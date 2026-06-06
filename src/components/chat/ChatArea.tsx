// src/components/chat/ChatArea.tsx
// Container scrollável que renderiza a lista de mensagens com day separators
// automáticos ("Hoje" / "Ontem" / "12 de junho") sempre que o dia muda entre
// duas mensagens consecutivas.
//
// Auto-scroll a cada mudança em messages — pega adição de mensagem nova E
// append de token durante streaming.

import { useEffect, useRef, type ReactNode } from "react";
import { useChatStore } from "../../store/chat";
import { UserBubble, AIResponse, AIComment, AIOptions } from "./Messages";
import { dayKey, formatDayLabel } from "../_shared/timestamps";

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="axxa-day-separator">
      <span>{label}</span>
    </div>
  );
}

export function ChatArea() {
  const messages = useChatStore((s) => s.messages);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div ref={scrollRef} className="axxa-chat-area axxa-chat-empty">
        <p className="axxa-empty-hint">
          Comece uma conversa — digite uma mensagem abaixo.
        </p>
      </div>
    );
  }

  // Monta a lista intercalando separadores de dia quando o dia muda
  const items: ReactNode[] = [];
  let lastDayKey: string | null = null;
  for (const m of messages) {
    const key = dayKey(m.timestamp);
    if (key !== lastDayKey) {
      items.push(
        <DaySeparator key={`day-${m.id}`} label={formatDayLabel(m.timestamp)} />
      );
      lastDayKey = key;
    }
    switch (m.type) {
      case "user":
        items.push(<UserBubble key={m.id} msg={m} />);
        break;
      case "ai-response":
        items.push(<AIResponse key={m.id} msg={m} />);
        break;
      case "ai-comment":
        items.push(<AIComment key={m.id} msg={m} />);
        break;
      case "ai-options":
        items.push(<AIOptions key={m.id} msg={m} />);
        break;
    }
  }

  return (
    <div ref={scrollRef} className="axxa-chat-area">
      {items}
    </div>
  );
}
