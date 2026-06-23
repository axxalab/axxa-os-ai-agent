// .storybook/obsidian-mock.ts
// ---------------------------------------------------------------------------
// Mock da API do Obsidian para o Storybook (aliasado como `obsidian` no
// viteFinal do .storybook/main.ts). Espelha o stub de testes
// (tests/obsidian-stub.ts), mas vai além porque o Storybook RENDERIZA os
// componentes: `setIcon` precisa desenhar ícones de verdade e
// `MarkdownRenderer.render` precisa produzir HTML visível.
//
// Só cobrimos o que os componentes do DS tocam ao renderizar. Expanda conforme
// novas stories exercitem mais da API.
// ---------------------------------------------------------------------------

import { createElement, icons } from "lucide";

/* ----------------------------- setIcon ---------------------------------- */
// O Obsidian vem com Lucide bundleado; o setIcon nativo injeta o <svg> do ícone
// com a classe `.svg-icon` (que o styles/main.css dimensiona por contexto).
// Replicamos isso 1:1 usando o pacote `lucide`.

const toPascalCase = (name: string): string =>
  name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

export function setIcon(parent: HTMLElement, iconId: string): void {
  if (!parent) return;
  parent.replaceChildren();

  const node = (icons as Record<string, [string, Record<string, unknown>, unknown[]]>)[
    toPascalCase(iconId)
  ];
  if (!node) {
    // Fallback: nome desconhecido vira um quadradinho — torna o "buraco" visível
    // em vez de sumir silenciosamente (ajuda a achar ícones errados nas stories).
    const fallback = createElement("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2,
    }, [["rect", { x: 4, y: 4, width: 16, height: 16, rx: 3 }]]);
    fallback.classList.add("svg-icon", `lucide-${iconId}`);
    parent.appendChild(fallback);
    return;
  }

  const svg = createElement(node[0], node[1] as Record<string, unknown>, node[2] as unknown[]);
  svg.classList.add("svg-icon", `lucide-${iconId}`);
  parent.appendChild(svg);
}

/* --------------------------- MarkdownRenderer --------------------------- */
// Conversor markdown→HTML MÍNIMO (headings, bold/italic/code, listas, code
// fences, blockquote, links, parágrafos). Não é o renderer real do Obsidian —
// é o suficiente pra a story do <Markdown> mostrar conteúdo formatado de verdade.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMarkdown(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function renderMarkdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // code fence ```
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      closeList();
      const lang = fence[1] || "";
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // pula a fence de fechamento
      out.push(
        `<pre class="language-${lang}"><code>${escapeHtml(buf.join("\n"))}</code></pre>`
      );
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      closeList();
      out.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ""))}</blockquote>`);
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>`);
      i++;
      continue;
    }

    if (line.trim() === "") {
      closeList();
      i++;
      continue;
    }

    closeList();
    out.push(`<p>${inlineMarkdown(line)}</p>`);
    i++;
  }
  closeList();
  return out.join("\n");
}

export const MarkdownRenderer = {
  async render(
    _app: unknown,
    markdown: string,
    el: HTMLElement,
    _sourcePath: string,
    _component: unknown
  ): Promise<void> {
    el.innerHTML = renderMarkdownToHtml(markdown);
  },
};

/* ------------------------ classes / utilitários ------------------------- */

export class Notice {
  constructor(public message?: string) {
    // eslint-disable-next-line no-console
    if (message) console.info("[storybook Notice]", message);
  }
  setMessage(message: string): this {
    this.message = message;
    return this;
  }
  hide(): void {}
}

export class Component {
  load(): void {}
  unload(): void {}
  onload(): void {}
  onunload(): void {}
  register(): void {}
  registerEvent(): void {}
  addChild<T>(child: T): T {
    return child;
  }
}

export class Modal {
  app: unknown;
  contentEl: HTMLElement = document.createElement("div");
  titleEl: HTMLElement = document.createElement("div");
  constructor(app: unknown) {
    this.app = app;
  }
  open(): void {}
  close(): void {}
  onOpen(): void {}
  onClose(): void {}
}

export class Plugin {}
export class PluginSettingTab {}
export class ItemView {}
export class Setting {}
export class TFile {}
export class TFolder {}
export class MarkdownView {}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

export function parseYaml(): unknown {
  return {};
}

export async function requestUrl(): Promise<unknown> {
  throw new Error("requestUrl não disponível no Storybook.");
}

// Mutável: vire `true` numa story pra exercitar o caminho mobile.
export const Platform = { isMobile: false, isDesktop: true };

/* ----------------------------- App mock --------------------------------- */
// AppContext exige um `App` do Obsidian. Pra stories que renderizam Markdown,
// fornecemos um stub com o mínimo de superfície que o renderer/links tocam.
export function createMockApp(): unknown {
  return {
    workspace: {
      openLinkText: () => {},
      getLeaf: () => ({ openFile: async () => {} }),
    },
    vault: {
      getAbstractFileByPath: () => null,
      cachedRead: async () => "",
      adapter: { exists: async () => false },
    },
    metadataCache: { getFirstLinkpathDest: () => null },
  };
}
