// src/components/chat/ChatArea.tsx
// Container scrollável com:
//   - Day separators automáticos
//   - Sticky-bottom scroll inteligente (ChatGPT-style)
//   - Botão flutuante "back to bottom" quando navegação tá acima
//   - highlightTarget: pula + destaca uma mensagem (resultado da busca)

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useChatStore } from "../../store/chat";
import {
  UserBubble,
  AIResponse,
  AIComment,
  AIOptions,
  ErrorMessage,
  ResponseSkeleton,
  ConversationSkeleton,
} from "./Messages";
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

export function ChatArea({
  highlightTarget,
}: {
  /** Mensagem a destacar (resultado da busca). `n` = nonce pra re-disparar. */
  highlightTarget?: { id: string; n: number } | null;
}) {
  const t = useT();
  const messages = useChatStore((s) => s.messages);
  // Janela "pending": mandou a mensagem, o modelo ainda NÃO emitiu o 1º token de
  // conteúdo (streamingMessageId só é setado no 1º token). Aí mostramos o
  // skeleton da resposta — some quando o markdown começa a renderizar.
  const isLoading = useChatStore((s) => s.isLoading);
  const streamingId = useChatStore((s) => s.streamingMessageId);
  const showSkeleton = isLoading && !streamingId;
  // Carregando conversa antiga do disco → skeleton de conversa no lugar das msgs.
  const loadingChat = useChatStore((s) => s.loadingChat);
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
    if (lastMsg?.type === "user") {
      shouldStickRef.current = true;
      setShowBackToBottom(false);
    }
    if (!shouldStickRef.current) return;
    // v0.1.228: coalesce o scroll num único rAF pra evitar layout thrash —
    // durante o stream esse efeito dispara a cada token; sem isso, lia
    // scrollHeight e escrevia scrollTop por token.
    const raf = window.requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
    // showSkeleton na dep: quando o skeleton aparece/some a altura muda → mantém
    // a visão colada no fim (se já estava no fim).
  }, [messages, showSkeleton]);

  // Pula + destaca a mensagem escolhida na busca
  useEffect(() => {
    const id = highlightTarget?.id;
    if (!id) return;
    const root = scrollRef.current;
    if (!root) return;
    // v0.1.228: CSS.escape pra não quebrar com ids contendo aspas/caracteres especiais
    const el = root.querySelector(
      `[data-msg-id="${CSS.escape(id)}"]`
    ) as HTMLElement | null;
    if (!el) return;
    shouldStickRef.current = false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("axxa-msg-highlight");
    const timer = window.setTimeout(
      () => el.classList.remove("axxa-msg-highlight"),
      2200
    );
    return () => window.clearTimeout(timer);
  }, [highlightTarget]);

  const handleBackToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    shouldStickRef.current = true;
    setShowBackToBottom(false);
  };

  // Monta items com day separators. Carregando conversa antiga → só o skeleton
  // de conversa (esconde as mensagens stale até a nova reidratar/renderizar).
  const items: ReactNode[] = [];
  if (loadingChat) {
    items.push(<ConversationSkeleton key="conversation-skeleton" />);
  }
  let lastDayKey: string | null = null;
  for (const m of loadingChat ? [] : messages) {
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
        items.push(
          m.isError ? (
            <ErrorMessage key={m.id} msg={m} />
          ) : (
            <AIResponse key={m.id} msg={m} />
          )
        );
        break;
      case "ai-comment":
        items.push(<AIComment key={m.id} msg={m} />);
        break;
      case "ai-options":
        items.push(<AIOptions key={m.id} msg={m} />);
        break;
    }
  }
  // Skeleton da resposta que está por vir (só na janela pending, antes do 1º
  // token de conteúdo). Fica após o "Pensando..." e some quando o markdown chega.
  if (showSkeleton && !loadingChat) {
    items.push(<ResponseSkeleton key="response-skeleton" />);
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
          aria-label={t.chat.backToBottom}
          title={t.chat.backToBottom}
        >
          <Icon name="arrow-down" />
        </button>
      )}
    </div>
  );
}
