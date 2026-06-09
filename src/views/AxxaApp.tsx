// src/views/AxxaApp.tsx
// Layout completo com session lock + starter screen + persistência de chats.
//
// Fluxo:
//   - Chat vazio → StarterScreen com provider/model/effort + Recent Chats
//   - Primeira msg → lockSession() + setCurrentChatId(uuid) + auto-save inicia
//   - Cada update em messages → auto-save debounced (500ms) no .axxa/chats/chat/[id].md
//   - "Nova conversa" no header → newChat() reseta tudo
//   - Click em chat recente → loadChat() reidrata mensagens + locked session

import { useEffect, useRef, useState } from "react";
import type AxxaPlugin from "../main";
import { Header } from "../components/layout/Header";
import { PersonaModal } from "../components/chat/PersonaModal";
import { ChatSearchModal } from "../components/chat/ChatSearchModal";
import { ChatArea } from "../components/chat/ChatArea";
import { Composer } from "../components/composer/Composer";
import { PlusModal } from "../components/composer/PlusModal";
import { StarterScreen } from "../components/chat/StarterScreen";
import { ConversationsList } from "../components/chat/ConversationsList";
import { AppContext } from "../components/_shared/AppContext";
import {
  ChatActionsContext,
  type ChatActions,
} from "../components/chat/ChatActionsContext";
import { TranslationsContext, getTranslations } from "../i18n";
import { useChatStore } from "../store/chat";
import { getProvider } from "../providers";
import { ProviderError, type ProviderMessage, type MessageAttachment } from "../providers/base";
import { getModelCapabilities, isGenerationModel } from "../providers/modelCapabilities";
import { checkCompatibility } from "../providers/compatibility";
import { IncompatibleBanner } from "../components/composer/IncompatibleBanner";
import { saveGeneration, type GenerationMediaType } from "../generation/save";
import {
  effortToMaxTokensSmart,
  effortToVaultLookup,
  resolveEffortConfig,
  type EffortLevel,
} from "../components/_shared/effort";
import { getContextWindow } from "../components/_shared/contextWindows";
import { useWakeLock } from "../components/_shared/useWakeLock";
import {
  saveChat,
  loadChat,
  listAllChats,
  renameChat,
  generateTitle,
  type ChatData,
  type ChatSummary,
} from "../components/_shared/chatPersistence";
import { Notice } from "obsidian";
import { ensureFolder } from "../components/_shared/chatPersistence";
import { hybridSearch } from "../rag/hybrid";
import type { AxxaCommand } from "../components/composer/completions";
import { TOOL_DEFINITIONS, getToolDefinition } from "../agent/toolSchemas";
import { TOOL_REGISTRY } from "../agent/tools";
import { evaluatePermission } from "../agent/permissions";
import { ConfirmationModal } from "../agent/ConfirmationModal";
import type { PermissionLevel } from "../agent/types";
import type { ChatMessage, UserMessage, AIResponseMessage } from "../store/chat";

interface AxxaAppProps {
  plugin: AxxaPlugin;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Spec de activity para cada tool — define ícone Lucide + textos pending/done
 * que aparecem na timeline estilo Claude Code.
 *
 * iconPending: ícone semântico que pulsa enquanto a tool roda
 * iconDone:    troca pra check com pop animation no fim (default global "check-circle-2")
 * pendingText: ação em gerúndio + path resumido
 * doneText:    ação no particípio + path resumido (sem "✓", o ícone faz isso)
 */
function agentActivitySpec(
  toolName: string,
  args: Record<string, unknown>
): {
  iconPending: string;
  iconDone: string;
  pendingText: string;
  doneText: string;
} {
  const path = String(args.path ?? args.from ?? args.folder ?? "");
  // Encurta path long pra cabe na timeline (mantém basename)
  const shortPath = path.length > 48 ? "…" + path.slice(-46) : path;

  switch (toolName) {
    case "vault_search":
      return {
        iconPending: "radar",
        iconDone: "search-check",
        pendingText: `Buscando "${String(args.query ?? "").slice(0, 40)}"`,
        doneText: `Buscou "${String(args.query ?? "").slice(0, 40)}"`,
      };
    case "vault_list":
      return {
        iconPending: "folder-search",
        iconDone: "folder-check",
        pendingText: `Listando ${shortPath || "raiz"}`,
        doneText: `Listou ${shortPath || "raiz"}`,
      };
    case "vault_read":
      return {
        iconPending: "eye",
        iconDone: "file-check-2",
        pendingText: `Lendo ${shortPath}`,
        doneText: `Leu ${shortPath}`,
      };
    case "vault_create":
      return {
        iconPending: "file-plus-2",
        iconDone: "file-check-2",
        pendingText: `Criando ${shortPath}`,
        doneText: `Criou ${shortPath}`,
      };
    case "vault_edit":
      return {
        iconPending: "file-pen-line",
        iconDone: "file-check-2",
        pendingText: `Editando ${shortPath}`,
        doneText: `Editou ${shortPath}`,
      };
    case "vault_move":
      return {
        iconPending: "move",
        iconDone: "check-circle-2",
        pendingText: `Movendo ${shortPath} → ${String(args.to ?? "?")}`,
        doneText: `Moveu ${shortPath} → ${String(args.to ?? "?")}`,
      };
    case "vault_delete":
      return {
        iconPending: "trash-2",
        iconDone: "circle-check-big",
        pendingText: `Deletando ${shortPath}`,
        doneText: `Deletou ${shortPath}`,
      };
    case "vault_create_folder":
      return {
        iconPending: "folder-plus",
        iconDone: "folder-check",
        pendingText: `Criando pasta ${shortPath}`,
        doneText: `Criou pasta ${shortPath}`,
      };
    default:
      return {
        iconPending: "wrench",
        iconDone: "check-circle-2",
        pendingText: `Executando ${toolName}`,
        doneText: `${toolName} concluído`,
      };
  }
}

/**
 * Extrai uma métrica curta do resultado de uma tool — usado como `content`
 * do ai-comment depois que vira "done". Exemplos:
 *   vault_list  → "8 itens"
 *   vault_read  → "1.2k chars"
 *   vault_edit  → "+12 chars" (tirado da string de retorno se possível)
 */
function summarizeToolResult(toolName: string, result: string): string {
  if (!result) return "";
  switch (toolName) {
    case "vault_list": {
      // Padrão: "Conteúdo de X (Y itens):"
      const m = /\((\d+)\s+itens?\)/.exec(result);
      return m ? `${m[1]} item${m[1] === "1" ? "" : "s"}` : "";
    }
    case "vault_read":
      return `${result.length >= 1000 ? (result.length / 1000).toFixed(1) + "k" : result.length} chars`;
    case "vault_create": {
      const m = /\((\d+)\s+chars\)/.exec(result);
      return m ? `${m[1]} chars` : "";
    }
    case "vault_edit": {
      const m = /\(([+-]\d+)\s+chars\)/.exec(result);
      return m ? `${m[1]} chars` : "";
    }
    default:
      return "";
  }
}

// Placeholder do composer varia pelo modo da sessão — feedback visual de
// que o "papel" do AXXA muda (assistente geral vs. focado no vault, etc.)
// Strings vêm do dicionário i18n (PT-BR / EN-US) — `t.composer.placeholderXxx`.
function placeholderForMode(
  mode: string,
  composer: {
    placeholderChat: string;
    placeholderVaultQa: string;
    placeholderAgent: string;
    placeholderCoder: string;
  }
): string {
  switch (mode) {
    case "vault-qa":
      return composer.placeholderVaultQa;
    case "agent":
      return composer.placeholderAgent;
    case "coder":
      return composer.placeholderCoder;
    default:
      return composer.placeholderChat;
  }
}

export function AxxaApp({ plugin }: AxxaAppProps) {
  // Subscreve a saveSettings — quando user troca idioma (ou qualquer setting
  // reativo) re-renderiza pegando os novos valores do plugin.settings.
  const [, forceRender] = useState(0);
  useEffect(() => {
    const unsub = plugin.onSettingsChange(() => forceRender((n) => n + 1));
    return unsub;
  }, [plugin]);

  // Fullscreen mobile (v0.1.74 reintro): toggle `axxa-fullscreen` no <body>
  // quando user ativa via menu "..." do Header. CSS escopado em
  // body.is-mobile.axxa-fullscreen faz o drawer ocupar 100vw + esconde
  // chrome nativo do Obsidian (drawer-header, tabs, footer).
  // theme-color OS + navbar tint já são geridos no AxxaView (não duplicar).
  useEffect(() => {
    const body = document.body;
    body.classList.toggle("axxa-fullscreen", plugin.settings.mobileFullscreen);
    return () => {
      // Limpa ao desmontar — volta o drawer ao layout normal do Obsidian
      body.classList.remove("axxa-fullscreen");
    };
  }, [plugin.settings.mobileFullscreen]);

  // Lê traduções na hora — atualiza no próximo render (após forceRender acima)
  const t = getTranslations(plugin.settings.language);

  const isLoading = useChatStore((s) => s.isLoading);
  const tokensIn = useChatStore((s) => s.tokensIn);
  const tokensOut = useChatStore((s) => s.tokensOut);
  const lastPromptTokens = useChatStore((s) => s.lastPromptTokens);
  const tokensPerSec = useChatStore((s) => s.tokensPerSec);
  const messages = useChatStore((s) => s.messages);
  const sessionProvider = useChatStore((s) => s.sessionProvider);
  const sessionModel = useChatStore((s) => s.sessionModel);
  const sessionMode = useChatStore((s) => s.sessionMode);
  const sessionPersona = useChatStore((s) => s.sessionPersona);
  const currentChatId = useChatStore((s) => s.currentChatId);
  const currentChatTitle = useChatStore((s) => s.currentChatTitle);
  const abortRef = useRef<AbortController | null>(null);

  // Mantém a tela ligada enquanto a IA gera (chat / agent / geração de mídia).
  // Evita que a tela apague por inatividade e congele o stream no mobile.
  useWakeLock(isLoading);

  // View state: chat (default) ou conversations (tela cheia de todas conversas)
  const [view, setView] = useState<"chat" | "conversations">("chat");
  // Busca dentro da conversa atual (toggle no Header → campo acima da ChatArea)
  // Alvo de destaque da busca (msg escolhida no modal). n = nonce p/ re-disparar.
  const [searchTarget, setSearchTarget] = useState<{
    id: string;
    n: number;
  } | null>(null);
  const [allChats, setAllChats] = useState<ChatSummary[]>([]);

  const [providerSel, setProviderSel] = useState(plugin.settings.defaultProvider);
  const [openaiModelSel, setOpenaiModelSel] = useState(plugin.settings.defaultModel);
  const [anthropicModelSel, setAnthropicModelSel] = useState(plugin.settings.anthropicModel);
  const [geminiModelSel, setGeminiModelSel] = useState(plugin.settings.geminiModel);
  const [openrouterModelSel, setOpenrouterModelSel] = useState(plugin.settings.openrouterModel);
  const [nimModelSel, setNimModelSel] = useState(plugin.settings.nimModel);
  const [ollamaModelSel, setOllamaModelSel] = useState(plugin.settings.ollamaModel);
  const [effort, setEffort] = useState(plugin.settings.defaultEffort);
  const [mode, setMode] = useState(
    plugin.settings.defaultMode === "vault-qa" ? "vault-qa" : "chat"
  );
  const [plusOpen, setPlusOpen] = useState(false);
  const [recentChats, setRecentChats] = useState<ChatSummary[]>([]);

  // Mapeia provider id → modelo correspondente
  const modelFor = (providerId: string): string => {
    switch (providerId) {
      case "anthropic": return anthropicModelSel;
      case "gemini": return geminiModelSel;
      case "openrouter": return openrouterModelSel;
      case "nim": return nimModelSel;
      case "ollama": return ollamaModelSel;
      default: return openaiModelSel;
    }
  };

  // Mapeia provider id → API key (centralizado pra um lugar só).
  // Pra Ollama, "apiKey" carrega o endpoint (provider trata como URL).
  const apiKeyFor = (providerId: string): string => {
    switch (providerId) {
      case "anthropic": return plugin.settings.anthropicApiKey;
      case "gemini": return plugin.settings.geminiApiKey;
      case "openrouter": return plugin.settings.openrouterApiKey;
      case "nim": return plugin.settings.nimApiKey;
      case "ollama": return plugin.settings.ollamaEndpoint;
      default: return plugin.settings.openaiApiKey;
    }
  };

  const activeProviderId = sessionProvider ?? providerSel;
  const activeProvider = getProvider(activeProviderId);
  const activeModel = sessionModel ?? modelFor(activeProviderId);
  const activeMode = sessionMode ?? mode;
  const isLocked = sessionProvider !== null;

  const starterModel = modelFor(providerSel);

  // ============================================================
  // Carrega lista de chats recentes (todos os modos) quando chat tá vazio
  // ============================================================
  const isEmpty = messages.length === 0;
  useEffect(() => {
    if (!isEmpty) return;
    listAllChats(plugin.app, plugin.settings.chatsPath, 8)
      .then(setRecentChats)
      .catch((err) => {
        console.error("[axxa] listAllChats falhou:", err);
        setRecentChats([]);
      });
  }, [isEmpty, plugin.app, plugin.settings.chatsPath]);

  // ============================================================
  // Auto-save debounced — escreve .axxa/chats/chat/[id].md
  // ============================================================
  useEffect(() => {
    if (messages.length === 0) return;
    if (!currentChatId) return;
    const timer = window.setTimeout(() => {
      const userOrAi = messages.filter(
        (m): m is UserMessage | AIResponseMessage =>
          m.type === "user" ||
          // Erros (isError) não são persistidos — são efêmeros por design
          (m.type === "ai-response" && !m.isError)
      );
      if (userOrAi.length === 0) return;
      const chat: ChatData = {
        id: currentChatId,
        title: currentChatTitle || generateTitle(userOrAi[0].content),
        date: new Date().toISOString(),
        mode: activeMode,
        provider: activeProviderId,
        model: activeModel,
        effort,
        tokensIn,
        tokensOut,
        persona: useChatStore.getState().sessionPersona || undefined,
        messages: userOrAi.map((m) => ({
          type: m.type as "user" | "ai-response",
          content: m.content,
          timestamp: m.timestamp,
          // Persiste reaction quando ai-response (like/dislike sobrevive reload)
          ...(m.type === "ai-response" && (m as AIResponseMessage).reaction
            ? { reaction: (m as AIResponseMessage).reaction }
            : {}),
        })),
      };
      saveChat(plugin.app, plugin.settings.chatsPath, chat).catch((err) =>
        console.error("[axxa] saveChat falhou:", err)
      );
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    messages,
    currentChatId,
    currentChatTitle,
    activeProviderId,
    activeModel,
    effort,
    tokensIn,
    tokensOut,
    sessionPersona,
    plugin.app,
    plugin.settings.chatsPath,
  ]);

  // ============================================================
  // Handlers
  // ============================================================

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
      addUsage,
      startStreamTimer,
      tickStreamTokens,
      endStreamTimer,
    } = useChatStore.getState();

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
          vaultContextBlock = hits
            .map((h) => `### ${h.path}\n\n${h.text}`)
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
      // Persona custom do chat (se definida) substitui o system prompt base.
      const personaBase = useChatStore.getState().sessionPersona.trim();
      const fullSystem =
        (personaBase || t.systemPrompt.base) +
        (vaultContextBlock.length > 0
          ? t.systemPrompt.vaultQaSuffix + vaultContextBlock
          : "") +
        noteContextBlock;

      // Pega só user/assistant do store. Última user msg ganha attachments
      // multimodais se foram passados pra essa chamada.
      const storeMsgs = useChatStore
        .getState()
        .messages.filter(
          (m) =>
            m.type === "user" || (m.type === "ai-response" && !m.isError)
        );
      const historyConverted: ProviderMessage[] = storeMsgs.map((m, idx) => {
        const base = {
          role: (m.type === "user" ? "user" : "assistant") as "user" | "assistant",
          content: (m as { content: string }).content,
        };
        const isLastUser =
          idx === storeMsgs.length - 1 && m.type === "user";
        if (isLastUser && userAttachments && userAttachments.length > 0) {
          return { ...base, attachments: userAttachments };
        }
        return base;
      });
      const history: ProviderMessage[] = [
        { role: "system", content: fullSystem },
        ...historyConverted,
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
          } else {
            appendToMessage(responseId, token);
          }
          tickStreamTokens(token);
        },
        (usage) => {
          lastOutputTokens = usage.output;
          addUsage(usage.input, usage.output);
        },
        controller.signal
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
            failedText: "Interrompido",
          });
        }
      } else {
        if (responseId === null) {
          updateActivity(commentId, {
            phase: "failed",
            iconFailed: "x-circle",
            failedText: "Falhou",
          });
        }
        const errorMsg =
          err instanceof ProviderError
            ? err.message
            : err instanceof Error
              ? err.message
              : t.ai.unknownError;
        addMessage({
          type: "ai-response",
          content: `${t.ai.errorPrefix} ${errorMsg}`,
          isError: true,
        });
      }
    } finally {
      setLoading(false);
      setStreamingMessageId(null);
      abortRef.current = null;
    }
  };

  // ============================================================
  // Agent loop — STREAMING + tool calls (v0.1.40)
  //
  // Flow:
  //   1. Monta history com system prompt + tools disponíveis
  //   2. Chama provider.streamChat() pra cada turno — tokens vêm via onToken
  //      e alimentam um ai-response message (sticky-bottom scroll funciona)
  //   3. Retorno do streamChat tem o estado final (text + tool_calls + usage)
  //   4. Se tem toolCalls: pra cada uma → check permission → executa
  //   5. Loop até resposta sem tools (final answer)
  //
  // Por que streaming agora?
  //   - User vê os tokens chegando (igual chat mode)
  //   - Token/s metric funciona
  //   - Sticky-bottom scroll triggered por updates de message
  //   - Provider sem streaming real (NIM) cai num pseudo-stream que ainda
  //     emite onToken — UX consistente
  // ============================================================
  const runAgentTurn = async (
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
      addUsage,
      startStreamTimer,
      tickStreamTokens,
      endStreamTimer,
    } = useChatStore.getState();

    if (!activeProvider.supportsTools) {
      addMessage({
        type: "ai-response",
        content: `${t.ai.errorPrefix} O provider "${activeProvider.name}" não suporta tool calling. Use OpenAI (que tem function calling) pro Agent Mode.`,
      });
      return;
    }

    setLoading(true);
    // Activity inicial "Pensando" — pulsa enquanto LLM processa, vira check
    // quando o stream começa (primeiro token).
    const commentId = addMessage({
      type: "ai-comment",
      content: "",
      activity: {
        phase: "pending",
        iconPending: "sparkles",
        iconDone: "check",
        pendingText: t.agent.thinking,
        doneText: t.agent.thinking,
      },
    });

    const permissionLevel: PermissionLevel = (plugin.settings.agentPermissionLevel ||
      "ask") as PermissionLevel;

    // Config do effort atual — agentMaxTurns, retry, loop detection, etc.
    const effortCfg = resolveEffortConfig(effort, plugin.settings.effortConfigs);

    // System prompt específico do agent — reforça uso eficiente das tools
    // e atitude "incansável" pra effort alto (não desiste em max).
    const agentPersona = useChatStore.getState().sessionPersona.trim();
    const AGENT_SYSTEM_PROMPT =
      (agentPersona ? agentPersona + "\n\n" : "") + t.agent.systemPrompt;

    // Constrói history inicial — pega só user/assistant do store (chat anterior).
    // Última user msg recebe attachments multimodais se vieram.
    const storeMsgs = useChatStore
      .getState()
      .messages.filter(
        (m) => m.type === "user" || (m.type === "ai-response" && !m.isError)
      );
    const conversationHistory: ProviderMessage[] = storeMsgs.map((m, idx) => {
      const isLastUser =
        idx === storeMsgs.length - 1 && m.type === "user";
      const base = {
        role: (m.type === "user" ? "user" : "assistant") as "user" | "assistant",
        content: (m as { content: string }).content,
      };
      if (isLastUser && userAttachments && userAttachments.length > 0) {
        return { ...base, attachments: userAttachments };
      }
      return base;
    });

    const history: ProviderMessage[] = [
      { role: "system", content: AGENT_SYSTEM_PROMPT },
      ...conversationHistory,
    ];

    const tools = TOOL_DEFINITIONS.map((td) => ({
      name: td.name,
      description: td.description,
      parameters: td.parameters,
    }));

    const apiKey = apiKeyFor(activeProviderId);

    // MAX_TURNS agora vem do effort config — low=5, med=12, high=25,
    // xhigh=60, max=200. User pode override via Settings → Effort.
    // 0 = uncapped (loop detection é o único limite).
    const MAX_TURNS = effortCfg.agentMaxTurns;
    const isUncapped = MAX_TURNS === 0;
    // Loop detection: guarda assinatura das últimas N tool calls pra detectar
    // o LLM ficar batendo a mesma chamada em loop infinito. Quando detecta,
    // injeta uma msg "tool" forçada pedindo pra mudar de estratégia.
    const loopWindow = effortCfg.loopDetectionWindow;
    const recentCallSignatures: string[] = [];
    const makeSignature = (name: string, args: Record<string, unknown>) =>
      `${name}::${JSON.stringify(args)}`;

    let turn = 0;
    let firstTurn = true;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      while (isUncapped || turn < MAX_TURNS) {
        turn++;

        // Cria msg ai-response que vai ser preenchida token-a-token.
        // Cada turno é um message separado pra ficar claro qual tokens
        // pertencem a qual round de tool execution.
        let responseId: string | null = null;
        const onToken = (token: string) => {
          if (responseId === null) {
            // Primeiro token do primeiro turno: marca a activity de "Pensando"
            // como done (ícone vira check com pop animation) e inicia a resposta.
            if (firstTurn) {
              updateActivity(commentId, { phase: "done" });
              firstTurn = false;
            }
            responseId = addMessage({ type: "ai-response", content: token });
            setStreamingMessageId(responseId);
          } else {
            appendToMessage(responseId, token);
          }
          tickStreamTokens(token);
        };

        startStreamTimer();
        const response = await activeProvider.streamChat(
          {
            model: activeModel,
            messages: history,
            maxTokens: effortToMaxTokensSmart(
              effort,
              getContextWindow(activeModel),
              plugin.settings.effortConfigs
            ),
            temperature: effortCfg.temperature,
            tools,
          },
          apiKey,
          onToken,
          (usage) => addUsage(usage.input, usage.output),
          controller.signal
        );
        endStreamTimer();
        setStreamingMessageId(null);

        // Caso 1: stream terminou sem tool_calls = resposta final
        if (!response.toolCalls || response.toolCalls.length === 0) {
          // Se não veio nem um token (raro), insere uma resposta vazia
          if (responseId === null) {
            if (firstTurn) {
              updateActivity(commentId, { phase: "done" });
              firstTurn = false;
            }
            addMessage({
              type: "ai-response",
              content: response.content || t.ai.emptyResponse,
            });
          }
          return;
        }

        // Caso 2: tool_calls — finaliza mensagem do turno (se já criada) e
        // adiciona msg do assistant na history pra próximo loop.
        if (firstTurn) {
          updateActivity(commentId, { phase: "done" });
          firstTurn = false;
        }
        history.push({
          role: "assistant",
          content: response.content ?? "",
          toolCalls: response.toolCalls,
        });

        // Loop detection: assinatura = name + JSON(args). Se a mesma assinatura
        // aparecer `loopWindow` vezes consecutivas, injetamos um nudge na
        // history e cortamos o loop. Evita o LLM "ficar girando" sem entender
        // que tá repetindo a mesma chamada que já falhou.
        let loopDetected = false;
        if (loopWindow > 0) {
          for (const call of response.toolCalls) {
            recentCallSignatures.push(makeSignature(call.name, call.arguments));
          }
          // Mantém só as últimas N×2 entries (gasta pouca memória)
          if (recentCallSignatures.length > loopWindow * 4) {
            recentCallSignatures.splice(
              0,
              recentCallSignatures.length - loopWindow * 4
            );
          }
          const lastN = recentCallSignatures.slice(-loopWindow);
          if (lastN.length === loopWindow && lastN.every((s) => s === lastN[0])) {
            loopDetected = true;
          }
        }

        // Executa as tool calls — em paralelo se effort permite e há >1 call,
        // senão sequencial. Modais de confirmação são SEMPRE sequenciais
        // (não dá pra abrir 2 ConfirmationModal ao mesmo tempo).
        type CallResult = {
          callId: string;
          content: string;
          activityId: string;
          spec: ReturnType<typeof agentActivitySpec>;
          meta: string;
          ok: boolean;
        };

        // Pre-check de permissão (sequencial) e cria placeholders de activity.
        // Isso garante que o usuário vê os modais um por vez e a ordem do
        // resultado preserva a ordem em que o LLM pediu.
        const preparedCalls: Array<{
          call: typeof response.toolCalls[number];
          def: ReturnType<typeof getToolDefinition>;
          approved: boolean;
          activityId: string;
          spec: ReturnType<typeof agentActivitySpec>;
        }> = [];
        for (const call of response.toolCalls) {
          const def = getToolDefinition(call.name);
          if (!def) {
            addMessage({
              type: "ai-comment",
              content: "",
              activity: {
                phase: "failed",
                iconPending: "wrench",
                iconFailed: "alert-triangle",
                pendingText: `Tool desconhecida: ${call.name}`,
                failedText: `Tool desconhecida: ${call.name}`,
              },
            });
            history.push({
              role: "tool",
              toolCallId: call.id,
              content: `Tool "${call.name}" não existe. Use uma das tools disponíveis.`,
            });
            continue;
          }

          const decision = evaluatePermission(def, permissionLevel);
          let approved = decision.autoApprove;
          if (!approved) {
            const modal = new ConfirmationModal(plugin.app, {
              toolCall: call,
              definition: def,
            });
            approved = await modal.openAndWait();
          }

          if (!approved) {
            addMessage({
              type: "ai-comment",
              content: "",
              activity: {
                phase: "failed",
                iconPending: "shield",
                iconFailed: "ban",
                pendingText: `Negado: ${call.name}`,
                failedText: `Negado: ${call.name}`,
              },
            });
            history.push({
              role: "tool",
              toolCallId: call.id,
              content:
                "User negou esta ação. NÃO tente repetir essa mesma chamada — considere outra abordagem ou pergunte ao user.",
            });
            continue;
          }

          const spec = agentActivitySpec(call.name, call.arguments);
          const activityId = addMessage({
            type: "ai-comment",
            content: "",
            activity: {
              phase: "pending",
              iconPending: spec.iconPending,
              iconDone: spec.iconDone,
              pendingText: spec.pendingText,
              doneText: spec.doneText,
            },
          });
          preparedCalls.push({ call, def, approved, activityId, spec });
        }

        // Executor com retry pra cada call individual.
        const execCall = async (
          prep: (typeof preparedCalls)[number]
        ): Promise<CallResult> => {
          const { call, activityId, spec } = prep;
          const executor = TOOL_REGISTRY[call.name];
          const maxAttempts = 1 + Math.max(0, effortCfg.toolRetryOnError);
          let lastErr: unknown = null;
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              const result = await executor(
                {
                  app: plugin.app,
                  vectorIndex: plugin.vectorIndex,
                  embed: {
                    openaiApiKey: plugin.settings.openaiApiKey,
                    openrouterApiKey: plugin.settings.openrouterApiKey,
                    geminiApiKey: plugin.settings.geminiApiKey,
                    nimApiKey: plugin.settings.nimApiKey,
                  },
                },
                call.arguments
              );
              const meta = summarizeToolResult(call.name, result);
              updateActivity(activityId, { phase: "done" }, meta);
              return {
                callId: call.id,
                content: result,
                activityId,
                spec,
                meta,
                ok: true,
              };
            } catch (err) {
              lastErr = err;
              // Só retenta erros transitórios (network / fs lock). Path errado
              // ou arg inválido não vão dar certo no retry — cai direto.
              const msg =
                err instanceof Error ? err.message.toLowerCase() : "";
              const isTransient =
                msg.includes("network") ||
                msg.includes("timeout") ||
                msg.includes("locked") ||
                msg.includes("busy");
              if (!isTransient || attempt === maxAttempts) break;
            }
          }
          const msg =
            lastErr instanceof Error ? lastErr.message : "Erro desconhecido.";
          updateActivity(
            activityId,
            {
              phase: "failed",
              iconFailed: "x-circle",
              failedText: spec.pendingText.replace(
                /^(Lendo|Editando|Criando|Movendo|Deletando|Listando|Executando)/,
                "Falhou em"
              ),
            },
            msg
          );
          return {
            callId: call.id,
            content: `ERRO: ${msg}. NÃO repita essa mesma chamada — ajuste path/args ou tente outra abordagem.`,
            activityId,
            spec,
            meta: "",
            ok: false,
          };
        };

        let results: CallResult[];
        if (effortCfg.parallelToolCalls && preparedCalls.length > 1) {
          // Paralelo: roda todas ao mesmo tempo, espera todas terminarem.
          // Cada call já tem seu próprio activity, não há disputa de UI.
          results = await Promise.all(preparedCalls.map(execCall));
        } else {
          results = [];
          for (const prep of preparedCalls) {
            results.push(await execCall(prep));
          }
        }
        for (const r of results) {
          history.push({
            role: "tool",
            toolCallId: r.callId,
            content: r.content,
          });
        }

        // Se detectou loop, injeta nudge pro LLM e segue um turn — se ele
        // insistir, dá outro turn e o próximo check vai cortar denovo.
        // Se o loop for muito persistente (3 nudges seguidos), aborta de vez.
        if (loopDetected) {
          history.push({
            role: "user",
            content:
              "⚠️ Detectei que você repetiu a mesma tool call exata várias vezes. " +
              "Isso indica que sua abordagem atual não está funcionando. " +
              "PARE de repetir, RECONSIDERE a estratégia (talvez você precise " +
              "de informação adicional — tente vault_list/vault_read em outro path) " +
              "OU pergunte ao usuário pra ele esclarecer. Não repita a mesma chamada.",
          });
          addMessage({
            type: "ai-comment",
            content: "",
            activity: {
              phase: "failed",
              iconPending: "rotate-cw",
              iconFailed: "alert-triangle",
              pendingText: "Loop detectado — pedindo reconsideração",
              failedText: "Loop detectado — pedi reconsideração ao agent",
            },
          });
          // Limpa o histórico de assinaturas pra dar chance limpa ao retry
          recentCallSignatures.length = 0;
        }
      }
      addMessage({
        type: "ai-response",
        content: t.agent.maxTurnsReached(MAX_TURNS),
      });
    } catch (err) {
      if (firstTurn) {
        // Em caso de erro antes do primeiro token, marca o "Pensando..." como
        // failed (ícone vira X) em vez de remover — dá feedback claro do que aconteceu.
        if (err instanceof DOMException && err.name === "AbortError") {
          updateActivity(commentId, {
            phase: "failed",
            iconFailed: "circle-stop",
            failedText: "Interrompido",
          });
        } else {
          updateActivity(commentId, {
            phase: "failed",
            iconFailed: "x-circle",
            failedText: "Falhou",
          });
        }
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        // Abort silencioso — usuário clicou em parar
      } else {
        const errorMsg =
          err instanceof ProviderError
            ? err.message
            : err instanceof Error
              ? err.message
              : t.ai.unknownError;
        addMessage({
          type: "ai-response",
          content: `${t.ai.errorPrefix} ${errorMsg}`,
          isError: true,
        });
      }
    } finally {
      setLoading(false);
      setStreamingMessageId(null);
      endStreamTimer();
      abortRef.current = null;
    }
  };

  // Anexos pendentes (multi-tipo) — limpa após envio.
  // Cada attachment ganha id estável pra UI tracking — não persiste no .md.
  interface PendingAttachmentEntry {
    id: string;
    attachment: MessageAttachment;
    name: string;
  }
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachmentEntry[]>([]);
  const makeAttachmentId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Toggles do PlusModal (webSearch, createImage, extendedThinking) — estado
  // local. Cada provider/modelo decide se respeita. Persistência é da sessão.
  const [plusToggles, setPlusToggles] = useState<Record<string, boolean>>({});

  // Dismissed banner state — chave = `${mode}::${provider}::${model}` pra
  // reaparecer se user mudar qualquer um dos 3. Sessão only.
  const [dismissedBannerKey, setDismissedBannerKey] = useState<string | null>(null);

  // Compatibilidade ATUAL do combo modo+provider+modelo+anexos.
  // Recomputado a cada render (cheap — só checa flags). null se não há issue.
  const activeModelsList =
    plugin.settings.activeModels?.[activeProviderId] ?? [];
  const hasImageAttachment = pendingAttachments.some(
    (p) => p.attachment.type === "image"
  );
  const compatibility = checkCompatibility(
    activeMode,
    activeProviderId,
    activeModel,
    activeModelsList,
    hasImageAttachment
  );
  const bannerKey = `${activeMode}::${activeProviderId}::${activeModel}`;
  const showBanner = !compatibility.ok && dismissedBannerKey !== bannerKey;

  const handleSend = async (text: string) => {
    const { addMessage, lockSession, setCurrentChatId, setCurrentChatTitle } =
      useChatStore.getState();

    // Primeira msg da sessão → cria chat ID, gera título, trava session
    if (messages.length === 0) {
      const newId = makeId();
      setCurrentChatId(newId);
      setCurrentChatTitle(generateTitle(text));
      lockSession(activeProviderId, activeModel, activeMode);
    }

    // Prepara attachments pra envio. Filtros aplicados em streamReply/runAgentTurn:
    //  - imagens só vão se o modelo aceita vision
    //  - notas viram bloco de contexto markdown no system prompt
    //  - pdf/audio passam como meta (ignorados no wire por enquanto)
    const caps = getModelCapabilities(activeProviderId, activeModel);
    const attachments =
      pendingAttachments.length > 0
        ? pendingAttachments
            .map((p) => p.attachment)
            .filter((a) => (a.type === "image" ? caps.vision : true))
        : undefined;

    // User msg salva sem attachments no store (pra simplicidade do auto-save .md).
    // O propagation pro provider acontece via parâmetro adicional pra streamReply/runAgentTurn.
    addMessage({ type: "user", content: text });
    setPendingAttachments([]);

    // Se o modelo ativo é de generation (imageGen/audioGen/videoGen), roteia
    // pra runGenerationTurn em vez de chat — gera mídia + salva no vault.
    if (isGenerationModel(caps)) {
      await runGenerationTurn(text, caps);
      return;
    }

    // Dispatch baseado no modo: agent usa loop com tools, demais usa streamReply
    if (activeMode === "agent") {
      await runAgentTurn(text, attachments);
    } else {
      await streamReply(text, attachments);
    }
  };

  // ============================================================
  // Generation turn — chama generateImage/Audio/Video conforme as caps
  // do modelo, salva o resultado em axxa-ai/generation/{type}/ + sidecar .md
  // com frontmatter, e renderiza a mídia inline na conversa.
  // ============================================================
  const runGenerationTurn = async (
    prompt: string,
    caps: ReturnType<typeof getModelCapabilities>
  ) => {
    const {
      addMessage,
      updateActivity,
      setLoading,
      newChat,
    } = useChatStore.getState();
    void newChat;

    setLoading(true);
    const mediaType: GenerationMediaType = caps.imageGen
      ? "image"
      : caps.audioGen
        ? "audio"
        : "video";

    const activityId = addMessage({
      type: "ai-comment",
      content: "",
      activity: {
        phase: "pending",
        iconPending: mediaType === "image" ? "image-plus" : mediaType === "audio" ? "volume-2" : "video",
        iconDone: "check",
        pendingText: mediaType === "image"
          ? "Gerando imagem..."
          : mediaType === "audio"
            ? "Gerando áudio..."
            : "Gerando vídeo...",
        doneText: "",
      },
    });

    try {
      const provider = activeProvider;
      const apiKey = apiKeyFor(activeProviderId);
      let items;
      if (mediaType === "image") {
        if (!provider.generateImage) {
          throw new Error(`Provider "${provider.name}" não implementa generateImage.`);
        }
        items = await provider.generateImage(
          { model: activeModel, prompt, size: "1024x1024" },
          apiKey
        );
      } else if (mediaType === "audio") {
        if (!provider.generateAudio) {
          throw new Error(`Provider "${provider.name}" não implementa generateAudio.`);
        }
        items = await provider.generateAudio(
          { model: activeModel, prompt },
          apiKey
        );
      } else {
        if (!provider.generateVideo) {
          throw new Error(`Provider "${provider.name}" não implementa generateVideo.`);
        }
        items = await provider.generateVideo(
          { model: activeModel, prompt },
          apiKey
        );
      }

      // Salva cada item gerado no vault com sidecar de metadata
      const savedPaths: string[] = [];
      for (const item of items) {
        const result = await saveGeneration(
          plugin.app,
          plugin.settings.generationPath,
          item.data,
          {
            id: makeId(),
            type: mediaType,
            provider: activeProviderId,
            model: activeModel,
            prompt,
            created: new Date().toISOString(),
            size: item.data.byteLength,
            mime: item.mime,
            width: item.width,
            height: item.height,
            duration: item.duration,
            seed: item.seed,
            chatId: useChatStore.getState().currentChatId ?? undefined,
          }
        );
        savedPaths.push(result.mediaPath);
      }

      updateActivity(
        activityId,
        {
          phase: "done",
          doneText: `${items.length} ${mediaType === "image" ? "imagem" : mediaType === "audio" ? "áudio" : "vídeo"}${items.length > 1 ? "s" : ""} gerado${items.length > 1 ? "s" : ""}`,
        },
        savedPaths[0]
      );

      // Resposta com wikilinks pra cada mídia salva (renderizado como embed pelo Obsidian)
      const responseContent = savedPaths
        .map((p) => mediaType === "image" ? `![[${p}]]` : `[[${p}]]`)
        .join("\n\n");
      addMessage({ type: "ai-response", content: responseContent });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido.";
      updateActivity(
        activityId,
        {
          phase: "failed",
          iconFailed: "x-circle",
          failedText: "Falha na geração",
        },
        msg
      );
      addMessage({ type: "ai-response", content: `${t.ai.errorPrefix} ${msg}` });
    } finally {
      setLoading(false);
    }
  };

  // Regenerar: remove o ai-response (e qualquer msg posterior) e re-roda
  // streamReply usando a user-msg que precedia. Ignora se já tá streamando.
  // Regenerar com BRANCHING: a resposta atual vira uma variante e a nova é
  // gerada NA MESMA bolha — o user navega entre versões com ‹ N/M ›.
  const handleRegenerate = async (aiMessageId: string) => {
    if (useChatStore.getState().isLoading) return;
    const current = useChatStore.getState().messages;
    const aiIdx = current.findIndex(
      (m) => m.id === aiMessageId && m.type === "ai-response"
    );
    if (aiIdx < 0) return;

    // Remove só o que vem DEPOIS da resposta — a bolha fica e vira variante.
    useChatStore.getState().setMessages(current.slice(0, aiIdx + 1));

    const {
      beginVariant,
      syncVariant,
      appendToMessage,
      setLoading,
      setStreamingMessageId,
      addUsage,
      startStreamTimer,
      tickStreamTokens,
      endStreamTimer,
    } = useChatStore.getState();

    // History = tudo ANTES da resposta sendo regenerada (sem erros).
    const before = current
      .slice(0, aiIdx)
      .filter(
        (m) => m.type === "user" || (m.type === "ai-response" && !m.isError)
      ) as Array<UserMessage | AIResponseMessage>;
    const personaBase = useChatStore.getState().sessionPersona.trim();
    const history: ProviderMessage[] = [
      { role: "system", content: personaBase || t.systemPrompt.base },
      ...before.map((m) => ({
        role: (m.type === "user" ? "user" : "assistant") as
          | "user"
          | "assistant",
        content: m.content,
      })),
    ];

    beginVariant(aiMessageId); // arquiva a versão atual + abre variante vazia
    setLoading(true);
    setStreamingMessageId(aiMessageId);
    const effortCfg = resolveEffortConfig(effort, plugin.settings.effortConfigs);
    const maxTokens = effortToMaxTokensSmart(
      effort,
      getContextWindow(activeModel),
      plugin.settings.effortConfigs
    );
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      startStreamTimer();
      await activeProvider.streamChat(
        {
          model: activeModel,
          messages: history,
          maxTokens,
          temperature: effortCfg.temperature,
        },
        apiKeyFor(activeProviderId),
        (token) => {
          appendToMessage(aiMessageId, token);
          tickStreamTokens(token);
        },
        (usage) => addUsage(usage.input, usage.output),
        controller.signal
      );
      endStreamTimer();
      syncVariant(aiMessageId);
    } catch (err) {
      syncVariant(aiMessageId);
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.error("[axxa] regenerar falhou:", err);
        new Notice(
          `${t.ai.errorPrefix} ${err instanceof Error ? err.message : t.ai.unknownError}`
        );
      }
    } finally {
      setLoading(false);
      setStreamingMessageId(null);
      endStreamTimer();
      abortRef.current = null;
    }
  };

  // Continuar: emenda uma resposta cortada no limite de tokens NA MESMA bolha.
  // Manda o history até a resposta + um nudge "continue de onde parou" e
  // appenda os novos tokens à mesma ai-response (não cria bolha nova).
  const continueReply = async (aiMessageId: string) => {
    const snapshot = useChatStore.getState();
    if (snapshot.isLoading) return;
    const msgs = snapshot.messages;
    const idx = msgs.findIndex(
      (m) => m.id === aiMessageId && m.type === "ai-response"
    );
    if (idx < 0) return;

    const {
      appendToMessage,
      setTruncated,
      setLoading,
      setStreamingMessageId,
      addUsage,
      startStreamTimer,
      tickStreamTokens,
      endStreamTimer,
    } = useChatStore.getState();

    setTruncated(aiMessageId, false);
    setLoading(true);
    setStreamingMessageId(aiMessageId);

    const hist = msgs
      .slice(0, idx + 1)
      .filter(
        (m) => m.type === "user" || (m.type === "ai-response" && !m.isError)
      ) as Array<UserMessage | AIResponseMessage>;
    const history: ProviderMessage[] = [
      { role: "system", content: t.systemPrompt.base },
      ...hist.map((m) => ({
        role: (m.type === "user" ? "user" : "assistant") as
          | "user"
          | "assistant",
        content: m.content,
      })),
      {
        role: "user",
        content:
          "Continue EXATAMENTE de onde você parou, sem repetir nem reintroduzir o que já escreveu.",
      },
    ];

    const effortCfg = resolveEffortConfig(effort, plugin.settings.effortConfigs);
    const maxTokens = effortToMaxTokensSmart(
      effort,
      getContextWindow(activeModel),
      plugin.settings.effortConfigs
    );
    let lastOutputTokens = 0;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Emenda um espaço antes pra não colar a continuação na última palavra
      appendToMessage(aiMessageId, " ");
      startStreamTimer();
      await activeProvider.streamChat(
        {
          model: activeModel,
          messages: history,
          maxTokens,
          temperature: effortCfg.temperature,
        },
        apiKeyFor(activeProviderId),
        (token) => {
          appendToMessage(aiMessageId, token);
          tickStreamTokens(token);
        },
        (usage) => {
          lastOutputTokens = usage.output;
          addUsage(usage.input, usage.output);
        },
        controller.signal
      );
      endStreamTimer();
      // Cortou de novo? Mantém o botão pra continuar mais uma vez.
      if (lastOutputTokens > 0 && lastOutputTokens >= maxTokens * 0.95) {
        setTruncated(aiMessageId, true);
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.error("[axxa] continue falhou:", err);
        new Notice(
          `${t.ai.errorPrefix} ${err instanceof Error ? err.message : t.ai.unknownError}`
        );
        // Deixa o botão disponível pra tentar de novo
        setTruncated(aiMessageId, true);
      }
    } finally {
      setLoading(false);
      setStreamingMessageId(null);
      endStreamTimer();
      abortRef.current = null;
    }
  };

  // Deletar: remove msg. Se for user-msg, remove também o ai-response
  // imediatamente a seguir (manter o par alinhado).
  const handleDeleteMessage = (messageId: string) => {
    const current = useChatStore.getState().messages;
    const idx = current.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    const msg = current[idx];
    if (msg.type === "user") {
      const next = current[idx + 1];
      if (next && next.type === "ai-response") {
        useChatStore
          .getState()
          .setMessages([...current.slice(0, idx), ...current.slice(idx + 2)]);
        return;
      }
    }
    useChatStore.getState().removeMessage(messageId);
  };

  // Editar: trunca a conversa a partir da user-msg editada e re-envia o texto
  // novo (gera resposta nova). Mesmo dispatch do handleSend (agent vs chat).
  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (useChatStore.getState().isLoading) return;
    const current = useChatStore.getState().messages;
    const idx = current.findIndex(
      (m) => m.id === messageId && m.type === "user"
    );
    if (idx < 0) return;
    const text = newContent.trim();
    if (!text) return;
    useChatStore.getState().setMessages(current.slice(0, idx));
    useChatStore.getState().addMessage({ type: "user", content: text });
    if (activeMode === "agent") await runAgentTurn(text);
    else await streamReply(text);
  };

  const chatActions: ChatActions = {
    regenerate: handleRegenerate,
    deleteMessage: handleDeleteMessage,
    continueResponse: continueReply,
    editMessage: handleEditMessage,
  };

  const handleStop = () => abortRef.current?.abort();

  // Salva o áudio gravado pelo hold-to-record no Vault e devolve o path
  // relativo (pra usar como wikilink no composer). Cria a pasta se não existir.
  const handleSaveAudio = async (
    blob: Blob,
    _durationMs: number
  ): Promise<string | null> => {
    try {
      const folder = plugin.settings.recordingsPath || "axxa-ai/recordings";
      await ensureFolder(plugin.app.vault.adapter, folder);
      // Nome: timestamp ISO-safe + extensão guess do mime
      const ext = blob.type.includes("ogg")
        ? "ogg"
        : blob.type.includes("mp4")
          ? "m4a"
          : "webm";
      const ts = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .slice(0, 19);
      const path = `${folder}/${ts}.${ext}`;
      const buffer = await blob.arrayBuffer();
      await plugin.app.vault.adapter.writeBinary(path, buffer);
      return path;
    } catch (err) {
      console.error("[axxa] save audio falhou:", err);
      return null;
    }
  };

  const handleOpenSettings = () => {
    const app = plugin.app as unknown as {
      setting: { open: () => void; openTabById: (id: string) => void };
    };
    app.setting.open();
    app.setting.openTabById("axxa-os-ai-agent");
  };

  const handleNewChat = () => {
    abortRef.current?.abort();
    useChatStore.getState().newChat();
    setView("chat");
  };

  // Carrega TODAS as conversas (todos os modos) e abre a tela cheia
  const handleOpenConversations = async () => {
    try {
      // limit alto pra trazer todas — se vault tiver 10k+ conversas isso pode
      // pesar; nesse caso paginar fica como próximo polish
      const all = await listAllChats(plugin.app, plugin.settings.chatsPath, 1000);
      setAllChats(all);
      setView("conversations");
    } catch (err) {
      console.error("[axxa] listAllChats (full) falhou:", err);
      setAllChats([]);
      setView("conversations");
    }
  };

  // Quando user clica numa conversa da lista cheia, descobre o modo dela
  // pelo summary e carrega o .md correto.
  const handleLoadChatFromList = async (chatId: string) => {
    const summary = allChats.find((c) => c.id === chatId);
    await handleLoadChat(chatId, summary?.mode);
    setView("chat");
  };

  // Rename direto pelo título do header (chat ativo). Reescreve o arquivo
  // com base na sessionMode + currentChatId já conhecidos.
  const handleHeaderRename = async (newTitle: string) => {
    if (!currentChatId) {
      // Sem chat salvo ainda — só atualiza local. Auto-save vai usar isso
      // na próxima escrita.
      useChatStore.getState().setCurrentChatTitle(newTitle);
      return;
    }
    try {
      await renameChat(
        plugin.app,
        plugin.settings.chatsPath,
        activeMode,
        currentChatId,
        newTitle
      );
      useChatStore.getState().setCurrentChatTitle(newTitle);
      // Sync nas listas em memória
      setAllChats((prev) =>
        prev.map((c) =>
          c.id === currentChatId ? { ...c, title: newTitle } : c
        )
      );
      setRecentChats((prev) =>
        prev.map((c) =>
          c.id === currentChatId ? { ...c, title: newTitle } : c
        )
      );
      new Notice(t.conversations.renameSuccess(newTitle));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.ai.unknownError;
      new Notice(t.conversations.renameFailed(msg));
    }
  };

  const handleOpenSearch = () => {
    const hits = useChatStore
      .getState()
      .messages.filter((m) => m.type === "user" || m.type === "ai-response")
      .map((m) => ({
        id: m.id,
        role: m.type === "user" ? "Você" : "IA",
        text: (m as { content: string }).content,
      }));
    if (hits.length === 0) return;
    new ChatSearchModal(
      plugin.app,
      hits,
      t.chat.searchPlaceholder,
      t.chat.searchNoResults,
      (id) => setSearchTarget({ id, n: Date.now() })
    ).open();
  };

  const handleCopyConversation = async () => {
    const msgs = useChatStore
      .getState()
      .messages.filter((m) => m.type === "user" || m.type === "ai-response");
    if (msgs.length === 0) return;
    const title = currentChatTitle || "Conversa";
    const body = msgs
      .map(
        (m) =>
          `## ${m.type === "user" ? "Você" : "Assistente"}\n\n${(m as { content: string }).content}`
      )
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(`# ${title}\n\n${body}\n`);
      new Notice(t.header.copyConversationDone);
    } catch (err) {
      console.error("[axxa] copy conversation falhou:", err);
    }
  };

  const handleEditPersona = () => {
    new PersonaModal(
      plugin.app,
      useChatStore.getState().sessionPersona,
      {
        title: t.chat.personaTitle,
        desc: t.chat.personaDesc,
        placeholder: t.chat.personaPlaceholder,
        save: t.chat.personaSave,
        clear: t.chat.personaClear,
      },
      (persona) => {
        useChatStore.getState().setSessionPersona(persona);
        new Notice(persona ? t.chat.personaSet : t.chat.personaCleared);
      }
    ).open();
  };

  const handlePlusClick = () => setPlusOpen(true);
  const handlePlusClose = () => setPlusOpen(false);
  const handleSelectEffort = async (level: EffortLevel) => {
    setEffort(level);
    plugin.settings.defaultEffort = level;
    await plugin.saveSettings();
  };

  const handleStarterProvider = async (p: string) => {
    setProviderSel(p);
    plugin.settings.defaultProvider = p;
    await plugin.saveSettings();
  };

  const handleStarterMode = async (newMode: string) => {
    setMode(newMode);
    plugin.settings.defaultMode = newMode;
    await plugin.saveSettings();
  };

  const handleStarterModel = async (m: string) => {
    switch (providerSel) {
      case "anthropic":
        setAnthropicModelSel(m);
        plugin.settings.anthropicModel = m;
        break;
      case "gemini":
        setGeminiModelSel(m);
        plugin.settings.geminiModel = m;
        break;
      case "openrouter":
        setOpenrouterModelSel(m);
        plugin.settings.openrouterModel = m;
        break;
      case "nim":
        setNimModelSel(m);
        plugin.settings.nimModel = m;
        break;
      case "ollama":
        setOllamaModelSel(m);
        plugin.settings.ollamaModel = m;
        break;
      default:
        setOpenaiModelSel(m);
        plugin.settings.defaultModel = m;
    }
    await plugin.saveSettings();
  };

  // chatMode opcional — quando vem da ConversationsList (que conhece o modo
  // do summary). Quando ausente, default "chat" pra compat com fluxo antigo.
  const handleLoadChat = async (chatId: string, chatMode: string = "chat") => {
    try {
      const chat = await loadChat(
        plugin.app,
        plugin.settings.chatsPath,
        chatMode,
        chatId
      );
      const restored: ChatMessage[] = chat.messages.map((m) => ({
        id: makeId(),
        type: m.type,
        content: m.content,
        timestamp: m.timestamp,
        // Restaura reaction salva quando ai-response
        ...(m.type === "ai-response" && m.reaction
          ? { reaction: m.reaction }
          : {}),
      })) as ChatMessage[];

      const {
        setMessages,
        setCurrentChatId,
        setCurrentChatTitle,
        lockSession,
        resetUsage,
        addUsage,
        setSessionPersona,
      } = useChatStore.getState();

      setMessages(restored);
      setCurrentChatId(chat.id);
      setCurrentChatTitle(chat.title);
      // lockSession agora também guarda o mode original do chat
      lockSession(chat.provider, chat.model, chat.mode);
      resetUsage();
      addUsage(chat.tokensIn, chat.tokensOut);
      setEffort(chat.effort);
      setSessionPersona(chat.persona ?? "");
    } catch (err) {
      console.error("[axxa] loadChat falhou:", err);
    }
  };

  // ============================================================
  // Slash commands — disponíveis no Composer via /comando
  // ============================================================
  const axxaCommands: AxxaCommand[] = [
    {
      id: "new",
      label: "new",
      description: "Nova conversa",
      execute: () => handleNewChat(),
    },
    {
      id: "clear",
      label: "clear",
      description: "Limpar conversa atual",
      execute: () => useChatStore.getState().newChat(),
    },
    {
      id: "regen",
      label: "regen",
      description: "Regenerar última resposta",
      execute: () => {
        const msgs = useChatStore.getState().messages;
        const lastAI = [...msgs].reverse().find((m) => m.type === "ai-response");
        if (lastAI) chatActions.regenerate(lastAI.id);
      },
    },
    {
      id: "stop",
      label: "stop",
      description: "Parar geração em andamento",
      execute: () => handleStop(),
    },
    {
      id: "conversations",
      label: "conversations",
      description: "Ver todas as conversas salvas",
      execute: () => handleOpenConversations(),
    },
    {
      id: "settings",
      label: "settings",
      description: "Abrir Configurações",
      execute: () => handleOpenSettings(),
    },
    {
      id: "mode-chat",
      label: "mode chat",
      description: "Trocar pro modo Chat (antes da primeira msg)",
      execute: () => !isLocked && handleStarterMode("chat"),
    },
    {
      id: "mode-vault",
      label: "mode vault-qa",
      description: "Trocar pro modo Vault Q&A (antes da primeira msg)",
      execute: () => !isLocked && handleStarterMode("vault-qa"),
    },
    {
      id: "mode-agent",
      label: "mode agent",
      description: "Trocar pro modo Agent (antes da primeira msg)",
      execute: () => !isLocked && handleStarterMode("agent"),
    },
  ];

  return (
    <AppContext.Provider value={plugin.app}>
      <TranslationsContext.Provider value={t}>
        <ChatActionsContext.Provider value={chatActions}>
        <div
          className={
            "axxa-root axxa-bg-" +
            (plugin.settings.background || "none") +
            (plugin.settings.codeWrap ? " axxa-code-wrap" : "") +
            (isLoading ? " axxa-bg-active" : "")
          }
        >
          <Header
            version={plugin.manifest.version}
            chatTitle={currentChatTitle}
            onOpenSettings={handleOpenSettings}
            onNewChat={handleNewChat}
            onOpenConversations={handleOpenConversations}
            onRenameChat={handleHeaderRename}
            fullscreen={plugin.settings.mobileFullscreen}
            onToggleFullscreen={async () => {
              plugin.settings.mobileFullscreen =
                !plugin.settings.mobileFullscreen;
              await plugin.saveSettings();
            }}
            onToggleSearch={handleOpenSearch}
            searchActive={false}
            onCopyConversation={handleCopyConversation}
            canCopy={messages.some(
              (m) => m.type === "user" || m.type === "ai-response"
            )}
            onEditPersona={handleEditPersona}
            personaActive={sessionPersona.trim().length > 0}
          />
        {view === "conversations" ? (
          <ConversationsList
            chats={allChats}
            onLoadChat={handleLoadChatFromList}
            onClose={() => setView("chat")}
            visibleChips={plugin.settings.listChips}
          />
        ) : isEmpty ? (
          <StarterScreen
            provider={providerSel}
            model={starterModel}
            effort={effort}
            mode={mode}
            recentChats={recentChats}
            activeModels={plugin.settings.activeModels}
            onProviderChange={handleStarterProvider}
            onModelChange={handleStarterModel}
            onEffortChange={handleSelectEffort}
            onModeChange={handleStarterMode}
            onLoadChat={handleLoadChat}
            visibleChips={plugin.settings.listChips}
          />
        ) : (
          <ChatArea highlightTarget={searchTarget} />
        )}
        {view === "chat" && showBanner && (
          <IncompatibleBanner
            result={compatibility}
            onSwapModel={(m) => {
              // Se session locked (após primeira msg), não dá pra trocar — avisa.
              if (isLocked) {
                new Notice(
                  `Pra trocar pra ${m}, comece uma Nova conversa (botão "+" no topo).`
                );
                return;
              }
              handleStarterModel(m);
              setDismissedBannerKey(null);
            }}
            onDismiss={() => setDismissedBannerKey(bannerKey)}
          />
        )}
        {view === "chat" && (
          <Composer
            onSend={handleSend}
            onStop={handleStop}
            onPlusClick={handlePlusClick}
            streaming={isLoading}
            providerName={activeProvider.name}
            modelName={activeModel}
            effort={effort}
            tokensIn={tokensIn}
            tokensOut={tokensOut}
            tokensPerSec={tokensPerSec}
            contextUsed={lastPromptTokens}
            locked={isLocked}
            mode={activeMode}
            placeholder={placeholderForMode(activeMode, t.composer)}
            onSaveAudio={handleSaveAudio}
            onAddAudio={(path, durationMs, alias) =>
              setPendingAttachments((prev) => [
                ...prev,
                {
                  id: makeAttachmentId(),
                  attachment: { type: "audio", path, durationMs },
                  name: alias,
                },
              ])
            }
            commands={axxaCommands}
            visibleChips={plugin.settings.composerChips}
            visionEnabled={getModelCapabilities(activeProviderId, activeModel).vision}
            pendingAttachments={pendingAttachments.map((p) => {
              const a = p.attachment;
              switch (a.type) {
                case "image":
                  return {
                    id: p.id,
                    kind: "image" as const,
                    dataUrl: a.dataUrl,
                    mimeType: a.mimeType ?? "image/png",
                    name: p.name,
                  };
                case "note":
                  return {
                    id: p.id,
                    kind: "note" as const,
                    path: a.path,
                    name: p.name,
                  };
                case "pdf":
                  return {
                    id: p.id,
                    kind: "pdf" as const,
                    name: p.name,
                    dataUrl: a.dataUrl,
                  };
                case "audio":
                  return {
                    id: p.id,
                    kind: "audio" as const,
                    path: a.path,
                    name: p.name,
                    durationMs: a.durationMs,
                  };
              }
            })}
            onAddImage={(img) =>
              setPendingAttachments((prev) => [
                ...prev,
                {
                  id: img.id,
                  attachment: {
                    type: "image",
                    dataUrl: img.dataUrl,
                    mimeType: img.mimeType,
                  },
                  name: img.name,
                },
              ])
            }
            onRemoveAttachment={(id) =>
              setPendingAttachments((prev) => prev.filter((p) => p.id !== id))
            }
            onPickNote={async (path, isFolder) => {
              // Pasta vira "note" sem content (pra LLM saber que existe);
              // arquivo é lido e inlinado como contexto na hora do envio
              try {
                let content = "";
                let resolvedPath = path;
                if (!isFolder) {
                  // Path pode vir sem .md (do autocomplete). Adiciona se faltar.
                  const candidate = path.endsWith(".md") ? path : `${path}.md`;
                  const exists = await plugin.app.vault.adapter.exists(candidate);
                  if (exists) {
                    resolvedPath = candidate;
                    content = await plugin.app.vault.adapter.read(candidate);
                  } else if (await plugin.app.vault.adapter.exists(path)) {
                    content = await plugin.app.vault.adapter.read(path);
                  } else {
                    new Notice(`Nota não encontrada: ${path}`);
                    return;
                  }
                }
                setPendingAttachments((prev) => [
                  ...prev,
                  {
                    id: makeAttachmentId(),
                    attachment: {
                      type: "note",
                      path: resolvedPath,
                      content,
                    },
                    name: resolvedPath.split("/").pop() ?? resolvedPath,
                  },
                ]);
              } catch (err) {
                console.error("[axxa] onPickNote falhou:", err);
                new Notice(
                  `Falha ao anexar nota: ${err instanceof Error ? err.message : "erro"}`
                );
              }
            }}
          />
        )}
          {plusOpen && (
            <PlusModal
              currentEffort={effort}
              onSelectEffort={handleSelectEffort}
              onClose={handlePlusClose}
              visionEnabled={
                getModelCapabilities(activeProviderId, activeModel).vision
              }
              imageGenEnabled={
                Boolean(getModelCapabilities(activeProviderId, activeModel).imageGen)
              }
              toggles={plusToggles}
              onToggle={(key, value) =>
                setPlusToggles((prev) => ({ ...prev, [key]: value }))
              }
              onAttachPicked={(picked) => {
                const id = makeAttachmentId();
                const entry: PendingAttachmentEntry = (() => {
                  switch (picked.type) {
                    case "note":
                      return {
                        id,
                        attachment: {
                          type: "note",
                          path: picked.path ?? picked.name,
                          content: picked.content ?? "",
                        },
                        name: picked.name,
                      };
                    case "pdf":
                      return {
                        id,
                        attachment: {
                          type: "pdf",
                          dataUrl: picked.dataUrl,
                          name: picked.name,
                        },
                        name: picked.name,
                      };
                    case "image":
                      return {
                        id,
                        attachment: {
                          type: "image",
                          dataUrl: picked.dataUrl ?? "",
                          mimeType: picked.mimeType,
                        },
                        name: picked.name,
                      };
                  }
                })();
                setPendingAttachments((prev) => [...prev, entry]);
              }}
            />
          )}
        </div>
        </ChatActionsContext.Provider>
      </TranslationsContext.Provider>
    </AppContext.Provider>
  );
}
