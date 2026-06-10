// src/components/layout/Sidebar.tsx
// Gaveta lateral ESQUERDA estilo Claude (v0.1.145) — abre pelo avatar no header.
// Scrim + painel que desliza da esquerda. Topo: brand + "Nova conversa" + busca.
// Lista de conversas agrupada por dia (Hoje/Ontem/data), itens minimalistas
// (dot do modo + título + data relativa). Rodapé: "Ver todas" + Settings.
//
// Sempre montado (toggle por classe) pra animar a entrada E a saída.

import { useMemo, useState } from "react";
import { Icon } from "../_shared/Icon";
import { useT, type Translations } from "../../i18n";
import type { ChatSummary } from "../_shared/chatPersistence";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  chats: ChatSummary[];
  onLoadChat: (chatId: string, chatMode: string) => void;
  onNewChat: () => void;
  /** "Ver todas" → tela cheia de conversas (com filtros/sort). */
  onOpenAll: () => void;
  onOpenSettings: () => void;
}

const MODE_COLOR: Record<string, string> = {
  chat: "var(--text-muted)",
  "vault-qa": "var(--color-cyan, #4cc9f0)",
  agent: "var(--color-purple, #a370f7)",
};
function modeColor(mode: string): string {
  return MODE_COLOR[mode] ?? "var(--text-muted)";
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function groupLabel(iso: string, t: Translations): string {
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

function relDate(iso: string, t: Translations): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
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

export function Sidebar({
  open,
  onClose,
  chats,
  onLoadChat,
  onNewChat,
  onOpenAll,
  onOpenSettings,
}: SidebarProps) {
  const t = useT();
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const q = search.toLowerCase().trim();
    const arr = [...chats].sort((a, b) => b.date.localeCompare(a.date));
    const filtered = q
      ? arr.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.model.toLowerCase().includes(q) ||
            c.mode.toLowerCase().includes(q)
        )
      : arr;
    const map = new Map<string, ChatSummary[]>();
    for (const c of filtered) {
      const k = groupLabel(c.date, t);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    }
    return Array.from(map.entries());
  }, [chats, search, t]);

  return (
    <>
      <div
        className={"axxa-sidebar-scrim" + (open ? " axxa-sidebar-scrim-open" : "")}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={"axxa-sidebar" + (open ? " axxa-sidebar-open" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={t.header.conversations}
        aria-hidden={!open}
      >
        <div className="axxa-sidebar-head">
          <span className="axxa-sidebar-brand">
            <span className="axxa-sidebar-avatar">
              <Icon name="user-round" />
            </span>
            AXXA OS
          </span>
          <button
            type="button"
            className="axxa-sidebar-close"
            onClick={onClose}
            aria-label={t.conversations.back}
          >
            <Icon name="x" />
          </button>
        </div>

        <button
          type="button"
          className="axxa-sidebar-new"
          onClick={() => {
            onNewChat();
            onClose();
          }}
        >
          <Icon name="message-square-plus" />
          {t.header.newChat}
        </button>

        <div className="axxa-sidebar-search">
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
              className="axxa-sidebar-search-clear"
              onClick={() => setSearch("")}
              aria-label={t.conversations.back}
            >
              <Icon name="x" />
            </button>
          )}
        </div>

        <div className="axxa-sidebar-list">
          {groups.length === 0 && (
            <div className="axxa-sidebar-empty">
              <Icon name="inbox" />
              <p>
                {search ? t.conversations.emptySearch : t.conversations.emptyAll}
              </p>
            </div>
          )}
          {groups.map(([label, items]) => (
            <div key={label} className="axxa-sidebar-group">
              <div className="axxa-sidebar-group-head">{label}</div>
              {items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="axxa-sidebar-item"
                  data-mode={c.mode}
                  onClick={() => {
                    onLoadChat(c.id, c.mode);
                    onClose();
                  }}
                >
                  <span
                    className="axxa-sidebar-item-dot"
                    style={{ background: modeColor(c.mode) }}
                  />
                  <span className="axxa-sidebar-item-title">{c.title}</span>
                  <span className="axxa-sidebar-item-date">
                    {relDate(c.date, t)}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="axxa-sidebar-foot">
          <button
            type="button"
            className="axxa-sidebar-foot-btn"
            onClick={() => {
              onOpenAll();
              onClose();
            }}
          >
            <Icon name="layout-list" />
            {t.dashboard.viewAll}
          </button>
          <button
            type="button"
            className="axxa-sidebar-foot-btn"
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
          >
            <Icon name="settings" />
            {t.header.openSettings}
          </button>
        </div>
      </aside>
    </>
  );
}
