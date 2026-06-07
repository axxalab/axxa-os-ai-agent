// src/components/_shared/Markdown.tsx
// Wrapper React do MarkdownRenderer nativo do Obsidian.
// Mesma engine que renderiza notas — pega bold, italic, headers, listas,
// code blocks com syntax highlighting, links, wikilinks, callouts, mermaid.
//
// Re-renderiza a cada mudança de `content` — usado também durante streaming
// (tokens chegando um a um). O Component do Obsidian é recriado a cada render
// pra gerenciar lifecycle interno do renderer.
//
// Pós-processamento: depois que o MarkdownRenderer termina, varremos cada
// <pre> e anexamos um botão "copiar código" no canto superior direito. UX
// padrão de IA (ChatGPT/Claude) — usuário quase sempre quer o código puro.

import { useEffect, useRef } from "react";
import { Component, MarkdownRenderer, setIcon } from "obsidian";
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
    let cancelled = false;

    // MarkdownRenderer.render retorna Promise — espera o highlight async
    // antes de scan dos <pre>. Promise.resolve() lida com APIs antigas
    // que poderiam retornar void.
    Promise.resolve(
      MarkdownRenderer.render(app, content, el, "", component)
    ).then(() => {
      if (cancelled) return;
      enhanceCodeBlocks(el);
    });

    return () => {
      cancelled = true;
      component.unload();
    };
  }, [app, content]);

  return <div ref={ref} className="axxa-markdown" />;
}

// Anexa botão "copy" em cada <pre> do bloco renderizado.
// Idempotente: se já tem botão, skip (proteção contra duplicação em re-renders).
function enhanceCodeBlocks(root: HTMLElement) {
  const pres = root.querySelectorAll<HTMLPreElement>("pre");
  pres.forEach((pre) => {
    if (pre.querySelector(":scope > .axxa-code-copy")) return;

    pre.classList.add("axxa-code-block");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "axxa-code-copy";
    btn.setAttribute("aria-label", "Copiar código");
    btn.setAttribute("title", "Copiar código");
    setIcon(btn, "copy");

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const code = pre.querySelector("code");
      const text = code?.textContent ?? pre.textContent ?? "";
      try {
        await navigator.clipboard.writeText(text);
        setIcon(btn, "check");
        btn.classList.add("axxa-code-copy-active");
        window.setTimeout(() => {
          if (!btn.isConnected) return;
          setIcon(btn, "copy");
          btn.classList.remove("axxa-code-copy-active");
        }, 1500);
      } catch (err) {
        console.error("[axxa] copy code falhou:", err);
      }
    });

    pre.appendChild(btn);
  });
}
