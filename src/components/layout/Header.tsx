// src/components/layout/Header.tsx
// Header da view com Status Line embutida (Módulo 2.5 phase 1):
//   - Título "AXXA OS" + versão
//   - Status dot (gray=ready, accent+pulse=streaming)
//   - Provider ativo · modelo ativo
//
// Futuro (phase 2): context window usado/total, tokens consumidos, modo atual.

interface HeaderProps {
  version: string;
  providerName: string;
  modelName: string;
  streaming: boolean;
}

export function Header({ version, providerName, modelName, streaming }: HeaderProps) {
  return (
    <header className="axxa-header">
      <div className="axxa-header-title">
        <span className="axxa-header-name">AXXA OS</span>
        <span className="axxa-header-version">v{version}</span>
      </div>
      <div className="axxa-header-status" aria-label="Status da sessão">
        <span
          className={
            "axxa-status-dot" + (streaming ? " axxa-status-dot-active" : "")
          }
          aria-label={streaming ? "Gerando resposta" : "Pronto"}
        />
        <span className="axxa-header-meta">
          {providerName} · {modelName}
        </span>
      </div>
    </header>
  );
}
