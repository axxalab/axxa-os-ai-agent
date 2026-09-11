// src/ui/modals.ts
// Modais NATIVOS do Obsidian usados pela casca CRUD: prompt de texto, confirmação
// e picker de nota. Zero CSS próprio — o Obsidian estiliza.

import {
  App,
  FuzzySuggestModal,
  Modal,
  Notice,
  Setting,
  TFile,
} from "obsidian";
import type AxxaPlugin from "../main";

export interface PromptOptions {
  title: string;
  label?: string;
  initial?: string;
  placeholder?: string;
  submitLabel?: string;
}

/** Pede um texto curto (nome, título). Resolve null se cancelar. */
export class PromptModal extends Modal {
  private value: string;
  private resolve: ((v: string | null) => void) | null = null;
  private done = false;

  constructor(app: App, private readonly opts: PromptOptions) {
    super(app);
    this.value = opts.initial ?? "";
  }

  onOpen(): void {
    this.titleEl.setText(this.opts.title);
    new Setting(this.contentEl).setName(this.opts.label ?? "").addText((t) => {
      t.setValue(this.value)
        .setPlaceholder(this.opts.placeholder ?? "")
        .onChange((v) => {
          this.value = v;
        });
      t.inputEl.style.width = "100%";
      t.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.submit();
        }
      });
      window.setTimeout(() => t.inputEl.focus(), 0);
    });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText(this.opts.submitLabel ?? "OK")
          .setCta()
          .onClick(() => this.submit())
      );
  }

  private submit(): void {
    const v = this.value.trim();
    if (!v) return;
    this.finish(v);
  }

  private finish(v: string | null): void {
    if (this.done) return;
    this.done = true;
    this.resolve?.(v);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.done) {
      this.done = true;
      this.resolve?.(null);
    }
  }

  openAndWait(): Promise<string | null> {
    return new Promise((res) => {
      this.resolve = res;
      this.open();
    });
  }
}

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  /** Botão de confirmar em vermelho (ação destrutiva). */
  danger?: boolean;
}

/** Confirmação sim/não. Resolve false se fechar sem confirmar. */
export class ConfirmModal extends Modal {
  private resolve: ((v: boolean) => void) | null = null;
  private done = false;

  constructor(app: App, private readonly opts: ConfirmOptions) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.opts.title);
    if (this.opts.body) this.contentEl.createEl("p", { text: this.opts.body });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((b) => {
        b.setButtonText(this.opts.confirmLabel ?? "Confirm").onClick(() =>
          this.finish(true)
        );
        if (this.opts.danger) b.setWarning();
        else b.setCta();
      });
  }

  private finish(v: boolean): void {
    if (this.done) return;
    this.done = true;
    this.resolve?.(v);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.done) {
      this.done = true;
      this.resolve?.(false);
    }
  }

  openAndWait(): Promise<boolean> {
    return new Promise((res) => {
      this.resolve = res;
      this.open();
    });
  }
}

/** Fuzzy picker de notas .md do vault. Resolve o path ou null. */
export class NotePickerModal extends FuzzySuggestModal<TFile> {
  private resolve: ((p: string | null) => void) | null = null;
  private chosen = false;

  constructor(app: App) {
    super(app);
    this.setPlaceholder("Pick a note…");
  }

  getItems(): TFile[] {
    return this.app.vault.getMarkdownFiles();
  }

  getItemText(f: TFile): string {
    return f.path;
  }

  onChooseItem(f: TFile): void {
    this.chosen = true;
    this.resolve?.(f.path);
  }

  onClose(): void {
    // O Obsidian fecha ANTES de chamar onChooseItem — decide no próximo tick.
    window.setTimeout(() => {
      if (!this.chosen) this.resolve?.(null);
    }, 0);
  }

  openAndWait(): Promise<string | null> {
    return new Promise((res) => {
      this.resolve = res;
      this.open();
    });
  }
}

/** Abre as Settings do plugin. `app.setting` é semi-privado → guardado. */
export function openPluginSettings(plugin: AxxaPlugin): void {
  const app = plugin.app as unknown as {
    setting?: { open?: () => void; openTabById?: (id: string) => void };
  };
  try {
    app.setting?.open?.();
    app.setting?.openTabById?.(plugin.manifest.id);
  } catch (err) {
    console.error("[axxa] abrir Settings falhou:", err);
    new Notice("Open Settings → Community plugins → AXXA OS.");
  }
}
