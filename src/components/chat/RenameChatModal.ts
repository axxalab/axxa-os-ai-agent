// src/components/chat/RenameChatModal.ts
// Modal nativo do Obsidian pra renomear o título de uma conversa.
// Usado pela ConversationsList (botão de lápis) e pelo Header (click no título).

import { App, Modal, Setting } from "obsidian";

interface RenameOptions {
  currentTitle: string;
  onSubmit: (newTitle: string) => Promise<void> | void;
  /** Labels i18n */
  title: string;
  inputLabel: string;
  submitLabel: string;
  cancelLabel: string;
}

export class RenameChatModal extends Modal {
  private value: string;
  private opts: RenameOptions;

  constructor(app: App, opts: RenameOptions) {
    super(app);
    this.opts = opts;
    this.value = opts.currentTitle;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("axxa-rename-modal");

    contentEl.createEl("h3", { text: this.opts.title });

    let inputEl: HTMLInputElement | null = null;
    new Setting(contentEl)
      .setName(this.opts.inputLabel)
      .addText((text) => {
        inputEl = text.inputEl;
        text.setValue(this.value).onChange((v) => {
          this.value = v;
        });
        text.inputEl.addClass("axxa-rename-input");
        text.inputEl.style.width = "100%";
        text.inputEl.addEventListener("keydown", async (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            await this.submit();
          } else if (e.key === "Escape") {
            this.close();
          }
        });
      });

    const actionsEl = contentEl.createDiv({ cls: "axxa-rename-actions" });
    const cancelBtn = actionsEl.createEl("button", {
      text: this.opts.cancelLabel,
      cls: "axxa-rename-cancel",
      attr: { type: "button" },
    });
    cancelBtn.onclick = () => this.close();
    const submitBtn = actionsEl.createEl("button", {
      text: this.opts.submitLabel,
      cls: "axxa-rename-submit mod-cta",
      attr: { type: "button" },
    });
    submitBtn.onclick = () => void this.submit();

    // Foco no input com seleção do texto inteiro pra facilitar edição
    setTimeout(() => {
      inputEl?.focus();
      inputEl?.select();
    }, 30);
  }

  private async submit() {
    const clean = this.value.trim();
    if (!clean) return;
    try {
      await this.opts.onSubmit(clean);
      this.close();
    } catch (err) {
      console.error("[axxa] rename falhou:", err);
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
