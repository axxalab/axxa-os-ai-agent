// src/components/chat/ConversationsList.tsx
// Tela cheia com TODAS as conversas salvas (chat / vault-qa / agent).
// v0.1.136 (redesign UX): search inline + sort + FILTRO DE MODO usando o
// SegmentedRow do StarterScreen (pílula deslizante, icon-only) + agrupamento
// por dia (Hoje / Ontem / data) + itens ricos (avatar do modo + título + data
// relativa + chips + chevron), no mesmo padrão dos "recentes" da home.

import { useMemo, useState } from "react";
import { Icon } from "../_shared/Icon";
import { InfoChip } from "../_shared/InfoChip";
import { SegmentedRow } from "../_shared/SegmentedRow";
import { useT, type Translations } from "../../i18n";
import { formatTokens } from "../_shared/contextWindows";
import type { ChatSummary } from "../_shared/chatPersistence";

interface ConversationsListProps {
  chats: ChatSummary[];
  onLoadChat: (chatId: string) => void;
  onClose: () => void;
  /** Chips visíveis em cada item (curado em Settings → Outros → Chips). */
  visibleChips: string[];
}

type SortKey =
  | "date-desc"
  | "date-asc"
  | "title-asc"
  | "msgs-desc"
  | "tokens-desc";

const MODE_FILTERS = ["all", "chat", "vault-qa", "agent"] as const;
type ModeFilter = (typeof MODE_FILTERS)[number];

// Cores semânticas — mesmo padrão do status line do Composer / recentes da home
const CHIP_COLORS = {
  mode: "var(--color-pink, #f472b6)",
  model: "var(--color-purple, #a370f7)",
  date: "var(--text-muted)",
  messages: "var(--color-cyan, #4cc9f0)",
  tokens: "var(--color-green, #06d6a0)",
} as const;

function modeIcon(mode: string): string {
  switch (mode) {
    case "agent": return "bot";
    case "vault-qa": return "library";
    default: return "message-square";
  }
}

/** Ícone do filtro de modo (inclui "Todos"). */
function modeFilterIcon(id: ModeFilter): string {
  switch (id) {
    case "all": return "layout-grid";
    case "chat": return "message-square";
    case "vault-qa": return "library";
    case "agent": return "bot";
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

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatGroupDate(iso: string, t: Translations): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    if (isSameDay(d, now)) return t.conversations.today;
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (isSameDay(d, y)) return t.conversations.yesterday;
    return d.toLocaleDateString(t.dashboard.dateLocale, {
      day: "2-digit",
      month: "short",
      year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatRelativeDate(iso: string, t: Translations): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60_000);
    if (diffMin < 1) return t.dashboard.relNow;
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d`;
    return d.toLocaleDateString(t.dashboard.dateLocale, {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function ConversationsList({
  chats,
  onLoadChat,
  onClose,
  visibleChips,
}: ConversationsListProps) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");

  // Filtra: search + modo
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return chats.filter((c) => {
      if (modeFilter !== "all" && c.mode !== modeFilter) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.model.toLowerCase().includes(q) ||
        c.provider.toLowerCase().includes(q) ||
        c.mode.toLowerCase().includes(q)
      );
    });
  }, [chats, search, modeFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortKey) {
      case "date-asc":
        arr.sort((a, b) => a.date.localeCompare(b.date));
        break;
      case "title-asc":
        arr.sort((a, b) => a.title.localeCompare(b.title, t.dashboard.dateLocale));
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
  }, [filtered, sortKey, t.dashboard.dateLocale]);

  // Agrupa por dia só quando o sort é por data; senão lista plana.
  const groups = useMemo(() => {
    const map = new Map<string, ChatSummary[]>();
    if (sortKey === "date-desc" || sortKey === "date-asc") {
      for (const c of sorted) {
        const key = formatGroupDate(c.date, t);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
      }
    } else if (sorted.length > 0) {
      map.set("", sorted);
    }
    return Array.from(map.entries());
  }, [sorted, sortKey, t]);

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
            aria-label={t.conversations.back}
          >
            <Icon name="x" />
          </button>
        )}
      </div>

      {/* Filtro de MODO — herda o SegmentedRow (pílula deslizante) do Starter.
          Sort fica num select compacto ao lado. */}
      <div className="axxa-conversations-controls">
        <SegmentedRow
          items={MODE_FILTERS.map((id) => ({
            id,
            icon: modeFilterIcon(id),
            label: modeLabel(id, t.conversations.filterAll),
          }))}
          activeId={modeFilter}
          onSelect={(id) => setModeFilter(id as ModeFilter)}
        />
        <div className="axxa-conversations-sort">
          <Icon name="arrow-up-down" />
          <select
            className="dropdown"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label={t.conversations.sortDateDesc}
          >
            <option value="date-desc">{t.conversations.sortDateDesc}</option>
            <option value="date-asc">{t.conversations.sortDateAsc}</option>
            <option value="title-asc">{t.conversations.sortTitleAsc}</option>
            <option value="msgs-desc">{t.conversations.sortMsgsDesc}</option>
            <option value="tokens-desc">{t.conversations.sortTokensDesc}</option>
          </select>
        </div>
      </div>

      <div className="axxa-conversations-list">
        {groups.length === 0 && (
          <div className="axxa-conversations-empty">
            <Icon name="inbox" />
            <p>
              {search ? t.conversations.emptySearch : t.conversations.emptyAll}
            </p>
          </div>
        )}
        {groups.map(([dayLabel, items]) => (
          <div key={dayLabel || "flat"} className="axxa-conversations-group">
            {dayLabel && (
              <div className="axxa-conversations-group-head">{dayLabel}</div>
            )}
            {items.map((c) => (
              <button
                key={c.id}
                type="button"
                className="axxa-recent-item"
                data-mode={c.mode}
                onClick={() => onLoadChat(c.id)}
              >
                <span className="axxa-recent-logo">
                  <Icon name={modeIcon(c.mode)} />
                </span>
                <span className="axxa-recent-main">
                  <span className="axxa-recent-top">
                    <span className="axxa-recent-title">{c.title}</span>
                    <span className="axxa-recent-date">
                      {formatRelativeDate(c.date, t)}
                    </span>
                  </span>
                  <span className="axxa-composer-info axxa-recent-status">
                    {visibleChips.includes("model") && (
                      <InfoChip icon="cpu" color={CHIP_COLORS.model}>
                        {c.model}
                      </InfoChip>
                    )}
                    {visibleChips.includes("messages") && (
                      <InfoChip
                        icon="message-square"
                        color={CHIP_COLORS.messages}
                      >
                        {c.messageCount}
                      </InfoChip>
                    )}
                    {visibleChips.includes("tokens") && (
                      <InfoChip icon="sigma" color={CHIP_COLORS.tokens}>
                        {formatTokens(c.tokensIn + c.tokensOut)}
                      </InfoChip>
                    )}
                  </span>
                </span>
                <span className="axxa-recent-chevron">
                  <Icon name="chevron-right" />
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
