// src/views/AxxaApp.tsx
// Layout completo do chat — header + área scrollável + composer.
// Por enquanto sem provider OpenAI (vem no Módulo 1.3).
// Inclui um seed de mock data pra você ver os 4 tipos de mensagem.

import { useEffect } from "react";
import type AxxaPlugin from "../main";
import { Header } from "../components/layout/Header";
import { ChatArea } from "../components/chat/ChatArea";
import { Composer } from "../components/composer/Composer";
import { useChatStore } from "../store/chat";

interface AxxaAppProps {
  plugin: AxxaPlugin;
}

export function AxxaApp({ plugin }: AxxaAppProps) {
  const addMessage = useChatStore((s) => s.addMessage);
  const messageCount = useChatStore((s) => s.messages.length);

  // Seed de exemplo na primeira montagem — pra você ver os 4 tipos.
  // Quando o Módulo 1.3 plugar a OpenAI, removemos esse bloco.
  useEffect(() => {
    if (messageCount > 0) return;
    addMessage({
      type: "user",
      content: "oi, me mostra como o chat se comporta com os 4 tipos de mensagem",
    });
    addMessage({
      type: "ai-response",
      content:
        "Esse aqui é o tipo padrão da IA — texto sem bubble, alinhado à esquerda, com os footer buttons abaixo (copiar, regenerar, curtir, descurtir). Toda resposta normal vem assim.",
    });
    addMessage({
      type: "ai-comment",
      content: "Buscando arquivos no vault...",
    });
    addMessage({
      type: "ai-options",
      prompt: "Qual estilo prefere pra continuar?",
      options: ["Mais conciso", "Mais detalhado", "Estilo atual"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = (text: string) => {
    addMessage({ type: "user", content: text });
    // No Módulo 1.3, aqui é onde a chamada à OpenAI vai disparar.
  };

  return (
    <div className="axxa-root">
      <Header version={plugin.manifest.version} />
      <ChatArea />
      <Composer onSend={handleSend} />
    </div>
  );
}
