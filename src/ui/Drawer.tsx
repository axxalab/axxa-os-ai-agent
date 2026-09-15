// src/ui/Drawer.tsx
// Menu lateral: a gaveta que guarda TODAS as opções do app — Projects, Skills,
// Settings e, principalmente, a porta de entrada de cada MÓDULO.
// Abre por cima do painel (scrim + slide), fecha no scrim, no Esc e sempre que
// leva o usuário pra algum lugar.
//
// DOIS NÍVEIS. A raiz lista os módulos (Chat, Vault Q&A, Agent) com quantas
// conversas cada um tem e quando foi a última; tocar num deles ABRE A TELA
// daquele módulo, com seta pra voltar, busca e "New chat" próprios.
//
// Por que não uma lista só com etiqueta de modo, como era: as conversas dos
// três se misturavam numa pilha ordenada por data, então achar "aquela
// conversa do Agent" era caçar entre chats e perguntas do vault. Eles não
// competem pela mesma atenção — cada um é um lugar.

import { Platform } from "obsidian";
import { useEffect, useMemo, useRef, useState } from "react";
import type AxxaPlugin from "../main";
import { isChatMode, type ChatSession } from "../core/session";
import type { ChatSummary } from "../core/chatPersistence";
import { useChatStore } from "../store/chat";
import { Icon } from "./Icon";
import { openActions } from "./menu";
import { PromptModal, ConfirmModal, openPluginSettings } from "./modals";
import {
  chatsOfModule,
  moduleHint,
  moduleLabel,
  moduleNewLabel,
  moduleStats,
  modulesInUse,
} from "./modules";

export type ViewId = "chat" | "projects" | "skills";

/** O resto do menu — o que não é módulo. */
const NAV: Array<{ id: ViewId; label: string; icon: string }> = [
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
  const sessionMode = useChatStore((s) => s.sessionMode);
  const [chats, setChats] = useState<ChatSummary[]>(plugin.chatSummaries ?? []);
  const [query, setQuery] = useState("");
  /** null = raiz do menu; um modo = a tela daquele módulo. String solta, e
   *  não `ChatMode`, porque o menu também abre módulos que só existem no
   *  disco (ver `modulesInUse`). */
  const [modulo, setModulo] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Qual módulo está em uso agora — a conversa aberta manda; sem conversa
  // aberta, o padrão das Settings. Marca a linha na raiz.
  const moduloAtual = isChatMode(sessionMode)
    ? sessionMode
    : isChatMode(plugin.settings.defaultMode)
      ? plugin.settings.defaultMode
      : "chat";

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
    // Sem preventScroll o foco rola o ancestral atrás da gaveta (ela também
    // entra deslocada) — o mesmo pulo da folha.
    panelRef.current?.focus({ preventScroll: true });
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Fechar a gaveta zera a busca E volta pra raiz: abrir de novo começa
  // limpo, no lugar de reabrir dentro de um módulo que já foi.
  useEffect(() => {
    if (open) return;
    setQuery("");
    setModulo(null);
  }, [open]);

  // Trocar de tela zera a busca — o que foi digitado era pergunta pra a lista
  // anterior, e uma busca invisível que some com as conversas é uma armadilha.
  useEffect(() => {
    setQuery("");
  }, [modulo]);

  /** Os três do motor + qualquer outro que apareça nas conversas gravadas. */
  const modulosVisiveis = useMemo(() => modulesInUse(chats), [chats]);

  /** As conversas do módulo aberto, já passadas pela busca. */
  const doModulo = useMemo(
    () => (modulo ? chatsOfModule(chats, modulo) : []),
    [chats, modulo]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return doModulo;
    return doModulo.filter((c) =>
      (c.title || "Untitled").toLowerCase().includes(q)
    );
  }, [doModulo, query]);

  // Fullscreen mobile: a AxxaView reage ao saveSettings e alterna as classes
  // nos ancestrais (ver AxxaView.applyFullscreen). A saída fica sempre aqui,
  // a um toque do hambúrguer — a nossa topbar não some no modo cheio.
  const toggleFullscreen = async () => {
    plugin.settings.mobileFullscreen = !plugin.settings.mobileFullscreen;
    await plugin.saveSettings();
    onClose();
  };

  const go = (id: ViewId) => {
    onNavigate(id);
    onClose();
  };

  // O "New chat" da tela de um módulo cria NAQUELE módulo — é o que a tela
  // promete. Na raiz não há módulo escolhido, então vale o padrão das
  // Settings, como sempre foi.
  const onNewChat = (mode?: string) => {
    session.newChat(isChatMode(mode) ? mode : undefined);
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
          {modulo && (
            <button
              type="button"
              className="axxa-icon-btn"
              aria-label="Back to menu"
              onClick={() => setModulo(null)}
            >
              <Icon name="arrow-left" />
            </button>
          )}
          <span className="axxa-brand">
            {modulo ? moduleLabel(modulo) : "AXXA OS"}
          </span>
          <button
            type="button"
            className="axxa-icon-btn"
            aria-label="Close menu"
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
        </header>

        {/* Módulo que o motor não conhece não ganha "New chat": não há como
            criar conversa num modo que não existe no código. A tela dele
            serve pra achar e abrir o que já está gravado. */}
        {(!modulo || isChatMode(modulo)) && (
          <button
            type="button"
            className="axxa-new-chat"
            onClick={() => onNewChat(modulo ?? undefined)}
          >
            <Icon name="plus" />
            <span>{moduleNewLabel(modulo)}</span>
          </button>
        )}

        {!modulo && (
          <nav className="axxa-drawer-nav">
            {/* Os módulos primeiro: é o que o menu É. O resto vem depois de
                um traço, porque é ferramenta, não lugar. */}
            {modulosVisiveis.map((m) => {
              const stats = moduleStats(chats, m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  className={
                    view === "chat" && moduloAtual === m.id
                      ? "axxa-nav-item axxa-module-item is-active"
                      : "axxa-nav-item axxa-module-item"
                  }
                  onClick={() => setModulo(m.id)}
                >
                  <Icon name={m.icon} />
                  <span className="axxa-module-text">
                    <span className="axxa-module-label">{m.label}</span>
                    <span className="axxa-module-hint">
                      {moduleHint(stats)}
                    </span>
                  </span>
                  <Icon
                    name="chevron-right"
                    size={18}
                    className="axxa-module-chev"
                  />
                </button>
              );
            })}

            <span className="axxa-nav-sep" role="presentation" />

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
            {Platform.isMobile && (
              <button
                type="button"
                className="axxa-nav-item"
                aria-pressed={plugin.settings.mobileFullscreen === true}
                onClick={() => void toggleFullscreen()}
              >
                <Icon
                  name={
                    plugin.settings.mobileFullscreen
                      ? "minimize-2"
                      : "maximize-2"
                  }
                />
                <span>
                  {plugin.settings.mobileFullscreen
                    ? "Exit fullscreen"
                    : "Fullscreen"}
                </span>
              </button>
            )}
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
        )}

        {modulo && doModulo.length >= SEARCH_FROM && (
          <div className="axxa-drawer-section">
            <input
              type="search"
              className="axxa-search"
              value={query}
              placeholder={`Search ${moduleLabel(modulo)}…`}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
          </div>
        )}

        {modulo && (
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
                {/* Sem a etiqueta de modo: a tela inteira já é daquele
                    módulo, repetir "agent" em cada linha é ruído. */}
                <span className="axxa-history-meta">
                  {c.model} · {c.date.slice(0, 10)}
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
              {doModulo.length === 0
                ? `No ${moduleLabel(modulo)} chats yet.`
                : "No chats match."}
            </p>
          )}
        </div>
        )}

        <footer className="axxa-drawer-foot">v{plugin.manifest.version}</footer>
      </aside>
    </div>
  );
}
