// src/views/AxxaApp.tsx
// Layout completo do chat com session lock + starter screen + scroll inteligente.
//
// Fluxo:
//   - Chat vazio → renderiza StarterScreen com provider/model/effort selectors
//   - Primeira mensagem → lockSession() trava provider+model no store
//   - Durante conversa → status mostra provider/model travados; só effort muda
//   - "+" modal → muda Effort em qualquer momento

import { useRef, useState } from "react";
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

interface AxxaAppProps {
  plugin: AxxaPlugin;
}

const SYSTEM_PROMPT =
  "Você é o AXXA Agent, um assistente integrado ao Obsidian. " +
  "Responda em português, de forma clara, direta e útil. " +
  "Quando fizer sentido, use Markdown.";

export function AxxaApp({ plugin }: AxxaAppProps) {
  const isLoading = useChatStore((s) => s.isLoading);
  const tokensIn = useChatStore((s) => s.tokensIn);
  const tokensOut = useChatStore((s) => s.tokensOut);
  const lastPromptTokens = useChatStore((s) => s.lastPromptTokens);
  const messages = useChatStore((s) => s.messages);
  const sessionProvider = useChatStore((s) => s.sessionProvider);
  const sessionModel = useChatStore((s) => s.sessionModel);
  const abortRef = useRef<AbortController | null>(null);

  // Mirror em state das settings pra ter reatividade
  // (user mexe no starter screen → updates settings + estado React)
  const [providerSel, setProviderSel] = useState(plugin.settings.defaultProvider);
  const [openaiModelSel, setOpenaiModelSel] = useState(plugin.settings.defaultModel);
  const [anthropicModelSel, setAnthropicModelSel] = useState(plugin.settings.anthropicModel);
  const [effort, setEffort] = useState(plugin.settings.defaultEffort);
  const [plusOpen, setPlusOpen] = useState(false);

  // Provider/model EFETIVOS = locked (se travado) senão starter selection
  const activeProviderId = sessionProvider ?? providerSel;
  const activeProvider = getProvider(activeProviderId);
  const activeModel =
    sessionModel ??
    (activeProviderId === "anthropic" ? anthropicModelSel : openaiModelSel);
  const isLocked = sessionProvider !== null;

  // Modelo mostrado/usado pelo starter screen (sempre o atual, não locked)
  const starterModel =
    providerSel === "anthropic" ? anthropicModelSel : openaiModelSel;

  const handleSend = async (text: string) => {
    const {
      addMessage,
      removeMessage,
      appendToMessage,
      setLoading,
      lockSession,
      setStreamingMessageId,
      addUsage,
    } = useChatStore.getState();

    // Lock session na primeira mensagem
    if (messages.length === 0) {
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

      const apiKey =
        activeProviderId === "anthropic"
          ? plugin.settings.anthropicApiKey
          : plugin.settings.openaiApiKey;

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
        addMessage({
          type: "ai-response",
          content: "[Resposta vazia recebida]",
        });
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

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleOpenSettings = () => {
    const app = plugin.app as unknown as {
      setting: { open: () => void; openTabById: (id: string) => void };
    };
    app.setting.open();
    app.setting.openTabById("axxa-os-ai-agent");
  };

  // Plus modal
  const handlePlusClick = () => setPlusOpen(true);
  const handlePlusClose = () => setPlusOpen(false);
  const handleSelectEffort = async (level: EffortLevel) => {
    setEffort(level);
    plugin.settings.defaultEffort = level;
    await plugin.saveSettings();
  };

  // Starter screen handlers
  const handleStarterProvider = async (p: string) => {
    setProviderSel(p);
    plugin.settings.defaultProvider = p;
    await plugin.saveSettings();
  };
  const handleStarterModel = async (m: string) => {
    if (providerSel === "anthropic") {
      setAnthropicModelSel(m);
      plugin.settings.anthropicModel = m;
    } else {
      setOpenaiModelSel(m);
      plugin.settings.defaultModel = m;
    }
    await plugin.saveSettings();
  };

  const isEmpty = messages.length === 0;

  return (
    <AppContext.Provider value={plugin.app}>
      <div className="axxa-root">
        <Header
          version={plugin.manifest.version}
          onOpenSettings={handleOpenSettings}
        />
        {isEmpty ? (
          <StarterScreen
            provider={providerSel}
            model={starterModel}
            effort={effort}
            onProviderChange={handleStarterProvider}
            onModelChange={handleStarterModel}
            onEffortChange={handleSelectEffort}
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
