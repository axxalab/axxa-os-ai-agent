// src/views/AxxaApp.tsx
// Layout completo do chat com integração OpenAI (Módulo 1.3).
// Fluxo no send:
//   1. Adiciona bubble do user
//   2. Adiciona ai-comment "Pensando..." (com ícone animado)
//   3. Trava o composer (isLoading = true)
//   4. Chama OpenAI via provider
//   5. Remove o "Pensando..." e adiciona a resposta da IA
//   6. Libera o composer

import type AxxaPlugin from "../main";
import { Header } from "../components/layout/Header";
import { ChatArea } from "../components/chat/ChatArea";
import { Composer } from "../components/composer/Composer";
import { useChatStore } from "../store/chat";
import { openaiProvider } from "../providers/openai";
import type { ProviderMessage } from "../providers/base";

interface AxxaAppProps {
  plugin: AxxaPlugin;
}

const SYSTEM_PROMPT =
  "Você é o AXXA Agent, um assistente integrado ao Obsidian. " +
  "Responda em português, de forma clara, direta e útil. " +
  "Quando fizer sentido, use Markdown.";

export function AxxaApp({ plugin }: AxxaAppProps) {
  const isLoading = useChatStore((s) => s.isLoading);

  const handleSend = async (text: string) => {
    const { addMessage, removeMessage, setLoading } = useChatStore.getState();

    // 1. Adiciona a mensagem do user
    addMessage({ type: "user", content: text });

    // 2. Adiciona o "Pensando..." (vai sumir quando a resposta chegar)
    const commentId = addMessage({ type: "ai-comment", content: "Pensando..." });
    setLoading(true);

    try {
      // Monta o histórico convertendo nossos types pros roles da OpenAI.
      // Filtra ai-comment e ai-options (não fazem parte da conversa real).
      const history: ProviderMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
        ...useChatStore.getState().messages
          .filter((m) => m.type === "user" || m.type === "ai-response")
          .map((m) => ({
            role: (m.type === "user" ? "user" : "assistant") as "user" | "assistant",
            content: (m as { content: string }).content,
          })),
      ];

      const response = await openaiProvider.chat(
        {
          model: plugin.settings.defaultModel,
          messages: history,
        },
        plugin.settings.openaiApiKey
      );

      removeMessage(commentId);
      addMessage({ type: "ai-response", content: response.content });
    } catch (err) {
      removeMessage(commentId);
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido.";
      addMessage({
        type: "ai-response",
        content: `[Erro] ${errorMsg}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="axxa-root">
      <Header version={plugin.manifest.version} />
      <ChatArea />
      <Composer onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
