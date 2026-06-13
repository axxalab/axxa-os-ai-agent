// src/generation/ImageGenModal.ts
// Modal de confirmação da geração de imagem (v0.1.166). Aberto pelo fallback
// manual (+ → Criar imagem) e, futuramente, pela tool generate_image do agente.
//
// Mostra: prompt (editável), e a lista de modelos de imagem ATIVOS com preço por
// imagem + se o provider está CONECTADO (first-user case). O user confirma o
// modelo e dispara — sem trocar o modelo ativo da conversa.
//
// UX ref: app do Claude — modal limpo, opções como cards selecionáveis, CTA claro.

import { App, Modal } from "obsidian";

export interface ImageModelOption {
  providerId: string;
  providerLabel: string;
  model: string;
  /** USD por imagem (1024x1024), quando conhecido. */
  pricePerImage?: number;
  /** Provider tem chave/endpoint configurado. */
  connected: boolean;
  /** Suporta edição de imagem (IMG2IMG) — hoje só o Nano Banana. */
  supportsEdit: boolean;
}

export interface ImageGenChoice {
  providerId: string;
  model: string;
  prompt: string;
  /** Usar a imagem anexada como entrada (IMG2IMG). */
  useInputImage: boolean;
}

export interface ImageGenStrings {
  title: string;
  editTitle: string;
  promptLabel: string;
  promptPlaceholder: string;
  modelLabel: string;
  generate: string;
  cancel: string;
  connected: string;
  notConnected: string;
  /** Nenhum provider de imagem conectado — orienta a configurar. */
  noneConnected: string;
  noModels: string;
  free: string;
  useAttached: string;
  editOnlyNano: string;
  perImage: (usd: string) => string;
}

interface Opts {
  options: ImageModelOption[];
  initialPrompt: string;
  /** Há uma imagem anexada disponível pra editar (IMG2IMG). */
  hasInputImage: boolean;
  strings: ImageGenStrings;
}

export class ImageGenModal extends Modal {
  private opts: Opts;
  private resolver: (r: ImageGenChoice | null) => void = () => {};
  private resolved = false;
  private selected: ImageModelOption | null;
  private prompt: string;
  private useInputImage: boolean;
  private generateBtn: HTMLButtonElement | null = null;
  // genTitleEl (não titleEl): Modal já tem titleEl: HTMLElement na base. v0.1.228
  private genTitleEl: HTMLElement | null = null;

  constructor(app: App, opts: Opts) {
    super(app);
    this.opts = opts;
    this.prompt = opts.initialPrompt;
    // Pré-seleciona o primeiro modelo CONECTADO (ou o primeiro da lista).
    this.selected =
      opts.options.find((o) => o.connected) ?? opts.options[0] ?? null;
    // IMG2IMG ligado por default quando há imagem anexada E o modelo edita.
    this.useInputImage = opts.hasInputImage && !!this.selected?.supportsEdit;
  }

  openAndWait(): Promise<ImageGenChoice | null> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.open();
    });
  }

  private resolveOnce(r: ImageGenChoice | null) {
    if (this.resolved) return;
    this.resolved = true;
    this.resolver(r);
  }

  onOpen() {
    const { contentEl } = this;
    const s = this.opts.strings;
    contentEl.empty();
    contentEl.addClass("axxa-imggen-modal");

    const editing = this.opts.hasInputImage && this.useInputImage;
    // v0.1.228: guarda ref do título p/ atualizar ao alternar IMG2IMG.
    this.genTitleEl = contentEl.createEl("h2", {
      text: editing ? s.editTitle : s.title,
    });

    if (this.opts.options.length === 0) {
      contentEl.createEl("p", {
        text: s.noModels,
        cls: "axxa-imggen-empty",
      });
      const close = contentEl.createEl("button", {
        text: s.cancel,
        cls: "axxa-imggen-btn",
      });
      close.onclick = () => {
        this.resolveOnce(null);
        this.close();
      };
      return;
    }

    // Prompt editável
    contentEl.createEl("label", { text: s.promptLabel, cls: "axxa-imggen-label" });
    const ta = contentEl.createEl("textarea", {
      cls: "axxa-imggen-prompt",
      attr: { rows: "3", placeholder: s.promptPlaceholder },
    });
    ta.value = this.prompt;
    ta.oninput = () => {
      this.prompt = ta.value;
      this.syncGenerate();
    };

    // Imagem anexada (IMG2IMG) — checkbox quando há imagem + modelo edita.
    if (this.opts.hasInputImage) {
      // v0.1.228: <label> envolve checkbox+texto p/ a11y (clique no texto + leitor).
      const editRow = contentEl.createEl("label", { cls: "axxa-imggen-editrow" });
      const cb = editRow.createEl("input", {
        attr: { type: "checkbox" },
      }) as HTMLInputElement;
      cb.checked = this.useInputImage;
      editRow.createSpan({ text: s.useAttached });
      cb.onchange = () => {
        this.useInputImage = cb.checked;
        // v0.1.228: atualiza o título (Editar imagem vs Gerar imagem) ao alternar.
        if (this.genTitleEl) {
          this.genTitleEl.setText(this.useInputImage ? s.editTitle : s.title);
        }
        this.renderOptions(listEl); // re-render p/ refletir suporte a edição
        this.syncGenerate();
      };
    }

    // Lista de modelos
    contentEl.createEl("label", { text: s.modelLabel, cls: "axxa-imggen-label" });
    // v0.1.228: role=radiogroup p/ a11y (seleção de modelo por teclado/leitor).
    const listEl = contentEl.createDiv({ cls: "axxa-imggen-list" });
    listEl.setAttr("role", "radiogroup");
    listEl.setAttr("aria-label", s.modelLabel);
    this.renderOptions(listEl);

    // v0.1.228: nenhum provider conectado → nota explícita (CTA fica desabilitado).
    if (!this.opts.options.some((o) => o.connected)) {
      contentEl.createEl("p", {
        text: s.noneConnected,
        cls: "axxa-imggen-noconn",
      });
    }

    // Footer
    const footer = contentEl.createDiv({ cls: "axxa-imggen-footer" });
    const cancel = footer.createEl("button", {
      text: s.cancel,
      cls: "axxa-imggen-btn",
    });
    cancel.onclick = () => {
      this.resolveOnce(null);
      this.close();
    };
    this.generateBtn = footer.createEl("button", {
      text: s.generate,
      cls: "axxa-imggen-btn axxa-imggen-btn-cta",
    });
    this.generateBtn.onclick = () => {
      if (!this.selected || !this.prompt.trim()) return;
      this.resolveOnce({
        providerId: this.selected.providerId,
        model: this.selected.model,
        prompt: this.prompt.trim(),
        useInputImage:
          this.opts.hasInputImage &&
          this.useInputImage &&
          this.selected.supportsEdit,
      });
      this.close();
    };
    this.syncGenerate();
  }

  private renderOptions(listEl: HTMLElement) {
    const s = this.opts.strings;
    listEl.empty();
    for (const opt of this.opts.options) {
      const selected = this.selected === opt;
      const row = listEl.createDiv({
        cls:
          "axxa-imggen-opt" +
          (selected ? " is-selected" : "") +
          (opt.connected ? "" : " is-disconnected"),
      });
      // v0.1.228: role=radio + tabindex p/ navegação por teclado/leitor de tela.
      row.setAttr("role", "radio");
      row.setAttr("aria-checked", selected ? "true" : "false");
      row.setAttr("tabindex", selected ? "0" : "-1");
      const main = row.createDiv({ cls: "axxa-imggen-opt-main" });
      main.createSpan({ text: opt.model, cls: "axxa-imggen-opt-name" });
      const meta = main.createSpan({ cls: "axxa-imggen-opt-meta" });
      meta.createSpan({ text: opt.providerLabel, cls: "axxa-imggen-opt-prov" });
      meta.createSpan({
        text:
          opt.pricePerImage != null
            ? s.perImage(`$${opt.pricePerImage.toFixed(3)}`)
            : s.free,
        cls: "axxa-imggen-opt-price",
      });
      // Edição só no Nano Banana — dica quando o user quer editar
      if (this.opts.hasInputImage && this.useInputImage && !opt.supportsEdit) {
        meta.createSpan({ text: s.editOnlyNano, cls: "axxa-imggen-opt-note" });
      }
      const badge = row.createSpan({
        cls:
          "axxa-imggen-opt-conn" +
          (opt.connected ? " is-on" : " is-off"),
        text: opt.connected ? s.connected : s.notConnected,
      });
      void badge;
      const select = () => {
        this.selected = opt;
        this.renderOptions(listEl);
        this.syncGenerate();
      };
      row.onclick = select;
      // v0.1.228: Enter/Space ativam a linha de opção (paridade com clique).
      row.onkeydown = (ev: KeyboardEvent) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          select();
        }
      };
    }
  }

  /** Habilita/desabilita o CTA conforme seleção válida + prompt + conectado. */
  private syncGenerate() {
    if (!this.generateBtn) return;
    const ok =
      !!this.selected && this.selected.connected && this.prompt.trim().length > 0;
    this.generateBtn.disabled = !ok;
    this.generateBtn.toggleClass("is-disabled", !ok);
  }

  onClose() {
    this.contentEl.empty();
    this.resolveOnce(null); // X / Escape = cancela
  }
}
