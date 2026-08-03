// src/providers/transcribe.ts
// Transcrição de áudio (STT) — fecha o VOZ-03/P0-01: o hold-to-record salvava a
// gravação no vault e o modelo nunca a ouvia. Agora o áudio vira TEXTO antes do
// envio, e o transcript entra na mensagem (logo vai pro .md e sobrevive ao
// reload — o mesmo rastro honesto de sempre, só que agora com conteúdo).
//
// Transporte: `requestUrl` do Obsidian (nativo, fura CORS no WebView mobile) com
// multipart/form-data montado à mão — FormData não sobrevive ao requestUrl, que
// quer um ArrayBuffer. O builder é uma função pura, testada byte a byte.
//
// Provider: OpenAI /v1/audio/transcriptions (a MESMA key já usada pelo cloud
// TTS). Não inventamos um papel novo de modelo pra isso; quem não tem key
// OpenAI continua com o aviso honesto de sempre.

import { requestUrl } from "obsidian";
import { ProviderError } from "./base";

const OPENAI_TRANSCRIBE_ENDPOINT =
  "https://api.openai.com/v1/audio/transcriptions";

/** Teto do arquivo aceito pela API (25MB) — barrado antes de subir. */
export const TRANSCRIBE_MAX_BYTES = 25 * 1024 * 1024;

/** Campo de um multipart: texto simples ou arquivo binário. */
export type MultipartField =
  | { name: string; value: string }
  | {
      name: string;
      filename: string;
      contentType: string;
      data: Uint8Array;
    };

/**
 * Monta um corpo multipart/form-data. Devolve o buffer e o content-type COM o
 * boundary (o servidor precisa dos dois casados).
 *
 * O boundary é injetável pra o teste poder afirmar os bytes exatos; em produção
 * vem de um random, como manda a especificação.
 */
export function buildMultipartBody(
  fields: MultipartField[],
  boundary = `----axxa${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
): { body: ArrayBuffer; contentType: string } {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const f of fields) {
    if ("value" in f) {
      chunks.push(
        enc.encode(
          `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"\r\n\r\n${f.value}\r\n`
        )
      );
      continue;
    }
    chunks.push(
      enc.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"; filename="${f.filename}"\r\n` +
          `Content-Type: ${f.contentType}\r\n\r\n`
      )
    );
    chunks.push(f.data);
    chunks.push(enc.encode("\r\n"));
  }
  chunks.push(enc.encode(`--${boundary}--\r\n`));

  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return {
    body: out.buffer.slice(0, total),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

/** Extensão → mime que a API aceita. Default webm (o que o MediaRecorder dá). */
export function audioMimeFor(path: string): string {
  const ext = (path.split(".").pop() ?? "").toLowerCase();
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
    case "mp4":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    default:
      return "audio/webm";
  }
}

export interface TranscribeOptions {
  apiKey: string;
  /** gpt-4o-mini-transcribe (default), gpt-4o-transcribe ou whisper-1. */
  model: string;
  data: Uint8Array;
  /** Nome com extensão — a API usa pra sniffar o formato. */
  filename: string;
  /** ISO-639-1 opcional; sem isso o modelo detecta sozinho. */
  language?: string;
}

/**
 * Transcreve um áudio. Devolve o texto limpo.
 * Erros viram ProviderError com o MESMO vocabulário de código do resto do app
 * (no-key/invalid-key/rate-limit/network), então a UI já sabe re-localizar.
 */
export async function transcribeAudio(
  opts: TranscribeOptions
): Promise<string> {
  if (!opts.apiKey?.trim()) {
    throw new ProviderError("OpenAI API key not configured.", "no-key");
  }
  if (opts.data.byteLength === 0) {
    throw new ProviderError("Empty audio file.", "unknown");
  }
  if (opts.data.byteLength > TRANSCRIBE_MAX_BYTES) {
    throw new ProviderError("Audio file too large (max 25MB).", "unknown");
  }

  const fields: MultipartField[] = [
    { name: "model", value: opts.model },
    {
      name: "file",
      filename: opts.filename,
      contentType: audioMimeFor(opts.filename),
      data: opts.data,
    },
  ];
  if (opts.language) fields.push({ name: "language", value: opts.language });

  const { body, contentType } = buildMultipartBody(fields);

  let res;
  try {
    res = await requestUrl({
      url: OPENAI_TRANSCRIBE_ENDPOINT,
      method: "POST",
      contentType,
      headers: { Authorization: `Bearer ${opts.apiKey.trim()}` },
      body,
      throw: false,
    });
  } catch {
    throw new ProviderError("Transcription connection failed.", "network");
  }

  if (res.status === 401) {
    throw new ProviderError("Invalid API key.", "invalid-key");
  }
  if (res.status === 429) {
    throw new ProviderError("OpenAI transcription rate limit.", "rate-limit");
  }
  if (res.status < 200 || res.status >= 300) {
    const msg = res.json?.error?.message ?? `HTTP ${res.status}`;
    throw new ProviderError(`OpenAI transcription: ${msg}`, "unknown");
  }

  const text = extractTranscript(res.json, res.text);
  if (!text) {
    throw new ProviderError("Empty transcription response.", "unknown");
  }
  return text;
}

/**
 * Texto do transcript a partir da resposta. `json.text` é o formato padrão;
 * `text` cru cobre response_format=text e hosts compatíveis que não devolvem
 * JSON. Devolve "" quando não há nada aproveitável.
 */
export function extractTranscript(
  json: unknown,
  raw?: string
): string {
  const j = json as { text?: unknown } | undefined;
  if (typeof j?.text === "string" && j.text.trim()) return j.text.trim();
  if (raw && raw.trim() && !raw.trim().startsWith("{")) return raw.trim();
  return "";
}
