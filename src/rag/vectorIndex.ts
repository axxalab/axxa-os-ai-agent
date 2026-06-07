// src/rag/vectorIndex.ts
// Índice vetorial em memória + persistência JSON no vault.
//
// Decisão arquitetural: cosine similarity é O(n × dim) por query — no Sprint F
// isso é "suficientemente rápido" pra vaults de até ~10k chunks (typical user).
// LanceDB ou hnswlib viram upgrade quando passar de 50k chunks.
//
// Persistência: 1 arquivo JSON em `<indexPath>/embeddings.json`. Float64
// embeddings = grande mas legível/portável. WAL/compactação não são necessários
// pra MVP (snapshot-on-save).

import type { App, DataAdapter } from "obsidian";
import { ensureFolder } from "../components/_shared/chatPersistence";
import type { IndexFile, SearchResult, VectorEntry } from "./types";

const INDEX_FILENAME = "embeddings.json";
const INDEX_VERSION = 1;

// ============================================================
// Cosine similarity — núcleo do search
// ============================================================

/** Devolve similaridade em [-1, 1]. 1 = vetores idênticos em direção. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ============================================================
// VectorIndex class — fonte de verdade em memória
// ============================================================

export class VectorIndex {
  provider: string;
  model: string;
  dim: number;
  entries: VectorEntry[];
  lastIndexedAt: string;

  constructor(opts: {
    provider: string;
    model: string;
    dim: number;
    entries?: VectorEntry[];
    lastIndexedAt?: string;
  }) {
    this.provider = opts.provider;
    this.model = opts.model;
    this.dim = opts.dim;
    this.entries = opts.entries ?? [];
    this.lastIndexedAt = opts.lastIndexedAt ?? "";
  }

  get size(): number {
    return this.entries.length;
  }

  get fileCount(): number {
    return new Set(this.entries.map((e) => e.path)).size;
  }

  /** Mapa path → último hash conhecido (pra detectar arquivos modificados). */
  hashMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const e of this.entries) {
      if (!map.has(e.path)) map.set(e.path, e.hash);
    }
    return map;
  }

  /** Substitui todos os entries de um path por novos chunks (após re-embed). */
  replaceFile(path: string, newEntries: VectorEntry[]) {
    this.entries = this.entries.filter((e) => e.path !== path);
    this.entries.push(...newEntries);
  }

  /** Remove todos os entries de paths que não estão no `keepSet`. */
  pruneToPaths(keepSet: Set<string>) {
    this.entries = this.entries.filter((e) => keepSet.has(e.path));
  }

  /** Limpa tudo. Usado em "Reindexar do zero". */
  clear() {
    this.entries = [];
    this.lastIndexedAt = "";
  }

  /**
   * Busca top K entries por cosine similarity com o vetor da query.
   * `minScore` (default 0.3) filtra resultados muito ruins — evita
   * injetar contexto irrelevante quando a query é muito off-topic.
   */
  search(queryVec: number[], topK = 5, minScore = 0.3): SearchResult[] {
    const scored: SearchResult[] = [];
    for (const entry of this.entries) {
      const score = cosineSimilarity(queryVec, entry.embedding);
      if (score >= minScore) scored.push({ entry, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}

// ============================================================
// Persistência — load/save no vault
// ============================================================

function indexFilePath(indexPath: string): string {
  return `${indexPath}/${INDEX_FILENAME}`;
}

/** Lê o índice do disco. Devolve null se não existe ou tá corrompido. */
export async function loadIndex(
  adapter: DataAdapter,
  indexPath: string
): Promise<VectorIndex | null> {
  const path = indexFilePath(indexPath);
  if (!(await adapter.exists(path))) return null;
  try {
    const raw = await adapter.read(path);
    const parsed = JSON.parse(raw) as IndexFile;
    if (parsed.version !== INDEX_VERSION) {
      console.warn(
        `[axxa/rag] versão do índice ${parsed.version} != esperado ${INDEX_VERSION} — descartando.`
      );
      return null;
    }
    return new VectorIndex({
      provider: parsed.provider,
      model: parsed.model,
      dim: parsed.dim,
      entries: parsed.entries,
      lastIndexedAt: parsed.lastIndexedAt,
    });
  } catch (err) {
    console.error("[axxa/rag] falha ao parsear índice:", err);
    return null;
  }
}

/** Salva o índice no disco. Cria a pasta se não existe. */
export async function saveIndex(
  app: App,
  indexPath: string,
  index: VectorIndex
): Promise<void> {
  await ensureFolder(app.vault.adapter, indexPath);
  const path = indexFilePath(indexPath);
  const payload: IndexFile = {
    version: INDEX_VERSION,
    provider: index.provider,
    model: index.model,
    dim: index.dim,
    lastIndexedAt: index.lastIndexedAt,
    fileCount: index.fileCount,
    entries: index.entries,
  };
  // JSON pretty=0 — economia de bytes em vault grande
  await app.vault.adapter.write(path, JSON.stringify(payload));
}

/** Deleta o índice do disco (usado em "Limpar índice"). */
export async function deleteIndex(
  adapter: DataAdapter,
  indexPath: string
): Promise<void> {
  const path = indexFilePath(indexPath);
  if (await adapter.exists(path)) {
    await adapter.remove(path);
  }
}
