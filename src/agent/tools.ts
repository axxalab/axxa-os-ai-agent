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

/** Normaliza separadores e remove leading slash. Lança se tem `..` ou `:`. */
function normalizePath(path: string): string {
  if (!path || typeof path !== "string") {
    throw new Error("Path vazio ou inválido.");
  }
  const normalized = path
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\//, "");
  if (normalized.includes("..")) {
    throw new Error("Paths com '..' não são permitidos.");
  }
  if (normalized.includes(":")) {
    throw new Error("Paths com ':' não são permitidos (anti drive letter).");
  }
  if (normalized.split("/").length > VAULT_ROOT_MAX_DEPTH) {
    throw new Error(`Path com mais de ${VAULT_ROOT_MAX_DEPTH} níveis bloqueado.`);
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
    return `Pasta não existe: ${folder}`;
  }
  const listing = await adapter.list(folder || "/");
  const folders = listing.folders.map((f) => `📁 ${f}`);
  const files = listing.files.map((f) => `📄 ${f}`);
  const all = [...folders, ...files];
  if (all.length === 0) {
    return `Pasta vazia: ${folder || "/"}`;
  }
  return `Conteúdo de ${folder || "/"} (${all.length} itens):\n` + all.join("\n");
}

// ============================================================
// Tool: vault_read
// ============================================================

interface ReadArgs {
  path: string;
}

const MAX_READ_BYTES = 200_000; // 200KB cap pra não estourar context

export async function toolVaultRead(app: App, args: ReadArgs): Promise<string> {
  const path = normalizePath(args.path);
  const adapter = app.vault.adapter;
  if (!(await adapter.exists(path))) {
    throw new Error(`Arquivo não existe: ${path}`);
  }
  const stat = await adapter.stat(path);
  if (!stat || stat.type !== "file") {
    throw new Error(`${path} não é um arquivo.`);
  }
  const content = await adapter.read(path);
  if (content.length > MAX_READ_BYTES) {
    return `(arquivo truncado em ${MAX_READ_BYTES} chars — original tinha ${content.length})\n\n${content.slice(0, MAX_READ_BYTES)}`;
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
      `Arquivo já existe: ${path}. Use vault_edit pra modificar ou vault_move pra renomear.`
    );
  }
  const dir = dirOf(path);
  if (dir) await ensureFolder(adapter, dir);
  await adapter.write(path, args.content ?? "");
  return `Arquivo criado: ${path} (${(args.content ?? "").length} chars)`;
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
    throw new Error(`Arquivo não existe: ${path}`);
  }
  const content = await adapter.read(path);
  const occurrences = content.split(args.oldStr).length - 1;
  if (occurrences === 0) {
    throw new Error(
      `String não encontrada em ${path}: "${args.oldStr.slice(0, 100)}"`
    );
  }
  if (occurrences > 1) {
    throw new Error(
      `String "${args.oldStr.slice(0, 60)}..." aparece ${occurrences}x em ${path}. ` +
        `Use uma string mais específica pra evitar ambiguidade.`
    );
  }
  const newContent = content.replace(args.oldStr, args.newStr);
  await adapter.write(path, newContent);
  const delta = args.newStr.length - args.oldStr.length;
  const sign = delta >= 0 ? "+" : "";
  return `Editado ${path} (${sign}${delta} chars)`;
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
    throw new Error(`Origem não existe: ${from}`);
  }
  if (await adapter.exists(to)) {
    throw new Error(`Destino já existe: ${to}. Não vou sobrescrever.`);
  }
  const dir = dirOf(to);
  if (dir) await ensureFolder(adapter, dir);
  // Usa rename do adapter (atomic em sistemas POSIX)
  await adapter.rename(from, to);
  return `Movido: ${from} → ${to}`;
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
    throw new Error(`Arquivo não existe: ${path}`);
  }
  const stat = await adapter.stat(path);
  if (!stat) {
    throw new Error(`Stat falhou pra ${path}`);
  }
  if (stat.type === "folder") {
    // Bloqueia delete de pasta com conteúdo (safety)
    const listing = await adapter.list(path);
    if (listing.files.length + listing.folders.length > 0) {
      throw new Error(
        `Pasta ${path} não está vazia. Delete os arquivos primeiro (safety).`
      );
    }
    await adapter.rmdir(path, false);
    return `Pasta vazia deletada: ${path}`;
  }
  await adapter.remove(path);
  return `Arquivo deletado: ${path}`;
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
    return `Pasta já existe: ${path}`;
  }
  await ensureFolder(adapter, path);
  return `Pasta criada: ${path}`;
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
  if (!query) throw new Error("Parâmetro 'query' vazio.");
  const topK = Math.min(Math.max(Number(args.topK) || 5, 1), 20);

  const hits = await hybridSearch({
    app: ctx.app,
    index: ctx.vectorIndex,
    creds: {
      openaiApiKey: ctx.embed.openaiApiKey,
      openrouterApiKey: ctx.embed.openrouterApiKey,
    },
    query,
    topK,
  });
  if (hits.length === 0) {
    return `Nenhuma nota relevante pra "${query}". Tente outros termos ou use vault_list pra navegar.`;
  }
  const lines = hits.map((h) => `### ${h.path} (${h.via})\n${h.text}`);
  return (
    `Busca híbrida — ${hits.length} resultado(s) pra "${query}":\n\n` +
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
