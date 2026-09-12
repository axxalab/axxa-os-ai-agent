// src/ui/Drawer.tsx
// Menu lateral: a gaveta que guarda TODAS as opções do app — nova conversa,
// histórico de chats (abrir / renomear / apagar), Projects, Skills e Settings.
// Abre por cima do painel (scrim + slide), fecha no scrim, no Esc e sempre que
// leva o usuário pra algum lugar.

import { useEffect, useMemo, useRef, useState } from "react";
import type AxxaPlugin from "../main";
import type { ChatSession } from "../core/session";
import type { ChatSummary } from "../core/chatPersistence";
import { useChatStore } from "../store/chat";
import { Icon } from "./Icon";
import { openActions } from "./menu";
import { PromptModal, ConfirmModal, openPluginSettings } from "./modals";

export type ViewId = "chat" | "projects" | "skills";

const NAV: Array<{ id: ViewId; label: string; icon: string }> = [
  { id: "chat", label: "Chats", icon: "message-square" },
  { id: "projects", label: "Projects", icon: "folder-open" },
  { id: "skills", label: "Skills", icon: "sparkles" },
];

/** Acima disto o histórico ganha campo de busca. */
const SEARCH_FROM = 8;

export function Drawer({
  plugin,
  session,
  open,
  view,
  onNavigate,
  onClose,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  open: boolean;
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  onClose: () => void;
}) {
  const currentChatId = useChatStore((s) => s.currentChatId);
  const [chats, setChats] = useState<ChatSummary[]>(plugin.chatSummaries ?? []);
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void plugin.loadChatSummaries().then((all) => {
      if (alive) setChats(all);
    });
    const unsub = plugin.onChatsChange(() => setChats(plugin.chatSummaries ?? []));
    return () => {
      alive = false;
      unsub();
    };
  }, [plugin]);

  // Esc fecha; o foco vai pra gaveta quando ela abre.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Fechar a gaveta zera a busca (abrir de novo começa limpo).
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => (c.title || "Untitled").toLowerCase().includes(q));
  }, [chats, query]);

  const go = (id: ViewId) => {
    onNavigate(id);
    onClose();
  };

  const onNewChat = () => {
    session.newChat();
    go("chat");
  };

  const onOpenChat = (c: ChatSummary) => {
    void session.load(c);
    go("chat");
  };

  const onRename = async (c: ChatSummary) => {
    const title = await new PromptModal(plugin.app, {
      title: "Rename chat",
      label: "Title",
      initial: c.title,
      submitLabel: "Rename",
    }).openAndWait();
    if (title && title !== c.title) await session.rename(c, title);
  };

  const onDelete = async (c: ChatSummary) => {
    const ok = await new ConfirmModal(plugin.app, {
      title: `Delete "${c.title || "Untitled"}"?`,
      body: "The chat file goes to the system trash (recoverable).",
      confirmLabel: "Delete",
      danger: true,
    }).openAndWait();
    if (ok) await session.delete(c);
  };

  return (
    <div
      className={open ? "axxa-drawer-layer is-open" : "axxa-drawer-layer"}
      aria-hidden={!open}
    >
      <div className="axxa-scrim" onClick={onClose} />
      <aside
        ref={panelRef}
        className="axxa-drawer"
        role="dialog"
        aria-label="AXXA menu"
        tabIndex={-1}
      >
        <header className="axxa-drawer-head">
          <span className="axxa-brand">AXXA OS</span>
          <button
            type="button"
            className="axxa-icon-btn"
            aria-label="Close menu"
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
        </header>

        <button type="button" className="axxa-new-chat" onClick={onNewChat}>
          <Icon name="plus" />
          <span>New chat</span>
        </button>

        <nav className="axxa-drawer-nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              className={
                view === n.id ? "axxa-nav-item is-active" : "axxa-nav-item"
              }
              onClick={() => go(n.id)}
            >
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </button>
          ))}
          <button
            type="button"
            className="axxa-nav-item"
            onClick={() => {
              openPluginSettings(plugin);
              onClose();
            }}
          >
            <Icon name="settings" />
            <span>Settings</span>
          </button>
        </nav>

        <div className="axxa-drawer-section">
          <span className="axxa-section-label">Recents</span>
          {chats.length >= SEARCH_FROM && (
            <input
              type="search"
              className="axxa-search"
              value={query}
              placeholder="Search chats…"
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
          )}
        </div>

        <div className="axxa-history">
          {filtered.map((c) => (
            <div
              key={c.id}
              className={
                c.id === currentChatId
                  ? "axxa-history-row is-current"
                  : "axxa-history-row"
              }
            >
              <button
                type="button"
                className="axxa-history-open"
                onClick={() => onOpenChat(c)}
              >
                <span className="axxa-history-title">
                  {c.title || "Untitled"}
                </span>
                <span className="axxa-history-meta">
                  {c.mode} · {c.model} · {c.date.slice(0, 10)}
                </span>
              </button>
              <button
                type="button"
                className="axxa-icon-btn axxa-history-more"
                aria-label={`Actions for ${c.title || "Untitled"}`}
                onClick={(e) =>
                  openActions(e as unknown as MouseEvent, [
                    {
                      label: "Rename",
                      icon: "pencil",
                      run: () => void onRename(c),
                    },
                    {
                      label: "Delete",
                      icon: "trash-2",
                      danger: true,
                      run: () => void onDelete(c),
                    },
                  ])
                }
              >
                <Icon name="more-horizontal" />
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="axxa-empty-line">
              {chats.length === 0 ? "No chats yet." : "No chats match."}
            </p>
          )}
        </div>

        <footer className="axxa-drawer-foot">v{plugin.manifest.version}</footer>
      </aside>
    </div>
  );
}
