// scripts/preview/obsidian-stub.ts
// Stub da API do Obsidian para o preview no browser. Cobre so o que a casca
// toca: setIcon, Menu, Modal/Setting, MarkdownRenderer, Notice.
// setIcon emite <i data-lucide="nome"> e o index.html hidrata com lucide do CDN.

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}
/**
 * YAML de mentirinha, do tamanho do frontmatter que o app escreve: uma chave
 * por linha, valor entre aspas ou solto.
 *
 * O `{}` de antes fazia todo skill do preview aparecer com o ícone padrão e
 * sem modo, acontecesse o que acontecesse no formulário — ou seja, o preview
 * escondia justamente o efeito do seletor de ícone.
 */
export function parseYaml(texto?: string): unknown {
  const out: Record<string, string> = {};
  for (const linha of (texto ?? "").split(/\r?\n/)) {
    const m = linha.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"') && v.length > 1) {
      v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
    out[m[1]] = v;
  }
  return out;
}
export class Notice {
  constructor(public message?: string) {
    console.log("[notice]", message);
  }
  setMessage() {}
  hide() {}
}
/** Palavras da fala falsa — a transcrição devolve fatias daqui. */
const FAKE_WORDS =
  ("perfeito chat só que assim a transcrição ela tem que aparecer desse mesmo " +
    "jeito que eu vou falando aqui olha que eu vou tirar o print pra você e " +
    "entendeu como é que funciona").split(" ");
/** Segmento que o stub acha que está ouvindo. A casca corta a gravação em
 *  pedaços independentes: dentro de um segmento os envios CRESCEM (parcial,
 *  parcial maior, fechamento), e o primeiro envio do segmento seguinte é
 *  menor que o anterior. É esse degrau pra baixo que marca o corte aqui. */
let fakeSeg = -1;
let fakeUltimoTamanho = Infinity;

export async function requestUrl(opts: {
  url?: string;
  body?: ArrayBuffer | string;
}): Promise<unknown> {
  // Página web de mentira — é o que o "Link" do "+" busca. Sem isso não dava
  // pra ver o anexo de link nascer.
  if (opts?.url && /^https?:/.test(opts.url) && !/\/v1\//.test(opts.url)) {
    await new Promise((r) => setTimeout(r, 300));
    return {
      status: 200,
      text: [
        "<html><head><title>Spaced repetition — Wikipedia</title></head>",
        "<body><script>ignora()</script><h1>Spaced repetition</h1>",
        "<p>Spaced repetition is an evidence-based learning technique.</p>",
        "<p>It is usually performed with flashcards &amp; software.</p>",
        "</body></html>",
      ].join(""),
    };
  }
  // O preview NÃO fala com a rede. A transcrição é a exceção MODELADA: sem ela
  // não dá pra ver o texto crescendo, que é o coração do modo de voz.
  if (opts?.url && /audio\/transcriptions/.test(opts.url)) {
    const bytes =
      typeof opts.body === "string"
        ? opts.body.length
        : (opts.body?.byteLength ?? 0);
    if (bytes <= fakeUltimoTamanho) fakeSeg += 1;
    fakeUltimoTamanho = bytes;
    const seg = fakeSeg;
    // O registro é o que deixa MEDIR o que antes só dava pra intuir: quantos
    // envios, de que tamanho, e quanto tempo o último demorou.
    const log = ((window as unknown as Record<string, unknown>).__transcribeLog ??=
      []) as { bytes: number; at: number; seg: number }[];
    log.push({ bytes, at: Date.now(), seg });
    // ?falhar=3,4 derruba a 3a e a 4a chamadas. A rede do celular cai no meio
    // da fala o tempo todo, e o que a casca faz com isso (guardar o áudio e
    // tentar de novo no fim) não dá pra ver sem poder derrubar de propósito.
    const derrubar = (new URLSearchParams(location.search).get("falhar") ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number);
    if (derrubar.includes(log.length)) {
      await new Promise((r) => setTimeout(r, 200));
      return { status: 500, json: { error: { message: "preview: queda de propósito" } } };
    }
    // Latência MODELADA em três parcelas, porque foi com a resposta
    // INSTANTÂNEA que o preview escondeu o problema do Pause — e porque uma
    // latência FIXA esconde justamente o que estamos consertando agora (o
    // custo de reenviar áudio):
    //   fixa   — TLS + fila do servidor (?lag=ms, padrão 700)
    //   rede   — subir os bytes a ~1,5 Mbps de uplink de celular
    //   modelo — transcrever roda a ~0,12x o tempo do áudio
    // Áudio a 32kbps => 4000 bytes por segundo de fala. CUIDADO ao comparar
    // com uma versão que grave em outro bitrate: a parcela do modelo é
    // estimada A PARTIR DOS BYTES, então um áudio mais gordo parece mais
    // LONGO do que é e leva uma punição que não é dele.
    const base = Number(new URLSearchParams(location.search).get("lag") ?? 700);
    const segundosDeAudio = bytes / 4000;
    await new Promise((r) =>
      setTimeout(r, base + bytes / 190 + segundosDeAudio * 120)
    );
    // Mesmo áudio, mesmo texto; mais áudio, mais palavras — é o que um
    // transcritor faz. Cada segmento pega uma fatia diferente da frase.
    const palavras = Math.max(1, Math.min(6, Math.round(bytes / 6000)));
    const inicio = (seg * 6) % FAKE_WORDS.length;
    return {
      status: 200,
      json: { text: FAKE_WORDS.slice(inicio, inicio + palavras).join(" ") },
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
/**
 * Modal com a ÁRVORE de verdade do Obsidian — `.modal-container.mod-dim` →
 * `.modal` → `.modal-content`. Um `open()` vazio (como era antes) escondia o
 * desenho inteiro do modal de aprovação: o preview só conseguia mostrar um
 * espelho de HTML escrito à mão, que mente por construção.
 */
export class Modal {
  containerEl: HTMLElement;
  modalEl: HTMLElement;
  titleEl: HTMLElement;
  contentEl: HTMLElement;

  constructor(public app?: unknown) {
    this.containerEl = document.createElement("div");
    this.containerEl.className = "modal-container mod-dim";
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    this.modalEl = document.createElement("div");
    this.modalEl.className = "modal";
    const fechar = document.createElement("div");
    fechar.className = "modal-close-button";
    fechar.addEventListener("click", () => this.close());
    this.titleEl = document.createElement("div");
    this.titleEl.className = "modal-title";
    this.contentEl = document.createElement("div");
    this.contentEl.className = "modal-content";
    this.modalEl.append(fechar, this.titleEl, this.contentEl);
    this.containerEl.append(bg, this.modalEl);
  }

  onOpen(): void {}
  onClose(): void {}

  open() {
    document.body.appendChild(this.containerEl);
    this.onOpen();
  }

  close() {
    this.onClose();
    this.containerEl.remove();
  }
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
/** Base64 de um ArrayBuffer — o Obsidian expõe isso e a casca usa pra anexar
 *  um artefato do vault como imagem. */
export function arrayBufferToBase64(buf: ArrayBuffer): string {
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export class Component {
  load() {}
  unload() {}
}
/**
 * Markdown de mentirinha — só o suficiente pra PROVAR que a formatação chega
 * (negrito, itálico, título, lista, código). O renderer de verdade é o do
 * Obsidian; aqui o que importa é o pipeline: quem chama, quando, e se pisca.
 * `textContent` cru, como estava antes, escondia exatamente o bug do stream.
 */
export const MarkdownRenderer = {
  async render(_app: unknown, text: string, el: HTMLElement) {
    const esc = (t: string) =>
      t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const inline = (t: string) =>
      esc(t)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
        // Link: sem isso o preview não tinha como mostrar a cor de acento.
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    const out: string[] = [];
    let lista: string[] = [];
    const fechaLista = () => {
      if (lista.length) out.push("<ul>" + lista.join("") + "</ul>");
      lista = [];
    };
    let tabela: string[] = [];
    const celulas = (l: string) =>
      l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    const fechaTabela = () => {
      if (tabela.length === 0) return;
      const linhas = tabela.filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l));
      const [cab, ...corpo] = linhas;
      const th = celulas(cab ?? "").map((c) => "<th>" + inline(c) + "</th>");
      const tr = corpo.map(
        (l) =>
          "<tr>" +
          celulas(l).map((c) => "<td>" + inline(c) + "</td>").join("") +
          "</tr>"
      );
      out.push(
        "<table><thead><tr>" + th.join("") + "</tr></thead><tbody>" +
          tr.join("") + "</tbody></table>"
      );
      tabela = [];
    };
    // Cerca de código: <pre><code class="language-x">, que é o que o Obsidian
    // produz (e onde o Prism dele pinta os tokens). Sem isto o preview não
    // mostrava bloco de código NENHUM — a formatação sumia calada.
    let cerca: { marca: string; lang: string; linhas: string[] } | null = null;
    // O Obsidian injeta um botão de copiar dentro de todo bloco de código. Sem
    // ele aqui, o preview mostrava um bloco que não existe no aparelho — e foi
    // justamente o botão que apareceu fora do lugar.
    const bloco = (lang: string, linhas: string[]) =>
      '<pre><button class="copy-code-button"><i data-lucide="copy"></i></button><code class="language-' +
      lang +
      '">' +
      esc(linhas.join(String.fromCharCode(10))) +
      "</code></pre>";
    for (const linha of text.split(String.fromCharCode(10))) {
      const abre = linha.match(/^ {0,3}(`{3,}|~{3,})\s*([A-Za-z0-9_+-]*)\s*$/);
      if (cerca) {
        if (abre && abre[1][0] === cerca.marca[0] && abre[1].length >= cerca.marca.length) {
          out.push(bloco(cerca.lang, cerca.linhas));
          cerca = null;
        } else {
          cerca.linhas.push(linha);
        }
        continue;
      }
      if (abre) {
        fechaLista();
        cerca = { marca: abre[1], lang: abre[2] || "none", linhas: [] };
        continue;
      }
      const h = linha.match(/^(#{1,4})\s+(.*)$/);
      const li = linha.match(/^[-*]\s+(.*)$/);
      // TABELA: acumula as linhas que começam e terminam com "|". Sem isto o
      // preview não renderizava tabela nenhuma — e tabela é justamente o que
      // mais aparece diferente entre um markdown cru e um formatado.
      if (/^\s*\|.*\|\s*$/.test(linha)) {
        fechaLista();
        tabela.push(linha);
        continue;
      }
      if (tabela.length > 0) fechaTabela();
      // Citação e régua.
      if (/^>\s?/.test(linha)) {
        fechaLista();
        out.push("<blockquote><p>" + inline(linha.replace(/^>\s?/, "")) + "</p></blockquote>");
        continue;
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(linha.trim())) {
        fechaLista();
        out.push("<hr>");
        continue;
      }
      if (h) {
        fechaLista();
        out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      } else if (li) {
        lista.push(`<li>${inline(li[1])}</li>`);
      } else if (linha.trim() === "") {
        fechaLista();
      } else {
        fechaLista();
        out.push(`<p>${inline(linha)}</p>`);
      }
    }
    fechaLista();
    fechaTabela();
    if (cerca) out.push(bloco(cerca.lang, cerca.linhas));
    el.innerHTML = out.join("");
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
/** ?platform=desktop troca o aparelho. O stub fixo em `isMobile: true` não
 *  deixava nem testar o caminho do desktop (Enter envia, Shift+Enter quebra). */
export const Platform = {
  isMobile:
    new URLSearchParams(location.search).get("platform") !== "desktop",
};

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
