// src/components/chat/ConversationsList.tsx
// Tela cheia mostrando TODAS as conversas salvas (não só as recentes).
// Tem search inline + agrupa por dia (Hoje / Ontem / data). Mesmo visual
// dos recent chats da StarterScreen — só que aqui mostra tudo.
//
// AxxaApp gerencia o state `view: "chat" | "conversations"` e injeta esse
// componente no body quando view==="conversations".

import { useMemo, useState } from "react";
import { Icon } from "../_shared/Icon";
import { useT } from "../../i18n";
import { formatTokens } from "../_shared/contextWindows";
import type { ChatSummary } from "../_shared/chatPersistence";

interface ConversationsListProps {
  chats: ChatSummary[];
  onLoadChat: (chatId: string) => void;
  onClose: () => void;
}

function formatGroupDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
    if (isSameDay(d, now)) return "Hoje";
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (isSameDay(d, y)) return "Ontem";
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatRelativeDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return iso.slice(0, 10);
  }
}

export function ConversationsList({
  chats,
  onLoadChat,
  onClose,
}: ConversationsListProps) {
  const t = useT();
  const [search, setSearch] = useState("");

  // Filtra por título/model (case-insensitive)
  const filtered = useMemo(() => {
    if (!search.trim()) return chats;
    const q = search.toLowerCase().trim();
    return chats.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.model.toLowerCase().includes(q) ||
        c.provider.toLowerCase().includes(q)
    );
  }, [chats, search]);

  // Agrupa por dia (a lista já vem ordenada desc do listChats)
  const groups = useMemo(() => {
    const map = new Map<string, ChatSummary[]>();
    for (const c of filtered) {
      const key = formatGroupDate(c.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="axxa-conversations">
      <div className="axxa-conversations-head">
        <button
          type="button"
          className="axxa-conversations-back"
          onClick={onClose}
          aria-label={t.conversations.back}
          title={t.conversations.back}
        >
          <Icon name="arrow-left" />
        </button>
        <h2 className="axxa-conversations-title">{t.conversations.title}</h2>
        <span className="axxa-conversations-count">
          {filtered.length}/{chats.length}
        </span>
      </div>

      <div className="axxa-conversations-search">
        <Icon name="search" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.conversations.searchPlaceholder}
        />
        {search && (
          <button
            type="button"
            className="axxa-conversations-search-clear"
            onClick={() => setSearch("")}
            aria-label="Limpar"
          >
            <Icon name="x" />
          </button>
        )}
      </div>

      <div className="axxa-conversations-list">
        {groups.length === 0 && (
          <div className="axxa-conversations-empty">
            <Icon name="inbox" />
            <p>
              {search
                ? t.conversations.emptySearch
                : t.conversations.emptyAll}
            </p>
          </div>
        )}
        {groups.map(([dayLabel, items]) => (
          <div key={dayLabel} className="axxa-conversations-group">
            <div className="axxa-conversations-group-head">{dayLabel}</div>
            {items.map((c) => (
              <button
                key={c.id}
                type="button"
                className="axxa-recent-item"
                onClick={() => onLoadChat(c.id)}
              >
                <div className="axxa-recent-title">{c.title}</div>
                <div className="axxa-recent-meta">
                  <span>{formatRelativeDate(c.date)}</span>
                  <span className="axxa-recent-meta-dot" aria-hidden="true" />
                  <span>{c.model}</span>
                  <span className="axxa-recent-meta-dot" aria-hidden="true" />
                  <span>{c.messageCount} msgs</span>
                  <span className="axxa-recent-meta-dot" aria-hidden="true" />
                  <span>
                    {formatTokens(c.tokensIn + c.tokensOut)} tokens
                  </span>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
