// src/components/chat/ChatArea.tsx
// Container scrollável com:
//   - Day separators automáticos
//   - Sticky-bottom scroll inteligente (ChatGPT-style)
//   - Botão flutuante "back to bottom" quando navegação tá acima
//   - Busca dentro da conversa (searchQuery): filtra user/ai-response que casam

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useChatStore } from "../../store/chat";
import { UserBubble, AIResponse, AIComment, AIOptions } from "./Messages";
import { dayKey, formatDayLabel } from "../_shared/timestamps";
import { Icon } from "../_shared/Icon";
import { useT } from "../../i18n";

const SCROLL_BOTTOM_THRESHOLD = 30; // px

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="axxa-day-separator">
      <span>{label}</span>
    </div>
  );
}

export function ChatArea({ searchQuery = "" }: { searchQuery?: string }) {
  const messages = useChatStore((s) => s.messages);
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldStickRef = useRef(true);
  const [showBackToBottom, setShowBackToBottom] = useState(false);

  const query = searchQuery.trim().toLowerCase();
  const searching = query.length > 0;

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

  // Auto-scroll quando messages muda (desativado durante busca — a lista muda)
  useEffect(() => {
    if (searching) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.type === "user") {
      shouldStickRef.current = true;
      setShowBackToBottom(false);
    }
    if (!shouldStickRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, searching]);

  const handleBackToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    shouldStickRef.current = true;
    setShowBackToBottom(false);
  };

  // Monta items
  const items: ReactNode[] = [];
  let matchCount = 0;

  if (searching) {
    // Busca: só user/ai-response que contêm o termo (sem day separators)
    for (const m of messages) {
      if (m.type !== "user" && m.type !== "ai-response") continue;
      if (!m.content.toLowerCase().includes(query)) continue;
      matchCount++;
      if (m.type === "user") items.push(<UserBubble key={m.id} msg={m} />);
      else items.push(<AIResponse key={m.id} msg={m} />);
    }
  } else {
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
  }

  return (
    <div className="axxa-chat-area-wrapper">
      {searching && (
        <div className="axxa-chat-search-count">
          {matchCount > 0
            ? t.chat.searchResults(matchCount)
            : t.chat.searchNoResults}
        </div>
      )}
      <div ref={scrollRef} className="axxa-chat-area">
        {items}
      </div>
      {!searching && showBackToBottom && (
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
