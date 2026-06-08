// src/components/layout/Header.tsx
// Header com título, versão, "nova conversa", lista de conversas e gear de
// Settings.
//
// Quando há chat ativo (chatTitle truthy), substitui "AXXA OS · v..." por
// um INPUT inline com o título da conversa atual. Click no input dá foco,
// Enter / blur dispara onRenameChat. Pra UX clara: a versão fica na linha
// 2 do bloco quando o título tá ativo.

import { useEffect, useRef, useState } from "react";
import { Menu } from "obsidian";
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
  /** Estado atual do modo fullscreen (mobile-only feature). */
  fullscreen: boolean;
  /** Toggle do modo fullscreen — sidebar direita ocupa 100vw em mobile. */
  onToggleFullscreen: () => void;
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
        <button
          type="button"
          className="axxa-header-gear"
          onClick={(e) => {
            const menu = new Menu();
            menu.addItem((item) =>
              item
                .setTitle(
                  fullscreen ? t.header.exitFullscreen : t.header.fullscreen
                )
                .setIcon(fullscreen ? "minimize" : "maximize")
                .onClick(() => onToggleFullscreen())
            );
            menu.showAtMouseEvent(e.nativeEvent);
          }}
          aria-label={t.header.moreOptions}
          title={t.header.moreOptions}
        >
          <Icon name="more-vertical" />
        </button>
      </div>
    </header>
  );
}
