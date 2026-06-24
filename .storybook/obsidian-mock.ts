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

import { icons } from "lucide";

/* ----------------------------- setIcon ---------------------------------- */
// O Obsidian vem com Lucide bundleado; o setIcon nativo injeta o <svg> do ícone
// com a classe `.svg-icon` (que o styles/main.css dimensiona por contexto).
// Replicamos isso a partir dos dados do pacote `lucide`.
//
// Cada ícone do lucide é um IconNode no formato `[tag, attrs, children[]]`
// (recursivo). NÃO usamos o `createElement` do lucide de propósito: a sua
// assinatura difere entre os builds CJS e ESM (no ESM o export recebe o array
// inteiro; no CJS recebe 3 args) — montar o SVG manualmente é à prova disso.

type IconNode = [string, Record<string, unknown>, IconNode[]?];

const SVG_NS = "http://www.w3.org/2000/svg";

const toPascalCase = (name: string): string =>
  name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

function buildSvgNode([tag, attrs, children = []]: IconNode): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs ?? {})) {
    el.setAttribute(name, String(value));
  }
  for (const child of children) {
    el.appendChild(buildSvgNode(child));
  }
  return el;
}

const FALLBACK_NODE: IconNode = [
  "svg",
  {
    xmlns: SVG_NS,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 2,
  },
  [["rect", { x: 4, y: 4, width: 16, height: 16, rx: 3 }]],
];

export function setIcon(parent: HTMLElement, iconId: string): void {
  if (!parent) return;
  parent.replaceChildren();

  // 1) Ícone/logo de marca registrado via addIcon() (BRAND_LOGOS/BRAND_ICONS).
  //    O conteúdo é o INNER de um <svg viewBox="0 0 100 100"> (padrão do Obsidian).
  const custom = CUSTOM_ICONS.get(iconId);
  if (custom !== undefined) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.classList.add("svg-icon", iconId);
    svg.innerHTML = custom;
    parent.appendChild(svg);
    return;
  }

  // 2) Ícone Lucide (o setIcon nativo usa a mesma lib). Nome desconhecido vira
  //    um quadradinho — torna o "buraco" visível em vez de sumir silenciosamente.
  const node =
    (icons as unknown as Record<string, IconNode>)[toPascalCase(iconId)] ??
    FALLBACK_NODE;

  const svg = buildSvgNode(node);
  svg.classList.add("svg-icon", `lucide-${iconId}`);
  parent.appendChild(svg);
}

// Registro dos ícones customizados do Obsidian (addIcon). O AXXA registra os
// logos de marca via registerBrandLogos()/registerBrandIcons() no onload — no
// Storybook isso é feito no preview.
const CUSTOM_ICONS = new Map<string, string>();

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
export class ItemView {}
export class TFile {}
export class TFolder {
  children: unknown[] = [];
  path = "";
  name = "";
}
export class MarkdownView {}

// PluginSettingTab — fornece containerEl + app, como o real. O subclasse
// (AxxaSettingsTab) chama display() pra montar a UI imperativa.
export class PluginSettingTab {
  app: unknown;
  containerEl: HTMLElement;
  constructor(app: unknown, _plugin?: unknown) {
    this.app = app;
    this.containerEl = document.createElement("div");
  }
  display(): void {}
  hide(): void {}
}

/* --------------------------- Setting (fiel) ----------------------------- */
// Reconstrói a API fluente do Obsidian `Setting` montando o DOM real
// (.setting-item / -info / -name / -description / -control) + os componentes
// (Text/TextArea/Search/Toggle/Dropdown/Button/ExtraButton/Slider). O suficiente
// pra renderizar o AxxaSettingsTab inteiro idêntico ao app.

function applyText(el: HTMLElement, value: string | DocumentFragment | undefined): void {
  if (value == null) return;
  if (typeof value === "string") el.textContent = value;
  else el.replaceChildren(value);
}

class BaseComponent {
  disabled = false;
  setDisabled(d: boolean): this {
    this.disabled = d;
    return this;
  }
  then(cb: (c: this) => void): this {
    cb(this);
    return this;
  }
}

class TextComponent extends BaseComponent {
  inputEl: HTMLInputElement;
  constructor(parent: HTMLElement, type = "text") {
    super();
    this.inputEl = document.createElement("input");
    this.inputEl.type = type;
    parent.appendChild(this.inputEl);
  }
  getValue(): string {
    return this.inputEl.value;
  }
  setValue(v: string): this {
    this.inputEl.value = v ?? "";
    return this;
  }
  setPlaceholder(p: string): this {
    this.inputEl.placeholder = p ?? "";
    return this;
  }
  setDisabled(d: boolean): this {
    this.inputEl.disabled = d;
    return this;
  }
  onChange(cb: (v: string) => unknown): this {
    this.inputEl.addEventListener("input", () => cb(this.inputEl.value));
    return this;
  }
}

class SearchComponent extends TextComponent {
  constructor(parent: HTMLElement) {
    super(parent, "search");
  }
}

class TextAreaComponent extends BaseComponent {
  inputEl: HTMLTextAreaElement;
  constructor(parent: HTMLElement) {
    super();
    this.inputEl = document.createElement("textarea");
    parent.appendChild(this.inputEl);
  }
  getValue(): string {
    return this.inputEl.value;
  }
  setValue(v: string): this {
    this.inputEl.value = v ?? "";
    return this;
  }
  setPlaceholder(p: string): this {
    this.inputEl.placeholder = p ?? "";
    return this;
  }
  onChange(cb: (v: string) => unknown): this {
    this.inputEl.addEventListener("input", () => cb(this.inputEl.value));
    return this;
  }
}

class ToggleComponent extends BaseComponent {
  toggleEl: HTMLElement;
  private value = false;
  private cb?: (v: boolean) => unknown;
  constructor(parent: HTMLElement) {
    super();
    this.toggleEl = document.createElement("div");
    this.toggleEl.className = "checkbox-container";
    this.toggleEl.setAttribute("role", "switch");
    const input = document.createElement("input");
    input.type = "checkbox";
    this.toggleEl.appendChild(input);
    this.toggleEl.addEventListener("click", () => {
      this.setValue(!this.value);
      this.cb?.(this.value);
    });
    parent.appendChild(this.toggleEl);
  }
  getValue(): boolean {
    return this.value;
  }
  setValue(v: boolean): this {
    this.value = v;
    this.toggleEl.classList.toggle("is-enabled", v);
    return this;
  }
  onChange(cb: (v: boolean) => unknown): this {
    this.cb = cb;
    return this;
  }
}

class DropdownComponent extends BaseComponent {
  selectEl: HTMLSelectElement;
  constructor(parent: HTMLElement) {
    super();
    this.selectEl = document.createElement("select");
    this.selectEl.className = "dropdown";
    parent.appendChild(this.selectEl);
  }
  addOption(value: string, display: string): this {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = display;
    this.selectEl.appendChild(o);
    return this;
  }
  addOptions(record: Record<string, string>): this {
    for (const [v, d] of Object.entries(record)) this.addOption(v, d);
    return this;
  }
  getValue(): string {
    return this.selectEl.value;
  }
  setValue(v: string): this {
    this.selectEl.value = v;
    return this;
  }
  onChange(cb: (v: string) => unknown): this {
    this.selectEl.addEventListener("change", () => cb(this.selectEl.value));
    return this;
  }
}

class ButtonComponent extends BaseComponent {
  buttonEl: HTMLButtonElement;
  constructor(parent: HTMLElement) {
    super();
    this.buttonEl = document.createElement("button");
    parent.appendChild(this.buttonEl);
  }
  setButtonText(t: string): this {
    this.buttonEl.textContent = t;
    return this;
  }
  setCta(): this {
    this.buttonEl.classList.add("mod-cta");
    return this;
  }
  setWarning(): this {
    this.buttonEl.classList.add("mod-warning");
    return this;
  }
  setIcon(name: string): this {
    setIcon(this.buttonEl, name);
    return this;
  }
  setTooltip(t: string): this {
    this.buttonEl.setAttribute("aria-label", t);
    return this;
  }
  setDisabled(d: boolean): this {
    this.buttonEl.disabled = d;
    return this;
  }
  onClick(cb: (e: MouseEvent) => unknown): this {
    this.buttonEl.addEventListener("click", cb);
    return this;
  }
}

class ExtraButtonComponent extends BaseComponent {
  extraSettingsEl: HTMLElement;
  constructor(parent: HTMLElement) {
    super();
    this.extraSettingsEl = document.createElement("button");
    this.extraSettingsEl.className = "clickable-icon extra-setting-button";
    parent.appendChild(this.extraSettingsEl);
  }
  setIcon(name: string): this {
    setIcon(this.extraSettingsEl, name);
    return this;
  }
  setTooltip(t: string): this {
    this.extraSettingsEl.setAttribute("aria-label", t);
    return this;
  }
  setDisabled(): this {
    return this;
  }
  onClick(cb: (e: MouseEvent) => unknown): this {
    this.extraSettingsEl.addEventListener("click", cb);
    return this;
  }
}

class SliderComponent extends BaseComponent {
  sliderEl: HTMLInputElement;
  constructor(parent: HTMLElement) {
    super();
    this.sliderEl = document.createElement("input");
    this.sliderEl.type = "range";
    this.sliderEl.className = "slider";
    parent.appendChild(this.sliderEl);
  }
  setLimits(min: number, max: number, step: number): this {
    this.sliderEl.min = String(min);
    this.sliderEl.max = String(max);
    this.sliderEl.step = String(step);
    return this;
  }
  getValue(): number {
    return Number(this.sliderEl.value);
  }
  setValue(v: number): this {
    this.sliderEl.value = String(v);
    return this;
  }
  setDynamicTooltip(): this {
    return this;
  }
  onChange(cb: (v: number) => unknown): this {
    this.sliderEl.addEventListener("input", () => cb(Number(this.sliderEl.value)));
    return this;
  }
}

export class Setting {
  settingEl: HTMLElement;
  infoEl: HTMLElement;
  nameEl: HTMLElement;
  descEl: HTMLElement;
  controlEl: HTMLElement;
  components: BaseComponent[] = [];
  constructor(containerEl: HTMLElement) {
    this.settingEl = document.createElement("div");
    this.settingEl.className = "setting-item";
    this.infoEl = document.createElement("div");
    this.infoEl.className = "setting-item-info";
    this.nameEl = document.createElement("div");
    this.nameEl.className = "setting-item-name";
    this.descEl = document.createElement("div");
    this.descEl.className = "setting-item-description";
    this.controlEl = document.createElement("div");
    this.controlEl.className = "setting-item-control";
    this.infoEl.append(this.nameEl, this.descEl);
    this.settingEl.append(this.infoEl, this.controlEl);
    containerEl.appendChild(this.settingEl);
  }
  setName(v: string | DocumentFragment): this {
    applyText(this.nameEl, v);
    return this;
  }
  setDesc(v: string | DocumentFragment): this {
    applyText(this.descEl, v);
    return this;
  }
  setClass(c: string): this {
    this.settingEl.classList.add(c);
    return this;
  }
  setTooltip(t: string): this {
    this.settingEl.setAttribute("aria-label", t);
    return this;
  }
  setHeading(): this {
    this.settingEl.classList.add("setting-item-heading");
    return this;
  }
  setDisabled(d: boolean): this {
    this.settingEl.classList.toggle("is-disabled", d);
    return this;
  }
  clear(): this {
    this.controlEl.replaceChildren();
    this.components = [];
    return this;
  }
  then(cb: (s: Setting) => void): this {
    cb(this);
    return this;
  }
  addText(cb?: (c: TextComponent) => void): this {
    const c = new TextComponent(this.controlEl);
    this.components.push(c);
    cb?.(c);
    return this;
  }
  addSearch(cb?: (c: SearchComponent) => void): this {
    const c = new SearchComponent(this.controlEl);
    this.components.push(c);
    cb?.(c);
    return this;
  }
  addTextArea(cb?: (c: TextAreaComponent) => void): this {
    const c = new TextAreaComponent(this.controlEl);
    this.components.push(c);
    cb?.(c);
    return this;
  }
  addToggle(cb?: (c: ToggleComponent) => void): this {
    const c = new ToggleComponent(this.controlEl);
    this.components.push(c);
    cb?.(c);
    return this;
  }
  addDropdown(cb?: (c: DropdownComponent) => void): this {
    const c = new DropdownComponent(this.controlEl);
    this.components.push(c);
    cb?.(c);
    return this;
  }
  addButton(cb?: (c: ButtonComponent) => void): this {
    const c = new ButtonComponent(this.controlEl);
    this.components.push(c);
    cb?.(c);
    return this;
  }
  addExtraButton(cb?: (c: ExtraButtonComponent) => void): this {
    const c = new ExtraButtonComponent(this.controlEl);
    this.components.push(c);
    cb?.(c);
    return this;
  }
  addSlider(cb?: (c: SliderComponent) => void): this {
    const c = new SliderComponent(this.controlEl);
    this.components.push(c);
    cb?.(c);
    return this;
  }
  addColorPicker(cb?: (c: TextComponent) => void): this {
    const c = new TextComponent(this.controlEl, "color");
    this.components.push(c);
    cb?.(c);
    return this;
  }
  addMomentFormat(cb?: (c: TextComponent) => void): this {
    const c = new TextComponent(this.controlEl);
    this.components.push(c);
    cb?.(c);
    return this;
  }
}

// Menu nativo (context menus de ConversationsList / Sidebar / mensagens). A API
// é encadeável: new Menu().addItem(i => i.setTitle().setIcon().onClick()).showAt…
class MenuItem {
  setTitle(): this {
    return this;
  }
  setIcon(): this {
    return this;
  }
  setChecked(): this {
    return this;
  }
  setDisabled(): this {
    return this;
  }
  onClick(): this {
    return this;
  }
  setSection(): this {
    return this;
  }
}

export class Menu {
  addItem(cb: (item: MenuItem) => void): this {
    cb(new MenuItem());
    return this;
  }
  addSeparator(): this {
    return this;
  }
  setNoIcon(): this {
    return this;
  }
  showAtMouseEvent(): void {}
  showAtPosition(): void {}
  hide(): void {}
}

// Modais de busca (PlusModal usa FuzzySuggestModal). Render no Storybook é no-op.
export class SuggestModal<T> extends Modal {
  getSuggestions(_query: string): T[] {
    return [];
  }
  renderSuggestion(): void {}
  onChooseSuggestion(): void {}
}
export class FuzzySuggestModal<T> extends SuggestModal<T> {
  getItems(): T[] {
    return [];
  }
  getItemText(): string {
    return "";
  }
  onChooseItem(): void {}
}

export function addIcon(id: string, svgContent: string): void {
  CUSTOM_ICONS.set(id, svgContent);
}

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
