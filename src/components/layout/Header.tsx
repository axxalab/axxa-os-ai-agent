// src/components/layout/Header.tsx
// Header simples — só título + versão.
// O Status Line foi movido pra perto do composer (mais perto do campo de texto).

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
