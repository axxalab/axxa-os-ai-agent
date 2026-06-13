// src/components/composer/completions.ts
// Sources de autocomplete pro CodeMirror do Composer:
//   - @nome → lista notas/pastas → insere [[path]]
//   - /comando → lista comandos do AXXA → executa action
//
// Usa @codemirror/autocomplete (mesma engine do autocomplete nativo do Obsidian).

// TFolder importado como VALOR (não type) pra usar `instanceof` em runtime —
// `constructor.name === "TFolder"` quebra no build de produção do Obsidian,
// que minifica os nomes das classes.
import { TFolder } from "obsidian";
import type { App, TFile } from "obsidian";
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
  // Pastas (recursivo via getAllLoadedFiles — apenas TFolder).
  // `instanceof TFolder` é resiliente à minificação (compara a referência da
  // classe, não o nome string como na implementação anterior — que falhava em prod).
  const folders = app.vault
    .getAllLoadedFiles()
    .filter((f): f is TFolder => f instanceof TFolder);
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

// Cache curto pra não varrer o vault inteiro a cada keystroke do @ autocomplete
// (v0.1.228). TTL pequeno: dentro de uma sessão de digitação a lista é reusada;
// criações/renomeações recentes aparecem em até ~2s sem precisar de listeners
// de vault (que exigiriam lifecycle/cleanup que este módulo stateless não tem).
let _vaultPathsCache: { items: WikiLinkOption[]; at: number } | null = null;
const VAULT_PATHS_TTL_MS = 2000;

function collectVaultPathsCached(app: App): WikiLinkOption[] {
  const now = Date.now();
  if (_vaultPathsCache && now - _vaultPathsCache.at < VAULT_PATHS_TTL_MS) {
    return _vaultPathsCache.items;
  }
  const items = collectVaultPaths(app);
  _vaultPathsCache = { items, at: now };
  return items;
}

/**
 * Source pra completion de @notas/pastas. Trigger: @ seguido de qualquer char.
 *
 * Comportamento NOVO (v0.1.47): em vez de inserir `[[path]]` no texto,
 * dispara o callback `onPickNote(path)` (caller adiciona como anexo) e
 * limpa o `@query` do composer. Mesma UX do paste de imagem — anexo
 * vai pro chip acima do composer, não polui o campo de texto.
 *
 * Fallback: se nenhum callback for passado, comportamento antigo (insere wikilink).
 */
export function wikilinkCompletionSource(
  app: App,
  onPickNote?: (path: string, isFolder: boolean) => void
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/@[\w\-/. áàâãäéèêëíîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÎÏÓÒÔÕÖÚÙÛÜÇÑ]*/);
    if (!match) return null;
    if (match.from === match.to && !context.explicit) return null;

    const query = match.text.slice(1).toLowerCase().trim();
    const allItems = collectVaultPathsCached(app);

    const filtered = allItems
      .filter((item) => {
        if (!query) return true;
        return (
          item.display.toLowerCase().includes(query) ||
          item.path.toLowerCase().includes(query)
        );
      })
      .slice(0, 50);

    return {
      from: match.from,
      options: filtered.map((item) => ({
        label: item.display,
        detail: item.isFolder ? "folder" : item.path,
        type: item.isFolder ? "namespace" : "text",
        apply: onPickNote
          ? (
              view: EditorView,
              _completion: Completion,
              fromArg: number,
              toArg: number
            ) => {
              // Troca o "@query" pelo ALIAS legível (display sem a "/" final de
              // pasta) — mantém a frase natural ("resuma a MinhaNota") em vez de
              // remover tudo. O item entra como anexo via callback (chip), não
              // como `[[path]]` cru no texto.
              const alias = item.display.replace(/\/$/, "");
              view.dispatch({
                changes: { from: fromArg, to: toArg, insert: alias + " " },
              });
              // Dispara callback (caller adiciona como anexo)
              Promise.resolve().then(() => onPickNote(item.path, item.isFolder));
            }
          : `[[${item.path}]] `,
      })),
      filter: false,
    };
  };
}

/**
 * Detecta wikilinks `[[path]]` (ou `[[path|alias]]`) em texto colado/digitado,
 * extrai os paths e substitui cada link pelo ALIAS legível no texto.
 *
 * Retorna: { cleanText, links: Array<{ path, alias }> }
 * — cleanText: texto com cada `[[...]]` trocado pelo alias (ou basename do path)
 * — links: paths + alias extraídos (na ordem em que apareciam)
 *
 * Ex: "veja [[Projetos/AXXA|AXXA]] hoje" → cleanText "veja AXXA hoje",
 *     links [{ path: "Projetos/AXXA", alias: "AXXA" }]
 */
export function extractWikilinks(text: string): {
  cleanText: string;
  links: Array<{ path: string; alias: string }>;
} {
  const links: Array<{ path: string; alias: string }> = [];
  // Regex pra `[[path]]` ou `[[path|alias]]`. Permite . _ - / espaço dentro.
  const wikilinkRe = /\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g;
  let cleanText = text.replace(
    wikilinkRe,
    (_full, path: string, alias?: string) => {
      const p = path.trim();
      // Alias explícito > basename do path (sem extensão .md)
      const display =
        (alias && alias.trim()) ||
        (p.split("/").pop() ?? p).replace(/\.md$/, "");
      links.push({ path: p, alias: display });
      return display; // deixa o alias legível no texto
    }
  );
  // Limpa whitespace duplicado deixado pelo replace
  cleanText = cleanText.replace(/[ \t]{2,}/g, " ").trim();
  return { cleanText, links };
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
