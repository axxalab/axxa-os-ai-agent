// src/core/chatEngine.ts
// Motor de CHAT (stream): [Vault Q&A → busca híbrida no vault] → "Pensando…" →
// provider.streamChat → trata erro/abort. Sem React: recebe um `EngineCtx` e
// opera direto no store (src/store/chat.ts). Chamado pela ChatSession
// (src/core/session.ts). A lógica é a mesma do app antigo (useChatEngine).

import { useChatStore } from "../store/chat";
import type { getProvider } from "../providers";
import { providerNeedsKey, describeProviderError } from "./helpers";
import {
  resolveEffortConfig,
  effortToVaultLookup,
  effortToMaxTokensSmart,
} from "./effort";
import { getContextWindow } from "./contextWindows";
import { hybridSearch } from "../rag/hybrid";
import {
  buildChatSystemPrompt,
  storeMessagesToProvider,
} from "../agent/conversation";
import type { getTranslations } from "../i18n";
import type {
  MessageAttachment,
  NoteAttachment,
  ProviderMessage,
} from "../providers/base";
import type AxxaPlugin from "../main";

/** Ref mutável do AbortController do turno em andamento (null = ocioso). */
export interface AbortRef {
  current: AbortController | null;
}

/** Tudo que um turno precisa saber da sessão — montado pela ChatSession. */
export interface EngineCtx {
  plugin: AxxaPlugin;
  t: ReturnType<typeof getTranslations>;
  abortRef: AbortRef;
  activeProviderId: string;
  activeProvider: ReturnType<typeof getProvider>;
  activeModel: string;
  /** "chat" | "vault-qa" | "agent" */
  activeMode: string;
  apiKeyFor: (providerId: string) => string;
  effort: string;
  /** Instrução extra de estilo pro system prompt ("" = nenhuma). */
  resolveStyleInstruction: () => string;
}

/**
 * Um turno de chat: lê a história ATUAL do store (não captura via closure),
 * faz a busca no vault quando o modo é vault-qa, streama a resposta e
 * registra erros como mensagens `isError` (efêmeras — não persistem).
 * `userAttachments`: notas/imagens anexadas — notas viram bloco de contexto
 * no system prompt; o resto é filtrado por capability em storeMessagesToProvider.
 */
export async function streamReply(
  ctx: EngineCtx,
  userText: string,
  userAttachments?: MessageAttachment[]
): Promise<void> {
  const {
    plugin,
    t,
    abortRef,
    activeProviderId,
    activeProvider,
    activeModel,
    activeMode,
    apiKeyFor,
    effort,
    resolveStyleInstruction,
  } = ctx;
  const {
    addMessage,
    appendToMessage,
    updateActivity,
    setLoading,
    setStreamingMessageId,
    addUsage,
    startStreamTimer,
    tickStreamTokens,
    endStreamTimer,
  } = useChatStore.getState();

  // Pre-flight: sem API key não adianta nem mostrar "Pensando..." — emite
  // direto a bolha de erro acionável.
  if (
    providerNeedsKey(activeProviderId) &&
    !apiKeyFor(activeProviderId).trim()
  ) {
    addMessage({
      type: "ai-response",
      content: `${t.ai.errorPrefix} ${t.ai.err.noKey(activeProvider.name)}`,
      isError: true,
      errorCode: "no-key",
    });
    return;
  }

  // Config completo do effort atual (com overrides do usuário).
  const effortCfg = resolveEffortConfig(effort, plugin.settings.effortConfigs);

  // Modo Vault Q&A: busca notas relevantes ANTES da chamada. topK e
  // excerptChars escalam com o effort. Com índice RAG → híbrida (semântica +
  // keyword); sem índice → keyword puro. Nunca bloqueia o envio.
  let vaultContextBlock = "";
  if (activeMode === "vault-qa") {
    const { topK, excerptChars } = effortToVaultLookup(
      effort,
      plugin.settings.effortConfigs
    );

    const searchActivityId = addMessage({
      type: "ai-comment",
      content: "",
      activity: {
        phase: "pending",
        iconPending: "radar",
        iconDone: "check",
        pendingText: t.vault.searching(topK, effort),
        doneText: t.vault.searchDone,
      },
    });

    try {
      const hits = await hybridSearch({
        app: plugin.app,
        index: plugin.vectorIndex,
        creds: {
          openaiApiKey: plugin.settings.openaiApiKey,
          openrouterApiKey: plugin.settings.openrouterApiKey,
          geminiApiKey: plugin.settings.geminiApiKey,
          nimApiKey: plugin.settings.nimApiKey,
        },
        query: userText,
        topK,
        excerptChars,
      });
      if (hits.length > 0) {
        // Cabeçalho com o título CITÁVEL ([[basename]]) + path, pra IA citar a
        // fonte exata e o link abrir a nota no clique.
        vaultContextBlock = hits
          .map((h) => {
            const base =
              h.path.replace(/\.md$/i, "").split("/").pop() ?? h.path;
            return `### [[${base}]]\n_(${h.path})_\n\n${h.text}`;
          })
          .join("\n\n---\n\n");
        const semanticUsed = hits.some((h) => h.via.includes("semantic"));
        const hasIndex = !!plugin.vectorIndex && plugin.vectorIndex.size > 0;
        updateActivity(searchActivityId, {
          phase: "done",
          doneText: semanticUsed
            ? t.vault.foundContextSemantic(hits.length)
            : hasIndex
              ? t.vault.foundContextKeywordFallback(hits.length)
              : t.vault.foundContextKeyword(hits.length),
        });
      } else {
        updateActivity(searchActivityId, {
          phase: "done",
          iconDone: "circle-slash",
          doneText: t.vault.notFound,
        });
      }
    } catch (err) {
      console.error("[axxa] vault search falhou:", err);
      updateActivity(searchActivityId, {
        phase: "failed",
        iconFailed: "x-circle",
        failedText: `${t.ai.errorPrefix} ${err instanceof Error ? err.message : t.ai.unknownError}`,
      });
    }
  }

  // "Pensando..." — vira done quando o primeiro token chega.
  const commentId = addMessage({
    type: "ai-comment",
    content: "",
    activity: {
      phase: "pending",
      iconPending: "sparkles",
      iconDone: "check",
      pendingText: t.ai.thinking,
      doneText: t.ai.thinking,
    },
  });
  setLoading(true);

  const controller = new AbortController();
  abortRef.current = controller;

  let responseId: string | null = null;
  let reasoningBuf = "";

  try {
    // Notas anexadas viram bloco no system prompt (o LLM "vê" o conteúdo).
    let noteContextBlock = "";
    if (userAttachments) {
      const noteAtts = userAttachments.filter(
        (a): a is NoteAttachment => a.type === "note"
      );
      if (noteAtts.length > 0) {
        noteContextBlock =
          "\n\n[Notas anexadas pelo usuário]\n\n" +
          noteAtts
            .map((n) => `### ${n.path}\n\n${n.content}`)
            .join("\n\n---\n\n");
      }
    }
    const fullSystem = buildChatSystemPrompt({
      persona: useChatStore.getState().sessionPersona,
      base: t.systemPrompt.base,
      vaultSuffix: t.systemPrompt.vaultQaSuffix,
      vaultBlock: vaultContextBlock,
      noteBlock: noteContextBlock,
      styleInstruction: resolveStyleInstruction(),
    });
    const history: ProviderMessage[] = [
      { role: "system", content: fullSystem },
      ...storeMessagesToProvider(
        useChatStore.getState().messages,
        userAttachments
      ),
    ];

    const apiKey = apiKeyFor(activeProviderId);
    const maxTokens = effortToMaxTokensSmart(
      effort,
      getContextWindow(activeModel),
      plugin.settings.effortConfigs
    );
    let lastOutputTokens = 0;

    startStreamTimer();
    await activeProvider.streamChat(
      {
        model: activeModel,
        messages: history,
        maxTokens,
        temperature: effortCfg.temperature,
      },
      apiKey,
      (token) => {
        if (responseId === null) {
          updateActivity(commentId, { phase: "done" });
          responseId = addMessage({ type: "ai-response", content: token });
          setStreamingMessageId(responseId);
          // Flush do raciocínio bufferizado antes do 1º token de conteúdo.
          if (reasoningBuf) {
            useChatStore.getState().appendReasoning(responseId, reasoningBuf);
            reasoningBuf = "";
          }
        } else {
          appendToMessage(responseId, token);
        }
        tickStreamTokens(token);
      },
      (usage) => {
        lastOutputTokens = usage.output;
        addUsage(usage.input, usage.output);
      },
      controller.signal,
      (reasoningDelta) => {
        // Reasoning costuma vir ANTES do conteúdo (R1). Buffera até a
        // ai-response existir; depois acumula direto na mensagem.
        reasoningBuf += reasoningDelta;
        if (responseId !== null) {
          useChatStore.getState().appendReasoning(responseId, reasoningDelta);
        }
      }
    );
    endStreamTimer();

    // Heurística de truncamento: output ≈ teto de tokens → "Continuar".
    if (
      responseId !== null &&
      lastOutputTokens > 0 &&
      lastOutputTokens >= maxTokens * 0.95
    ) {
      useChatStore.getState().setTruncated(responseId, true);
    }

    if (responseId === null) {
      updateActivity(commentId, { phase: "done" });
      addMessage({ type: "ai-response", content: t.ai.emptyResponse });
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      if (responseId === null) {
        updateActivity(commentId, {
          phase: "failed",
          iconFailed: "circle-stop",
          failedText: t.ai.interrupted,
        });
      } else {
        // Stop com resposta PARCIAL: marca truncated.
        useChatStore.getState().setTruncated(responseId, true);
      }
    } else {
      if (responseId === null) {
        updateActivity(commentId, {
          phase: "failed",
          iconFailed: "x-circle",
          failedText: t.ai.failed,
        });
      }
      const { message, code } = describeProviderError(
        err,
        t,
        activeProvider.name
      );
      addMessage({
        type: "ai-response",
        content: `${t.ai.errorPrefix} ${message}`,
        isError: true,
        errorCode: code,
      });
    }
  } finally {
    setLoading(false);
    setStreamingMessageId(null);
    abortRef.current = null;
  }
}
