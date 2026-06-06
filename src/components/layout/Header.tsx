// src/components/layout/Header.tsx
// Header com título, versão, "nova conversa" e gear de Settings.

import { Icon } from "../_shared/Icon";

interface HeaderProps {
  version: string;
  onOpenSettings: () => void;
  onNewChat: () => void;
}

export function Header({ version, onOpenSettings, onNewChat }: HeaderProps) {
  return (
    <header className="axxa-header">
      <div className="axxa-header-title">
        <span className="axxa-header-name">AXXA OS</span>
        <span className="axxa-header-version">v{version}</span>
      </div>
      <div className="axxa-header-actions">
        <button
          type="button"
          className="axxa-header-gear"
          onClick={onNewChat}
          aria-label="Nova conversa"
          title="Nova conversa"
        >
          <Icon name="message-square-plus" />
        </button>
        <button
          type="button"
          className="axxa-header-gear"
          onClick={onOpenSettings}
          aria-label="Abrir configurações"
          title="Configurações"
        >
          <Icon name="settings" />
        </button>
      </div>
    </header>
  );
}
