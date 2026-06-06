// src/components/layout/Header.tsx
// Header da view — por enquanto só título + versão.
// Vai evoluir no Módulo 2 com Status Line (provider, modelo, tokens).

interface HeaderProps {
  version: string;
}

export function Header({ version }: HeaderProps) {
  return (
    <header className="axxa-header">
      <div className="axxa-header-title">
        <span className="axxa-header-name">AXXA OS</span>
        <span className="axxa-header-version">v{version}</span>
      </div>
    </header>
  );
}
