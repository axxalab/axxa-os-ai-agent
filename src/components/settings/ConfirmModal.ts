// src/components/settings/ConfirmModal.ts
// Modal genérico de confirmação (Sim/Cancelar) — substitui window.confirm, que
// BLOQUEIA a UI e NÃO funciona no mobile do Obsidian (Capacitor). Resolve `true`
// se confirma, `false` se cancela/fecha (X/Escape). Extraído do AxxaSettingsTab.

import { App, Modal, Setting } from "obsidian";
import type { Translations } from "../../i18n";

export class AxxaConfirmModal extends Modal {
  private message: string;
  private t: Translations;
  private resolver: (v: boolean) => void = () => {};
  private resolved = false;

  constructor(app: App, message: string, t: Translations) {
    super(app);
    this.message = message;
    this.t = t;
  }

  openAndWait(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
      this.open();
    });
  }

  private resolveOnce(value: boolean) {
    if (this.resolved) return;
    this.resolved = true;
    this.resolver(value);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("axxa-confirm-modal");
    contentEl.createEl("p", { text: this.message });
    const setting = new Setting(contentEl);
    setting.addButton((btn) => {
      btn.setButtonText(this.t.settings.confirmCancel).onClick(() => {
        this.resolveOnce(false);
        this.close();
      });
    });
    setting.addButton((btn) => {
      btn
        .setButtonText(this.t.settings.confirmProceed)
        .setWarning()
        .onClick(() => {
          this.resolveOnce(true);
          this.close();
        });
    });
  }

  onClose() {
    this.contentEl.empty();
    this.resolveOnce(false); // X / Escape = cancela
  }
}
