// src/rag/embeddings.ts
// Wrapper das APIs de embedding. MVP: só OpenAI text-embedding-3-{small,large}.
// Ollama (nomic-embed-text local) vem em v0.1.26+.

import { requestUrl } from "obsidian";
import { ProviderError } from "../providers/base";

const OPENAI_EMBEDDINGS_ENDPOINT = "https://api.openai.com/v1/embeddings";

interface OpenAIEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
  usage: { prompt_tokens: number; total_tokens: number };
}

/**
 * Embeda um batch de textos. OpenAI aceita até 2048 inputs por request,
 * mas mantemos batches menores (16) pra controlar tamanho e progresso.
 * Devolve embeddings na MESMA ordem dos inputs.
 */
export async function embedBatch(
  texts: string[],
  apiKey: string,
  model = "text-embedding-3-small"
): Promise<number[][]> {
  if (!apiKey || !apiKey.trim()) {
    throw new ProviderError(
      "API key da OpenAI não configurada. Necessária pra embeddings.",
      "no-key"
    );
  }
  if (texts.length === 0) return [];

  let res;
  try {
    res = await requestUrl({
      url: OPENAI_EMBEDDINGS_ENDPOINT,
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: texts,
      }),
      throw: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro de rede.";
    throw new ProviderError(`Falha ao chamar embeddings: ${msg}`, "network");
  }

  if (res.status === 401) {
    throw new ProviderError("API key da OpenAI inválida.", "invalid-key");
  }
  if (res.status === 429) {
    throw new ProviderError(
      "Rate limit excedido nos embeddings. Aguarde e tente de novo.",
      "rate-limit"
    );
  }
  if (res.status >= 400) {
    throw new ProviderError(
      `Embeddings retornou ${res.status}: ${res.text?.slice(0, 200) ?? ""}`,
      "unknown"
    );
  }

  let parsed: OpenAIEmbeddingResponse;
  try {
    parsed = res.json as OpenAIEmbeddingResponse;
  } catch {
    throw new ProviderError("Resposta de embeddings inválida.", "unknown");
  }
  // OpenAI devolve em ordem de `index` — ordenar pra garantir
  return parsed.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
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
        // Parágrafo único maior que maxSize — força quebra
        for (let i = 0; i < p.length; i += maxSize - overlap) {
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
