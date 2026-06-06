// src/components/layout/Header.tsx
// Header com título, versão e botão de Settings (gear icon → abre Settings do plugin).

import { Icon } from "../_shared/Icon";

interface HeaderProps {
  version: string;
  onOpenSettings: () => void;
}

export function Header({ version, onOpenSettings }: HeaderProps) {
  return (
    <header className="axxa-header">
      <div className="axxa-header-title">
        <span className="axxa-header-name">AXXA OS</span>
        <span className="axxa-header-version">v{version}</span>
      </div>
      <button
        type="button"
        className="axxa-header-gear"
        onClick={onOpenSettings}
        aria-label="Abrir configurações"
        title="Configurações"
      >
        <Icon name="settings" />
      </button>
    </header>
  );
}
