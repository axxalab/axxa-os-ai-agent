// src/ui/attachSources.ts
// As fontes de contexto do "+": além da nota do vault, o que dá pra grudar
// numa mensagem — PDF, link e o que o próprio plugin gerou (artefatos).
//
// Tudo que é decisão (o que é artefato, o que sobra de uma página web, o que
// vira rótulo) mora aqui, fora do componente, pra dar pra testar sem UI.

import type { App } from "obsidian";
import type { MessageAttachment, NoteAttachment } from "../providers/base";

/** Onde o plugin salva o que gera (imagens, áudio, vídeo + sidecar .md). */
export const GENERATION_DIR = "axxa-ai/generation";

export interface ArtifactLike {
  path: string;
  basename: string;
  extension: string;
  mtime: number;
}

const MIDIA = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "mp3",
  "wav",
  "ogg",
  "webm",
  "m4a",
  "mp4",
  "mov",
]);

export function isImageExt(ext: string): boolean {
  return ["png", "jpg", "jpeg", "webp", "gif"].includes(ext.toLowerCase());
}

/**
 * O que o plugin gerou, mais recente primeiro. Só a MÍDIA: o sidecar `.md` de
 * cada arquivo é metadata, e listar os dois lado a lado dobraria a lista sem
 * acrescentar nada.
 */
export function rankArtifacts(
  arquivos: readonly ArtifactLike[],
  limite = 40
): ArtifactLike[] {
  return arquivos
    .filter(
      (f) =>
        f.path.startsWith(`${GENERATION_DIR}/`) &&
        MIDIA.has(f.extension.toLowerCase())
    )
    .slice()
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limite);
}

/** Todos os arquivos do vault no formato do ranking. */
export function vaultArtifacts(app: App): ArtifactLike[] {
  return app.vault.getFiles().map((f) => ({
    path: f.path,
    basename: f.basename,
    extension: f.extension,
    mtime: f.stat?.mtime ?? 0,
  }));
}

/**
 * Texto legível de uma página web. Não é um parser de HTML — é o suficiente
 * pra o modelo ler: tira script/style, transforma tag em espaço, desfaz as
 * entidades mais comuns e junta os brancos.
 */
export function htmlToText(html: string, max = 20000): string {
  const limpo = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    // Espaço colado na quebra é sobra de tag, não texto.
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return limpo.length > max ? `${limpo.slice(0, max)}\n\n[…]` : limpo;
}

/** O <title> da página, quando dá — é o que vira rótulo do chip. */
export function htmlTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const t = m ? m[1].replace(/\s+/g, " ").trim() : "";
  return t || null;
}

/** Completa o endereço digitado sem protocolo (é o que todo mundo digita). */
export function normalizeUrl(entrada: string): string | null {
  const url = entrada.trim();
  if (!url) return null;
  const cheia = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    const u = new URL(cheia);
    return u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

/** A página vira contexto de texto, com a fonte no topo pra ficar citável. */
export function linkNote(url: string, titulo: string | null, texto: string): NoteAttachment {
  return {
    type: "note",
    path: titulo ? `${titulo} — ${url}` : url,
    content: `Fonte: ${url}\n\n${texto}`,
  };
}

/** Ícone do artefato pelo que ele É: imagem, som ou vídeo. */
export function artifactIcon(ext: string): string {
  if (isImageExt(ext)) return "image";
  return ["mp4", "mov", "webm"].includes(ext.toLowerCase())
    ? "file-video"
    : "file-audio";
}

/** Ícone do chip de anexo — o mesmo vocabulário da folha de ações. */
export function attachmentIcon(a: MessageAttachment): string {
  if (a.type === "image") return "image";
  if (a.type === "pdf") return "file-text";
  if (a.type === "audio") return "mic";
  return "file-text";
}

/** Rótulo curto: o nome do arquivo, não o caminho inteiro. */
export function attachmentLabel(a: MessageAttachment): string {
  if (a.type === "note") {
    // Link: o rótulo é o título (ou o host) — cortar na barra transformava
    // "…/spaced-repetition" em "spaced", que não diz nada.
    const corte = a.path.indexOf(" — http");
    if (corte > 0) return a.path.slice(0, corte);
    if (/^https?:\/\//.test(a.path)) {
      try {
        return new URL(a.path).hostname;
      } catch {
        return a.path;
      }
    }
    return a.path.split("/").pop() ?? a.path;
  }
  if (a.type === "image") return a.name ?? "Image";
  if (a.type === "pdf") return a.name;
  return a.path.split("/").pop() ?? "Audio";
}
