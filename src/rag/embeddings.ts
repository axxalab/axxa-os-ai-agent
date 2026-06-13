// src/rag/embeddings.ts
// Wrapper das APIs de embedding.
//
// Providers suportados:
//   - openai: text-embedding-3-{small,large} — texto only
//   - openrouter: nvidia/llama-nemotron-embed-vl-1b-v2:free — TEXTO + IMAGEM (free)
//
// Router `embedItems()` despacha pra função correta com base em getEmbeddingSpec().
// Embedding de áudio NÃO é suportado por nenhum desses (modelos VL, não VLA) —
// pra áudio precisaria pipeline Whisper → texto → embed.

import { requestUrl } from "obsidian";
import { ProviderError } from "../providers/base";
import { getEmbeddingSpec } from "./types";

const OPENAI_EMBEDDINGS_ENDPOINT = "https://api.openai.com/v1/embeddings";
const OPENROUTER_EMBEDDINGS_ENDPOINT =
  "https://openrouter.ai/api/v1/embeddings";
const GEMINI_EMBEDDINGS_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai/embeddings";
const NIM_EMBEDDINGS_ENDPOINT = "https://integrate.api.nvidia.com/v1/embeddings";

interface OpenAIEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
  usage: { prompt_tokens: number; total_tokens: number };
}

/** Teto de tempo (ms) por request de embedding — `requestUrl` do Obsidian não
 *  tem timeout próprio, então uma chamada pendurada travaria a UI de
 *  indexação indefinidamente. v0.1.228 */
const EMBED_REQUEST_TIMEOUT_MS = 60_000;

/**
 * Corre `promise` contra um timeout. Se estourar, rejeita com ProviderError
 * ('network') pra cair no mesmo tratamento de erro de rede dos callers. v0.1.228
 */
function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new ProviderError(
          `Timeout (${EMBED_REQUEST_TIMEOUT_MS / 1000}s) ao chamar embeddings ${label}.`,
          "network"
        )
      );
    }, EMBED_REQUEST_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ============================================================
// EmbedInput — input unificado: texto ou imagem (data URL)
// ============================================================

/** Input pra embedding — texto puro OU imagem (como data URL base64). */
export type EmbedInput =
  | { kind: "text"; text: string }
  | { kind: "image"; dataUrl: string; alt?: string };

/** API keys necessárias (passamos juntas pra rota escolher). */
export interface EmbedCredentials {
  openaiApiKey: string;
  openrouterApiKey: string;
  geminiApiKey?: string;
  nimApiKey?: string;
}

/**
 * Converte ArrayBuffer de imagem em data URL base64 (`data:image/png;base64,...`).
 * Usado pelo indexer pra mandar imagem binária via JSON.
 */
export function arrayBufferToDataUrl(
  buffer: ArrayBuffer,
  mimeType: string
): string {
  // btoa não aceita string com bytes >127 direto — convertemos pelo Uint8Array.
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000; // 32K — evita stack overflow com strings gigantes
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    // apply aceita array-like — Uint8Array funciona direto, sem cópia
    // intermediária via Array.from por chunk. v0.1.228
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  const b64 = btoa(binary);
  return `data:${mimeType};base64,${b64}`;
}

/**
 * Embeda um batch de textos. OpenAI aceita até 2048 inputs por request,
 * mas mantemos batches menores (16) pra controlar tamanho e progresso.
 * Devolve embeddings na MESMA ordem dos inputs.
 */
/**
 * Embeda textos num endpoint OpenAI-compatible (/embeddings). Reusado por
 * OpenAI, Gemini (/v1beta/openai/) e NIM (integrate.api.nvidia.com).
 * `extraBody` injeta params específicos (ex: NIM exige `input_type`).
 */
async function embedOpenAICompat(
  texts: string[],
  apiKey: string,
  model: string,
  endpoint: string,
  label: string,
  opts?: { dimensions?: number; extraBody?: Record<string, unknown> }
): Promise<number[][]> {
  if (!apiKey || !apiKey.trim()) {
    throw new ProviderError(
      `API key ${label} não configurada. Necessária pra embeddings.`,
      "no-key"
    );
  }
  if (texts.length === 0) return [];

  let res;
  try {
    res = await withTimeout(
      requestUrl({
        url: endpoint,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        // `dimensions` (Matryoshka) só em modelos que suportam (OpenAI 3-*, Gemini).
        body: JSON.stringify({
          model,
          input: texts,
          ...(opts?.dimensions && opts.dimensions > 0
            ? { dimensions: opts.dimensions }
            : {}),
          ...(opts?.extraBody ?? {}),
        }),
        throw: false,
      }),
      label
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro de rede.";
    throw new ProviderError(
      `Falha ao chamar embeddings ${label}: ${msg}`,
      "network"
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new ProviderError(`API key ${label} inválida.`, "invalid-key");
  }
  if (res.status === 429) {
    throw new ProviderError(
      "Rate limit excedido nos embeddings. Aguarde e tente de novo.",
      "rate-limit"
    );
  }
  if (res.status >= 400) {
    throw new ProviderError(
      `Embeddings ${label} retornou ${res.status}: ${res.text?.slice(0, 200) ?? ""}`,
      "unknown"
    );
  }

  // `requestUrl` já parseou o corpo em `res.json` — um try/catch aqui não
  // pegaria nada. Validamos a forma explicitamente (data como array). v0.1.228
  const parsed = res.json as OpenAIEmbeddingResponse | undefined;
  if (!parsed || !Array.isArray(parsed.data)) {
    throw new ProviderError(
      `Resposta de embeddings ${label} sem campo data.`,
      "unknown"
    );
  }
  // Reconstrói POR index (não confia em sort+map sequencial): se a API
  // omitir/rejeitar um item, isso desalinharia os vetores dos chunks e
  // corromperia o índice silenciosamente. v0.1.227
  const out: number[][] = new Array(texts.length);
  for (const d of parsed.data ?? []) {
    if (d && d.index >= 0 && d.index < out.length && Array.isArray(d.embedding)) {
      out[d.index] = d.embedding;
    }
  }
  for (let i = 0; i < out.length; i++) {
    if (!Array.isArray(out[i]) || out[i].length === 0) {
      throw new ProviderError(
        `Embeddings ${label}: a API devolveu ${parsed.data?.length ?? 0} vetores pra ${texts.length} inputs (faltou o índice ${i}).`,
        "unknown"
      );
    }
  }
  return out;
}

/** OpenAI text-embedding-3-* / ada-002 (batch nativo). */
export async function embedBatch(
  texts: string[],
  apiKey: string,
  model = "text-embedding-3-small",
  dimensions?: number
): Promise<number[][]> {
  return embedOpenAICompat(
    texts,
    apiKey,
    model,
    OPENAI_EMBEDDINGS_ENDPOINT,
    "OpenAI",
    { dimensions }
  );
}

/** Embeda 1 texto (helper). */
export async function embedText(
  text: string,
  apiKey: string,
  model?: string
): Promise<number[]> {
  const [vec] = await embedBatch([text], apiKey, model);
  return vec;
}

// ============================================================
// OpenRouter (Nemotron VL) — multimodal: texto + imagem
// ============================================================
// API é OpenAI-compatible mas aceita também o formato multimodal:
//   { input: [{ type: "text"|"image_url", ... }] } ou { input: "text simples" }
// Nemotron VL devolve embeddings com dim=2048.

interface OpenRouterEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
  usage?: { prompt_tokens?: number; total_tokens?: number };
}

/**
 * Constrói o body do OpenRouter pra UM input (texto ou imagem).
 *
 * v0.1.29 fix: Nemotron VL espera content-array MESMO pra texto.
 * Antes mandávamos string simples e devolvia `data: []`. Agora:
 *   - Texto: [{type:"text", text:"..."}]
 *   - Imagem: [{type:"image_url", image_url:{url:"data:..."}}]
 */
function buildOpenRouterInput(item: EmbedInput): unknown {
  if (item.kind === "text") {
    return [{ type: "text", text: item.text }];
  }
  return [{ type: "image_url", image_url: { url: item.dataUrl } }];
}

/** Pausa em ms — usado pra backoff entre retries de rate limit. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Embeda um batch via OpenRouter (Nemotron VL multimodal).
 * 1 request por item (Nemotron VL não tem batching nativo em embeddings).
 *
 * Retries: 1 tentativa extra após 3s se receber 429 (rate limit do free tier).
 */
export async function embedBatchOpenRouter(
  items: EmbedInput[],
  apiKey: string,
  model: string
): Promise<number[][]> {
  if (!apiKey || !apiKey.trim()) {
    throw new ProviderError(
      "API key do OpenRouter não configurada. Necessária pra embeddings VL (multimodal).",
      "no-key"
    );
  }
  if (items.length === 0) return [];

  const results: number[][] = [];
  for (const item of items) {
    const body = {
      model,
      input: buildOpenRouterInput(item),
    };
    let res;
    let attempt = 0;
    const MAX_ATTEMPTS = 4;
    while (true) {
      attempt++;
      try {
        res = await withTimeout(
          requestUrl({
            url: OPENROUTER_EMBEDDINGS_ENDPOINT,
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://axxa.lab",
              "X-Title": "AXXA OS",
            },
            body: JSON.stringify(body),
            throw: false,
          }),
          "OpenRouter"
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro de rede.";
        throw new ProviderError(
          `Falha ao chamar OpenRouter embeddings: ${msg}`,
          "network"
        );
      }
      // Retry pra transitórios: 429 (rate limit) e 5xx (erro de servidor).
      // Backoff exponencial (1s, 2s, 4s) + jitter pra não martelar em fase. v0.1.228
      const transient = res.status === 429 || res.status >= 500;
      if (transient && attempt < MAX_ATTEMPTS) {
        const backoff = 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
        console.warn(
          `[axxa/rag] OpenRouter ${res.status} — esperando ${backoff}ms antes do retry ${attempt + 1}/${MAX_ATTEMPTS}`
        );
        await sleep(backoff);
        continue;
      }
      break;
    }

    if (res.status === 401) {
      throw new ProviderError("API key do OpenRouter inválida.", "invalid-key");
    }
    if (res.status === 429) {
      throw new ProviderError(
        "Rate limit do OpenRouter persistiu após retry. Aguarde 1 min e tente de novo.",
        "rate-limit"
      );
    }
    if (res.status >= 400) {
      // Log COMPLETO no console pra debug (resposta + body enviado)
      console.error(
        `[axxa/rag] OpenRouter ${res.status} — body enviado:`,
        JSON.stringify(body).slice(0, 400)
      );
      console.error(
        `[axxa/rag] OpenRouter ${res.status} — resposta:`,
        res.text?.slice(0, 500)
      );
      throw new ProviderError(
        `OpenRouter embeddings retornou ${res.status}. Veja console.`,
        "unknown"
      );
    }

    // `requestUrl` já parseou o corpo — try/catch em res.json não pegaria
    // nada. Validamos a forma explicitamente. v0.1.228
    const parsed = res.json as OpenRouterEmbeddingResponse | undefined;
    if (!parsed || !Array.isArray(parsed.data) || parsed.data.length === 0) {
      // CASO DO BUG ORIGINAL — vamos logar tudo pra inspeção
      console.error(
        "[axxa/rag] Nemotron devolveu data vazio. Modelo:",
        model
      );
      console.error(
        "[axxa/rag] Body enviado:",
        JSON.stringify(body).slice(0, 400)
      );
      console.error(
        "[axxa/rag] Resposta inteira:",
        res.text?.slice(0, 800)
      );
      throw new ProviderError(
        `Nemotron devolveu data vazio. Possíveis causas: (1) payload incompatível, ` +
          `(2) rate limit silencioso, (3) modelo offline. Veja console.`,
        "unknown"
      );
    }
    const emb = parsed.data[0]?.embedding;
    if (!Array.isArray(emb) || emb.length === 0) {
      throw new ProviderError(
        "Nemotron devolveu data sem embedding (item vazio/inválido).",
        "unknown"
      );
    }
    results.push(emb);
  }
  return results;
}

// ============================================================
// Router unificado: embedItems
// ============================================================
// Escolhe a função correta com base no spec do modelo:
//   - openai → embedBatch (texto only, batch nativo)
//   - openrouter → embedBatchOpenRouter (multimodal, 1 request por item)
//
// Se o modelo NÃO suporta imagem mas o batch tem imagem, dá erro claro.

/** Embeda items (texto e/ou imagem) usando o provider do modelo. */
export async function embedItems(
  items: EmbedInput[],
  creds: EmbedCredentials,
  model: string,
  dimensions?: number
): Promise<number[][]> {
  const spec = getEmbeddingSpec(model);
  const hasImage = items.some((i) => i.kind === "image");

  if (hasImage && !spec.supportsImage) {
    throw new ProviderError(
      `O modelo ${model} não suporta embeddings de imagem. Use nvidia/llama-nemotron-embed-vl-1b-v2:free (OpenRouter, free) pra multimodal.`,
      "unknown"
    );
  }

  if (spec.provider === "openrouter") {
    // OpenRouter (Nemotron VL) não suporta `dimensions` — ignora.
    return embedBatchOpenRouter(items, creds.openrouterApiKey, model);
  }
  // Só o path do OpenRouter sabe embedar imagem. Um spec DESCOBERTO pode marcar
  // supportsImage=true por heurística de nome (ex: "...-vl...") em outro provider
  // e passar o guard acima — aqui a imagem viraria string vazia. Falha explícito
  // em vez de embedar texto vazio e corromper o índice. v0.1.228
  if (hasImage) {
    throw new ProviderError(
      `Embedding de imagem só é suportado via OpenRouter (Nemotron VL). O modelo ${model} (${spec.provider}) não embeda imagem.`,
      "unknown"
    );
  }
  // Texto puro pros endpoints OpenAI-compat (OpenAI / Gemini / NIM)
  const texts = items.map((i) => (i.kind === "text" ? i.text : ""));
  if (spec.provider === "gemini") {
    return embedOpenAICompat(
      texts,
      creds.geminiApiKey ?? "",
      model,
      GEMINI_EMBEDDINGS_ENDPOINT,
      "Gemini",
      { dimensions: spec.supportsDimensions ? dimensions : undefined }
    );
  }
  if (spec.provider === "nim") {
    // Modelos QA do NIM exigem input_type; "passage" pra indexar/buscar.
    return embedOpenAICompat(
      texts,
      creds.nimApiKey ?? "",
      model,
      NIM_EMBEDDINGS_ENDPOINT,
      "NIM",
      { extraBody: { input_type: "passage" } }
    );
  }
  // OpenAI path — `dimensions` aplica aqui (Matryoshka).
  return embedBatch(texts, creds.openaiApiKey, model, dimensions);
}

/** Helper: embeda 1 texto usando o provider do modelo. `dimensions` opcional
 *  pra casar com a dim do índice (busca). */
export async function embedQuery(
  text: string,
  creds: EmbedCredentials,
  model: string,
  dimensions?: number
): Promise<number[]> {
  const [vec] = await embedItems(
    [{ kind: "text", text }],
    creds,
    model,
    dimensions
  );
  return vec;
}

/**
 * Chunking simples baseado em parágrafos. Quebra o texto em blocos de
 * ~maxSize chars respeitando `\n\n` como boundary. Sobrepõe `overlap`
 * chars entre chunks consecutivos pra preservar contexto.
 *
 * Pra MVP isso é "suficientemente bom" — chunking semântico avançado
 * (por heading H2/H3) vem em v0.2.x.
 */
export function chunkText(
  text: string,
  maxSize = 1500,
  overlap = 200
): string[] {
  const cleaned = text.trim();
  if (cleaned.length <= maxSize) return cleaned.length > 0 ? [cleaned] : [];

  const paragraphs = cleaned.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const p of paragraphs) {
    if (!p.trim()) continue;
    if ((current + "\n\n" + p).length > maxSize) {
      if (current.length > 0) {
        chunks.push(current.trim());
        // Inicia o próximo chunk com overlap do final do anterior
        const tail = current.slice(-overlap);
        current = tail + "\n\n" + p;
      } else {
        // Parágrafo único maior que maxSize — força quebra.
        // Passo mínimo de 1 pra não travar em loop se overlap >= maxSize. v0.1.228
        const step = Math.max(1, maxSize - overlap);
        for (let i = 0; i < p.length; i += step) {
          chunks.push(p.slice(i, i + maxSize));
        }
        current = "";
      }
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Um chunk + o "breadcrumb" de headings da seção onde ele vive. */
export interface MarkdownChunk {
  text: string;
  /** Ex: "Arquitetura > RAG > Quantização". "" quando fora de qualquer heading. */
  breadcrumb: string;
}

/**
 * Chunking ESTRUTURAL: quebra o markdown por seções de heading (#..######),
 * preservando o breadcrumb hierárquico, e sub-quebra seções grandes via
 * chunkText. Melhora a relevância — cada chunk carrega o contexto da seção
 * (o breadcrumb entra no texto embedado). Sem headings, cai no chunkText puro.
 */
export function chunkMarkdown(
  content: string,
  maxSize = 1500,
  overlap = 200
): MarkdownChunk[] {
  const lines = content.split("\n");
  const sections: { breadcrumb: string; body: string }[] = [];
  const stack: { level: number; title: string }[] = [];
  let body: string[] = [];

  const flush = () => {
    const text = body.join("\n");
    if (text.trim()) {
      sections.push({
        breadcrumb: stack.map((h) => h.title).join(" > "),
        body: text,
      });
    }
    body = [];
  };

  for (const line of lines) {
    // Heading ATX: "## Título" (ignora trailing #). Evita falso-positivo em
    // linhas tipo "#tag" (exige espaço após os #).
    const m = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
    if (m) {
      flush();
      const level = m[1].length;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, title: m[2].trim() });
      body.push(line);
    } else {
      body.push(line);
    }
  }
  flush();

  const out: MarkdownChunk[] = [];
  for (const sec of sections) {
    for (const piece of chunkText(sec.body, maxSize, overlap)) {
      out.push({ text: piece, breadcrumb: sec.breadcrumb });
    }
  }
  // Nota sem headings → chunkText puro
  if (out.length === 0) {
    return chunkText(content, maxSize, overlap).map((t) => ({
      text: t,
      breadcrumb: "",
    }));
  }
  return out;
}

/** Hash SHA-1 hex de uma string. Usado pra detectar arquivo modificado. */
export async function sha1Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Estimativa rude de tokens (1 token ≈ 4 chars no inglês, 3-3.5 em PT-BR). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
