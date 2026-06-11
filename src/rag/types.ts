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
  /** Descoberto via fetch da API (spec inferida, não curada). v0.1.151 */
  discovered?: boolean;
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

// ============================================================
// Modelos de embedding DESCOBERTOS via fetch da API (v0.1.151)
// Registro mutável: o plugin popula no load + a cada "Buscar da API". Assim
// getEmbeddingSpec/getAllEmbeddingModels enxergam os descobertos em todo lugar
// (indexer, settings, hybrid) sem prop drilling.
// ============================================================
let DISCOVERED_EMBEDDINGS: EmbeddingModelSpec[] = [];

/** Substitui o conjunto de embeddings descobertos (chamado pelo plugin). */
export function registerDiscoveredEmbeddings(specs: EmbeddingModelSpec[]): void {
  DISCOVERED_EMBEDDINGS = specs;
}

/** Curados + descobertos, sem duplicar por model id. */
export function getAllEmbeddingModels(): EmbeddingModelSpec[] {
  const seen = new Set(EMBEDDING_MODELS.map((m) => m.model));
  const extra = DISCOVERED_EMBEDDINGS.filter((m) => !seen.has(m.model));
  return [...EMBEDDING_MODELS, ...extra];
}

/** True se o id parece um modelo de embedding (filtra o fetch). */
export function isEmbeddingModelId(id: string): boolean {
  return /embed/i.test(id);
}

/**
 * Monta um spec pra um modelo de embedding: usa o curado se existir, senão
 * INFERE (dim por heurística de nome, free/imagem/dimensions por padrão). É a
 * info "best-effort" mostrada na UI pros modelos recém-descobertos. v0.1.151
 */
export function inferEmbeddingSpec(
  provider: EmbeddingProvider,
  model: string
): EmbeddingModelSpec {
  const curated = EMBEDDING_MODELS.find((m) => m.model === model);
  if (curated) return curated;

  const id = model.toLowerCase();
  // Dimensão — heurística pelos nomes conhecidos; default 1536.
  let dim = 1536;
  if (id.includes("3-large") || id.includes("gemini-embedding")) dim = 3072;
  else if (id.includes("004")) dim = 768;
  else if (id.includes("nv-embedqa-e5") || id.includes("e5-v5")) dim = 1024;
  else if (id.includes("nemotron-embed") || id.includes("nv-embedqa-1b") || id.includes("-2048")) dim = 2048;
  else if (id.includes("3-small") || id.includes("ada-002")) dim = 1536;

  const supportsImage = /(\bvl\b|vision|multimodal|embed-vl)/.test(id);
  const supportsDimensions =
    id.includes("text-embedding-3") || id.includes("gemini-embedding");
  const free =
    provider === "nim" ||
    (provider === "openrouter" && id.includes(":free")) ||
    id.includes("004");

  return {
    provider,
    model,
    dim,
    maxInputTokens: 8192,
    pricePerMillion: free ? 0 : 0.1, // estimativa — só pra ordem de grandeza
    ...(supportsImage ? { supportsImage: true } : {}),
    ...(supportsDimensions ? { supportsDimensions: true } : {}),
    ...(free ? { free: true } : {}),
    discovered: true,
  };
}

export function getEmbeddingSpec(model: string): EmbeddingModelSpec {
  return (
    getAllEmbeddingModels().find((m) => m.model === model) ?? EMBEDDING_MODELS[0]
  );
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
