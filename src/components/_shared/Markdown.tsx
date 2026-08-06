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
import { type App, Component, MarkdownRenderer, Modal, Notice, setIcon } from "obsidian";
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
      enhanceArtifacts(el);
      enhanceCodeBlocks(el, t.chat.copyCode, app);
      enhanceInternalLinks(el, app, t.plus.pickNoteNotFound);
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
function enhanceInternalLinks(
  root: HTMLElement,
  app: App,
  notFoundMsg: (path: string) => string
) {
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
      // (P1-81) Citação que a IA inventou (ou nota renomeada): openLinkText
      // não-resolvido CRIA uma nota vazia em silêncio — resolve antes e avisa.
      const dest = app.metadataCache.getFirstLinkpathDest(href, "");
      if (!dest) {
        new Notice(notFoundMsg(href));
        return;
      }
      const newLeaf = e.ctrlKey || e.metaKey;
      app.workspace.openLinkText(href, "", newLeaf);
    });
  });
}

// Botão de ação do code block (copy/expand/close) — ícone Lucide, sem borda.
function codeActionBtn(icon: string, label: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "axxa-code-btn";
  b.setAttribute("aria-label", label);
  b.setAttribute("title", label);
  setIcon(b, icon);
  return b;
}

// Liga o "copiar" num botão: ícone vira check por 1.5s ao copiar.
function wireCopy(btn: HTMLButtonElement, getText: () => string): void {
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(getText());
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
}

// Overlay fullscreen do "expandir": clona o <pre> (mantém o highlight) num
// painel com header (linguagem + copiar + fechar). v0.2.10
function openCodeOverlay(app: App, pre: HTMLPreElement, lang: string, copyLabel: string): void {
  // Modal NATIVO do Obsidian (bottom sheet no mobile, posição de fábrica). Clona
  // o <pre> pra manter o syntax highlight.
  const modal = new Modal(app);
  modal.onOpen = () => {
    const { contentEl } = modal;
    contentEl.empty();
    contentEl.addClass("axxa-code-modal");
    const header = document.createElement("div");
    header.className = "axxa-code-header";
    const langEl = document.createElement("span");
    langEl.className = "axxa-code-lang";
    langEl.textContent = lang;
    const actions = document.createElement("div");
    actions.className = "axxa-code-actions";
    const copyBtn = codeActionBtn("copy", copyLabel);
    wireCopy(copyBtn, () => pre.querySelector("code")?.textContent ?? pre.textContent ?? "");
    actions.append(copyBtn);
    header.append(langEl, actions);
    contentEl.append(header, pre.cloneNode(true));
  };
  modal.onClose = () => modal.contentEl.empty();
  modal.open();
}

// Envolve cada <pre> num wrapper com HEADER (linguagem + copiar + expandir),
// estilo Claude. Idempotente: se já está no wrapper, skip.
function enhanceCodeBlocks(root: HTMLElement, copyLabel: string, app: App) {
  const pres = root.querySelectorAll<HTMLPreElement>("pre");
  pres.forEach((pre) => {
    if (pre.parentElement?.classList.contains("axxa-code-block-wrap")) return;

    pre.classList.add("axxa-code-block");

    // Remove o botão "copy" NATIVO do Obsidian (fica dentro do <pre>) — a gente
    // tem o nosso no header; senão aparecem 2 copiar.
    pre.querySelectorAll("button").forEach((b) => b.remove());

    // Linguagem via <code class="language-xxx"> (renderer do Obsidian).
    const code = pre.querySelector("code");
    const langClass = code
      ? Array.from(code.classList).find((c) => c.startsWith("language-"))
      : undefined;
    const lang = langClass ? langClass.slice("language-".length) : "text";

    const wrap = document.createElement("div");
    wrap.className = "axxa-code-block-wrap";
    pre.parentElement?.insertBefore(wrap, pre);

    const header = document.createElement("div");
    header.className = "axxa-code-header";
    const langEl = document.createElement("span");
    langEl.className = "axxa-code-lang";
    langEl.textContent = lang;

    const actions = document.createElement("div");
    actions.className = "axxa-code-actions";
    const copyBtn = codeActionBtn("copy", copyLabel);
    wireCopy(copyBtn, () => code?.textContent ?? pre.textContent ?? "");
    const expandBtn = codeActionBtn("maximize-2", "Expand");
    expandBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openCodeOverlay(app, pre, lang, copyLabel);
    });
    actions.append(copyBtn, expandBtn);
    header.append(langEl, actions);

    wrap.append(header, pre); // move o <pre> pra dentro do wrapper
  });
}

// ── MOCK de ARTEFATOS (ref Claude): um fence ```artifacts com um array JSON de
// {name, type} vira cards (ícone do tipo + título + subtítulo). Placeholder até
// a feature real (que vem junto com Projetos). v0.2.11
function artifactIcon(type: string): string {
  const t = type.toLowerCase();
  if (t === "zip" || t.includes("archive")) return "file-archive";
  if (["md", "markdown", "doc", "document"].includes(t)) return "file-text";
  if (["sh", "bash", "code", "js", "ts", "py", "json"].includes(t)) return "file-code";
  if (["png", "jpg", "img", "image"].includes(t)) return "image";
  return "file";
}
function artifactSubtitle(type: string): string {
  const t = type.toLowerCase();
  if (["md", "markdown"].includes(t)) return "Document · MD";
  if (["sh", "bash"].includes(t)) return "Code · SH";
  if (["js", "ts", "py", "code", "json"].includes(t)) return "Code · " + type.toUpperCase();
  if (!type) return "File";
  return type.toUpperCase();
}
function enhanceArtifacts(root: HTMLElement) {
  root.querySelectorAll<HTMLPreElement>("pre").forEach((pre) => {
    const code = pre.querySelector("code");
    if (!code || !code.classList.contains("language-artifacts")) return;
    let items: Array<{ name?: string; type?: string }>;
    try {
      items = JSON.parse(code.textContent || "[]");
    } catch {
      return; // JSON inválido → deixa o bloco como code normal
    }
    if (!Array.isArray(items) || items.length === 0) return;

    const wrap = document.createElement("div");
    wrap.className = "axxa-artifacts";
    const head = document.createElement("div");
    head.className = "axxa-artifacts-head";
    head.textContent = `${items.length} Artifact${items.length === 1 ? "" : "s"}`;
    wrap.appendChild(head);

    items.forEach((it) => {
      const card = document.createElement("div");
      card.className = "axxa-artifact-card";
      const ico = document.createElement("span");
      ico.className = "axxa-artifact-ico";
      setIcon(ico, artifactIcon(it.type ?? ""));
      const main = document.createElement("div");
      main.className = "axxa-artifact-main";
      const title = document.createElement("div");
      title.className = "axxa-artifact-title";
      title.textContent = it.name ?? "Untitled";
      const sub = document.createElement("div");
      sub.className = "axxa-artifact-sub";
      sub.textContent = artifactSubtitle(it.type ?? "");
      main.append(title, sub);
      card.append(ico, main);
      wrap.appendChild(card);
    });

    pre.replaceWith(wrap);
  });
}
