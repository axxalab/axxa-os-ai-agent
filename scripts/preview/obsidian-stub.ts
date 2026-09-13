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
/** Frase falsa da transcrição — cresce a cada chamada, que é como o parcial
 *  se comporta de verdade (o texto vai aparecendo enquanto se fala). */
const FAKE_WORDS =
  ("perfeito chat só que assim a transcrição ela tem que aparecer desse mesmo " +
    "jeito que eu vou falando aqui olha que eu vou tirar o print pra você e " +
    "entendeu como é que funciona").split(" ");
let fakeCalls = 0;

export async function requestUrl(opts: { url?: string }): Promise<unknown> {
  // O preview NÃO fala com a rede. A transcrição é a exceção MODELADA: sem ela
  // não dá pra ver o texto crescendo, que é o coração do modo de voz.
  if (opts?.url && /audio\/transcriptions/.test(opts.url)) {
    fakeCalls += 1;
    // Latência de verdade (?lag=ms, padrão 2.5s). O celular não responde em
    // 200ms, e foi com a resposta INSTANTÂNEA que o preview escondeu o
    // problema do Pause.
    const lag = Number(new URLSearchParams(location.search).get("lag") ?? 2500);
    await new Promise((r) => setTimeout(r, lag));
    return {
      status: 200,
      json: { text: FAKE_WORDS.slice(0, Math.min(fakeCalls * 4, FAKE_WORDS.length)).join(" ") },
    };
  }
  // TTS: devolve um WAV mudo de verdade, pra dar pra exercitar o caminho
  // inteiro (blob → <audio> → play) sem falar com a rede.
  if (opts?.url && /audio\/speech|text-to-speech/.test(opts.url)) {
    await new Promise((r) => setTimeout(r, 300));
    return { status: 200, arrayBuffer: silentWav() };
  }
  if (opts?.url && /elevenlabs\.io\/v1\/voices/.test(opts.url)) {
    await new Promise((r) => setTimeout(r, 300));
    return {
      status: 200,
      json: {
        voices: [
          { voice_id: "v-rachel", name: "Rachel", category: "premade" },
          { voice_id: "v-rafael", name: "Rafael", category: "cloned" },
        ],
      },
    };
  }
  throw new Error("no network in preview");
}

/** WAV de 0.2s em silêncio — cabeçalho montado à mão. */
function silentWav(): ArrayBuffer {
  const rate = 8000;
  const frames = rate / 5;
  const buf = new ArrayBuffer(44 + frames * 2);
  const v = new DataView(buf);
  const ascii = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i));
  };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + frames * 2, true);
  ascii(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, frames * 2, true);
  return buf;
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
  infoEl: HTMLElement;
  // Publicos como no Obsidian de verdade: a casca decora o nameEl (logo do
  // provider). Criados no construtor, iguais aos de la.
  nameEl: HTMLElement;
  descEl: HTMLElement;
  controlEl: HTMLElement;

  constructor(el?: HTMLElement) {
    this.settingEl = document.createElement("div");
    this.settingEl.className = "setting-item";
    this.infoEl = document.createElement("div");
    this.infoEl.className = "setting-item-info";
    this.nameEl = document.createElement("div");
    this.nameEl.className = "setting-item-name";
    this.descEl = document.createElement("div");
    this.descEl.className = "setting-item-description";
    this.infoEl.append(this.nameEl, this.descEl);
    this.controlEl = document.createElement("div");
    this.controlEl.className = "setting-item-control";
    this.settingEl.append(this.infoEl, this.controlEl);
    el?.appendChild(this.settingEl);
  }
  setName(v: string) {
    this.nameEl.textContent = v;
    return this;
  }
  setDesc(v: string) {
    this.descEl.textContent = v;
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
      onChange(cb: (v: string) => void) {
        input.addEventListener("input", () => cb(input.value));
        return api;
      },
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
      onChange(cb: (v: boolean) => void) {
        wrap.addEventListener("click", () => {
          wrap.classList.toggle("is-enabled");
          cb(wrap.classList.contains("is-enabled"));
        });
        return api;
      },
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
      onChange(cb: (v: string) => void) {
        sel.addEventListener("change", () => cb(sel.value));
        return api;
      },
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
      onClick(cb: () => void) {
        btn.addEventListener("click", cb);
        return api;
      },
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
/** Registro do addIcon — o mesmo que o Obsidian mantém pros ícones custom. */
const CUSTOM_ICONS = new Map<string, string>();

export function addIcon(id: string, svgContent: string): void {
  CUSTOM_ICONS.set(id, svgContent);
}

export function setIcon(el: HTMLElement, name: string): void {
  const custom = CUSTOM_ICONS.get(name);
  if (custom) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.innerHTML = custom;
    el.appendChild(svg);
    return;
  }
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
