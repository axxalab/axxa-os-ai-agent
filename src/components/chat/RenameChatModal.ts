// src/components/chat/RenameChatModal.ts
// Modal nativo do Obsidian pra renomear o título de uma conversa.
// Usado pela ConversationsList (botão de lápis) e pelo Header (click no título).

import { App, Modal, Notice, Setting } from "obsidian";

interface RenameOptions {
  currentTitle: string;
  onSubmit: (newTitle: string) => Promise<void> | void;
  /** Labels i18n */
  title: string;
  inputLabel: string;
  submitLabel: string;
  cancelLabel: string;
  /** Mensagem i18n exibida quando o rename falha (t.conversations.renameFailed) */
  failureLabel?: string;
}

export class RenameChatModal extends Modal {
  private value: string;
  private opts: RenameOptions;
  // v0.1.228: guard de in-flight + ref do botão pra evitar double submit
  private submitting = false;
  private submitBtn: HTMLButtonElement | null = null;

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
    this.submitBtn = submitBtn;
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
    // v0.1.228: evita double submit (Enter repetido / Enter + clique) enquanto roda
    if (this.submitting) return;
    this.submitting = true;
    if (this.submitBtn) this.submitBtn.disabled = true;
    try {
      await this.opts.onSubmit(clean);
      this.close();
    } catch (err) {
      console.error("[axxa] rename falhou:", err);
      // v0.1.228: avisa o usuário (modal continua aberto pra nova tentativa)
      if (this.opts.failureLabel) new Notice(this.opts.failureLabel);
    } finally {
      this.submitting = false;
      if (this.submitBtn) this.submitBtn.disabled = false;
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
