// src/components/_shared/ErrorBoundary.tsx
// Captura erros de render da árvore React e mostra um painel com a mensagem +
// stack EM VEZ de derrubar a view (no mobile, um throw não-tratado pode levar o
// WebView do Obsidian junto). Também serve de diagnóstico: o erro fica visível
// e copiável. v0.1.197

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
  info: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[axxa] erro de render capturado:", error, info);
    this.setState({ info: info.componentStack ?? "" });
  }

  private reset = () => this.setState({ error: null, info: "" });

  private copy = () => {
    const { error, info } = this.state;
    const text = `${error?.name}: ${error?.message}\n\n${error?.stack ?? ""}\n\n${info}`;
    void navigator.clipboard?.writeText(text);
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="axxa-errboundary" role="alert">
        <div className="axxa-errboundary-card">
          <h3 className="axxa-errboundary-title">⚠️ AXXA OS — erro de tela</h3>
          <p className="axxa-errboundary-sub">
            Algo quebrou ao renderizar. Copie o erro abaixo e mande pro dev — ele
            diz exatamente onde foi. O texto pode conter caminhos de arquivos do
            seu vault; confira antes de enviar. {/* v0.1.228: aviso de disclosure */}
          </p>
          <pre className="axxa-errboundary-msg">
            {error.name}: {error.message}
            {"\n\n"}
            {error.stack ?? ""}
            {this.state.info ? "\n" + this.state.info : ""}
          </pre>
          <div className="axxa-errboundary-actions">
            <button type="button" className="axxa-errboundary-copy" onClick={this.copy}>
              Copiar erro
            </button>
            <button type="button" className="axxa-errboundary-retry" onClick={this.reset}>
              Tentar de novo
            </button>
          </div>
        </div>
      </div>
    );
  }
}
