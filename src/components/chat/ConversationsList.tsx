// src/components/chat/ConversationsList.tsx
// Tela cheia mostrando TODAS as conversas salvas (todos os modos: chat /
// vault-qa / agent). Tem search inline + agrupa por dia (Hoje / Ontem /
// data) + filtros de provider E modo + sort. Mesmo visual dos recent
// chats da StarterScreen — só que aqui mostra tudo.
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
  onRenameChat: (chat: ChatSummary) => void;
  onClose: () => void;
}

type SortKey =
  | "date-desc"
  | "date-asc"
  | "title-asc"
  | "msgs-desc"
  | "tokens-desc";

const PROVIDER_FILTERS = [
  "all",
  "openai",
  "anthropic",
  "gemini",
  "openrouter",
  "nim",
  "ollama",
] as const;
type ProviderFilter = (typeof PROVIDER_FILTERS)[number];

const MODE_FILTERS = ["all", "chat", "vault-qa", "agent"] as const;
type ModeFilter = (typeof MODE_FILTERS)[number];

function providerLabel(id: ProviderFilter, allLabel: string): string {
  switch (id) {
    case "all": return allLabel;
    case "openai": return "OpenAI";
    case "anthropic": return "Anthropic";
    case "gemini": return "Gemini";
    case "openrouter": return "OpenRouter";
    case "nim": return "Nvidia NIM";
    case "ollama": return "Ollama";
  }
}

function modeLabel(id: ModeFilter, allLabel: string): string {
  switch (id) {
    case "all": return allLabel;
    case "chat": return "Chat";
    case "vault-qa": return "Vault Q&A";
    case "agent": return "Agent";
  }
}

function modeIcon(mode: string): string {
  switch (mode) {
    case "agent": return "bot";
    case "vault-qa": return "library";
    default: return "message-square";
  }
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
  onRenameChat,
  onClose,
}: ConversationsListProps) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");

  // Filtra: search + provider chip + mode chip
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return chats.filter((c) => {
      if (providerFilter !== "all" && c.provider !== providerFilter) return false;
      if (modeFilter !== "all" && c.mode !== modeFilter) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.model.toLowerCase().includes(q) ||
        c.provider.toLowerCase().includes(q) ||
        c.mode.toLowerCase().includes(q)
      );
    });
  }, [chats, search, providerFilter, modeFilter]);

  // Sort baseado na key escolhida
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortKey) {
      case "date-asc":
        arr.sort((a, b) => a.date.localeCompare(b.date));
        break;
      case "title-asc":
        arr.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
        break;
      case "msgs-desc":
        arr.sort((a, b) => b.messageCount - a.messageCount);
        break;
      case "tokens-desc":
        arr.sort(
          (a, b) => b.tokensIn + b.tokensOut - (a.tokensIn + a.tokensOut)
        );
        break;
      case "date-desc":
      default:
        arr.sort((a, b) => b.date.localeCompare(a.date));
    }
    return arr;
  }, [filtered, sortKey]);

  // Quando o sort não é por data, não agrupa (mostra lista plana)
  const groups = useMemo(() => {
    const map = new Map<string, ChatSummary[]>();
    if (sortKey === "date-desc" || sortKey === "date-asc") {
      for (const c of sorted) {
        const key = formatGroupDate(c.date);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
      }
    } else {
      // Sort não-data: 1 grupo só sem header
      if (sorted.length > 0) map.set("", sorted);
    }
    return Array.from(map.entries());
  }, [sorted, sortKey]);

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

      {/* Sort + provider filter chips + mode filter chips */}
      <div className="axxa-conversations-controls">
        <div className="axxa-conversations-sort">
          <Icon name="arrow-up-down" />
          <select
            className="dropdown"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="date-desc">{t.conversations.sortDateDesc}</option>
            <option value="date-asc">{t.conversations.sortDateAsc}</option>
            <option value="title-asc">{t.conversations.sortTitleAsc}</option>
            <option value="msgs-desc">{t.conversations.sortMsgsDesc}</option>
            <option value="tokens-desc">
              {t.conversations.sortTokensDesc}
            </option>
          </select>
        </div>

        <div className="axxa-conversations-filters">
          {MODE_FILTERS.map((id) => (
            <button
              key={`mode-${id}`}
              type="button"
              className={
                "axxa-filter-chip" +
                (modeFilter === id ? " axxa-filter-chip-active" : "")
              }
              onClick={() => setModeFilter(id)}
            >
              {modeLabel(id, t.conversations.filterAll)}
            </button>
          ))}
        </div>

        <div className="axxa-conversations-filters">
          {PROVIDER_FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              className={
                "axxa-filter-chip" +
                (providerFilter === id ? " axxa-filter-chip-active" : "")
              }
              onClick={() => setProviderFilter(id)}
            >
              {providerLabel(id, t.conversations.filterAll)}
            </button>
          ))}
        </div>
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
          <div key={dayLabel || "flat"} className="axxa-conversations-group">
            {dayLabel && (
              <div className="axxa-conversations-group-head">{dayLabel}</div>
            )}
            {items.map((c) => (
              <div key={c.id} className="axxa-recent-item-row">
                <button
                  type="button"
                  className="axxa-recent-item"
                  onClick={() => onLoadChat(c.id)}
                >
                  <div className="axxa-recent-title-row">
                    <Icon name={modeIcon(c.mode)} />
                    <span className="axxa-recent-title">{c.title}</span>
                  </div>
                  <div className="axxa-recent-meta">
                    <span className="axxa-recent-mode-chip">{c.mode}</span>
                    <span className="axxa-recent-meta-dot" aria-hidden="true" />
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
                <button
                  type="button"
                  className="axxa-recent-item-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRenameChat(c);
                  }}
                  aria-label={t.conversations.renameAria}
                  title={t.conversations.renameTitle}
                >
                  <Icon name="pencil" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
