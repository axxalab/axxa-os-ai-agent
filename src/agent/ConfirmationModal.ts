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

import { App, Component, MarkdownRenderer, Modal, Setting } from "obsidian";
import type { ToolCall, ToolDefinition } from "./types";
import type { Translations } from "../i18n";

interface ConfirmOpts {
  toolCall: ToolCall;
  definition: ToolDefinition;
  /** Mostra o preview/diff da mudança (Settings → "Approve changes (diff)").
   *  v0.1.237: o toggle deixou de forçar o GATE (nível decide se confirma) e
   *  passou a controlar só a riqueza da confirmação. Default true. */
  showDiff?: boolean;
  /** Strings i18n (t.agent) — injetadas pelo caller, mesmo padrão do
   *  ImageGenModal (strings: t.imageGen). Antes eram PT-BR hardcoded. */
  strings: Translations["agent"];
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
  /** Dono dos renders de markdown (o renderer do Obsidian precisa de um
   *  Component vivo pra pendurar callouts, mermaid, embeds…). */
  private md: Component | null = null;

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
    const strings = opts.strings;
    contentEl.createEl("h2", {
      text: irreversible ? strings.confirmTitleIrreversible : strings.confirmTitle,
    });

    const summaryEl = contentEl.createDiv({ cls: "axxa-confirm-summary" });
    summaryEl.createEl("div", {
      cls: "axxa-confirm-tool-name",
      text: opts.toolCall.name,
    });
    summaryEl.createEl("div", {
      cls: "axxa-confirm-tool-desc",
      text: firstSentence(opts.definition.description),
    });

    if (this.opts.showDiff !== false) this.renderPreview(contentEl);

    const setting = new Setting(contentEl);
    setting.addButton((btn) => {
      btn.setButtonText(strings.confirmDeny).onClick(() => {
        this.resolveOnce(false);
        this.close();
      });
      btn.buttonEl.classList.add("axxa-confirm-deny");
    });
    // "Aprovar todas" — só em ações reversíveis (delete sempre é por ação).
    if (!irreversible) {
      setting.addButton((btn) => {
        btn.setButtonText(strings.confirmApproveAll).onClick(() => {
          this.resolveOnce(true, true);
          this.close();
        });
        btn.buttonEl.classList.add("axxa-confirm-approveall");
      });
    }
    setting.addButton((btn) => {
      btn
        .setButtonText(irreversible ? strings.confirmDelete : strings.confirmApprove)
        .setCta()
        .onClick(() => {
          this.resolveOnce(true);
          this.close();
        });
      if (irreversible) btn.buttonEl.classList.add("axxa-confirm-irreversible");
    });
  }

  /** Preview/diff conforme a tool. Conteúdo grande é truncado, e o que sobra
   *  vira uma linha de aviso em vez de sujar o bloco. */
  private renderPreview(root: HTMLElement) {
    const { name, arguments: args } = this.opts.toolCall;
    const strings = this.opts.strings;
    const path = typeof args.path === "string" ? args.path : "";
    const box = root.createDiv({ cls: "axxa-confirm-preview" });

    const pathRow = (label: string, value: string, cls = "") => {
      const row = box.createDiv({ cls: "axxa-confirm-path " + cls });
      row.createSpan({ cls: "axxa-confirm-path-label", text: label });
      row.createSpan({ cls: "axxa-confirm-path-val", text: value });
    };

    // O conteúdo aparece DO JEITO QUE ELE É: nota vira markdown formatado,
    // arquivo de código vira bloco colorido (Prism do próprio Obsidian), e o
    // que não dá pra reconhecer continua texto cru. Quem aprova uma mudança
    // precisa LER a mudança — markdown cru com ## e ** no meio é ruído.
    const block = (
      text: string,
      kind: "add" | "del" | "ctx",
      como: Preview = previewFor(path)
    ) => {
      const cls = "axxa-diff-block axxa-diff-" + kind;
      const cortado =
        text.length > MAX_PREVIEW ? text.slice(0, MAX_PREVIEW) : text;

      if (como.kind === "plain") {
        box.createEl("pre", { cls }).textContent = cortado;
      } else {
        const host = box.createDiv({ cls: cls + " is-rich" });
        const md =
          como.kind === "code"
            ? fence(cortado, como.lang)
            : closeOpenFence(cortado);
        void MarkdownRenderer.render(this.app, md, host, path, this.mdOwner())
          // Markdown quebrado não pode engolir a aprovação: cai pro texto cru.
          .catch(() => {
            host.empty();
            host.removeClass("is-rich");
            host.textContent = cortado;
          });
      }

      if (cortado.length < text.length) {
        box.createDiv({
          cls: "axxa-diff-more",
          text: strings.confirmTruncated(text.length - cortado.length),
        });
      }
    };

    switch (name) {
      case "vault_edit": {
        pathRow(strings.confirmLabelEdit, path);
        block(String(args.oldStr ?? ""), "del");
        block(String(args.newStr ?? ""), "add");
        return;
      }
      case "vault_create": {
        pathRow(strings.confirmLabelCreate, path, "axxa-confirm-path-add");
        block(String(args.content ?? ""), "add");
        return;
      }
      case "vault_create_folder": {
        pathRow(strings.confirmLabelCreateFolder, path, "axxa-confirm-path-add");
        return;
      }
      case "vault_move": {
        pathRow(strings.confirmLabelFrom, String(args.from ?? ""), "axxa-confirm-path-del");
        pathRow(strings.confirmLabelTo, String(args.to ?? ""), "axxa-confirm-path-add");
        return;
      }
      case "vault_delete": {
        pathRow(strings.confirmLabelDelete, path, "axxa-confirm-path-del");
        return;
      }
      default: {
        // Preview genérico dos argumentos (tools não-write em modo "ask").
        // String é texto; objeto é JSON colorido.
        Object.entries(args).forEach(([key, value]) => {
          const texto =
            typeof value === "string" ? value : JSON.stringify(value, null, 2);
          pathRow(key, "");
          block(
            texto,
            "ctx",
            typeof value === "string"
              ? { kind: "plain" }
              : { kind: "code", lang: "json" }
          );
        });
      }
    }
  }

  /** Component vivo enquanto o modal existe — criado na primeira vez que
   *  alguém renderiza markdown, descarregado no onClose. */
  private mdOwner(): Component {
    if (!this.md) {
      this.md = new Component();
      this.md.load();
    }
    return this.md;
  }

  onClose() {
    this.md?.unload();
    this.md = null;
    this.contentEl.empty();
    this.resolveOnce(false); // X / Escape = negação
  }
}

// v0.1.228: corta na 1ª frase real (ponto + espaço), sem quebrar em pontos
// internos como ".md" ou "1.5". Fallback: descrição inteira truncada curta.
function firstSentence(desc: string, max = 140): string {
  const d = desc.trim();
  if (!d) return "";
  const m = d.match(/^(.+?\.)(?:\s|$)/);
  const sentence = m ? m[1] : d;
  return sentence.length > max ? sentence.slice(0, max - 1) + "…" : sentence;
}

/** Teto do preview: o suficiente pra julgar a mudança sem virar a nota
 *  inteira dentro de um modal. O que sobra vira uma linha de aviso. */
const MAX_PREVIEW = 1200;

type Preview =
  | { kind: "markdown" }
  | { kind: "code"; lang: string }
  | { kind: "plain" };

/** Extensão → linguagem do Prism (o mesmo highlighter que o Obsidian usa em
 *  modo leitura). Sem entrada aqui o conteúdo fica texto cru: melhor que
 *  colorir errado. */
const CODE_LANGS: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  css: "css",
  scss: "scss",
  html: "html",
  xml: "xml",
  svg: "xml",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  ini: "ini",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ps1: "powershell",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sql: "sql",
  lua: "lua",
  dart: "dart",
  diff: "diff",
  patch: "diff",
};

const MARKDOWN_EXT = new Set(["md", "markdown", "mdx"]);

function extOf(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot + 1).toLowerCase();
}

/** Como mostrar o conteúdo de um caminho. Sem extensão é nota do vault —
 *  markdown, que é o caso mais comum aqui. */
export function previewFor(path: string): Preview {
  const ext = extOf(path);
  if (ext === "" || MARKDOWN_EXT.has(ext)) return { kind: "markdown" };
  const lang = CODE_LANGS[ext];
  return lang ? { kind: "code", lang } : { kind: "plain" };
}

/** Cerca de código maior que qualquer sequência de crases do conteúdo: senão
 *  uma cerca no meio do arquivo fecha o bloco e o resto vaza como markdown. */
export function fence(text: string, lang: string): string {
  const maior = Math.max(
    0,
    ...Array.from(text.matchAll(/`+/g), (m) => m[0].length)
  );
  const crases = "`".repeat(Math.max(3, maior + 1));
  return `${crases}${lang}\n${text}\n${crases}`;
}

/** Truncar markdown pode deixar uma cerca aberta — o resto do preview viraria
 *  código. Fecha o que ficou aberto. */
export function closeOpenFence(md: string): string {
  const cercas = md.match(/^ {0,3}(`{3,}|~{3,})/gm);
  if (!cercas || cercas.length % 2 === 0) return md;
  return `${md}\n${cercas[cercas.length - 1].trim()}`;
}
