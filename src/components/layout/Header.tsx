// src/components/layout/Header.tsx
// Header com título, versão, "nova conversa" e gear de Settings.

import { Icon } from "../_shared/Icon";
import { useT } from "../../i18n";

interface HeaderProps {
  version: string;
  onOpenSettings: () => void;
  onNewChat: () => void;
}

export function Header({ version, onOpenSettings, onNewChat }: HeaderProps) {
  const t = useT();
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
      </div>
    </header>
  );
}
