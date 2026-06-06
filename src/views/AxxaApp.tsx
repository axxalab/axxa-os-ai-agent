// src/views/AxxaApp.tsx
// Componente React raiz da UI do plugin.
// Por enquanto é só "Hello World" — o marco do Módulo 0.
// A partir do Módulo 1, esse componente vira o layout completo (header + chat + composer).

import * as React from "react";
import type AxxaPlugin from "../main";

interface AxxaAppProps {
  plugin: AxxaPlugin;
}

export function AxxaApp({ plugin }: AxxaAppProps) {
  return (
    <div className="axxa-root">
      <h2>AXXA OS — AI Agent</h2>
      <p>
        <span className="axxa-tag">v{plugin.manifest.version}</span>{" "}
        Módulo 0 · primeiro render React rodando.
      </p>
      <p>
        Se você está vendo isso na sidebar direita do Obsidian, o scaffold do plugin
        está funcional. Próximo passo: Módulo 1 (Chat Mode MVP).
      </p>
    </div>
  );
}
