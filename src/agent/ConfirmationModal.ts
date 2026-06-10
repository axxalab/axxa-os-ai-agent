// src/agent/ConfirmationModal.ts
// Modal de aprovação do Agent — mostra um PREVIEW/DIFF da mudança antes de
// gravar no vault, e devolve a decisão do user. v0.1.140 (aposta #2):
//   - editar nota → diff antes/depois (vermelho/verde) do trecho trocado
//   - criar nota → conteúdo novo (verde)
//   - mover/renomear → de → para
//   - deletar → caminho (irreversível, vermelho)
//   - outras tools → preview genérico dos argumentos
//
// Botões: Negar · (Aprovar todas) · Aprovar. "Aprovar todas" libera o resto das
// edições desta rodada sem perguntar (NÃO aparece em ações irreversíveis —
// delete sempre é por ação). O agent loop dá `await modal.openAndWait()`.

import { App, Modal, Setting } from "obsidian";
import type { ToolCall, ToolDefinition } from "./types";

interface ConfirmOpts {
  toolCall: ToolCall;
  definition: ToolDefinition;
}

export interface ConfirmResult {
  approved: boolean;
  /** Aprovar todas as edições restantes desta rodada (não-irreversíveis). */
  approveAll: boolean;
}

export class ConfirmationModal extends Modal {
  private opts: ConfirmOpts;
  private resolver: (r: ConfirmResult) => void = () => {};
  private resolved = false;

  constructor(app: App, opts: ConfirmOpts) {
    super(app);
    this.opts = opts;
  }

  openAndWait(): Promise<ConfirmResult> {
    return new Promise<ConfirmResult>((resolve) => {
      this.resolver = resolve;
      this.open();
    });
  }

  private resolveOnce(approved: boolean, approveAll = false) {
    if (this.resolved) return;
    this.resolved = true;
    this.resolver({ approved, approveAll });
  }

  onOpen() {
    const { contentEl, opts } = this;
    contentEl.empty();
    contentEl.addClass("axxa-confirm-modal");
    this.modalEl.addClass("axxa-modal-keyboard-aware");

    const irreversible = !!opts.definition.irreversible;
    contentEl.createEl("h2", {
      text: irreversible ? "⚠️ Ação irreversível" : "Revisar mudança do Agent",
    });

    const summaryEl = contentEl.createDiv({ cls: "axxa-confirm-summary" });
    summaryEl.createEl("div", {
      cls: "axxa-confirm-tool-name",
      text: opts.toolCall.name,
    });
    summaryEl.createEl("div", {
      cls: "axxa-confirm-tool-desc",
      text: opts.definition.description.split(".")[0] + ".",
    });

    this.renderPreview(contentEl);

    const setting = new Setting(contentEl);
    setting.addButton((btn) => {
      btn.setButtonText("Negar").onClick(() => {
        this.resolveOnce(false);
        this.close();
      });
      btn.buttonEl.classList.add("axxa-confirm-deny");
    });
    // "Aprovar todas" — só em ações reversíveis (delete sempre é por ação).
    if (!irreversible) {
      setting.addButton((btn) => {
        btn.setButtonText("Aprovar todas").onClick(() => {
          this.resolveOnce(true, true);
          this.close();
        });
        btn.buttonEl.classList.add("axxa-confirm-approveall");
      });
    }
    setting.addButton((btn) => {
      btn
        .setButtonText(irreversible ? "Sim, deletar" : "Aprovar")
        .setCta()
        .onClick(() => {
          this.resolveOnce(true);
          this.close();
        });
      if (irreversible) btn.buttonEl.classList.add("axxa-confirm-irreversible");
    });
  }

  /** Preview/diff conforme a tool. Conteúdo grande é truncado. */
  private renderPreview(root: HTMLElement) {
    const { name, arguments: args } = this.opts.toolCall;
    const path = typeof args.path === "string" ? args.path : "";
    const box = root.createDiv({ cls: "axxa-confirm-preview" });

    const pathRow = (label: string, value: string, cls = "") => {
      const row = box.createDiv({ cls: "axxa-confirm-path " + cls });
      row.createSpan({ cls: "axxa-confirm-path-label", text: label });
      row.createSpan({ cls: "axxa-confirm-path-val", text: value });
    };
    const block = (text: string, kind: "add" | "del" | "ctx") => {
      const pre = box.createEl("pre", {
        cls: "axxa-diff-block axxa-diff-" + kind,
      });
      pre.textContent = trunc(text);
    };

    switch (name) {
      case "vault_edit": {
        pathRow("Editar", path);
        block(String(args.oldStr ?? ""), "del");
        block(String(args.newStr ?? ""), "add");
        return;
      }
      case "vault_create": {
        pathRow("Criar", path, "axxa-confirm-path-add");
        block(String(args.content ?? ""), "add");
        return;
      }
      case "vault_create_folder": {
        pathRow("Criar pasta", path, "axxa-confirm-path-add");
        return;
      }
      case "vault_move": {
        pathRow("De", String(args.from ?? ""), "axxa-confirm-path-del");
        pathRow("Para", String(args.to ?? ""), "axxa-confirm-path-add");
        return;
      }
      case "vault_delete": {
        pathRow("Deletar", path, "axxa-confirm-path-del");
        return;
      }
      default: {
        // Preview genérico dos argumentos (tools não-write em modo "ask").
        Object.entries(args).forEach(([key, value]) => {
          const valStr =
            typeof value === "string" ? value : JSON.stringify(value, null, 2);
          pathRow(key, "");
          block(valStr, "ctx");
        });
      }
    }
  }

  onClose() {
    this.contentEl.empty();
    this.resolveOnce(false); // X / Escape = negação
  }
}

function trunc(s: string, max = 1200): string {
  return s.length > max ? s.slice(0, max) + `\n\n[+${s.length - max} chars]` : s;
}
