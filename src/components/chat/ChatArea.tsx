// src/components/chat/ChatArea.tsx
// Container scrollável que renderiza a lista de mensagens com day separators
// automáticos ("Hoje" / "Ontem" / "12 de junho") sempre que o dia muda.
//
// Sticky-bottom scroll (estilo ChatGPT):
//   - Por padrão, auto-scrola pra base a cada novo token/mensagem
//   - Se o user scrolar pra cima, desativa o auto-scroll
//   - Se o user voltar à base manualmente, reativa o auto-scroll
// Implementado via ref (shouldStickRef) atualizado em scroll events.

import { useEffect, useRef, type ReactNode } from "react";
import { useChatStore } from "../../store/chat";
import { UserBubble, AIResponse, AIComment, AIOptions } from "./Messages";
import { dayKey, formatDayLabel } from "../_shared/timestamps";

const SCROLL_BOTTOM_THRESHOLD = 30; // px — distância considerada "na base"

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
  // true = user quer ficar grudado na base (auto-scroll ativo)
  // false = user scrollou pra cima e quer ler (auto-scroll pausado)
  const shouldStickRef = useRef(true);

  // Listener de scroll — atualiza shouldStick com base na posição atual
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const atBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_BOTTOM_THRESHOLD;
      shouldStickRef.current = atBottom;
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll a cada mudança em messages — mas só se o user quer stick
  useEffect(() => {
    if (!shouldStickRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

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

  // Mesma <div> em ambos os estados (vazio vs com mensagens) — assim o ref do
  // scroll listener não muda entre re-renders. Empty state alterna via classe.
  const isEmpty = messages.length === 0;
  return (
    <div
      ref={scrollRef}
      className={"axxa-chat-area" + (isEmpty ? " axxa-chat-empty" : "")}
    >
      {isEmpty ? (
        <p className="axxa-empty-hint">
          Comece uma conversa — digite uma mensagem abaixo.
        </p>
      ) : (
        items
      )}
    </div>
  );
}
