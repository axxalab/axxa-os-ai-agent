// src/components/_shared/Markdown.tsx
// Wrapper React do MarkdownRenderer nativo do Obsidian.
// Mesma engine que renderiza notas — pega bold, italic, headers, listas,
// code blocks com syntax highlighting, links, wikilinks, callouts, mermaid.
//
// Re-renderiza a cada mudança de `content` — usado também durante streaming
// (tokens chegando um a um). O Component do Obsidian é recriado a cada render
// pra gerenciar lifecycle interno do renderer.

import { useEffect, useRef } from "react";
import { Component, MarkdownRenderer } from "obsidian";
import { useApp } from "./AppContext";

interface MarkdownProps {
  content: string;
}

export function Markdown({ content }: MarkdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  const app = useApp();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Component local pra esse render — descarrega ao re-render ou unmount
    const component = new Component();
    component.load();

    el.empty();
    MarkdownRenderer.render(app, content, el, "", component);

    return () => {
      component.unload();
    };
  }, [app, content]);

  return <div ref={ref} className="axxa-markdown" />;
}
