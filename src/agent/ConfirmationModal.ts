// src/agent/ConfirmationModal.ts
// Modal do Obsidian que pede confirmação pro user antes de executar uma tool
// destrutiva. Devolve uma Promise<boolean> — resolve true (aprovou) ou false (negou).
//
// Estratégia: o agent loop dá `await modal.openAndWait()` no meio do trabalho;
// modal abre, user decide, promise resolve, agent continua.
//
// Pra ações irreversíveis (vault_delete), o botão "Aprovar" tem cor vermelha
// (.mod-warning do Obsidian) — visual de "tem certeza?".

import { App, Modal, Setting } from "obsidian";
import type { ToolCall, ToolDefinition } from "./types";

interface ConfirmOpts {
  toolCall: ToolCall;
  definition: ToolDefinition;
}

export class ConfirmationModal extends Modal {
  private opts: ConfirmOpts;
  private resolver: (approved: boolean) => void = () => {};
  /** Garante que só resolve uma vez — close pode ser chamado por X / Escape. */
  private resolved = false;

  constructor(app: App, opts: ConfirmOpts) {
    super(app);
    this.opts = opts;
  }

  /** Abre o modal e devolve uma promise que resolve com a decisão do user. */
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
    const { contentEl, opts } = this;
    contentEl.empty();
    contentEl.addClass("axxa-confirm-modal");
    // Marca o modal pra CSS poder reposicionar quando teclado virtual abre.
    // (mobile: sem isso, modal central fica atrás do teclado)
    this.modalEl.addClass("axxa-modal-keyboard-aware");

    const isIrreversible = !!opts.definition.irreversible;
    const title = isIrreversible
      ? "⚠️ Ação irreversível"
      : "Confirmar ação do Agent";
    contentEl.createEl("h2", { text: title });

    // Resumo da tool (nome + descrição curta)
    const summaryEl = contentEl.createDiv({ cls: "axxa-confirm-summary" });
    summaryEl.createEl("div", {
      cls: "axxa-confirm-tool-name",
      text: opts.toolCall.name,
    });
    summaryEl.createEl("div", {
      cls: "axxa-confirm-tool-desc",
      text: opts.definition.description.split(".")[0] + ".",
    });

    // Argumentos — preview formatado
    const argsEl = contentEl.createDiv({ cls: "axxa-confirm-args" });
    argsEl.createEl("h4", { text: "Argumentos:" });
    Object.entries(opts.toolCall.arguments).forEach(([key, value]) => {
      const row = argsEl.createDiv({ cls: "axxa-confirm-arg-row" });
      row.createEl("div", { cls: "axxa-confirm-arg-key", text: key });
      // String longa: collapse com max-height + scroll
      const valStr = typeof value === "string" ? value : JSON.stringify(value, null, 2);
      const valEl = row.createEl("pre", { cls: "axxa-confirm-arg-val" });
      // Trunca preview a 800 chars com nota
      const truncated = valStr.length > 800;
      valEl.textContent = truncated
        ? valStr.slice(0, 800) + `\n\n[+${valStr.length - 800} chars]`
        : valStr;
    });

    // Botões: Aprovar / Negar
    new Setting(contentEl)
      .addButton((btn) => {
        btn
          .setButtonText("Negar")
          .onClick(() => {
            this.resolveOnce(false);
            this.close();
          });
        btn.buttonEl.classList.add("axxa-confirm-deny");
      })
      .addButton((btn) => {
        btn
          .setButtonText(isIrreversible ? "Sim, deletar" : "Aprovar")
          .setCta()
          .onClick(() => {
            this.resolveOnce(true);
            this.close();
          });
        if (isIrreversible) {
          btn.buttonEl.classList.add("axxa-confirm-irreversible");
        }
      });
  }

  onClose() {
    this.contentEl.empty();
    // Fechou sem clicar nenhum botão (X ou Escape) = negação
    this.resolveOnce(false);
  }
}
