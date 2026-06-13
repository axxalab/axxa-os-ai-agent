// src/components/chat/PersonaModal.ts
// Modal nativo do Obsidian pra definir a PERSONA (system prompt custom) do chat.
// A persona substitui o system prompt padrão na conversa atual — define tom,
// papel e regras de comportamento do assistente. Persiste no .md do chat.

import { App, Modal, Setting } from "obsidian";

export interface PersonaModalTexts {
  title: string;
  desc: string;
  placeholder: string;
  save: string;
  clear: string;
}

export class PersonaModal extends Modal {
  private value: string;
  private readonly onSubmit: (persona: string) => void;
  private readonly texts: PersonaModalTexts;
  // v0.1.228: guarda o timer do focus pra cancelar no onClose e não focar após o detach
  private focusTimer: number | null = null;

  constructor(
    app: App,
    current: string,
    texts: PersonaModalTexts,
    onSubmit: (persona: string) => void
  ) {
    super(app);
    this.value = current;
    this.texts = texts;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("axxa-persona-modal");

    contentEl.createEl("h3", { text: this.texts.title });
    contentEl.createEl("p", {
      text: this.texts.desc,
      cls: "axxa-persona-desc",
    });

    const ta = contentEl.createEl("textarea", {
      cls: "axxa-persona-textarea",
    });
    ta.value = this.value;
    ta.placeholder = this.texts.placeholder;
    ta.rows = 7;
    ta.addEventListener("input", () => {
      this.value = ta.value;
    });
    // Ctrl/Cmd+Enter salva
    ta.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        this.submit(this.value);
      }
    });

    new Setting(contentEl)
      .addButton((b) =>
        b.setButtonText(this.texts.clear).onClick(() => this.submit(""))
      )
      .addButton((b) =>
        b
          .setButtonText(this.texts.save)
          .setCta()
          .onClick(() => this.submit(this.value))
      );

    this.focusTimer = window.setTimeout(() => ta.focus(), 50);
  }

  private submit(value: string) {
    this.onSubmit(value.trim());
    this.close();
  }

  onClose() {
    // v0.1.228: cancela o focus pendente pra não focar um textarea já desanexado
    if (this.focusTimer !== null) {
      window.clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
    this.contentEl.empty();
  }
}
