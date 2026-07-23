// storybook/obsidian-shim.ts
// Shim do módulo "obsidian" pro Storybook (preview fora do Obsidian).
// Cobre SÓ o que os componentes usam em runtime: setIcon/addIcon (Lucide),
// Notice, Menu, Platform, Component, MarkdownRenderer (markdown naive),
// Modal e as extensões de prototype do DOM (createEl/empty/...).
// Nunca entra no bundle real do plugin — alias só no esbuild do storybook.

import { icons, createElement } from "lucide";

// ── Extensões de DOM (Obsidian estende HTMLElement.prototype) ──
type CreateOpts =
  | string
  | {
      cls?: string | string[];
      text?: string;
      attr?: Record<string, string>;
      type?: string;
      placeholder?: string;
      value?: string;
      href?: string;
    };

function applyOpts(el: HTMLElement, opts?: CreateOpts) {
  if (!opts) return;
  if (typeof opts === "string") {
    el.className = opts;
    return;
  }
  if (opts.cls)
    el.className = Array.isArray(opts.cls) ? opts.cls.join(" ") : opts.cls;
  if (opts.text) el.textContent = opts.text;
  if (opts.attr)
    for (const [k, v] of Object.entries(opts.attr)) el.setAttribute(k, v);
  if (opts.type) (el as HTMLInputElement).type = opts.type;
  if (opts.placeholder) (el as HTMLInputElement).placeholder = opts.placeholder;
  if (opts.value !== undefined) (el as HTMLInputElement).value = opts.value;
  if (opts.href) (el as HTMLAnchorElement).href = opts.href;
}

const proto = HTMLElement.prototype as any;
proto.createEl ??= function (tag: string, opts?: CreateOpts) {
  const el = document.createElement(tag);
  applyOpts(el, opts);
  this.appendChild(el);
  return el;
};
proto.createDiv ??= function (opts?: CreateOpts) {
  return this.createEl("div", opts);
};
proto.createSpan ??= function (opts?: CreateOpts) {
  return this.createEl("span", opts);
};
proto.empty ??= function () {
  this.replaceChildren();
};
proto.setText ??= function (t: string) {
  this.textContent = t;
};
proto.addClass ??= function (...cls: string[]) {
  this.classList.add(...cls);
};
proto.removeClass ??= function (...cls: string[]) {
  this.classList.remove(...cls);
};
proto.toggleClass ??= function (cls: string, on: boolean) {
  this.classList.toggle(cls, on);
};
proto.detach ??= function () {
  this.remove();
};
proto.appendText ??= function (t: string) {
  this.appendChild(document.createTextNode(t));
};
proto.onClickEvent ??= function (cb: (e: MouseEvent) => void) {
  this.addEventListener("click", cb);
};
proto.setAttr ??= function (k: string, v: string) {
  this.setAttribute(k, v);
};

// ── Ícones ─────────────────────────────────────────────────
const customIcons = new Map<string, string>();

export function addIcon(id: string, svgContent: string) {
  customIcons.set(id, svgContent);
}

function kebabToPascal(name: string): string {
  return name
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

export function setIcon(el: HTMLElement, name: string) {
  el.replaceChildren();
  const custom = customIcons.get(name);
  if (custom) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.classList.add("svg-icon");
    svg.innerHTML = custom;
    el.appendChild(svg);
    return;
  }
  const node = (icons as any)[kebabToPascal(name)];
  if (!node) return;
  const svg = createElement(node);
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.classList.add("svg-icon");
  el.appendChild(svg);
}

// ── Notice (toast) ─────────────────────────────────────────
export class Notice {
  noticeEl: HTMLElement;
  constructor(message: string | DocumentFragment, timeout = 4000) {
    let host = document.querySelector(".sb-notices") as HTMLElement | null;
    if (!host) {
      host = document.createElement("div");
      host.className = "sb-notices";
      document.body.appendChild(host);
    }
    this.noticeEl = document.createElement("div");
    this.noticeEl.className = "sb-notice";
    if (typeof message === "string") this.noticeEl.textContent = message;
    else this.noticeEl.appendChild(message);
    host.appendChild(this.noticeEl);
    if (timeout > 0) window.setTimeout(() => this.hide(), timeout);
  }
  setMessage(m: string) {
    this.noticeEl.textContent = m;
    return this;
  }
  hide() {
    this.noticeEl.remove();
  }
}

// ── Menu (context menu) ────────────────────────────────────
class MenuItem {
  el: HTMLElement;
  constructor(el: HTMLElement) {
    this.el = el;
  }
  setTitle(t: string) {
    const span = this.el.querySelector(".sb-menu-title") as HTMLElement;
    span.textContent = t;
    return this;
  }
  setIcon(name: string) {
    const span = this.el.querySelector(".sb-menu-icon") as HTMLElement;
    setIcon(span, name);
    return this;
  }
  setSection() {
    return this;
  }
  setChecked() {
    return this;
  }
  setDisabled(d: boolean) {
    this.el.classList.toggle("is-disabled", d);
    return this;
  }
  onClick(cb: (e: Event) => void) {
    this.el.addEventListener("click", (e) => {
      cb(e);
      this.el.closest(".sb-menu")?.remove();
    });
    return this;
  }
}

export class Menu {
  menuEl: HTMLElement;
  constructor() {
    this.menuEl = document.createElement("div");
    this.menuEl.className = "sb-menu";
  }
  addItem(cb: (item: MenuItem) => void) {
    const el = document.createElement("div");
    el.className = "sb-menu-item";
    el.innerHTML = `<span class="sb-menu-icon"></span><span class="sb-menu-title"></span>`;
    this.menuEl.appendChild(el);
    cb(new MenuItem(el));
    return this;
  }
  addSeparator() {
    const el = document.createElement("div");
    el.className = "sb-menu-sep";
    this.menuEl.appendChild(el);
    return this;
  }
  showAtMouseEvent(e: MouseEvent) {
    this.showAtPosition({ x: e.clientX, y: e.clientY });
    return this;
  }
  showAtPosition(pos: { x: number; y: number }) {
    this.menuEl.style.left = `${pos.x}px`;
    this.menuEl.style.top = `${pos.y}px`;
    document.body.appendChild(this.menuEl);
    const close = (ev: MouseEvent) => {
      if (!this.menuEl.contains(ev.target as Node)) {
        this.menuEl.remove();
        document.removeEventListener("mousedown", close);
      }
    };
    window.setTimeout(() =>
      document.addEventListener("mousedown", close)
    );
    return this;
  }
  hide() {
    this.menuEl.remove();
    return this;
  }
}

// ── Platform ───────────────────────────────────────────────
export const Platform = {
  isMobile: false,
  isMobileApp: false,
  isPhone: false,
  isTablet: false,
  isDesktop: true,
  isDesktopApp: false,
  isIosApp: false,
  isAndroidApp: false,
  isMacOS: false,
  isWin: false,
  isLinux: true,
  isSafari: false,
};

// ── Component / lifecycle ──────────────────────────────────
export class Component {
  load() {}
  onload() {}
  unload() {}
  onunload() {}
  addChild<T>(c: T): T {
    return c;
  }
  removeChild<T>(c: T): T {
    return c;
  }
  register() {}
  registerEvent() {}
  registerDomEvent(el: EventTarget, ev: string, cb: EventListener) {
    el.addEventListener(ev, cb);
  }
  registerInterval(id: number) {
    return id;
  }
}

// ── Markdown renderer (naive, só pro preview) ──────────────
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMd(s: string): string {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[\[([^\]]+)\]\]/g, '<a class="internal-link" href="#">$1</a>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="external-link" rel="noopener">$1</a>');
}

function naiveMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeLang = "";
  let codeBuf: string[] = [];
  let listMode: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listMode) {
      out.push(`</${listMode}>`);
      listMode = null;
    }
  };

  for (const raw of lines) {
    if (raw.startsWith("```")) {
      if (!inCode) {
        closeList();
        inCode = true;
        codeLang = raw.slice(3).trim();
        codeBuf = [];
      } else {
        out.push(
          `<pre><code class="language-${codeLang}">${escapeHtml(codeBuf.join("\n"))}</code></pre>`
        );
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(raw);
      continue;
    }
    const line = escapeHtml(raw);
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      out.push(`<h${h[1].length}>${inlineMd(h[2])}</h${h[1].length}>`);
      continue;
    }
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ol || ul) {
      const mode = ol ? "ol" : "ul";
      if (listMode !== mode) {
        closeList();
        out.push(`<${mode}>`);
        listMode = mode;
      }
      out.push(`<li>${inlineMd((ol ?? ul)![1])}</li>`);
      continue;
    }
    closeList();
    if (line.startsWith("&gt; ")) {
      out.push(`<blockquote><p>${inlineMd(line.slice(5))}</p></blockquote>`);
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      out.push("<hr>");
      continue;
    }
    if (line.trim() === "") continue;
    out.push(`<p>${inlineMd(line)}</p>`);
  }
  if (inCode)
    out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
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
  ) {
    el.innerHTML = naiveMarkdown(markdown);
  },
};

// ── Modal ──────────────────────────────────────────────────
export class Modal {
  app: unknown;
  containerEl: HTMLElement;
  modalEl: HTMLElement;
  contentEl: HTMLElement;
  titleEl: HTMLElement;
  constructor(app: unknown) {
    this.app = app;
    this.containerEl = document.createElement("div");
    this.containerEl.className = "modal-container sb-modal-container";
    const bg = this.containerEl.createDiv("modal-bg");
    bg.addEventListener("click", () => this.close());
    this.modalEl = this.containerEl.createDiv("modal");
    const closeBtn = this.modalEl.createDiv("modal-close-button");
    closeBtn.addEventListener("click", () => this.close());
    this.titleEl = this.modalEl.createDiv("modal-title");
    this.contentEl = this.modalEl.createDiv("modal-content");
  }
  open() {
    document.body.appendChild(this.containerEl);
    this.onOpen();
  }
  close() {
    this.onClose();
    this.containerEl.remove();
  }
  onOpen() {}
  onClose() {}
  setTitle(t: string) {
    this.titleEl.setText(t);
    return this;
  }
}

export class SuggestModal extends Modal {
  setPlaceholder() {}
}
export class FuzzySuggestModal extends SuggestModal {}

// ── Setting (linha de settings nativa) ─────────────────────
export class Setting {
  settingEl: HTMLElement;
  nameEl: HTMLElement;
  descEl: HTMLElement;
  controlEl: HTMLElement;
  constructor(container: HTMLElement) {
    this.settingEl = container.createDiv("setting-item");
    const info = this.settingEl.createDiv("setting-item-info");
    this.nameEl = info.createDiv("setting-item-name");
    this.descEl = info.createDiv("setting-item-description");
    this.controlEl = this.settingEl.createDiv("setting-item-control");
  }
  setName(n: string) {
    this.nameEl.setText(n);
    return this;
  }
  setDesc(d: string) {
    this.descEl.setText(d);
    return this;
  }
  setHeading() {
    this.settingEl.addClass("setting-item-heading");
    return this;
  }
  addText(cb: (c: any) => void) {
    const input = this.controlEl.createEl("input", { type: "text" }) as HTMLInputElement;
    const c: any = {
      inputEl: input,
      setValue(v: string) {
        input.value = v;
        return c;
      },
      getValue() {
        return input.value;
      },
      setPlaceholder(p: string) {
        input.placeholder = p;
        return c;
      },
      setDisabled(d: boolean) {
        input.disabled = d;
        return c;
      },
      onChange(f: (v: string) => void) {
        input.addEventListener("input", () => f(input.value));
        return c;
      },
    };
    cb(c);
    return this;
  }
  addTextArea(cb: (c: any) => void) {
    const input = this.controlEl.createEl("textarea") as HTMLTextAreaElement;
    const c: any = {
      inputEl: input,
      setValue(v: string) {
        input.value = v;
        return c;
      },
      setPlaceholder(p: string) {
        input.placeholder = p;
        return c;
      },
      onChange(f: (v: string) => void) {
        input.addEventListener("input", () => f(input.value));
        return c;
      },
    };
    cb(c);
    return this;
  }
  addToggle(cb: (c: any) => void) {
    const input = this.controlEl.createEl("input", { type: "checkbox" }) as HTMLInputElement;
    const c: any = {
      toggleEl: input,
      setValue(v: boolean) {
        input.checked = v;
        return c;
      },
      setDisabled(d: boolean) {
        input.disabled = d;
        return c;
      },
      setTooltip() {
        return c;
      },
      onChange(f: (v: boolean) => void) {
        input.addEventListener("change", () => f(input.checked));
        return c;
      },
    };
    cb(c);
    return this;
  }
  addButton(cb: (c: any) => void) {
    const btn = this.controlEl.createEl("button") as HTMLButtonElement;
    const c: any = {
      buttonEl: btn,
      setButtonText(t: string) {
        btn.textContent = t;
        return c;
      },
      setIcon(name: string) {
        setIcon(btn, name);
        return c;
      },
      setCta() {
        btn.addClass("mod-cta");
        return c;
      },
      setWarning() {
        btn.addClass("mod-warning");
        return c;
      },
      setTooltip(t: string) {
        btn.title = t;
        return c;
      },
      setDisabled(d: boolean) {
        btn.disabled = d;
        return c;
      },
      onClick(f: () => void) {
        btn.addEventListener("click", f);
        return c;
      },
    };
    cb(c);
    return this;
  }
  addExtraButton(cb: (c: any) => void) {
    return this.addButton(cb);
  }
  addDropdown(cb: (c: any) => void) {
    const sel = this.controlEl.createEl("select") as HTMLSelectElement;
    const c: any = {
      selectEl: sel,
      addOption(v: string, l: string) {
        const o = sel.createEl("option") as HTMLOptionElement;
        o.value = v;
        o.textContent = l;
        return c;
      },
      addOptions(opts: Record<string, string>) {
        for (const [v, l] of Object.entries(opts)) c.addOption(v, l);
        return c;
      },
      setValue(v: string) {
        sel.value = v;
        return c;
      },
      setDisabled(d: boolean) {
        sel.disabled = d;
        return c;
      },
      onChange(f: (v: string) => void) {
        sel.addEventListener("change", () => f(sel.value));
        return c;
      },
    };
    cb(c);
    return this;
  }
  addSlider(cb: (c: any) => void) {
    const input = this.controlEl.createEl("input", { type: "range" }) as HTMLInputElement;
    const c: any = {
      sliderEl: input,
      setLimits(min: number, max: number, step: number) {
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        return c;
      },
      setValue(v: number) {
        input.value = String(v);
        return c;
      },
      setDynamicTooltip() {
        return c;
      },
      onChange(f: (v: number) => void) {
        input.addEventListener("input", () => f(Number(input.value)));
        return c;
      },
    };
    cb(c);
    return this;
  }
  setDisabled() {
    return this;
  }
  setClass(cls: string) {
    this.settingEl.addClass(cls);
    return this;
  }
  setTooltip() {
    return this;
  }
  then(cb: (s: Setting) => void) {
    cb(this);
    return this;
  }
  clear() {
    this.controlEl.empty();
    return this;
  }
}

// ── Vault types / helpers ──────────────────────────────────
export class TAbstractFile {
  path = "";
  name = "";
}
export class TFile extends TAbstractFile {
  basename = "";
  extension = "";
  stat = { ctime: 0, mtime: 0, size: 0 };
}
export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

export function parseYaml(s: string): any {
  // Naive: só key: value linha a linha (suficiente pro preview).
  const out: Record<string, unknown> = {};
  for (const line of s.split("\n")) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

export async function requestUrl(): Promise<any> {
  throw new Error("requestUrl não disponível no storybook");
}

// ── PluginSettingTab (pro preview da Settings) ─────────────
export class PluginSettingTab {
  app: unknown;
  plugin: unknown;
  containerEl: HTMLElement;
  constructor(app: unknown, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement("div");
    this.containerEl.className = "vertical-tab-content sb-settings-host";
  }
  display() {}
  hide() {}
}

// ── Stubs de classes só-tipo (nunca instanciadas no preview) ─
export class Plugin extends Component {}
export class ItemView extends Component {}
export class WorkspaceLeaf {}

export type App = any;
export type CachedMetadata = any;
export type DataAdapter = any;
