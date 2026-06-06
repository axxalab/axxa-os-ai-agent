// src/views/AxxaApp.tsx
// Layout completo do chat com streaming OpenAI (Módulo 1.4).
// Fluxo no send:
//   1. Adiciona bubble do user
//   2. Adiciona ai-comment "Pensando..." (com sparkles animado)
//   3. setLoading(true) → composer mostra botão Stop
//   4. streamChat dispara, AbortController fica em ref pra abort manual
//   5. Primeiro token: remove "Pensando...", cria ai-response com o token
//   6. Tokens seguintes: appendToMessage no mesmo ai-response
//   7. Stream encerra (normal ou abort): setLoading(false)

import { useRef } from "react";
import type AxxaPlugin from "../main";
import { Header } from "../components/layout/Header";
import { ChatArea } from "../components/chat/ChatArea";
import { Composer } from "../components/composer/Composer";
import { AppContext } from "../components/_shared/AppContext";
import { useChatStore } from "../store/chat";
import { getProvider } from "../providers";
import { ProviderError, type ProviderMessage } from "../providers/base";

interface AxxaAppProps {
  plugin: AxxaPlugin;
}

const SYSTEM_PROMPT =
  "Você é o AXXA Agent, um assistente integrado ao Obsidian. " +
  "Responda em português, de forma clara, direta e útil. " +
  "Quando fizer sentido, use Markdown.";

export function AxxaApp({ plugin }: AxxaAppProps) {
  const isLoading = useChatStore((s) => s.isLoading);
  const abortRef = useRef<AbortController | null>(null);

  const handleSend = async (text: string) => {
    const { addMessage, removeMessage, appendToMessage, setLoading } =
      useChatStore.getState();

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

      // Provider, modelo e api key são lidos das settings na hora do envio
      // — se o user mudar provider em settings, próximas mensagens já pegam o novo.
      const providerId = plugin.settings.defaultProvider;
      const provider = getProvider(providerId);
      const apiKey =
        providerId === "anthropic"
          ? plugin.settings.anthropicApiKey
          : plugin.settings.openaiApiKey;
      const model =
        providerId === "anthropic"
          ? plugin.settings.anthropicModel
          : plugin.settings.defaultModel;

      await provider.streamChat(
        { model, messages: history },
        apiKey,
        (token) => {
          if (responseId === null) {
            // primeiro token — substitui "Pensando..." pela resposta real
            removeMessage(commentId);
            responseId = addMessage({ type: "ai-response", content: token });
          } else {
            appendToMessage(responseId, token);
          }
        },
        controller.signal
      );

      // Stream terminou sem token? Limpa o "Pensando..." de qualquer jeito
      if (responseId === null) {
        removeMessage(commentId);
        addMessage({
          type: "ai-response",
          content: "[Resposta vazia recebida da OpenAI]",
        });
      }
    } catch (err) {
      // AbortError = usuário clicou em Stop. Mantém o que já apareceu, sem erro.
      if (err instanceof DOMException && err.name === "AbortError") {
        if (responseId === null) {
          removeMessage(commentId);
        }
      } else {
        if (responseId === null) {
          removeMessage(commentId);
        }
        const errorMsg =
          err instanceof ProviderError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Erro desconhecido.";
        addMessage({
          type: "ai-response",
          content: `[Erro] ${errorMsg}`,
        });
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  return (
    <AppContext.Provider value={plugin.app}>
      <div className="axxa-root">
        <Header version={plugin.manifest.version} />
        <ChatArea />
        <Composer onSend={handleSend} onStop={handleStop} streaming={isLoading} />
      </div>
    </AppContext.Provider>
  );
}
