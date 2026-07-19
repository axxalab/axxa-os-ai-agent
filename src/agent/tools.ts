// src/agent/tools.ts
// Implementações das ferramentas — chamadas reais ao vault via DataAdapter.
//
// Convenção: cada tool é (app, args) → Promise<string>. String volta como
// content do ToolResult. Em caso de erro, joga Error — o caller marca isError.
//
// Paths são SEMPRE relativos à raiz do vault. Tools normalizam (/, \, ..)
// e bloqueiam paths que tentam sair do vault (anti path-traversal).

import type { App } from "obsidian";
import { ensureFolder } from "../components/_shared/chatPersistence";
import type { ToolContext } from "./types";
import { hybridSearch } from "../rag/hybrid";

const VAULT_ROOT_MAX_DEPTH = 32; // sanity check: ninguém precisa de 100 níveis

// ============================================================
// Helpers — path safety
// ============================================================

/** Erro transitório (vale retry): rede/timeout/lock. Path/arg errado NÃO é. */
export function isTransientError(message: string): boolean {
  const m = (message || "").toLowerCase();
  return (
    m.includes("network") ||
    m.includes("timeout") ||
    m.includes("locked") ||
    m.includes("busy")
  );
}

/** Normaliza separadores e remove leading slash. Lança se tem `..` ou `:`.
 *  Exportada pra teste do boundary de segurança (anti path-traversal). */
export function normalizePath(path: string): string {
  if (!path || typeof path !== "string") {
    throw new Error("Empty or invalid path.");
  }
  const normalized = path
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\//, "");
  // v0.1.228: checa SEGMENTO === ".." (não substring) — assim um nome de
  // arquivo legítimo com ".." embutido (ex: "relatorio..final.md") passa, mas
  // o traversal real (segmento ".." ou ".") continua bloqueado.
  const segs = normalized.split("/");
  if (segs.some((s) => s === ".." || s === ".")) {
    throw new Error("Paths containing '..' are not allowed.");
  }
  if (normalized.includes(":")) {
    throw new Error("Paths containing ':' are not allowed (no drive letters).");
  }
  if (normalized.split("/").length > VAULT_ROOT_MAX_DEPTH) {
    throw new Error(`Paths deeper than ${VAULT_ROOT_MAX_DEPTH} levels are blocked.`);
  }
  return normalized;
}

function dirOf(path: string): string {
  const parts = path.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

// ============================================================
// Tool: vault_list
// ============================================================

interface ListArgs {
  folder?: string;
}

export async function toolVaultList(app: App, args: ListArgs): Promise<string> {
  const folder = args.folder ? normalizePath(args.folder) : "";
  const adapter = app.vault.adapter;
  if (folder && !(await adapter.exists(folder))) {
    return `Folder does not exist: ${folder}`;
  }
  // v0.1.228: adapter.list pode lançar (path é arquivo, permissão, etc.) —
  // devolve mensagem amigável em vez de propagar erro cru pro agent.
  let listing: Awaited<ReturnType<typeof adapter.list>>;
  try {
    listing = await adapter.list(folder || "/");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Could not list ${folder || "/"}: ${msg}`;
  }
  const folders = listing.folders.map((f) => `📁 ${f}`);
  const files = listing.files.map((f) => `📄 ${f}`);
  const all = [...folders, ...files];
  if (all.length === 0) {
    return `Empty folder: ${folder || "/"}`;
  }
  return `Contents of ${folder || "/"} (${all.length} items):\n` + all.join("\n");
}

// ============================================================
// Tool: vault_read
// ============================================================

interface ReadArgs {
  path: string;
}

// v0.1.228: medida em CHARS (UTF-16 .length), não bytes — nome honesto.
const MAX_READ_CHARS = 200_000; // ~200K chars cap pra não estourar context

export async function toolVaultRead(app: App, args: ReadArgs): Promise<string> {
  const path = normalizePath(args.path);
  const adapter = app.vault.adapter;
  if (!(await adapter.exists(path))) {
    throw new Error(`File does not exist: ${path}`);
  }
  const stat = await adapter.stat(path);
  if (!stat || stat.type !== "file") {
    throw new Error(`${path} is not a file.`);
  }
  const content = await adapter.read(path);
  if (content.length > MAX_READ_CHARS) {
    // v0.1.228: evita cortar no meio de um surrogate pair (emoji etc.) —
    // se o char no limite é high-surrogate, recua 1 pra não quebrar o grafema.
    let cut = MAX_READ_CHARS;
    const code = content.charCodeAt(cut - 1);
    if (code >= 0xd800 && code <= 0xdbff) cut -= 1;
    return `(file truncated at ${cut} chars — original had ${content.length})\n\n${content.slice(0, cut)}`;
  }
  return content;
}

// ============================================================
// Tool: vault_create
// ============================================================

interface CreateArgs {
  path: string;
  content: string;
}

export async function toolVaultCreate(
  app: App,
  args: CreateArgs
): Promise<string> {
  const path = normalizePath(args.path);
  const adapter = app.vault.adapter;
  if (await adapter.exists(path)) {
    throw new Error(
      `File already exists: ${path}. Use vault_edit to modify or vault_move to rename.`
    );
  }
  const dir = dirOf(path);
  if (dir) await ensureFolder(adapter, dir);
  await adapter.write(path, args.content ?? "");
  return `File created: ${path} (${(args.content ?? "").length} chars)`;
}

// ============================================================
// Tool: vault_edit (find/replace)
// ============================================================

interface EditArgs {
  path: string;
  /** String LITERAL a ser encontrada (case-sensitive, sem regex). */
  oldStr: string;
  /** String que substitui. */
  newStr: string;
}

export async function toolVaultEdit(app: App, args: EditArgs): Promise<string> {
  const path = normalizePath(args.path);
  const adapter = app.vault.adapter;
  if (!(await adapter.exists(path))) {
    throw new Error(`File does not exist: ${path}`);
  }
  const content = await adapter.read(path);
  const occurrences = content.split(args.oldStr).length - 1;
  if (occurrences === 0) {
    throw new Error(
      `String not found in ${path}: "${args.oldStr.slice(0, 100)}"`
    );
  }
  if (occurrences > 1) {
    throw new Error(
      `String "${args.oldStr.slice(0, 60)}..." appears ${occurrences}x in ${path}. ` +
        `Use a more specific string to avoid ambiguity.`
    );
  }
  // split/join (NÃO .replace): replace interpreta $&, $1, $$ no newStr e
  // corromperia trechos com '$' (regex, TeX, preços) silenciosamente. Como já
  // garantimos occurrences===1, split/join troca exatamente a única ocorrência.
  const newContent = content.split(args.oldStr).join(args.newStr);
  await adapter.write(path, newContent);
  const delta = args.newStr.length - args.oldStr.length;
  const sign = delta >= 0 ? "+" : "";
  return `Edited ${path} (${sign}${delta} chars)`;
}

// ============================================================
// Tool: vault_move (rename ou mover)
// ============================================================

interface MoveArgs {
  from: string;
  to: string;
}

export async function toolVaultMove(app: App, args: MoveArgs): Promise<string> {
  const from = normalizePath(args.from);
  const to = normalizePath(args.to);
  const adapter = app.vault.adapter;
  if (!(await adapter.exists(from))) {
    throw new Error(`Source does not exist: ${from}`);
  }
  if (await adapter.exists(to)) {
    throw new Error(`Destination already exists: ${to}. Refusing to overwrite.`);
  }
  // v0.1.228: se a origem é pasta, bloqueia mover pra dentro dela mesma
  // (to === from ou descendente) — rename de pasta nesse caso corromperia.
  const fromStat = await adapter.stat(from);
  if (fromStat?.type === "folder" && (to === from || to.startsWith(from + "/"))) {
    throw new Error("Cannot move a folder into itself.");
  }
  const dir = dirOf(to);
  if (dir) await ensureFolder(adapter, dir);
  // Usa rename do adapter (atomic em sistemas POSIX)
  await adapter.rename(from, to);
  return `Moved: ${from} → ${to}`;
}

// ============================================================
// Tool: vault_delete
// ============================================================

interface DeleteArgs {
  path: string;
}

export async function toolVaultDelete(
  app: App,
  args: DeleteArgs
): Promise<string> {
  const path = normalizePath(args.path);
  const adapter = app.vault.adapter;
  if (!(await adapter.exists(path))) {
    throw new Error(`File does not exist: ${path}`);
  }
  const stat = await adapter.stat(path);
  if (!stat) {
    throw new Error(`Stat failed for ${path}`);
  }
  if (stat.type === "folder") {
    // Bloqueia delete de pasta com conteúdo (safety)
    const listing = await adapter.list(path);
    if (listing.files.length + listing.folders.length > 0) {
      throw new Error(
        `Folder ${path} is not empty. Delete the files first (safety).`
      );
    }
    await adapter.rmdir(path, false);
    return `Empty folder deleted: ${path}`;
  }
  await adapter.remove(path);
  return `File deleted: ${path}`;
}

// ============================================================
// Tool: vault_create_folder
// ============================================================

interface CreateFolderArgs {
  path: string;
}

export async function toolVaultCreateFolder(
  app: App,
  args: CreateFolderArgs
): Promise<string> {
  const path = normalizePath(args.path);
  const adapter = app.vault.adapter;
  if (await adapter.exists(path)) {
    return `Folder already exists: ${path}`;
  }
  await ensureFolder(adapter, path);
  return `Folder created: ${path}`;
}

// ============================================================
// Tool: vault_search (busca semântica RAG + fallback keyword)
// ============================================================

interface SearchArgs {
  query: string;
  topK?: number;
}

/**
 * Busca HÍBRIDA por relevância nas notas: funde semântico (embeddings/cosine)
 * com keyword via RRF e re-rankeia pelo grafo de links. Funciona com ou sem
 * índice (sem índice = só keyword). Dá ao agent "memória" do vault — encontrar
 * notas relevantes em 1 call, sem listar pastas e ler arquivo por arquivo.
 */
export async function toolVaultSearch(
  ctx: ToolContext,
  args: SearchArgs
): Promise<string> {
  const query = String(args.query ?? "").trim();
  if (!query) throw new Error("Empty 'query' parameter.");
  const topK = Math.min(Math.max(Number(args.topK) || 5, 1), 20);

  const hits = await hybridSearch({
    app: ctx.app,
    index: ctx.vectorIndex,
    creds: {
      openaiApiKey: ctx.embed.openaiApiKey,
      openrouterApiKey: ctx.embed.openrouterApiKey,
      geminiApiKey: ctx.embed.geminiApiKey,
      nimApiKey: ctx.embed.nimApiKey,
    },
    query,
    topK,
  });
  if (hits.length === 0) {
    return `No relevant notes for "${query}". Try other terms or use vault_list to browse.`;
  }
  const lines = hits.map((h) => `### ${h.path} (${h.via})\n${h.text}`);
  return (
    `Hybrid search — ${hits.length} result(s) for "${query}":\n\n` +
    lines.join("\n\n---\n\n")
  );
}

// ============================================================
// Registry — executor central
// ============================================================

/** Mapa nome → função executor. AxxaApp/agent loop usa pra despachar.
 *  Recebe ToolContext (app + RAG + creds) — tools simples usam só ctx.app. */
export type ToolExecutor = (
  ctx: ToolContext,
  args: Record<string, unknown>
) => Promise<string>;

export const TOOL_REGISTRY: Record<string, ToolExecutor> = {
  vault_search: (ctx, args) =>
    toolVaultSearch(ctx, args as unknown as SearchArgs),
  vault_list: (ctx, args) => toolVaultList(ctx.app, args as unknown as ListArgs),
  vault_read: (ctx, args) => toolVaultRead(ctx.app, args as unknown as ReadArgs),
  vault_create: (ctx, args) =>
    toolVaultCreate(ctx.app, args as unknown as CreateArgs),
  vault_edit: (ctx, args) => toolVaultEdit(ctx.app, args as unknown as EditArgs),
  vault_move: (ctx, args) => toolVaultMove(ctx.app, args as unknown as MoveArgs),
  vault_delete: (ctx, args) =>
    toolVaultDelete(ctx.app, args as unknown as DeleteArgs),
  vault_create_folder: (ctx, args) =>
    toolVaultCreateFolder(ctx.app, args as unknown as CreateFolderArgs),
};
