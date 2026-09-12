// scripts/preview/obsidian-stub.ts
// Stub da API do Obsidian para o preview no browser. Cobre so o que a casca
// toca: setIcon, Menu, Modal/Setting, MarkdownRenderer, Notice.
// setIcon emite <i data-lucide="nome"> e o index.html hidrata com lucide do CDN.

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}
export function parseYaml(): unknown {
  return {};
}
export class Notice {
  constructor(public message?: string) {
    console.log("[notice]", message);
  }
  setMessage() {}
  hide() {}
}
export async function requestUrl(): Promise<unknown> {
  throw new Error("no network in preview");
}
export class Plugin {}
export class PluginSettingTab {
  containerEl: HTMLElement = document.createElement("div");
  constructor(public app?: unknown, _plugin?: unknown) {}
  display(): void {}
}
export class ItemView {}
export class Modal {
  constructor(public app?: unknown) {}
  open() {}
  close() {}
}
export class FuzzySuggestModal extends Modal {
  setPlaceholder() {}
}
/** Setting API o bastante pra renderizar a aba de settings no preview. */
export class Setting {
  settingEl: HTMLElement;
  private infoEl: HTMLElement;
  private controlEl: HTMLElement;

  constructor(el?: HTMLElement) {
    this.settingEl = document.createElement("div");
    this.settingEl.className = "setting-item";
    this.infoEl = document.createElement("div");
    this.infoEl.className = "setting-item-info";
    this.controlEl = document.createElement("div");
    this.controlEl.className = "setting-item-control";
    this.settingEl.append(this.infoEl, this.controlEl);
    el?.appendChild(this.settingEl);
  }
  setName(v: string) {
    const n = document.createElement("div");
    n.className = "setting-item-name";
    n.textContent = v;
    this.infoEl.appendChild(n);
    return this;
  }
  setDesc(v: string) {
    const d = document.createElement("div");
    d.className = "setting-item-description";
    d.textContent = v;
    this.infoEl.appendChild(d);
    return this;
  }
  setHeading() {
    this.settingEl.classList.add("setting-item-heading");
    return this;
  }
  addText(cb: (t: unknown) => void) {
    const input = document.createElement("input");
    input.type = "text";
    this.controlEl.appendChild(input);
    const api = {
      inputEl: input,
      setPlaceholder(v: string) { input.placeholder = v; return api; },
      setValue(v: string) { input.value = v ?? ""; return api; },
      onChange() { return api; },
    };
    cb(api);
    return this;
  }
  addToggle(cb: (t: unknown) => void) {
    const wrap = document.createElement("div");
    wrap.className = "checkbox-container";
    this.controlEl.appendChild(wrap);
    const api = {
      setValue(v: boolean) { wrap.classList.toggle("is-enabled", !!v); return api; },
      onChange() { return api; },
    };
    cb(api);
    return this;
  }
  addDropdown(cb: (d: unknown) => void) {
    const sel = document.createElement("select");
    sel.className = "dropdown";
    this.controlEl.appendChild(sel);
    const api = {
      addOption(value: string, label: string) {
        const o = document.createElement("option");
        o.value = value; o.textContent = label; sel.appendChild(o); return api;
      },
      setValue(v: string) { sel.value = v; return api; },
      onChange() { return api; },
    };
    cb(api);
    return this;
  }
  addButton(cb: (b: unknown) => void) {
    const btn = document.createElement("button");
    this.controlEl.appendChild(btn);
    const api = {
      buttonEl: btn,
      setButtonText(v: string) { btn.textContent = v; return api; },
      setCta() { btn.classList.add("mod-cta"); return api; },
      setWarning() { btn.classList.add("mod-warning"); return api; },
      setDisabled(v: boolean) { btn.disabled = !!v; return api; },
      onClick() { return api; },
    };
    cb(api);
    return this;
  }
}
export class TFile {}
export class TFolder {}
export class Component {
  load() {}
  unload() {}
}
export const MarkdownRenderer = {
  async render(_app: unknown, text: string, el: HTMLElement) {
    el.textContent = text;
  },
};
export function setIcon(el: HTMLElement, name: string): void {
  const i = document.createElement("i");
  i.setAttribute("data-lucide", name);
  el.appendChild(i);
  (window as unknown as { lucide?: { createIcons: (o: unknown) => void } })
    .lucide?.createIcons({ nameAttr: "data-lucide" });
}
export const Platform = { isMobile: true };

export class MenuItem {
  title = "";
  checked = false;
  setTitle(t: string) {
    this.title = t;
    return this;
  }
  setIcon() {
    return this;
  }
  setChecked(v: boolean) {
    this.checked = v;
    return this;
  }
  setDisabled() {
    return this;
  }
  setWarning() {
    return this;
  }
  onClick(cb: () => void) {
    this.cb = cb;
    return this;
  }
  cb: (() => void) | null = null;
}

/** Menu do preview: popup simples só pra conferir o fluxo visual. */
export class Menu {
  private items: MenuItem[] = [];
  addItem(cb: (item: MenuItem) => void) {
    const it = new MenuItem();
    cb(it);
    this.items.push(it);
    return this;
  }
  showAtPosition(pos: { x: number; y: number }) {
    const host = document.createElement("div");
    host.className = "preview-menu";
    host.style.left = `${Math.min(pos.x, window.innerWidth - 220)}px`;
    host.style.top = `${Math.min(pos.y, window.innerHeight - 200)}px`;
    for (const it of this.items) {
      const b = document.createElement("button");
      b.textContent = (it.checked ? "✓ " : "") + it.title;
      b.onclick = () => {
        it.cb?.();
        host.remove();
      };
      host.appendChild(b);
    }
    document.body.appendChild(host);
    setTimeout(() => {
      const off = () => {
        host.remove();
        document.removeEventListener("click", off);
      };
      document.addEventListener("click", off);
    }, 0);
  }
  showAtMouseEvent(ev: MouseEvent) {
    this.showAtPosition({ x: ev.clientX, y: ev.clientY });
  }
}
