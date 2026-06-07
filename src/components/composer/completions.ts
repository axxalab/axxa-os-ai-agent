// src/components/composer/completions.ts
// Sources de autocomplete pro CodeMirror do Composer:
//   - @nome → lista notas/pastas → insere [[path]]
//   - /comando → lista comandos do AXXA → executa action
//
// Usa @codemirror/autocomplete (mesma engine do autocomplete nativo do Obsidian).

import type { App, TFile, TFolder, TAbstractFile } from "obsidian";
import type {
  CompletionContext,
  CompletionResult,
  CompletionSource,
  Completion,
} from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";

// ============================================================
// @ wikilink — notas + pastas
// ============================================================

interface WikiLinkOption {
  path: string;
  /** Filename (sem .md) pra exibição limpa */
  display: string;
  isFolder: boolean;
}

/** Coleta path → display de todas as notas + pastas do vault. */
function collectVaultPaths(app: App): WikiLinkOption[] {
  const items: WikiLinkOption[] = [];
  // Notas (.md) — basename sem extensão
  app.vault.getMarkdownFiles().forEach((f: TFile) => {
    items.push({
      path: f.path.replace(/\.md$/, ""),
      display: f.basename,
      isFolder: false,
    });
  });
  // Pastas (recursivo via getAllLoadedFiles — apenas TFolder)
  const folders = app.vault.getAllLoadedFiles().filter((f: TAbstractFile) => {
    const proto = Object.getPrototypeOf(f);
    return proto && proto.constructor && proto.constructor.name === "TFolder";
  }) as TFolder[];
  folders.forEach((f) => {
    if (f.path === "/" || !f.path) return;
    items.push({
      path: f.path,
      display: f.name + "/",
      isFolder: true,
    });
  });
  return items;
}

/** Source pra completion de @notas/pastas. Trigger: @ seguido de qualquer char. */
export function wikilinkCompletionSource(app: App): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    // Match @ + caracteres do nome (alfanum, -, _, /, espaço)
    const match = context.matchBefore(/@[\w\-/. áàâãäéèêëíîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÎÏÓÒÔÕÖÚÙÛÜÇÑ]*/);
    if (!match) return null;
    if (match.from === match.to && !context.explicit) return null;

    const query = match.text.slice(1).toLowerCase().trim();
    const allItems = collectVaultPaths(app);

    const filtered = allItems
      .filter((item) => {
        if (!query) return true;
        return (
          item.display.toLowerCase().includes(query) ||
          item.path.toLowerCase().includes(query)
        );
      })
      .slice(0, 50); // cap pra performance

    return {
      from: match.from,
      options: filtered.map((item) => ({
        label: item.display,
        detail: item.isFolder ? "folder" : item.path,
        type: item.isFolder ? "namespace" : "text",
        apply: `[[${item.path}]] `,
      })),
      // Filter já foi aplicado acima — não deixa CodeMirror re-filtrar
      filter: false,
    };
  };
}

// ============================================================
// / commands — actions do AXXA
// ============================================================

export interface AxxaCommand {
  id: string;
  /** Trigger sem a barra: "new", "clear", etc. */
  label: string;
  description: string;
  /** Executor recebe args (texto depois do comando), devolve void. */
  execute: () => void;
}

/** Source pra completion de /comandos. */
export function commandCompletionSource(
  commands: AxxaCommand[]
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    // Match / no início OU após espaço (em msg longa, /clear no meio não conta)
    const match = context.matchBefore(/(^|\s)\/[\w-]*/);
    if (!match) return null;
    if (match.from === match.to && !context.explicit) return null;

    // Remove o leading space se tiver
    const text = match.text.startsWith(" ") ? match.text.slice(1) : match.text;
    const from = match.text.startsWith(" ") ? match.from + 1 : match.from;
    const query = text.slice(1).toLowerCase();

    const filtered = commands.filter(
      (c) =>
        !query ||
        c.label.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query)
    );

    return {
      from,
      options: filtered.map((cmd) => ({
        label: "/" + cmd.label,
        detail: cmd.description,
        type: "keyword",
        // Apply: limpa o "/cmd" do texto E executa a action
        apply: (
          view: EditorView,
          _completion: Completion,
          _fromArg: number,
          toArg: number
        ) => {
          view.dispatch({
            changes: { from, to: toArg, insert: "" },
          });
          // Executa em microtask pra deixar a dispatch terminar
          Promise.resolve().then(() => cmd.execute());
        },
      })),
      filter: false,
    };
  };
}
