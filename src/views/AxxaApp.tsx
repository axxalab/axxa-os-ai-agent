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
import { AppContext } from "../components/_shared/AppContext";
import {
  ChatActionsContext,
  type ChatActions,
} from "../components/chat/ChatActionsContext";
import { useChatStore } from "../store/chat";
import { getProvider } from "../providers";
import { ProviderError, type ProviderMessage } from "../providers/base";
import {
  effortToMaxTokens,
  effortToVaultLookup,
  type EffortLevel,
} from "../components/_shared/effort";
import {
  saveChat,
  loadChat,
  listChats,
  generateTitle,
  type ChatData,
  type ChatSummary,
} from "../components/_shared/chatPersistence";
import { searchVault, buildVaultContext } from "../components/_shared/vaultSearch";
import type { ChatMessage, UserMessage, AIResponseMessage } from "../store/chat";

interface AxxaAppProps {
  plugin: AxxaPlugin;
}

const SYSTEM_PROMPT =
  "Você é o AXXA Agent, um assistente integrado ao Obsidian. " +
  "Responda em português, de forma clara, direta e útil. " +
  "Quando fizer sentido, use Markdown.";

const VAULT_QA_SUFFIX =
  "\n\nO usuário está no modo Vault Q&A — abaixo seguem notas relevantes " +
  "extraídas do vault dele. Use elas como fonte principal pra responder, " +
  "e cite o título da nota quando referenciar.\n\nNotas:\n\n";

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Placeholder do composer varia pelo modo da sessão — feedback visual de
// que o "papel" do AXXA muda (assistente geral vs. focado no vault, etc.)
function placeholderForMode(mode: string): string {
  switch (mode) {
    case "vault-qa":
      return "Pergunte sobre seu Vault...";
    case "agent":
      return "Peça pro Agent organizar seu vault...";
    case "coder":
      return "Cole código ou pergunte como debugar...";
    default:
      return "Pergunte ao AXXA Agent...";
  }
}

export function AxxaApp({ plugin }: AxxaAppProps) {
  const isLoading = useChatStore((s) => s.isLoading);
  const tokensIn = useChatStore((s) => s.tokensIn);
  const tokensOut = useChatStore((s) => s.tokensOut);
  const lastPromptTokens = useChatStore((s) => s.lastPromptTokens);
  const messages = useChatStore((s) => s.messages);
  const sessionProvider = useChatStore((s) => s.sessionProvider);
  const sessionModel = useChatStore((s) => s.sessionModel);
  const sessionMode = useChatStore((s) => s.sessionMode);
  const currentChatId = useChatStore((s) => s.currentChatId);
  const currentChatTitle = useChatStore((s) => s.currentChatTitle);
  const abortRef = useRef<AbortController | null>(null);

  const [providerSel, setProviderSel] = useState(plugin.settings.defaultProvider);
  const [openaiModelSel, setOpenaiModelSel] = useState(plugin.settings.defaultModel);
  const [anthropicModelSel, setAnthropicModelSel] = useState(plugin.settings.anthropicModel);
  const [openrouterModelSel, setOpenrouterModelSel] = useState(plugin.settings.openrouterModel);
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
      case "openrouter": return openrouterModelSel;
      case "ollama": return ollamaModelSel;
      default: return openaiModelSel;
    }
  };

  const activeProviderId = sessionProvider ?? providerSel;
  const activeProvider = getProvider(activeProviderId);
  const activeModel = sessionModel ?? modelFor(activeProviderId);
  const activeMode = sessionMode ?? mode;
  const isLocked = sessionProvider !== null;

  const starterModel = modelFor(providerSel);

  // ============================================================
  // Carrega lista de chats recentes quando chat tá vazio
  // ============================================================
  const isEmpty = messages.length === 0;
  useEffect(() => {
    if (!isEmpty) return;
    listChats(plugin.app, plugin.settings.chatsPath, "chat", 8)
      .then(setRecentChats)
      .catch((err) => {
        console.error("[axxa] listChats falhou:", err);
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
  const streamReply = async (userText: string) => {
    const {
      addMessage,
      removeMessage,
      appendToMessage,
      setLoading,
      setStreamingMessageId,
      addUsage,
    } = useChatStore.getState();

    // Modo Vault Q&A: busca notas relevantes ANTES da chamada
    // topK e excerptChars escalam com effort (low=3×300 ... max=12×2000)
    let vaultContextBlock = "";
    if (activeMode === "vault-qa") {
      const { topK, excerptChars } = effortToVaultLookup(effort);
      addMessage({
        type: "ai-comment",
        content: `Buscando até ${topK} notas no vault (effort: ${effort})...`,
      });
      try {
        const matches = await searchVault(plugin.app, userText, topK, excerptChars);
        if (matches.length > 0) {
          vaultContextBlock = buildVaultContext(matches);
          addMessage({
            type: "ai-comment",
            content: `${matches.length} nota${matches.length > 1 ? "s" : ""} encontrada${matches.length > 1 ? "s" : ""} como contexto`,
          });
        } else {
          addMessage({
            type: "ai-comment",
            content: "Nenhuma nota relevante encontrada — respondendo sem contexto do vault",
          });
        }
      } catch (err) {
        console.error("[axxa] vault search falhou:", err);
      }
    }

    const commentId = addMessage({ type: "ai-comment", content: "Pensando..." });
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let responseId: string | null = null;

    try {
      const fullSystem =
        vaultContextBlock.length > 0
          ? SYSTEM_PROMPT + VAULT_QA_SUFFIX + vaultContextBlock
          : SYSTEM_PROMPT;

      const history: ProviderMessage[] = [
        { role: "system", content: fullSystem },
        ...useChatStore.getState().messages
          .filter((m) => m.type === "user" || m.type === "ai-response")
          .map((m) => ({
            role: (m.type === "user" ? "user" : "assistant") as "user" | "assistant",
            content: (m as { content: string }).content,
          })),
      ];

      // Para Ollama, "apiKey" carrega o endpoint (provider trata como URL)
      let apiKey: string;
      switch (activeProviderId) {
        case "anthropic":
          apiKey = plugin.settings.anthropicApiKey;
          break;
        case "openrouter":
          apiKey = plugin.settings.openrouterApiKey;
          break;
        case "ollama":
          apiKey = plugin.settings.ollamaEndpoint;
          break;
        default:
          apiKey = plugin.settings.openaiApiKey;
      }

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
        },
        (usage) => {
          addUsage(usage.input, usage.output);
        },
        controller.signal
      );

      if (responseId === null) {
        removeMessage(commentId);
        addMessage({ type: "ai-response", content: "[Resposta vazia recebida]" });
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
              : "Erro desconhecido.";
        addMessage({ type: "ai-response", content: `[Erro] ${errorMsg}` });
      }
    } finally {
      setLoading(false);
      setStreamingMessageId(null);
      abortRef.current = null;
    }
  };

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

    addMessage({ type: "user", content: text });
    await streamReply(text);
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
      case "openrouter":
        setOpenrouterModelSel(m);
        plugin.settings.openrouterModel = m;
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

  const handleLoadChat = async (chatId: string) => {
    try {
      const chat = await loadChat(plugin.app, plugin.settings.chatsPath, "chat", chatId);
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
      lockSession(chat.provider, chat.model);
      resetUsage();
      addUsage(chat.tokensIn, chat.tokensOut);
      setEffort(chat.effort);
    } catch (err) {
      console.error("[axxa] loadChat falhou:", err);
    }
  };

  return (
    <AppContext.Provider value={plugin.app}>
      <ChatActionsContext.Provider value={chatActions}>
        <div className="axxa-root">
          <Header
            version={plugin.manifest.version}
            onOpenSettings={handleOpenSettings}
            onNewChat={handleNewChat}
          />
        {isEmpty ? (
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
          />
        ) : (
          <ChatArea />
        )}
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
          contextUsed={lastPromptTokens}
          locked={isLocked}
          mode={activeMode}
          placeholder={placeholderForMode(activeMode)}
        />
          {plusOpen && (
            <PlusModal
              currentEffort={effort}
              onSelectEffort={handleSelectEffort}
              onClose={handlePlusClose}
            />
          )}
        </div>
      </ChatActionsContext.Provider>
    </AppContext.Provider>
  );
}
