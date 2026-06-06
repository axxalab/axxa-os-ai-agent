// src/components/chat/ChatArea.tsx
// Container scrollável com:
//   - Day separators automáticos
//   - Sticky-bottom scroll inteligente (ChatGPT-style):
//       * Padrão: auto-scrola pra base a cada novo token/msg
//       * User scrolla pra cima: desativa auto-scroll
//       * User volta à base: reativa auto-scroll
//       * User manda nova mensagem (qualquer estado): FORÇA reativação
//   - Botão flutuante "back to bottom" quando navegação tá acima

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useChatStore } from "../../store/chat";
import { UserBubble, AIResponse, AIComment, AIOptions } from "./Messages";
import { dayKey, formatDayLabel } from "../_shared/timestamps";
import { Icon } from "../_shared/Icon";

const SCROLL_BOTTOM_THRESHOLD = 30; // px

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
  const shouldStickRef = useRef(true);
  const [showBackToBottom, setShowBackToBottom] = useState(false);

  // Listener de scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const atBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_BOTTOM_THRESHOLD;
      shouldStickRef.current = atBottom;
      setShowBackToBottom(!atBottom);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll quando messages muda
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    // Nova mensagem do USER força reativação do sticky-bottom
    // (cobre o caso: user scrollou pra ler, mas mandou nova msg → quer ver tudo)
    if (lastMsg?.type === "user") {
      shouldStickRef.current = true;
      setShowBackToBottom(false);
    }

    if (!shouldStickRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleBackToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    shouldStickRef.current = true;
    setShowBackToBottom(false);
  };

  // Monta items com day separators
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
    <div className="axxa-chat-area-wrapper">
      <div ref={scrollRef} className="axxa-chat-area">
        {items}
      </div>
      {showBackToBottom && (
        <button
          type="button"
          className="axxa-back-to-bottom"
          onClick={handleBackToBottom}
          aria-label="Voltar pra base"
          title="Voltar pra base"
        >
          <Icon name="arrow-down" />
        </button>
      )}
    </div>
  );
}
