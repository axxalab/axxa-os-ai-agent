// src/components/layout/Header.tsx
// Header com título, versão, "nova conversa", lista de conversas e gear de
// Settings.
//
// Quando há chat ativo (chatTitle truthy), substitui "AXXA OS · v..." por
// um INPUT inline com o título da conversa atual. Click no input dá foco,
// Enter / blur dispara onRenameChat. Pra UX clara: a versão fica na linha
// 2 do bloco quando o título tá ativo.

import { useEffect, useRef, useState } from "react";
import { Icon } from "../_shared/Icon";
import { useT } from "../../i18n";

interface HeaderProps {
  version: string;
  /** Título do chat atual. String vazia = sem chat ativo (mostra "AXXA OS"). */
  chatTitle: string;
  onOpenSettings: () => void;
  onNewChat: () => void;
  onOpenConversations: () => void;
  /** Recebe novo título quando user edita inline. Chama mesmo se vazio? — não. */
  onRenameChat: (newTitle: string) => void;
  /** Estado atual do modo fullscreen mobile (drawer 100vw + chrome hidden). */
  fullscreen: boolean;
  /** Toggle do fullscreen — persiste em settings.mobileFullscreen. */
  onToggleFullscreen: () => void;
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
}

export function Header({
  version,
  chatTitle,
  onOpenSettings,
  onNewChat,
  onOpenConversations,
  onRenameChat,
  fullscreen,
  onToggleFullscreen,
  onToggleSearch,
  searchActive,
  onCopyConversation,
  canCopy,
  onEditPersona,
  personaActive,
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

  const openMenu = () => {
    const r = moreBtnRef.current?.getBoundingClientRect();
    if (r) setMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    setMenuOpen((o) => !o);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) close();
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
    if (!clean || clean === chatTitle) {
      // sem mudança ou inválido — reverte
      setDraft(chatTitle);
      return;
    }
    onRenameChat(clean);
  };

  return (
    <header className="axxa-header">
      <div className="axxa-header-title">
        {hasChat ? (
          <>
            <input
              ref={inputRef}
              type="text"
              className="axxa-header-chat-title"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === "Escape") {
                  setDraft(chatTitle);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              aria-label={t.conversations.renameAria}
              title={t.conversations.renameTitle}
              placeholder={t.conversations.renameInputLabel}
            />
            <span className="axxa-header-version">v{version}</span>
          </>
        ) : (
          <>
            <span className="axxa-header-name">AXXA OS</span>
            <span className="axxa-header-version">v{version}</span>
          </>
        )}
      </div>
      <div className="axxa-header-actions">
        <button
          type="button"
          className={
            "axxa-header-gear" + (searchActive ? " axxa-header-gear-active" : "")
          }
          onClick={onToggleSearch}
          aria-label={t.header.search}
          title={t.header.search}
        >
          <Icon name="search" />
        </button>
        <button
          type="button"
          className="axxa-header-gear"
          onClick={onOpenConversations}
          aria-label={t.header.conversations}
          title={t.header.conversations}
        >
          <Icon name="messages-square" />
        </button>
        <button
          type="button"
          className="axxa-header-gear"
          onClick={onNewChat}
          aria-label={t.header.newChat}
          title={t.header.newChat}
        >
          <Icon name="message-square-plus" />
        </button>
        <button
          type="button"
          className="axxa-header-gear"
          onClick={onOpenSettings}
          aria-label={t.header.openSettings}
          title={t.header.openSettings}
        >
          <Icon name="settings" />
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
          {menuOpen && (
            <div
              className="axxa-popover-menu"
              role="menu"
              style={
                menuPos ? { top: menuPos.top, right: menuPos.right } : undefined
              }
            >
              <button
                type="button"
                role="menuitem"
                className={
                  "axxa-popover-item" +
                  (personaActive ? " axxa-popover-item-active" : "")
                }
                onClick={() => {
                  onEditPersona();
                  setMenuOpen(false);
                }}
              >
                <Icon name="drama" />
                <span className="axxa-popover-label">
                  {personaActive ? t.header.personaActive : t.header.persona}
                </span>
                <Icon name="chevron-right" className="axxa-popover-chevron" />
              </button>
              {canCopy && (
                <button
                  type="button"
                  role="menuitem"
                  className="axxa-popover-item"
                  onClick={() => {
                    onCopyConversation();
                    setMenuOpen(false);
                  }}
                >
                  <Icon name="copy" />
                  <span>{t.header.copyConversation}</span>
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className="axxa-popover-item"
                onClick={() => {
                  onToggleFullscreen();
                  setMenuOpen(false);
                }}
              >
                <Icon name={fullscreen ? "minimize" : "maximize"} />
                <span>
                  {fullscreen ? t.header.exitFullscreen : t.header.fullscreen}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
