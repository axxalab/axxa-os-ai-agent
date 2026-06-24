// .storybook/obsidian-dom.ts
// O Obsidian estende o HTMLElement.prototype com helpers próprios (empty,
// createEl, createDiv, createSpan, setText, addClass, setAttr, …). Eles existem
// só dentro do app — fora dele (Storybook / jsdom) os componentes que os usam
// quebram (ex.: o <Markdown> chama `el.empty()`). Aqui recriamos os mais usados
// pra que os componentes rendam idênticos ao app. Importar ANTES de qualquer
// componente (topo do preview.tsx).
/* eslint-disable @typescript-eslint/no-explicit-any */

type ElInfo =
  | string
  | {
      cls?: string | string[];
      text?: string;
      title?: string;
      href?: string;
      type?: string;
      placeholder?: string;
      value?: string;
      attr?: Record<string, string | number | boolean | null>;
    };

const proto = HTMLElement.prototype as any;

function applyInfo(el: HTMLElement, info?: ElInfo): HTMLElement {
  if (!info) return el;
  if (typeof info === "string") {
    if (info) el.className = info;
    return el;
  }
  if (info.cls) el.className = Array.isArray(info.cls) ? info.cls.join(" ") : info.cls;
  if (info.text != null) el.textContent = info.text;
  if (info.title != null) el.title = info.title;
  if (info.href != null) el.setAttribute("href", info.href);
  if (info.type != null) el.setAttribute("type", info.type);
  if (info.placeholder != null) el.setAttribute("placeholder", info.placeholder);
  if (info.value != null) (el as HTMLInputElement).value = info.value;
  if (info.attr) {
    for (const [k, v] of Object.entries(info.attr)) {
      if (v === false || v == null) el.removeAttribute(k);
      else el.setAttribute(k, v === true ? "" : String(v));
    }
  }
  return el;
}

function def(name: string, fn: (...args: any[]) => any): void {
  if (!(name in proto)) {
    Object.defineProperty(proto, name, { value: fn, writable: true, configurable: true });
  }
}

def("empty", function (this: HTMLElement) {
  while (this.firstChild) this.removeChild(this.firstChild);
  return this;
});
def("createEl", function (this: HTMLElement, tag: string, info?: ElInfo, cb?: (el: HTMLElement) => void) {
  const el = document.createElement(tag);
  applyInfo(el, info);
  this.appendChild(el);
  cb?.(el);
  return el;
});
def("createDiv", function (this: HTMLElement, info?: ElInfo, cb?: (el: HTMLElement) => void) {
  return (this as any).createEl("div", info, cb);
});
def("createSpan", function (this: HTMLElement, info?: ElInfo, cb?: (el: HTMLElement) => void) {
  return (this as any).createEl("span", info, cb);
});
def("setText", function (this: HTMLElement, text: string) {
  this.textContent = text ?? "";
  return this;
});
def("appendText", function (this: HTMLElement, text: string) {
  this.appendChild(document.createTextNode(text));
  return this;
});
def("addClass", function (this: HTMLElement, ...cls: string[]) {
  this.classList.add(...cls);
  return this;
});
def("removeClass", function (this: HTMLElement, ...cls: string[]) {
  this.classList.remove(...cls);
  return this;
});
def("toggleClass", function (this: HTMLElement, cls: string | string[], value?: boolean) {
  (Array.isArray(cls) ? cls : [cls]).forEach((c) => this.classList.toggle(c, value));
  return this;
});
def("hasClass", function (this: HTMLElement, cls: string) {
  return this.classList.contains(cls);
});
def("setAttr", function (this: HTMLElement, k: string, v: string | number | boolean | null) {
  if (v === false || v == null) this.removeAttribute(k);
  else this.setAttribute(k, v === true ? "" : String(v));
  return this;
});
def("setAttrs", function (this: HTMLElement, obj: Record<string, string | number | boolean | null>) {
  for (const [k, v] of Object.entries(obj)) (this as any).setAttr(k, v);
  return this;
});
def("getAttr", function (this: HTMLElement, k: string) {
  return this.getAttribute(k);
});
def("removeAttr", function (this: HTMLElement, k: string) {
  this.removeAttribute(k);
  return this;
});
def("detach", function (this: HTMLElement) {
  this.remove();
  return this;
});
def("insertAfter", function (this: HTMLElement, node: Node, ref?: Node | null) {
  this.insertBefore(node, ref ? ref.nextSibling : null);
  return node;
});
def("setCssStyles", function (this: HTMLElement, styles: Record<string, string>) {
  Object.assign(this.style, styles);
  return this;
});
def("setCssProps", function (this: HTMLElement, props: Record<string, string>) {
  for (const [k, v] of Object.entries(props)) this.style.setProperty(k, v);
  return this;
});
def("show", function (this: HTMLElement) {
  this.style.removeProperty("display");
  return this;
});
def("hide", function (this: HTMLElement) {
  this.style.display = "none";
  return this;
});
def("toggle", function (this: HTMLElement, show: boolean) {
  if (show) this.style.removeProperty("display");
  else this.style.display = "none";
  return this;
});

export {};
