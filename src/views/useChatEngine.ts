// src/views/useChatEngine.ts
// Motor de CHAT (stream) extraído do AxxaApp (Frente 2 — base 1.0). streamReply:
// vault-search (Q&A) → "Pensando..." → provider.streamChat → trata erro/abort.
// Deps de UI/sessão via ctx; corpo movido VERBATIM (zero mudança de lógica).
// runAgentTurn entra aqui num próximo passo.

import { type MutableRefObject } from "react";
import { useChatStore } from "../store/chat";
import { getProvider } from "../providers";
import { providerNeedsKey, describeProviderError } from "./axxaApp.helpers";
import {
  resolveEffortConfig,
  effortToVaultLookup,
  effortToMaxTokensSmart,
} from "../components/_shared/effort";
import { getContextWindow } from "../components/_shared/contextWindows";
import { hybridSearch } from "../rag/hybrid";
import {
  buildChatSystemPrompt,
  storeMessagesToProvider,
} from "../agent/conversation";
import { getTranslations } from "../i18n";
import type { ProviderMessage } from "../providers/base";
import type AxxaPlugin from "../main";

interface ChatEngineCtx {
  plugin: AxxaPlugin;
  t: ReturnType<typeof getTranslations>;
  abortRef: MutableRefObject<AbortController | null>;
  activeProviderId: string;
  activeProvider: ReturnType<typeof getProvider>;
  activeModel: string;
  activeMode: string;
  apiKeyFor: (providerId: string) => string;
  effort: string;
  resolveStyleInstruction: () => string;
}

export function useChatEngine(ctx: ChatEngineCtx) {
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

  // streamReply: parte reusável do fluxo de envio — vault search → comment
  // "Pensando..." → streamChat → trata erro/abort.
  // Lê a história ATUAL do store (não captura via closure) pra funcionar
  // tanto no handleSend quanto no handleRegenerate (que mutou o array antes).
  // userAttachments: imagens anexadas pela UI — propagadas pra última msg user
  // do history quando o modelo suporta vision.
  const streamReply = async (
    userText: string,
    userAttachments?: import("../providers/base").MessageAttachment[]
  ) => {
    const {
      addMessage,
      removeMessage,
      appendToMessage,
      updateActivity,
      setLoading,
      setStreamingMessageId,
      setAgentSteps,
      addUsage,
      startStreamTimer,
      tickStreamTokens,
      endStreamTimer,
    } = useChatStore.getState();

    // Pre-flight cold-start: sem API key não adianta nem mostrar "Pensando..." —
    // emite direto a bolha de erro ACIONÁVEL (com "Abrir Configurações"). v0.1.147
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

    // Resolve config completo do effort atual (com overrides do usuário).
    // Centraliza todos os params escaláveis em um objeto só.
    const effortCfg = resolveEffortConfig(effort, plugin.settings.effortConfigs);

    // Modo Vault Q&A: busca notas relevantes ANTES da chamada
    // topK e excerptChars escalam com effort (low=3×300 ... max=12×2000)
    // Se índice RAG existe → busca semântica (cosine sim sobre embeddings).
    // Senão → fallback pra busca keyword (busca por título + ocorrências).
    let vaultContextBlock = "";
    if (activeMode === "vault-qa") {
      const { topK } = effortToVaultLookup(effort, plugin.settings.effortConfigs);

      // Activity de busca — pulsa enquanto procura, vira check com resumo
      const searchActivityId = addMessage({
        type: "ai-comment",
        content: "",
        activity: {
          phase: "pending",
          iconPending: "radar",
          iconDone: "check",
          pendingText: `Buscando até ${topK} trechos (híbrido)`,
          doneText: `Busca concluída`,
        },
      });

      try {
        // Busca híbrida: semantic (RAG) + keyword fundidos via RRF, re-rankeados
        // pelo grafo de links. Funciona com ou sem índice (cai pra keyword).
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
        });
        if (hits.length > 0) {
          // Cabeçalho com o título CITÁVEL ([[basename]]) + path de referência,
          // pra IA citar a fonte exata e o link abrir a nota no clique. v0.1.137
          vaultContextBlock = hits
            .map((h) => {
              const base = h.path.replace(/\.md$/i, "").split("/").pop() ?? h.path;
              return `### [[${base}]]\n_(${h.path})_\n\n${h.text}`;
            })
            .join("\n\n---\n\n");
          updateActivity(searchActivityId, {
            phase: "done",
            doneText: `${hits.length} trecho${hits.length > 1 ? "s" : ""} encontrado${hits.length > 1 ? "s" : ""}`,
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

    // Activity de "Pensando..." estilo Claude chat (sparkles pulsando).
    // Vira done quando o primeiro token chega (em vez de ser removido) —
    // mostra visualmente que o LLM começou a responder.
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
      // Inlina notes anexadas no system prompt — não vão pro wire visual,
      // mas o LLM "vê" o conteúdo das notas marcadas pra esta turn.
      let noteContextBlock = "";
      if (userAttachments) {
        const noteAtts = userAttachments.filter(
          (a): a is import("../providers/base").NoteAttachment =>
            a.type === "note"
        );
        if (noteAtts.length > 0) {
          noteContextBlock =
            "\n\n[Notas anexadas pelo usuário]\n\n" +
            noteAtts.map((n) => `### ${n.path}\n\n${n.content}`).join("\n\n---\n\n");
        }
      }
      // System prompt + history centralizados em agent/conversation.ts.
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
            // Primeiro token: marca "Pensando..." como done (ícone pop pra check)
            // em vez de remover — fica registrado na timeline da conversa.
            updateActivity(commentId, { phase: "done" });
            responseId = addMessage({ type: "ai-response", content: token });
            setStreamingMessageId(responseId);
            // Flush do raciocínio bufferizado antes do 1º token de conteúdo.
            // Limpa o buffer: a partir daqui os deltas vão direto pra mensagem.
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

      // Heurística de truncamento: se o output bateu ~o teto de tokens, a
      // resposta provavelmente foi cortada → habilita o botão "Continuar".
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
  };
  return { streamReply };
}
