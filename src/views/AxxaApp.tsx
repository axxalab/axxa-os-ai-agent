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
import { getModelCapabilities } from "../providers/modelCapabilities";
import {
  effortToMaxTokens,
  effortToVaultLookup,
  type EffortLevel,
} from "../components/_shared/effort";
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
import { searchVault, buildVaultContext } from "../components/_shared/vaultSearch";
import { ensureFolder } from "../components/_shared/chatPersistence";
import { embedQuery } from "../rag/embeddings";
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

// Label curto pra mostrar como ai-comment quando agent roda uma tool.
// Inclui ícone visual (📄 criar, ✏️ editar, 🗑️ deletar, etc) + path resumido.
function agentToolLabel(
  toolName: string,
  args: Record<string, unknown>
): string {
  const path = (args.path ?? args.from ?? args.folder ?? "") as string;
  switch (toolName) {
    case "vault_list":
      return `📋 Listando: ${path || "raiz"}`;
    case "vault_read":
      return `👀 Lendo: ${path}`;
    case "vault_create":
      return `📄 Criando: ${path}`;
    case "vault_edit":
      return `✏️ Editando: ${path}`;
    case "vault_move":
      return `📦 Movendo: ${path} → ${args.to ?? "?"}`;
    case "vault_delete":
      return `🗑️ Deletando: ${path}`;
    case "vault_create_folder":
      return `📁 Criando pasta: ${path}`;
    default:
      return `🔧 ${toolName}`;
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
  const currentChatId = useChatStore((s) => s.currentChatId);
  const currentChatTitle = useChatStore((s) => s.currentChatTitle);
  const abortRef = useRef<AbortController | null>(null);

  // View state: chat (default) ou conversations (tela cheia de todas conversas)
  const [view, setView] = useState<"chat" | "conversations">("chat");
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
          m.type === "user" || m.type === "ai-response"
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
        messages: userOrAi.map((m) => ({
          type: m.type as "user" | "ai-response",
          content: m.content,
          timestamp: m.timestamp,
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
      setLoading,
      setStreamingMessageId,
      addUsage,
      startStreamTimer,
      tickStreamTokens,
      endStreamTimer,
    } = useChatStore.getState();

    // Modo Vault Q&A: busca notas relevantes ANTES da chamada
    // topK e excerptChars escalam com effort (low=3×300 ... max=12×2000)
    // Se índice RAG existe → busca semântica (cosine sim sobre embeddings).
    // Senão → fallback pra busca keyword (busca por título + ocorrências).
    let vaultContextBlock = "";
    if (activeMode === "vault-qa") {
      const { topK, excerptChars } = effortToVaultLookup(effort);
      const useRag =
        plugin.vectorIndex !== null && plugin.vectorIndex.size > 0;

      addMessage({
        type: "ai-comment",
        content: useRag
          ? `Buscando ${topK} trechos via RAG (effort: ${effort})...`
          : t.vault.searching(topK, effort),
      });

      try {
        if (useRag) {
          // RAG path: embed query (router escolhe provider OpenAI/OpenRouter)
          const queryVec = await embedQuery(
            userText,
            {
              openaiApiKey: plugin.settings.openaiApiKey,
              openrouterApiKey: plugin.settings.openrouterApiKey,
            },
            plugin.vectorIndex!.model
          );
          const results = plugin.vectorIndex!.search(queryVec, topK, 0.3);
          if (results.length > 0) {
            // Monta o contexto a partir dos chunks ranqueados
            vaultContextBlock = results
              .map((r) => {
                const excerpt = r.entry.text.slice(0, excerptChars);
                return `### ${r.entry.path} (sim=${r.score.toFixed(2)})\n\n${excerpt}`;
              })
              .join("\n\n---\n\n");
            addMessage({
              type: "ai-comment",
              content: `${results.length} trecho${results.length > 1 ? "s" : ""} encontrado${results.length > 1 ? "s" : ""} via RAG (similarity ${results[0].score.toFixed(2)}–${results[results.length - 1].score.toFixed(2)})`,
            });
          } else {
            addMessage({
              type: "ai-comment",
              content: t.vault.notFound,
            });
          }
        } else {
          // Fallback: keyword search (sem embedding configurado/indexado)
          const matches = await searchVault(
            plugin.app,
            userText,
            topK,
            excerptChars
          );
          if (matches.length > 0) {
            vaultContextBlock = buildVaultContext(matches);
            addMessage({
              type: "ai-comment",
              content: t.vault.foundContext(matches.length),
            });
          } else {
            addMessage({
              type: "ai-comment",
              content: t.vault.notFound,
            });
          }
        }
      } catch (err) {
        console.error("[axxa] vault search falhou:", err);
        addMessage({
          type: "ai-comment",
          content: `${t.ai.errorPrefix} ${err instanceof Error ? err.message : t.ai.unknownError}`,
        });
      }
    }

    const commentId = addMessage({ type: "ai-comment", content: t.ai.thinking });
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let responseId: string | null = null;

    try {
      const fullSystem =
        vaultContextBlock.length > 0
          ? t.systemPrompt.base + t.systemPrompt.vaultQaSuffix + vaultContextBlock
          : t.systemPrompt.base;

      // Pega só user/assistant do store. Última user msg ganha attachments
      // multimodais se foram passados pra essa chamada.
      const storeMsgs = useChatStore.getState().messages
        .filter((m) => m.type === "user" || m.type === "ai-response");
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

      startStreamTimer();
      await activeProvider.streamChat(
        {
          model: activeModel,
          messages: history,
          maxTokens: effortToMaxTokens(effort),
        },
        apiKey,
        (token) => {
          if (responseId === null) {
            removeMessage(commentId);
            responseId = addMessage({ type: "ai-response", content: token });
            setStreamingMessageId(responseId);
          } else {
            appendToMessage(responseId, token);
          }
          tickStreamTokens(token);
        },
        (usage) => {
          addUsage(usage.input, usage.output);
        },
        controller.signal
      );
      endStreamTimer();

      if (responseId === null) {
        removeMessage(commentId);
        addMessage({ type: "ai-response", content: t.ai.emptyResponse });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (responseId === null) removeMessage(commentId);
      } else {
        if (responseId === null) removeMessage(commentId);
        const errorMsg =
          err instanceof ProviderError
            ? err.message
            : err instanceof Error
              ? err.message
              : t.ai.unknownError;
        addMessage({
          type: "ai-response",
          content: `${t.ai.errorPrefix} ${errorMsg}`,
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
    const commentId = addMessage({
      type: "ai-comment",
      content: t.agent.thinking,
    });

    const permissionLevel: PermissionLevel = (plugin.settings.agentPermissionLevel ||
      "ask") as PermissionLevel;

    // System prompt específico do agent
    const AGENT_SYSTEM_PROMPT =
      "Você é o AXXA Agent, um assistente integrado ao Obsidian com acesso direto " +
      "ao vault do usuário via ferramentas (tools). Responda em português. " +
      "Use as tools pra realizar a tarefa pedida — leia, crie, edite, mova ou delete " +
      "arquivos quando o user pedir. Pergunte ANTES se a intenção for ambígua. " +
      "Quando terminar, devolva uma resposta de texto resumindo o que fez. " +
      "Pra editar arquivos, SEMPRE use vault_read antes pra ver o conteúdo exato.";

    // Constrói history inicial — pega só user/assistant do store (chat anterior).
    // Última user msg recebe attachments multimodais se vieram.
    const storeMsgs = useChatStore
      .getState()
      .messages.filter((m) => m.type === "user" || m.type === "ai-response");
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

    const MAX_TURNS = 10;
    let turn = 0;
    let firstTurn = true;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      while (turn < MAX_TURNS) {
        turn++;

        // Cria msg ai-response que vai ser preenchida token-a-token.
        // Cada turno é um message separado pra ficar claro qual tokens
        // pertencem a qual round de tool execution.
        let responseId: string | null = null;
        const onToken = (token: string) => {
          if (responseId === null) {
            // Remove o comment de "Pensando..." só no primeiro token do primeiro turno
            if (firstTurn) {
              removeMessage(commentId);
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
            maxTokens: effortToMaxTokens(effort),
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
              removeMessage(commentId);
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
          removeMessage(commentId);
          firstTurn = false;
        }
        history.push({
          role: "assistant",
          content: response.content ?? "",
          toolCalls: response.toolCalls,
        });

        for (const call of response.toolCalls) {
          const def = getToolDefinition(call.name);
          if (!def) {
            addMessage({
              type: "ai-comment",
              content: `⚠️ Tool desconhecida: ${call.name}`,
            });
            history.push({
              role: "tool",
              toolCallId: call.id,
              content: `Tool "${call.name}" não existe.`,
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
              content: `🚫 Negado: ${call.name}`,
            });
            history.push({
              role: "tool",
              toolCallId: call.id,
              content: "User negou esta ação. Considere outra abordagem ou pergunte ao user.",
            });
            continue;
          }

          addMessage({
            type: "ai-comment",
            content: agentToolLabel(call.name, call.arguments),
          });
          const executor = TOOL_REGISTRY[call.name];
          try {
            const result = await executor(plugin.app, call.arguments);
            history.push({
              role: "tool",
              toolCallId: call.id,
              content: result,
            });
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : "Erro desconhecido.";
            addMessage({
              type: "ai-comment",
              content: `❌ ${call.name} falhou: ${msg}`,
            });
            history.push({
              role: "tool",
              toolCallId: call.id,
              content: `ERRO: ${msg}`,
            });
          }
        }
      }
      addMessage({
        type: "ai-response",
        content: t.agent.maxTurnsReached(MAX_TURNS),
      });
    } catch (err) {
      if (firstTurn) removeMessage(commentId);
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
        });
      }
    } finally {
      setLoading(false);
      setStreamingMessageId(null);
      endStreamTimer();
      abortRef.current = null;
    }
  };

  // Imagens anexadas no composer pra próxima mensagem (limpa após envio).
  // Cada attachment ganha id estável pra UI tracking — não persiste no .md.
  interface PendingAttachmentEntry {
    id: string;
    attachment: MessageAttachment;
    name: string;
  }
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachmentEntry[]>([]);

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

    // Filtra attachments só se o modelo aceita vision — silenciosamente
    // descarta caso contrário (UI já bloqueou attach, mas dupla checagem aqui).
    const caps = getModelCapabilities(activeProviderId, activeModel);
    const attachments =
      caps.vision && pendingAttachments.length > 0
        ? pendingAttachments.map((p) => p.attachment)
        : undefined;

    // User msg salva sem attachments no store (pra simplicidade do auto-save .md).
    // O propagation pro provider acontece via parâmetro adicional pra streamReply/runAgentTurn.
    addMessage({ type: "user", content: text });
    setPendingAttachments([]);

    // Dispatch baseado no modo: agent usa loop com tools, demais usa streamReply
    if (activeMode === "agent") {
      await runAgentTurn(text, attachments);
    } else {
      await streamReply(text, attachments);
    }
  };

  // Regenerar: remove o ai-response (e qualquer msg posterior) e re-roda
  // streamReply usando a user-msg que precedia. Ignora se já tá streamando.
  const handleRegenerate = async (aiMessageId: string) => {
    if (useChatStore.getState().isLoading) return;
    const current = useChatStore.getState().messages;
    const aiIdx = current.findIndex(
      (m) => m.id === aiMessageId && m.type === "ai-response"
    );
    if (aiIdx < 0) return;

    // Acha a user-msg imediatamente anterior
    let userIdx = aiIdx - 1;
    while (userIdx >= 0 && current[userIdx].type !== "user") userIdx--;
    if (userIdx < 0) return;

    const userMsg = current[userIdx];
    if (userMsg.type !== "user") return;

    // Remove tudo de aiIdx em diante (ai-response + qualquer ai-comment posterior)
    useChatStore.getState().setMessages(current.slice(0, aiIdx));

    await streamReply(userMsg.content);
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

  const chatActions: ChatActions = {
    regenerate: handleRegenerate,
    deleteMessage: handleDeleteMessage,
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
      })) as ChatMessage[];

      const {
        setMessages,
        setCurrentChatId,
        setCurrentChatTitle,
        lockSession,
        resetUsage,
        addUsage,
      } = useChatStore.getState();

      setMessages(restored);
      setCurrentChatId(chat.id);
      setCurrentChatTitle(chat.title);
      // lockSession agora também guarda o mode original do chat
      lockSession(chat.provider, chat.model, chat.mode);
      resetUsage();
      addUsage(chat.tokensIn, chat.tokensOut);
      setEffort(chat.effort);
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
          <ChatArea />
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
            commands={axxaCommands}
            visibleChips={plugin.settings.composerChips}
            visionEnabled={getModelCapabilities(activeProviderId, activeModel).vision}
            pendingImages={pendingAttachments
              .filter((p) => p.attachment.type === "image")
              .map((p) => ({
                id: p.id,
                dataUrl: p.attachment.dataUrl,
                mimeType: p.attachment.mimeType ?? "image/png",
                name: p.name,
              }))}
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
            onRemoveImage={(id) =>
              setPendingAttachments((prev) => prev.filter((p) => p.id !== id))
            }
          />
        )}
          {plusOpen && (
            <PlusModal
              currentEffort={effort}
              onSelectEffort={handleSelectEffort}
              onClose={handlePlusClose}
            />
          )}
        </div>
        </ChatActionsContext.Provider>
      </TranslationsContext.Provider>
    </AppContext.Provider>
  );
}
