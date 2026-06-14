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

import { useEffect, useRef, useState } from "react";
import { type App, Component, MarkdownRenderer, setIcon } from "obsidian";
import { useApp } from "./AppContext";
import { useT } from "../../i18n";
import { wireExternalLinkSafety } from "../chat/LinkSafetyModal";

interface MarkdownProps {
  content: string;
}

// Throttle do conteúdo. Durante o streaming `content` muda a cada token; renderizar
// o MarkdownRenderer inteiro (com el.empty()) a cada token é O(n²). Aqui agrupamos
// em frames de ~64ms: renderiza na hora se já passou o intervalo, senão garante UM
// timer pendente que pinta o valor MAIS RECENTE (via ref). O conteúdo final sempre
// é renderizado (o trailing timer dispara após o último token). Visual igual, custo
// muito menor. Conteúdo estático passa direto (1º frame já satisfaz o intervalo).
function useThrottled(value: string, ms: number): string {
  const [shown, setShown] = useState(value);
  const latestRef = useRef(value);
  latestRef.current = value;
  const lastRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastRef.current;
    if (elapsed >= ms) {
      lastRef.current = now;
      setShown(latestRef.current);
    } else if (timerRef.current === null) {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        lastRef.current = Date.now();
        setShown(latestRef.current);
      }, ms - elapsed);
    }
  }, [value, ms]);
  // Limpa o timer pendente só no unmount (não a cada token — senão o periódico
  // nunca dispara durante streaming contínuo).
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );
  return shown;
}

export function Markdown({ content }: MarkdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  const app = useApp();
  const t = useT();
  // Renderiza o conteúdo agrupado (~64ms) em vez de a cada token. v0.1.234
  const shown = useThrottled(content, 64);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Component local pra esse render — descarrega ao re-render ou unmount
    const component = new Component();
    component.load();

    el.empty();
    let cancelled = false;
    let disposeLinks: (() => void) | null = null;

    // MarkdownRenderer.render retorna Promise — espera o highlight async
    // antes de scan dos <pre>. Promise.resolve() lida com APIs antigas
    // que poderiam retornar void.
    Promise.resolve(
      MarkdownRenderer.render(app, shown, el, "", component)
    ).then(() => {
      if (cancelled) return;
      enhanceCodeBlocks(el, t.chat.copyCode);
      enhanceInternalLinks(el, app);
      disposeLinks = wireExternalLinkSafety(el, app, {
        title: t.linkSafety.title,
        desc: t.linkSafety.desc,
        open: t.linkSafety.open,
        copy: t.linkSafety.copy,
        cancel: t.linkSafety.cancel,
        copied: t.linkSafety.copied,
        muteSession: t.linkSafety.muteSession,
      });
    });

    return () => {
      cancelled = true;
      disposeLinks?.();
      component.unload();
    };
  }, [app, shown, t]);

  return <div ref={ref} className="axxa-markdown" />;
}

// Faz os [[wikilinks]] (e citações da IA) ABRIREM a nota no clique. O
// MarkdownRenderer gera <a.internal-link data-href="...">, mas num view custom
// o clique não é interceptado por default — aqui ligamos via openLinkText.
// Ctrl/Cmd-clique abre numa nova aba. v0.1.137
function enhanceInternalLinks(root: HTMLElement, app: App) {
  const links = root.querySelectorAll<HTMLAnchorElement>("a.internal-link");
  links.forEach((a) => {
    if (a.dataset.axxaWired) return;
    a.dataset.axxaWired = "1";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const href =
        a.getAttribute("data-href") ||
        a.getAttribute("href") ||
        a.textContent ||
        "";
      if (!href) return;
      const newLeaf = e.ctrlKey || e.metaKey;
      app.workspace.openLinkText(href, "", newLeaf);
    });
  });
}

// Anexa botão "copy" em cada <pre> do bloco renderizado.
// Idempotente: se já tem botão, skip (proteção contra duplicação em re-renders).
function enhanceCodeBlocks(root: HTMLElement, copyLabel: string) {
  const pres = root.querySelectorAll<HTMLPreElement>("pre");
  pres.forEach((pre) => {
    if (pre.querySelector(":scope > .axxa-code-copy")) return;

    pre.classList.add("axxa-code-block");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "axxa-code-copy";
    btn.setAttribute("aria-label", copyLabel);
    btn.setAttribute("title", copyLabel);
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
