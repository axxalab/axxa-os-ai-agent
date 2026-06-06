// src/components/chat/ChatArea.tsx
// Container scrollável que renderiza a lista de mensagens.
// Auto-scroll pro fim quando uma nova mensagem chega (igual ChatGPT).

import { useEffect, useRef } from "react";
import { useChatStore } from "../../store/chat";
import { UserBubble, AIResponse, AIComment, AIOptions } from "./Messages";

export function ChatArea() {
  const messages = useChatStore((s) => s.messages);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll quando o número de mensagens aumenta.
    // O usuário ainda pode scrollar pra cima manualmente entre updates.
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div ref={scrollRef} className="axxa-chat-area axxa-chat-empty">
        <p className="axxa-empty-hint">
          Comece uma conversa — digite uma mensagem abaixo.
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="axxa-chat-area">
      {messages.map((m) => {
        switch (m.type) {
          case "user":
            return <UserBubble key={m.id} msg={m} />;
          case "ai-response":
            return <AIResponse key={m.id} msg={m} />;
          case "ai-comment":
            return <AIComment key={m.id} msg={m} />;
          case "ai-options":
            return <AIOptions key={m.id} msg={m} />;
        }
      })}
    </div>
  );
}
