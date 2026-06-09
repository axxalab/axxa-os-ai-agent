// src/rag/types.ts
// Tipos compartilhados do módulo RAG.
//
// Arquitetura:
//   Indexer  → percorre vault, chunka markdown, chama Embeddings, salva VectorIndex
//   Embeddings → wrapper das APIs (OpenAI / Ollama futuramente)
//   VectorIndex → cosine similarity em memória + persistência JSON

export interface VectorEntry {
  /** Path do arquivo no vault (relativo). Pode ser .md ou imagem. */
  path: string;
  /** SHA-1 hex do conteúdo no momento do embed — usado pra detectar mudança. */
  hash: string;
  /** Índice do chunk dentro do arquivo (markdown grande vira N chunks; imagem = 0). */
  chunkIndex: number;
  /** Total de chunks do arquivo (pra UX/debug). Imagem = 1. */
  chunkCount: number;
  /** Texto raw do chunk (pra excerpt na busca). Pra imagem: "Image: filename.ext". */
  text: string;
  /** Vetor em memória — typed array UNIT-NORMALIZADO. Int8Array (×127) quando o
   *  índice usa precisão int8, Float32Array quando float32. Tamanho = dim. */
  embedding: Float32Array | Int8Array;
  /** Tipo do conteúdo. "text" = markdown chunk; "image" = arquivo de imagem inteiro. */
  kind?: "text" | "image";
}

/** Entry como persistido em disco — embedding vira base64 do buffer do typed
 *  array (precisão vem do IndexFile, global do índice). */
export interface StoredEntry {
  path: string;
  hash: string;
  chunkIndex: number;
  chunkCount: number;
  text: string;
  kind?: "text" | "image";
  /** base64 do buffer (Int8Array ou Float32Array conforme IndexFile.precision). */
  emb: string;
}

/** Formato persistido em disco — versionado pra migração futura. */
export interface IndexFile {
  version: number;
  provider: string;
  model: string;
  dim: number;
  /** Precisão dos vetores (int8 / float32) — v0.1.80+ (RAG v2). */
  precision: "float32" | "int8";
  /** Id do perfil de quantização (precision/balanced/light/minimal). */
  profile: string;
  /** ISO string da última indexação completa. */
  lastIndexedAt: string;
  /** Total de arquivos cobertos. */
  fileCount: number;
  entries: StoredEntry[];
}

/** Resultado de uma busca — entry + score de similaridade. */
export interface SearchResult {
  entry: VectorEntry;
  /** Cosine similarity em [-1, 1]. Maior = mais relevante. */
  score: number;
}

/** Provider de embeddings disponíveis. */
export type EmbeddingProvider = "openai" | "openrouter" | "gemini" | "nim";

/** Modelo + dimensão associada. */
export interface EmbeddingModelSpec {
  provider: EmbeddingProvider;
  /** ID do modelo na API (ex: "text-embedding-3-small"). */
  model: string;
  /** Dimensão do vetor produzido. */
  dim: number;
  /** Tokens máx por input (limite da API). */
  maxInputTokens: number;
  /** Custo por 1M tokens (USD) — pra estimativa pré-indexação. */
  pricePerMillion: number;
  /** Suporta embedding de imagens? VL models = true, text models = false. */
  supportsImage?: boolean;
  /** Suporta dim reduzida via param `dimensions` (Matryoshka). OpenAI 3-* = true.
   *  Quando false, perfis "Leve/Mínimo" caem pra int8 com a dim cheia do modelo. */
  supportsDimensions?: boolean;
  /** Indica que é tier free do OpenRouter (rate limits mais apertados). */
  free?: boolean;
}

export const EMBEDDING_MODELS: EmbeddingModelSpec[] = [
  {
    provider: "openai",
    model: "text-embedding-3-small",
    dim: 1536,
    maxInputTokens: 8191,
    pricePerMillion: 0.02,
    supportsDimensions: true,
  },
  {
    provider: "openai",
    model: "text-embedding-3-large",
    dim: 3072,
    maxInputTokens: 8191,
    pricePerMillion: 0.13,
    supportsDimensions: true,
  },
  {
    provider: "openrouter",
    model: "nvidia/llama-nemotron-embed-vl-1b-v2:free",
    dim: 2048,
    maxInputTokens: 131000,
    pricePerMillion: 0,
    supportsImage: true,
    free: true,
  },
  // ── Gemini (endpoint OpenAI-compat /v1beta/openai/embeddings) ──
  {
    provider: "gemini",
    model: "gemini-embedding-001",
    dim: 3072,
    maxInputTokens: 2048,
    pricePerMillion: 0.15,
    supportsDimensions: true,
  },
  {
    provider: "gemini",
    model: "text-embedding-004",
    dim: 768,
    maxInputTokens: 2048,
    pricePerMillion: 0,
    free: true,
  },
  // ── Nvidia NIM (endpoint OpenAI-compat /v1/embeddings; usa input_type) ──
  {
    provider: "nim",
    model: "nvidia/nv-embedqa-e5-v5",
    dim: 1024,
    maxInputTokens: 512,
    pricePerMillion: 0,
    free: true,
  },
  {
    provider: "nim",
    model: "nvidia/llama-3.2-nv-embedqa-1b-v2",
    dim: 2048,
    maxInputTokens: 8192,
    pricePerMillion: 0,
    free: true,
  },
  // ── OpenAI legacy ──
  {
    provider: "openai",
    model: "text-embedding-ada-002",
    dim: 1536,
    maxInputTokens: 8191,
    pricePerMillion: 0.1,
  },
];

export function getEmbeddingSpec(model: string): EmbeddingModelSpec {
  return EMBEDDING_MODELS.find((m) => m.model === model) ?? EMBEDDING_MODELS[0];
}

/** Helper: extensões de imagem suportadas pelos modelos VL. */
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"] as const;

/** Detecta se um path é imagem (case-insensitive). */
export function isImagePath(path: string): boolean {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  return (IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}

/** Mime type pra um path de imagem. Cobre os 5 formatos da lista. */
export function imageMimeFromPath(path: string): string {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}
