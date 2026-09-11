// src/ui/Markdown.tsx
// Renderiza markdown com o renderer NATIVO do Obsidian (wikilinks, callouts,
// code, mermaid…). Enquanto a mensagem está streamando, mostra texto puro —
// re-renderizar markdown a cada token é caro e pisca.

import { useEffect, useRef } from "react";
import { App, Component, MarkdownRenderer } from "obsidian";

export function Markdown({
  app,
  text,
  streaming,
}: {
  app: App;
  text: string;
  streaming?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (streaming) {
      el.textContent = text;
      return;
    }
    el.empty();
    const comp = new Component();
    comp.load();
    void MarkdownRenderer.render(app, text, el, "", comp);
    return () => comp.unload();
  }, [app, text, streaming]);
  return <div ref={ref} className="axxa-markdown" />;
}
