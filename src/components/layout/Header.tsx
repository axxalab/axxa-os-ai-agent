// src/components/layout/Header.tsx
// Header com título, versão, "nova conversa", lista de conversas e gear de
// Settings.
//
// Quando há chat ativo (chatTitle truthy), substitui "AXXA OS · v..." por
// um INPUT inline com o título da conversa atual. Click no input dá foco,
// Enter / blur dispara onRenameChat. Pra UX clara: a versão fica na linha
// 2 do bloco quando o título tá ativo.

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Notice } from "obsidian";
import { Icon } from "../_shared/Icon";
import { useT } from "../../i18n";

/**
 * (P1-29) Teclado nos popovers portalados (WAI-ARIA menu button): ao abrir,
 * foca o 1º item; setas ↑/↓ + Home/End circulam; ao fechar, o foco volta pro
 * gatilho. Sem isto o role="menu" prometia navegação que não existia — Tab
 * pulava pro conteúdo do chat com o menu ainda aberto.
 */
function usePopoverKeyboard(
  open: boolean,
  popRef: RefObject<HTMLDivElement | null>,
  triggerRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) return;
    const items = () =>
      Array.from(
        popRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"], button'
        ) ?? []
      );
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      const list = items();
      if (!list.length) return;
      const idx = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        list[(idx + 1) % list.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        list[(idx - 1 + list.length) % list.length]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        list[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        list[list.length - 1]?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const trigger = triggerRef.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open, popRef, triggerRef]);
}

interface HeaderProps {
  version: string;
  /** Título do chat atual. String vazia = sem chat ativo (mostra "AXXA OS"). */
  chatTitle: string;
  onOpenSettings: () => void;
  onNewChat: () => void;
  /** Abre a GAVETA lateral (avatar à esquerda) com as conversas. v0.1.145 */
  onOpenSidebar: () => void;
  /** Recebe novo título quando user edita inline. Chama mesmo se vazio? — não. */
  onRenameChat: (newTitle: string) => void;
  /** Toggle do campo de busca dentro da conversa atual. */
  onToggleSearch: () => void;
  /** Busca aberta — destaca o ícone. */
  searchActive: boolean;
  /** Copia a conversa atual (markdown) pro clipboard. */
  onCopyConversation: () => void;
  /** Há conversa pra copiar (esconde o item do menu se vazio). */
  canCopy: boolean;
  /** Abre o modal de persona (system prompt custom) do chat. */
  onEditPersona: () => void;
  /** Persona ativa — destaca o item no menu. */
  personaActive: boolean;
  /** Modelo ativo da conversa (mostrado no switcher central). */
  modelName: string;
  /** Modelos conectados do provider ativo (opções do switcher). */
  modelOptions: string[];
  /** Troca o modelo. Se a sessão estiver locked, o caller inicia nova conversa. */
  onSelectModel: (model: string) => void;
  /** Sessão travada (após 1ª msg) — switcher mostra cadeado + dica. */
  modelLocked: boolean;
  /** Abre o Modo Voz (conversa por voz). */
  onOpenVoice: () => void;
  /** Fullscreen mobile ligado — item do menu vira "sair da tela cheia". */
  fullscreen: boolean;
  /** Alterna o fullscreen mobile (persiste em settings.mobileFullscreen). */
  onToggleFullscreen: () => void;
  /** Só mobile: no desktop não há chrome de drawer/navbar pra recuperar. */
  showFullscreen: boolean;
  /** Abre o modal de rename do chat atual (item "Rename" do menu ⋮). */
  onRename: () => void;
  /** Deleta o chat atual (item "Delete" do menu ⋮, vermelho). */
  onDeleteChat: () => void;
}

export function Header({
  version,
  chatTitle,
  onOpenSettings,
  onNewChat,
  onOpenSidebar,
  onRenameChat,
  onToggleSearch,
  searchActive,
  onCopyConversation,
  canCopy,
  onEditPersona,
  personaActive,
  modelName,
  modelOptions,
  onSelectModel,
  modelLocked,
  onOpenVoice,
  fullscreen,
  onToggleFullscreen,
  showFullscreen,
  onRename,
  onDeleteChat,
}: HeaderProps) {
  const t = useT();
  const [draft, setDraft] = useState(chatTitle);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sincroniza o draft quando o título externo muda (ex: novo chat criado,
  // chat carregado da lista, rename feito em outro lugar).
  useEffect(() => {
    setDraft(chatTitle);
  }, [chatTitle]);

  const hasChat = chatTitle.trim().length > 0;

  // Menu "..." — popover custom (sem Menu nativo do Obsidian). Posição FIXED
  // calculada do botão, pra não ser cortado pelo overflow do header/painel.
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null
  );
  const moreRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  // Popover é portalado pro <body> (escapa o stacking context do header e
  // qualquer overflow/transform de ancestral) — ref separada pro click-outside.
  const popoverRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    const r = moreBtnRef.current?.getBoundingClientRect();
    if (r) setMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    setMenuOpen((o) => !o);
  };

  usePopoverKeyboard(menuOpen, popoverRef, moreBtnRef);
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      // Popover vive no <body> (portal) — checar as duas refs antes de fechar.
      if (moreRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    // Popover é fixed → fecha ao rolar/redimensionar (senão flutua solto).
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  const commit = () => {
    const clean = draft.trim();
    // v0.1.228: compara contra o título também normalizado — senão um título
    // externo com espaços nas pontas dispara rename "fantasma" (no-op real).
    if (!clean || clean === chatTitle.trim()) {
      // sem mudança ou inválido — reverte
      setDraft(chatTitle);
      return;
    }
    onRenameChat(clean);
  };

  return (
    <header className="axxa-header">
      {/* Hambúrguer à ESQUERDA → abre a gaveta (ref: Claude). */}
      <button
        type="button"
        className="axxa-header-hamburger"
        onClick={onOpenSidebar}
        aria-label={t.header.conversations}
        title={t.header.conversations}
      >
        <Icon name="menu" />
      </button>
      {/* Centro vazio — o título da conversa vive no menu ⋮ (ref: Claude). */}
      <div className="axxa-header-spacer" />
      <div className="axxa-header-actions">
        <button
          type="button"
          className="axxa-header-gear axxa-header-gear-primary"
          onClick={onNewChat}
          aria-label={t.header.newChat}
          title={t.header.newChat}
        >
          <Icon name="message-circle-plus" />
        </button>
        <div className="axxa-header-more" ref={moreRef}>
          <button
            ref={moreBtnRef}
            type="button"
            className={
              "axxa-header-gear" + (menuOpen ? " axxa-header-gear-active" : "")
            }
            onClick={openMenu}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t.header.moreOptions}
            title={t.header.moreOptions}
          >
            <Icon name="more-vertical" />
          </button>
          {menuOpen &&
            createPortal(
              <div
                ref={popoverRef}
                className="axxa-popover-menu axxa-chat-menu"
                role="menu"
                style={
                  menuPos
                    ? { top: menuPos.top, right: menuPos.right }
                    : undefined
                }
              >
                {hasChat && (
                  <div className="axxa-chat-menu-title">{chatTitle}</div>
                )}
                {canCopy && (
                  <button
                    type="button"
                    role="menuitem"
                    className="axxa-popover-item axxa-chat-menu-item"
                    onClick={() => {
                      onCopyConversation();
                      setMenuOpen(false);
                    }}
                  >
                    <span className="axxa-popover-label">Share</span>
                    <Icon name="forward" className="axxa-chat-menu-icon" />
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="axxa-popover-item axxa-chat-menu-item"
                  onClick={() => {
                    onRename();
                    setMenuOpen(false);
                  }}
                >
                  <span className="axxa-popover-label">Rename</span>
                  <Icon name="pencil" className="axxa-chat-menu-icon" />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="axxa-popover-item axxa-chat-menu-item"
                  onClick={() => {
                    new Notice("Coming soon");
                    setMenuOpen(false);
                  }}
                >
                  <span className="axxa-popover-label">Star</span>
                  <Icon name="star" className="axxa-chat-menu-icon" />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="axxa-popover-item axxa-chat-menu-item"
                  onClick={() => {
                    new Notice("Coming soon");
                    setMenuOpen(false);
                  }}
                >
                  <span className="axxa-popover-label">Add to project</span>
                  <Icon name="layers" className="axxa-chat-menu-icon" />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="axxa-popover-item axxa-chat-menu-item"
                  onClick={() => {
                    new Notice("Coming soon");
                    setMenuOpen(false);
                  }}
                >
                  <span className="axxa-popover-label">Add to home</span>
                  <Icon name="home" className="axxa-chat-menu-icon" />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="axxa-popover-item axxa-chat-menu-item axxa-chat-menu-item-danger"
                  onClick={() => {
                    onDeleteChat();
                    setMenuOpen(false);
                  }}
                >
                  <span className="axxa-popover-label">Delete</span>
                  <Icon name="trash-2" className="axxa-chat-menu-icon" />
                </button>
              </div>,
              (moreRef.current?.ownerDocument ?? document).body
            )}
        </div>
      </div>
    </header>
  );
}

/**
 * Switcher de modelo no header (ref: Claude iOS 16/23/33) — chip discreto
 * "● modelo ⌄" embaixo do título. Tap abre dropdown com os modelos conectados
 * do provider ativo. Quando a sessão está locked, escolher outro modelo inicia
 * uma nova conversa com ele (continuidade preservada — quem decide é o caller).
 */
function HeaderModelSwitcher({
  modelName,
  modelOptions,
  onSelectModel,
  locked,
}: {
  modelName: string;
  modelOptions: string[];
  onSelectModel: (model: string) => void;
  locked: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  usePopoverKeyboard(open, popRef, btnRef);

  const toggle = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left });
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (popRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  // v0.1.228: dedup + ativo primeiro. Set elimina duplicatas dentro de
  // modelOptions (senão dois itens iguais geram key React repetida no map).
  const opts = Array.from(new Set([modelName, ...modelOptions]));

  return (
    <div className="axxa-header-model" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={
          "axxa-header-model-btn" + (open ? " axxa-header-model-btn-open" : "")
        }
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t.header.modelSwitcherLabel}
      >
        {locked && <Icon name="lock" className="axxa-header-model-lock" />}
        <span className="axxa-header-model-name">{modelName}</span>
        <Icon name="chevron-down" className="axxa-header-model-caret" />
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            className="axxa-popover-menu axxa-model-menu"
            role="menu"
            style={pos ? { top: pos.top, left: pos.left } : undefined}
          >
            {locked && (
              <div className="axxa-model-menu-hint">
                {t.header.modelLockedHint}
              </div>
            )}
            {opts.map((m) => {
              const active = m === modelName;
              return (
                <button
                  key={m}
                  type="button"
                  role="menuitem"
                  className={
                    "axxa-popover-item" +
                    (active ? " axxa-popover-item-active" : "")
                  }
                  onClick={() => {
                    setOpen(false);
                    if (!active) onSelectModel(m);
                  }}
                >
                  <Icon name={active ? "check" : "circle"} />
                  <span className="axxa-popover-label axxa-model-menu-label">
                    {m}
                  </span>
                </button>
              );
            })}
          </div>,
          (wrapRef.current?.ownerDocument ?? document).body
        )}
    </div>
  );
}
