// src/ui/Drawer.tsx
// Menu lateral: a gaveta que guarda TODAS as opções do app — Projects, Skills,
// Settings e, principalmente, a porta de entrada de cada MÓDULO.
// Abre por cima do painel (scrim + slide), fecha no scrim, no Esc e sempre que
// leva o usuário pra algum lugar.
//
// O menu LEVA, não guarda. A raiz lista os módulos (Chat, Vault Q&A, Agent)
// com quantas conversas cada um tem e quando foi a última; tocar num deles
// abre a TELA daquele módulo — a tela de verdade, com o campo de texto e as
// conversas dele (ver StarterScreen).
//
// A lista de conversas já morou aqui dentro, misturando os três módulos numa
// pilha só. Saiu por dois motivos: achar "aquela conversa do Agent" era caçar
// entre chats e perguntas do vault, e mesmo separada por módulo ela ficava a
// dois toques, longe de onde se escreve.

import { Platform } from "obsidian";
import { useEffect, useMemo, useRef } from "react";
import type AxxaPlugin from "../main";
import { isChatMode, type ChatSession } from "../core/session";
import { useChatStore } from "../store/chat";
import { useChatSummaries, useUnreadChats } from "./ChatList";
import { Icon } from "./Icon";
import { openPluginSettings } from "./modals";
import { moduleHint, moduleStats, modulesInUse } from "./modules";
import { alertCount } from "./chatAlert";

export type ViewId =
  | "home"
  | "chat"
  | "module"
  | "history"
  | "usage"
  | "projects"
  | "skills";

/** O resto do menu — o que não é módulo. */
const NAV: Array<{ id: ViewId; label: string; icon: string }> = [
  { id: "projects", label: "Projects", icon: "folder-open" },
  { id: "skills", label: "Skills", icon: "sparkles" },
];

export function Drawer({
  plugin,
  session,
  open,
  view,
  modulo,
  onEnterModule,
  onNavigate,
  onClose,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  open: boolean;
  view: ViewId;
  /** De qual módulo é a home aberta (ou a última). */
  modulo: string;
  onEnterModule: (mode: string) => void;
  onNavigate: (view: ViewId) => void;
  onClose: () => void;
}) {
  const sessionMode = useChatStore((s) => s.sessionMode);
  const esperandoId = useChatStore((s) => s.waitingChatId);
  const chats = useChatSummaries(plugin);
  const naoLidas = useUnreadChats(plugin);
  const panelRef = useRef<HTMLDivElement>(null);

  // Qual módulo está em uso agora — a conversa aberta manda; sem conversa
  // aberta, o padrão das Settings. Marca a linha na raiz.
  // Qual linha de módulo aparece marcada: na home é a dela; dentro de uma
  // conversa é o modo daquela conversa.
  const moduloAtual =
    view === "module"
      ? modulo
      : isChatMode(sessionMode)
        ? sessionMode
        : isChatMode(plugin.settings.defaultMode)
          ? plugin.settings.defaultMode
          : "chat";

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

  /** Os três do motor + qualquer outro que apareça nas conversas gravadas. */
  const modulosVisiveis = useMemo(() => modulesInUse(chats), [chats]);

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

  const onNewChat = () => {
    session.newChat();
    go("chat");
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
            {/* O painel vem primeiro — é a volta pro começo. */}
            <button
              type="button"
              className={
                view === "home" ? "axxa-nav-item is-active" : "axxa-nav-item"
              }
              onClick={() => go("home")}
            >
              <Icon name="layout-grid" />
              <span>Home</span>
            </button>

            {/* Depois os módulos: é o que o menu É. O resto vem atrás de um
                traço, porque é ferramenta, não lugar. */}
            {modulosVisiveis.map((m) => {
              const stats = moduleStats(chats, m.id);
              const pedindo = alertCount(chats, m.id, {
                esperando: esperandoId,
                naoLidas,
              });
              return (
                <button
                  key={m.id}
                  type="button"
                  className={
                    (view === "chat" || view === "module") &&
                    moduloAtual === m.id
                      ? "axxa-nav-item axxa-module-item is-active"
                      : "axxa-nav-item axxa-module-item"
                  }
                  onClick={() => onEnterModule(m.id)}
                >
                  <Icon name={m.icon} />
                  <span className="axxa-module-text">
                    <span className="axxa-module-label">{m.label}</span>
                    <span className="axxa-module-hint">
                      {moduleHint(stats)}
                    </span>
                  </span>
                  {/* Quantas conversas daqui pedem alguma coisa. Fica ANTES
                      do chevron porque é informação, e o chevron é gesto. */}
                  {pedindo > 0 && (
                    <span className="axxa-module-badge">{pedindo}</span>
                  )}
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

        <footer className="axxa-drawer-foot">v{plugin.manifest.version}</footer>
      </aside>
    </div>
  );
}
