// src/generation/save.ts
// Salva mídia gerada (imagem/áudio/vídeo) no vault em axxa-ai/generation/{type}
// + sidecar .md com frontmatter de metadata.
//
// Estrutura:
//   axxa-ai/generation/images/{ts}-{slug}.png
//   axxa-ai/generation/images/{ts}-{slug}.md     ← sidecar com metadata
//   axxa-ai/generation/audio/{ts}-{slug}.mp3
//   axxa-ai/generation/audio/{ts}-{slug}.md
//   axxa-ai/generation/video/{ts}-{slug}.mp4
//   axxa-ai/generation/video/{ts}-{slug}.md
//
// Sidecar frontmatter format:
//   ---
//   id: uuid
//   type: image | audio | video
//   provider: openai | gemini | nim | openrouter | anthropic | ollama
//   model: gpt-image-1 | gemini-2.5-flash-image | stable-diffusion-3-medium
//   prompt: "the user prompt that generated this"
//   created: ISO8601 timestamp
//   size: bytes
//   mime: image/png | audio/mpeg | video/mp4
//   width/height: pra imagens
//   duration: pra audio/video (segundos)
//   seed: opcional, se determinístico
//   chat_id: chat de origem (linkável)
//   ---

import { TFile, type App } from "obsidian";
import { ensureFolder } from "../components/_shared/chatPersistence";

export type GenerationMediaType = "image" | "audio" | "video";

export interface GenerationMetadata {
  id: string;
  type: GenerationMediaType;
  provider: string;
  model: string;
  prompt: string;
  created: string;
  size: number;
  mime: string;
  width?: number;
  height?: number;
  duration?: number;
  seed?: number;
  chatId?: string;
  /** Settings que afetaram a geração (temperature, steps, etc) */
  extra?: Record<string, string | number | boolean>;
}

const TYPE_TO_FOLDER: Record<GenerationMediaType, string> = {
  image: "images",
  audio: "audio",
  video: "video",
};

/** Slug pro nome de arquivo — pega ~5 palavras do prompt, kebab-case, sem accents. */
function slugify(prompt: string, maxLen = 40): string {
  if (!prompt) return "untitled";
  const normalized = prompt
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join("-")
    .slice(0, maxLen);
  return normalized || "untitled";
}

/** Timestamp ISO-safe pra filename: 2026-06-08_14-32-15 */
function tsFileName(): string {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
}

/** Escapa string pra frontmatter YAML (aspas duplas + escape de aspas internas). */
function yamlString(s: string): string {
  if (!s) return '""';
  // Multilinha → block scalar com `|`
  if (s.includes("\n")) {
    const indented = s
      .split("\n")
      .map((l) => "  " + l)
      .join("\n");
    return "|\n" + indented;
  }
  const escaped = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/** Monta o frontmatter sidecar como string Markdown. */
function buildSidecar(meta: GenerationMetadata, mediaPath: string): string {
  const fm: string[] = ["---"];
  fm.push(`id: ${meta.id}`);
  fm.push(`type: ${meta.type}`);
  fm.push(`provider: ${meta.provider}`);
  fm.push(`model: ${yamlString(meta.model)}`);
  fm.push(`prompt: ${yamlString(meta.prompt)}`);
  fm.push(`created: ${meta.created}`);
  fm.push(`size: ${meta.size}`);
  fm.push(`mime: ${yamlString(meta.mime)}`);
  if (meta.width != null) fm.push(`width: ${meta.width}`);
  if (meta.height != null) fm.push(`height: ${meta.height}`);
  if (meta.duration != null) fm.push(`duration: ${meta.duration}`);
  if (meta.seed != null) fm.push(`seed: ${meta.seed}`);
  if (meta.chatId) fm.push(`chat_id: ${yamlString(meta.chatId)}`);
  fm.push(`tags:`);
  fm.push(`  - axxa-generation`);
  fm.push(`  - ${meta.type}-gen`);
  if (meta.extra) {
    for (const [k, v] of Object.entries(meta.extra)) {
      fm.push(`${k}: ${typeof v === "string" ? yamlString(v) : v}`);
    }
  }
  fm.push("---");
  fm.push("");
  // Body: wikilink pra mídia + prompt human-readable
  fm.push(`# ${meta.type === "image" ? "Imagem" : meta.type === "audio" ? "Áudio" : "Vídeo"} gerado`);
  fm.push("");
  if (meta.type === "image") {
    fm.push(`![[${mediaPath}]]`);
  } else {
    fm.push(`[[${mediaPath}]]`);
  }
  fm.push("");
  fm.push(`## Prompt`);
  fm.push("");
  fm.push(`> ${meta.prompt.replace(/\n/g, "\n> ")}`);
  fm.push("");
  fm.push(`## Metadata`);
  fm.push("");
  fm.push(`- **Modelo:** \`${meta.model}\``);
  fm.push(`- **Provider:** \`${meta.provider}\``);
  fm.push(`- **Criado:** ${meta.created}`);
  if (meta.width && meta.height) {
    fm.push(`- **Resolução:** ${meta.width}×${meta.height}px`);
  }
  if (meta.duration) {
    fm.push(`- **Duração:** ${meta.duration.toFixed(2)}s`);
  }
  fm.push(`- **Tamanho:** ${formatBytes(meta.size)}`);
  return fm.join("\n");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export interface SaveGenerationResult {
  /** Path da mídia salva (relativo à raiz do vault). */
  mediaPath: string;
  /** Path do sidecar .md. */
  sidecarPath: string;
}

/**
 * Salva mídia gerada + sidecar de metadata.
 *
 * basePath é o root configurável (default `axxa-ai/generation`).
 * O subfolder é determinado pelo type via TYPE_TO_FOLDER.
 *
 * Extension é derivado do mime; fallback por type.
 */
export async function saveGeneration(
  app: App,
  basePath: string,
  data: ArrayBuffer | Uint8Array,
  meta: GenerationMetadata
): Promise<SaveGenerationResult> {
  const subfolder = TYPE_TO_FOLDER[meta.type];
  const folder = `${basePath}/${subfolder}`;
  await ensureFolderVault(app, folder);

  const ext = extFromMime(meta.mime, meta.type);
  const slug = slugify(meta.prompt);
  const stem = `${tsFileName()}-${slug}`;
  const mediaPath = `${folder}/${stem}.${ext}`;
  const sidecarPath = `${folder}/${stem}.md`;

  // Garante ArrayBuffer puro (não SharedArrayBuffer) — slice copia pro buffer regular
  const buffer: ArrayBuffer =
    data instanceof Uint8Array
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
      : (data as ArrayBuffer);

  // Escreve preferindo a Vault API: registra o arquivo no índice do Obsidian na
  // hora, então o ![[wikilink]] do sidecar resolve imediatamente. O
  // adapter.writeBinary não registra → embed quebrado até reindex. (v0.1.91)
  await writeBinaryVaultFirst(app, mediaPath, buffer);

  const sidecar = buildSidecar(meta, mediaPath);
  await writeTextVaultFirst(app, sidecarPath, sidecar);

  return { mediaPath, sidecarPath };
}

/** Cria a pasta registrando-a na Vault API quando possível (fallback adapter). */
async function ensureFolderVault(app: App, folder: string): Promise<void> {
  if (app.vault.getAbstractFileByPath(folder)) return;
  try {
    await app.vault.createFolder(folder);
  } catch {
    // Já existe no disco (criada via adapter antes) ou parent não registrado.
    await ensureFolder(app.vault.adapter, folder);
  }
}

/** Escreve binário via Vault API (registra TFile → wikilink resolve na hora);
 *  cai pro adapter se a Vault API recusar (pasta oculta/não registrada). */
async function writeBinaryVaultFirst(
  app: App,
  path: string,
  buffer: ArrayBuffer
): Promise<void> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await app.vault.modifyBinary(existing, buffer);
    return;
  }
  try {
    await app.vault.createBinary(path, buffer);
  } catch {
    await app.vault.adapter.writeBinary(path, buffer);
  }
}

/** Idem pra texto (sidecar .md). */
async function writeTextVaultFirst(
  app: App,
  path: string,
  text: string
): Promise<void> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await app.vault.modify(existing, text);
    return;
  }
  try {
    await app.vault.create(path, text);
  } catch {
    await app.vault.adapter.write(path, text);
  }
}

/** Mapeia mime → extensão. Fallback por type. */
function extFromMime(mime: string, type: GenerationMediaType): string {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("svg")) return "svg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("flac")) return "flac";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("webm")) return "webm";
  if (m.includes("quicktime") || m.includes("mov")) return "mov";
  // Fallback por tipo
  return type === "image" ? "png" : type === "audio" ? "mp3" : "mp4";
}

/** Decodifica base64 (string ou data URL) pra Uint8Array. */
export function base64ToBytes(b64OrDataUrl: string): Uint8Array {
  const b64 = b64OrDataUrl.includes(",")
    ? b64OrDataUrl.slice(b64OrDataUrl.indexOf(",") + 1)
    : b64OrDataUrl;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
