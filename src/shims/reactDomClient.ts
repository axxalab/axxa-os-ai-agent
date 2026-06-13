// src/shims/reactDomClient.ts
// Shim de `react-dom/client` (createRoot do React 18) sobre o render do Preact.
// Usado SÓ no bundle (alias do esbuild) — a fonte segue importando de
// "react-dom/client" normalmente, e o tsc usa os types reais do @types/react-dom.
// O preact/compat não expõe createRoot; o React 18 createRoot vira render().
import { render } from "preact/compat";

export function createRoot(container: Element | DocumentFragment) {
  return {
    render(children: unknown) {
      render(children as never, container as never);
    },
    unmount() {
      render(null as never, container as never);
    },
  };
}
