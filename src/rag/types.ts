// src/rag/types.ts
// Tipos compartilhados do módulo RAG.
//
// Arquitetura:
//   Indexer  → percorre vault, chunka markdown, chama Embeddings, salva VectorIndex
//   Embeddings → wrapper das APIs (OpenAI / Ollama futuramente)
//   VectorIndex → cosine similarity em memória + persistência JSON

export interface VectorEntry {
  /** Path do arquivo .md no vault (relativo). */
  path: string;
  /** SHA-1 hex do conteúdo no momento do embed — usado pra detectar mudança. */
  hash: string;
  /** Índice do chunk dentro do arquivo (arquivos grandes viram N chunks). */
  chunkIndex: number;
  /** Total de chunks do arquivo (pra UX/debug). */
  chunkCount: number;
  /** Texto raw que foi embedado (max ~1500 chars). */
  text: string;
  /** Vetor de embedding. Tamanho = dim do modelo. */
  embedding: number[];
}

/** Formato persistido em disco — versionado pra migração futura. */
export interface IndexFile {
  version: number;
  provider: string;
  model: string;
  dim: number;
  /** ISO string da última indexação completa. */
  lastIndexedAt: string;
  /** Total de arquivos cobertos. */
  fileCount: number;
  entries: VectorEntry[];
}

/** Resultado de uma busca — entry + score de similaridade. */
export interface SearchResult {
  entry: VectorEntry;
  /** Cosine similarity em [-1, 1]. Maior = mais relevante. */
  score: number;
}

/** Provider de embeddings disponíveis. */
export type EmbeddingProvider = "openai";

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
}

export const EMBEDDING_MODELS: EmbeddingModelSpec[] = [
  {
    provider: "openai",
    model: "text-embedding-3-small",
    dim: 1536,
    maxInputTokens: 8191,
    pricePerMillion: 0.02,
  },
  {
    provider: "openai",
    model: "text-embedding-3-large",
    dim: 3072,
    maxInputTokens: 8191,
    pricePerMillion: 0.13,
  },
];

export function getEmbeddingSpec(model: string): EmbeddingModelSpec {
  return EMBEDDING_MODELS.find((m) => m.model === model) ?? EMBEDDING_MODELS[0];
}
