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
import { useChatStore } from "../store/chat";
import { getProvider } from "../providers";
import { ProviderError, type ProviderMessage } from "../providers/base";
import { effortToMaxTokens, type EffortLevel } from "../components/_shared/effort";
import {
  saveChat,
  loadChat,
  listChats,
  generateTitle,
  type ChatData,
  type ChatSummary,
} from "../components/_shared/chatPersistence";
import type { ChatMessage, UserMessage, AIResponseMessage } from "../store/chat";

interface AxxaAppProps {
  plugin: AxxaPlugin;
}

const SYSTEM_PROMPT =
  "Você é o AXXA Agent, um assistente integrado ao Obsidian. " +
  "Responda em português, de forma clara, direta e útil. " +
  "Quando fizer sentido, use Markdown.";

const MODE = "chat";

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function AxxaApp({ plugin }: AxxaAppProps) {
  const isLoading = useChatStore((s) => s.isLoading);
  const tokensIn = useChatStore((s) => s.tokensIn);
  const tokensOut = useChatStore((s) => s.tokensOut);
  const lastPromptTokens = useChatStore((s) => s.lastPromptTokens);
  const messages = useChatStore((s) => s.messages);
  const sessionProvider = useChatStore((s) => s.sessionProvider);
  const sessionModel = useChatStore((s) => s.sessionModel);
  const currentChatId = useChatStore((s) => s.currentChatId);
  const currentChatTitle = useChatStore((s) => s.currentChatTitle);
  const abortRef = useRef<AbortController | null>(null);

  const [providerSel, setProviderSel] = useState(plugin.settings.defaultProvider);
  const [openaiModelSel, setOpenaiModelSel] = useState(plugin.settings.defaultModel);
  const [anthropicModelSel, setAnthropicModelSel] = useState(plugin.settings.anthropicModel);
  const [openrouterModelSel, setOpenrouterModelSel] = useState(plugin.settings.openrouterModel);
  const [ollamaModelSel, setOllamaModelSel] = useState(plugin.settings.ollamaModel);
  const [effort, setEffort] = useState(plugin.settings.defaultEffort);
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
  const isLocked = sessionProvider !== null;

  const starterModel = modelFor(providerSel);

  // ============================================================
  // Carrega lista de chats recentes quando chat tá vazio
  // ============================================================
  const isEmpty = messages.length === 0;
  useEffect(() => {
    if (!isEmpty) return;
    listChats(plugin.app, plugin.settings.chatsPath, MODE, 8)
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
        mode: MODE,
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
  const handleSend = async (text: string) => {
    const {
      addMessage,
      removeMessage,
      appendToMessage,
      setLoading,
      lockSession,
      setStreamingMessageId,
      setCurrentChatId,
      setCurrentChatTitle,
      addUsage,
    } = useChatStore.getState();

    // Primeira msg da sessão → cria chat ID, gera título, trava session
    if (messages.length === 0) {
      const newId = makeId();
      setCurrentChatId(newId);
      setCurrentChatTitle(generateTitle(text));
      lockSession(activeProviderId, activeModel);
    }

    addMessage({ type: "user", content: text });
    const commentId = addMessage({ type: "ai-comment", content: "Pensando..." });
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let responseId: string | null = null;

    try {
      const history: ProviderMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
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
      const chat = await loadChat(plugin.app, plugin.settings.chatsPath, MODE, chatId);
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
            recentChats={recentChats}
            onProviderChange={handleStarterProvider}
            onModelChange={handleStarterModel}
            onEffortChange={handleSelectEffort}
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
        />
        {plusOpen && (
          <PlusModal
            currentEffort={effort}
            onSelectEffort={handleSelectEffort}
            onClose={handlePlusClose}
          />
        )}
      </div>
    </AppContext.Provider>
  );
}
