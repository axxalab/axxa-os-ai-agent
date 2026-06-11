// src/components/_shared/chatPersistence.ts
// Persistência de chats no Vault — Módulo 4.1+4.2
//
// Cada conversa vira um arquivo .md em `.axxa/chats/chat/[id].md` com:
//   - Frontmatter YAML com metadata (id, title, date, provider, model, effort, tokens)
//   - Body markdown legível: `## You` / `## Assistant` blocks
//
// Funções:
//   saveChat()   — escreve/atualiza o arquivo do chat
//   loadChat()   — lê + parsa um chat
//   listChats()  — lista summary de todos os chats (frontmatter only)
//   ensureFolder() — cria pasta recursiva

import type { App, DataAdapter } from "obsidian";
import type { AIToolStep } from "../../agent/types";

export interface ChatMessageStored {
  type: "user" | "ai-response";
  content: string;
  timestamp: number;
  /** Reaction do user no ai-response (persiste like/dislike entre reloads). */
  reaction?: "like" | "dislike" | null;
  /** Ações de tool do agent (Agent mode) — persistidas pra continuidade de
   *  contexto ao reabrir o chat. v0.1.160 */
  agentSteps?: AIToolStep[];
}

/** Argumento mais significativo de uma tool (path/from/query) pro resumo. */
function stepLabel(step: AIToolStep): string {
  const a = step.arguments ?? {};
  const key = (a.path ?? a.from ?? a.folder ?? a.query) as string | undefined;
  return key ? `${step.name} ${key}` : step.name;
}

export interface ChatData {
  id: string;
  title: string;
  date: string; // ISO 8601
  mode: string;
  provider: string;
  model: string;
  effort: string;
  tokensIn: number;
  tokensOut: number;
  /** Persona / system prompt custom do chat ("" ou ausente = prompt padrão). */
  persona?: string;
  messages: ChatMessageStored[];
}

export interface ChatSummary {
  id: string;
  title: string;
  date: string;
  /** Modo da conversa (chat / vault-qa / agent). Usado pra carregar do disco. */
  mode: string;
  provider: string;
  model: string;
  effort: string;
  tokensIn: number;
  tokensOut: number;
  messageCount: number;
  filePath: string;
}

const TAG_LIST = ["axxa-chat"];

/** Cria a pasta (e ancestrais) se não existir. */
export async function ensureFolder(adapter: DataAdapter, path: string): Promise<void> {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const partial = parts.slice(0, i + 1).join("/");
    if (!(await adapter.exists(partial))) {
      try {
        await adapter.mkdir(partial);
      } catch {
        // pode falhar se outro processo criou ao mesmo tempo — ignora
      }
    }
  }
}

/** Caminho da pasta de um modo específico (ex: "chat") */
function modeFolder(chatsPath: string, mode: string): string {
  return `${chatsPath}/${mode}`;
}

/** Caminho completo do arquivo do chat */
function chatFilePath(chatsPath: string, mode: string, chatId: string): string {
  return `${modeFolder(chatsPath, mode)}/${chatId}.md`;
}

/** Gera título auto-baseado na primeira mensagem do user */
export function generateTitle(firstUserMessage: string): string {
  const cleaned = firstUserMessage.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 60) return cleaned;
  return cleaned.slice(0, 60).trim() + "…";
}

// ============================================================
// Render: ChatData → Markdown
// ============================================================

function yamlString(s: string): string {
  // JSON.stringify produz string YAML-segura (com aspas + escapes)
  return JSON.stringify(s);
}

// Base64 UTF-8-safe (funciona no plugin Electron E no node dos testes). Usado
// pra embutir os agentSteps num comentário sem risco de "-->" no result quebrar.
function b64encode(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}
function b64decode(s: string): string {
  return decodeURIComponent(escape(atob(s)));
}

function renderFrontmatter(chat: ChatData): string {
  const tags = TAG_LIST.concat([`axxa-mode-${chat.mode}`])
    .map((t) => `  - ${t}`)
    .join("\n");
  // tools_used: resumo legível das ações do agent (RAG indexa frontmatter →
  // dá pra achar "qual chat criou notes/projeto.md"). v0.1.160
  const allSteps = chat.messages.flatMap((m) => m.agentSteps ?? []);
  const toolsBlock =
    allSteps.length > 0
      ? `tools_used:\n${allSteps
          .map((s) => `  - ${yamlString(stepLabel(s))}`)
          .join("\n")}\n`
      : "";
  return `---
id: ${yamlString(chat.id)}
title: ${yamlString(chat.title)}
date: ${yamlString(chat.date)}
mode: ${yamlString(chat.mode)}
provider: ${yamlString(chat.provider)}
model: ${yamlString(chat.model)}
effort: ${yamlString(chat.effort)}
${chat.persona ? `persona: ${yamlString(chat.persona)}\n` : ""}tokens_in: ${chat.tokensIn}
tokens_out: ${chat.tokensOut}
message_count: ${chat.messages.length}
${toolsBlock}tags:
${tags}
---`;
}

function renderBody(chat: ChatData): string {
  const heading = `# ${chat.title}\n`;
  const sections = chat.messages
    .map((m) => {
      const label = m.type === "user" ? "You" : "Assistant";
      // Marca de reaction como linha HTML comment invisível no markdown
      // (sobrevive ao parse manual + invisivel em qualquer render)
      const meta: string[] = [];
      if (m.timestamp) meta.push(`ts=${m.timestamp}`);
      if (m.reaction) meta.push(`reaction=${m.reaction}`);
      const metaLine = meta.length > 0 ? `<!-- axxa: ${meta.join(" ")} -->\n` : "";
      // Ações do agent — base64 num comentário (precisão pro replay; invisível
      // no preview). O resumo legível vai no frontmatter tools_used.
      const stepsLine =
        m.agentSteps && m.agentSteps.length > 0
          ? `\n\n<!-- axxa-steps: ${b64encode(JSON.stringify(m.agentSteps))} -->`
          : "";
      return `## ${label}\n\n${metaLine}${m.content.trim()}${stepsLine}\n`;
    })
    .join("\n");
  return `${heading}\n${sections}`;
}

/** Extrai metadata da linha HTML comment + retorna content limpo. */
function parseMessageMeta(content: string): {
  cleanContent: string;
  timestamp?: number;
  reaction?: "like" | "dislike" | null;
} {
  const match = content.match(/^\s*<!--\s*axxa:\s*([^>]+?)\s*-->\s*\n?/);
  if (!match) return { cleanContent: content };
  const meta = match[1];
  const cleanContent = content.slice(match[0].length);
  let timestamp: number | undefined;
  let reaction: "like" | "dislike" | null | undefined;
  for (const part of meta.split(/\s+/)) {
    const [k, v] = part.split("=");
    if (k === "ts" && v) timestamp = parseInt(v, 10);
    else if (k === "reaction" && (v === "like" || v === "dislike")) {
      reaction = v;
    }
  }
  return { cleanContent, timestamp, reaction };
}

// Exportadas pra teste de round-trip (integridade de dados). v0.1.149
export function renderChatMarkdown(chat: ChatData): string {
  return `${renderFrontmatter(chat)}\n\n${renderBody(chat)}`;
}

// ============================================================
// Parse: Markdown → ChatData
// ============================================================

function parseSimpleYaml(text: string): Record<string, string | number | string[]> {
  const result: Record<string, string | number | string[]> = {};
  const lines = text.split("\n");
  let currentArrayKey: string | null = null;
  let currentArray: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine;
    // Item de array (- value)
    const arrayItemMatch = line.match(/^\s*-\s+(.+)$/);
    if (currentArrayKey && arrayItemMatch) {
      let value = arrayItemMatch[1].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        try {
          value = JSON.parse(value);
        } catch {
          /* keep */
        }
      }
      currentArray.push(value);
      continue;
    }
    // Se tinha array em progresso e a linha não é mais item, salva
    if (currentArrayKey && !arrayItemMatch) {
      result[currentArrayKey] = currentArray;
      currentArrayKey = null;
      currentArray = [];
    }
    // Key: value
    const kvMatch = line.match(/^([\w_-]+):\s*(.*)$/);
    if (!kvMatch) continue;
    const key = kvMatch[1];
    const rawValue = kvMatch[2].trim();
    if (!rawValue) {
      // Pode ser início de array (linhas seguintes começam com `- `)
      currentArrayKey = key;
      currentArray = [];
      continue;
    }
    let value: string | number = rawValue;
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        /* keep */
      }
    } else if (/^-?\d+(\.\d+)?$/.test(value)) {
      value = Number(value);
    }
    result[key] = value;
  }
  // Fecha array pendente
  if (currentArrayKey) {
    result[currentArrayKey] = currentArray;
  }
  return result;
}

/** Extrai os agentSteps (comentário base64 no fim) e devolve o content limpo. */
function extractAgentSteps(content: string): {
  content: string;
  agentSteps?: AIToolStep[];
} {
  const m = content.match(/\n*<!--\s*axxa-steps:\s*([A-Za-z0-9+/=]+)\s*-->\s*$/);
  if (!m || m.index === undefined) return { content };
  try {
    const steps = JSON.parse(b64decode(m[1])) as AIToolStep[];
    return { content: content.slice(0, m.index).trimEnd(), agentSteps: steps };
  } catch {
    return { content };
  }
}

function parseBody(body: string): ChatMessageStored[] {
  // Pula até a primeira heading `## You` ou `## Assistant`
  // depois alterna entre elas até o final ou outra heading desconhecida.
  const messages: ChatMessageStored[] = [];
  const sectionRegex = /^## (You|Assistant)\s*$/gm;
  let match: RegExpExecArray | null;
  // Guarda o início do HEADING (match.index) E o início do CONTEÚDO
  // (após o match). O fim de cada conteúdo é o heading do próximo.
  // v0.1.149: antes o fim era calculado subtraindo o tamanho fixo do label
  // de next.start — mas `\s*$` engole um \n, então match[0] tinha 1 char a
  // mais e vazava o "#" do próximo heading pro fim da mensagem anterior.
  const starts: {
    type: "user" | "ai-response";
    headingStart: number;
    contentStart: number;
  }[] = [];
  while ((match = sectionRegex.exec(body)) !== null) {
    const type = match[1] === "You" ? "user" : "ai-response";
    starts.push({
      type,
      headingStart: match.index,
      contentStart: match.index + match[0].length,
    });
  }
  for (let i = 0; i < starts.length; i++) {
    const cur = starts[i];
    const next = starts[i + 1];
    const rawContent = body.slice(
      cur.contentStart,
      next ? next.headingStart : body.length
    );
    // Extrai metadata (timestamp + reaction) da linha HTML comment
    const { cleanContent, timestamp, reaction } = parseMessageMeta(rawContent.trim());
    // Extrai as ações do agent (comentário base64) e tira do conteúdo visível.
    const { content: finalContent, agentSteps } = extractAgentSteps(
      cleanContent.trim()
    );
    messages.push({
      type: cur.type,
      content: finalContent,
      // Restaura timestamp original se salvo; fallback now()
      timestamp: timestamp ?? Date.now(),
      ...(reaction != null ? { reaction } : {}),
      ...(agentSteps ? { agentSteps } : {}),
    });
  }
  return messages;
}

export function parseChatMarkdown(content: string): ChatData {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Frontmatter inválido — não encontrei `---` delimitadores.");
  }
  const fm = parseSimpleYaml(match[1]);
  const messages = parseBody(match[2]);
  return {
    id: String(fm.id ?? ""),
    title: String(fm.title ?? "Sem título"),
    date: String(fm.date ?? new Date().toISOString()),
    mode: String(fm.mode ?? "chat"),
    provider: String(fm.provider ?? "openai"),
    model: String(fm.model ?? ""),
    effort: String(fm.effort ?? "med"),
    persona: fm.persona ? String(fm.persona) : undefined,
    tokensIn: Number(fm.tokens_in ?? 0),
    tokensOut: Number(fm.tokens_out ?? 0),
    messages,
  };
}

// ============================================================
// Public API
// ============================================================

export async function saveChat(
  app: App,
  chatsPath: string,
  chat: ChatData
): Promise<string> {
  const folder = modeFolder(chatsPath, chat.mode);
  await ensureFolder(app.vault.adapter, folder);
  const path = chatFilePath(chatsPath, chat.mode, chat.id);
  await app.vault.adapter.write(path, renderChatMarkdown(chat));
  return path;
}

export async function loadChat(
  app: App,
  chatsPath: string,
  mode: string,
  chatId: string
): Promise<ChatData> {
  const path = chatFilePath(chatsPath, mode, chatId);
  const content = await app.vault.adapter.read(path);
  return parseChatMarkdown(content);
}

/** Monta um ChatSummary a partir do frontmatter (do cache OU parseado). */
export function summaryFromFrontmatter(
  fm: Record<string, unknown>,
  fallbackMode: string,
  filePath: string
): ChatSummary {
  return {
    id: String(fm.id ?? ""),
    title: String(fm.title ?? "Sem título"),
    date: String(fm.date ?? ""),
    mode: String(fm.mode ?? fallbackMode),
    provider: String(fm.provider ?? ""),
    model: String(fm.model ?? ""),
    effort: String(fm.effort ?? ""),
    tokensIn: Number(fm.tokens_in ?? 0),
    tokensOut: Number(fm.tokens_out ?? 0),
    messageCount: Number(fm.message_count ?? 0),
    filePath,
  };
}

export async function listChats(
  app: App,
  chatsPath: string,
  mode: string,
  limit: number = 10
): Promise<ChatSummary[]> {
  const folder = modeFolder(chatsPath, mode);
  if (!(await app.vault.adapter.exists(folder))) return [];
  const listing = await app.vault.adapter.list(folder);
  const summaries: ChatSummary[] = [];
  for (const file of listing.files) {
    if (!file.endsWith(".md")) continue;
    // CACHE-FIRST (v0.1.159): o Obsidian já parseou o frontmatter no
    // metadataCache → pega de lá sem LER o arquivo (antes lia o .md INTEIRO
    // só pro frontmatter, pesado em vault com muitos chats). Cache frio
    // (arquivo recém-criado) cai no fallback de leitura.
    const cached = app.metadataCache.getCache(file)?.frontmatter as
      | Record<string, unknown>
      | undefined;
    if (cached && cached.id) {
      summaries.push(summaryFromFrontmatter(cached, mode, file));
      continue;
    }
    try {
      const content = await app.vault.adapter.read(file);
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (!match) continue;
      summaries.push(summaryFromFrontmatter(parseSimpleYaml(match[1]), mode, file));
    } catch {
      // skip arquivos quebrados
    }
  }
  return summaries
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

/**
 * Lista chats de TODOS os modos (chat / vault-qa / agent / etc).
 * Walk em todas as subpastas de chatsPath e agrega. Usado pela
 * ConversationsList (que mostra tudo) e pela StarterScreen (recent).
 */
export async function listAllChats(
  app: App,
  chatsPath: string,
  limit: number = 1000
): Promise<ChatSummary[]> {
  if (!(await app.vault.adapter.exists(chatsPath))) return [];
  // Cada subpasta do chatsPath é um "modo" (chat, vault-qa, agent, ...)
  const root = await app.vault.adapter.list(chatsPath);
  const all: ChatSummary[] = [];
  for (const subfolder of root.folders) {
    // O último segmento do path é o nome do modo
    const mode = subfolder.split("/").pop() ?? "chat";
    const summaries = await listChats(app, chatsPath, mode, 10_000);
    all.push(...summaries);
  }
  return all
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

/**
 * Renomeia o título de um chat (sem mudar o id / file path).
 * Reescreve frontmatter `title:` e o `# Heading` do body.
 */
/**
 * Deleta o .md de um chat — manda pra LIXEIRA do sistema (recuperável), com
 * fallback pro adapter.remove se a Vault API não conhecer o arquivo. #3
 */
export async function deleteChat(
  app: App,
  chatsPath: string,
  mode: string,
  chatId: string
): Promise<void> {
  const path = chatFilePath(chatsPath, mode, chatId);
  const file = app.vault.getAbstractFileByPath(path);
  if (file) {
    await app.vault.trash(file, true);
    return;
  }
  if (await app.vault.adapter.exists(path)) {
    await app.vault.adapter.remove(path);
  }
}

export async function renameChat(
  app: App,
  chatsPath: string,
  mode: string,
  chatId: string,
  newTitle: string
): Promise<void> {
  const clean = newTitle.trim();
  if (!clean) throw new Error("Título vazio.");
  const path = chatFilePath(chatsPath, mode, chatId);
  const content = await app.vault.adapter.read(path);
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Frontmatter inválido nesse chat.");
  // Atualiza só a linha `title:` (mantém resto do frontmatter)
  const updatedFm = match[1].replace(
    /^title:\s*.*$/m,
    `title: ${yamlString(clean)}`
  );
  // Atualiza o primeiro `# ...` do body
  let body = match[2];
  body = body.replace(/^# .+$/m, `# ${clean}`);
  const updated = `---\n${updatedFm}\n---\n${body}`;
  await app.vault.adapter.write(path, updated);
}
