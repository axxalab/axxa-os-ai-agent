// src/components/chat/ReasoningModal.ts
// Modal NATIVO do Obsidian pro raciocínio ("Summary"). Nativo de propósito: no
// mobile o Obsidian já renderiza o .modal como bottom sheet (posição/animação/
// backdrop de fábrica) — o sheet custom em React portalado pro body abria no
// topo. Mesmo caminho dos outros modais .ts (rename/persona/confirm). v0.2.12

import { App, Modal } from "obsidian";

export class ReasoningModal extends Modal {
  private text: string;
  private heading: string;

  constructor(app: App, text: string, heading = "Summary") {
    super(app);
    this.text = text;
    this.heading = heading;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("axxa-reasoning-modal");
    contentEl.createEl("h3", {
      text: this.heading,
      cls: "axxa-reasoning-modal-title",
    });
    // setText preserva as quebras via CSS (white-space: pre-wrap).
    contentEl
      .createDiv({ cls: "axxa-reasoning-modal-body" })
      .setText(this.text);
  }

  onClose() {
    this.contentEl.empty();
  }
}
