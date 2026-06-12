// src/rag/vectorIndex.ts
// Índice vetorial em memória + persistência no vault.
//
// v0.1.80 (RAG v2): vetores agora são TYPED ARRAYS unit-normalizados
// (Float32Array ou Int8Array conforme o perfil de quantização). int8 usa 8× menos
// memória que o `number[]` float64 antigo e acelera o score (typed array, sem
// boxing). Persistência: embeddings viram base64 do buffer num único JSON.
//
// Busca: cosine ≈ dot product (vetores já unit-normalizados). Linear O(n×dim) —
// suficiente até dezenas de milhares de chunks com int8 + dim reduzida.

import { Platform, type App, type DataAdapter } from "obsidian";
import { ensureFolder } from "../components/_shared/chatPersistence";
import type {
  IndexFile,
  SearchResult,
  StoredEntry,
  VectorEntry,
} from "./types";
import {
  base64ToTypedArray,
  quantizeEmbedding,
  scoreVectors,
  typedArrayToBase64,
  type QuantPrecision,
} from "./quant";

// Índices SEPARADOS por plataforma (v0.1.199): o índice do desktop costuma ser
// grande e estourava o WebView do mobile. Agora cada plataforma gera e usa o
// SEU próprio arquivo — desktop nunca toca no índice do mobile e vice-versa.
//   - desktop: embeddings.json        (mantém o nome legado → não força reindex)
//   - mobile:  embeddings.mobile.json
const INDEX_FILENAME_DESKTOP = "embeddings.json";
const INDEX_FILENAME_MOBILE = "embeddings.mobile.json";
/** Nome do arquivo de índice da plataforma ATUAL. */
export function indexFileName(): string {
  return Platform.isMobile ? INDEX_FILENAME_MOBILE : INDEX_FILENAME_DESKTOP;
}
// v2: formato binário (base64 typed arrays) + precision/profile. Índices v1
// (number[] float64) são descartados no load → user reindexa.
const INDEX_VERSION = 2;

// ============================================================
// VectorIndex — fonte de verdade em memória
// ============================================================

export class VectorIndex {
  provider: string;
  model: string;
  dim: number;
  precision: QuantPrecision;
  profile: string;
  entries: VectorEntry[];
  lastIndexedAt: string;

  constructor(opts: {
    provider: string;
    model: string;
    dim: number;
    precision: QuantPrecision;
    profile: string;
    entries?: VectorEntry[];
    lastIndexedAt?: string;
  }) {
    this.provider = opts.provider;
    this.model = opts.model;
    this.dim = opts.dim;
    this.precision = opts.precision;
    this.profile = opts.profile;
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

  /** Remove entries de paths que não estão no `keepSet`. */
  pruneToPaths(keepSet: Set<string>) {
    this.entries = this.entries.filter((e) => keepSet.has(e.path));
  }

  /** Limpa tudo. Usado em "Reindexar do zero". */
  clear() {
    this.entries = [];
    this.lastIndexedAt = "";
  }

  /**
   * Busca top K por cosine similarity. `queryRaw` = embedding CRU da query
   * (number[]) — normalizamos + quantizamos aqui pra casar com o formato do
   * índice (int8/float32). `minScore` (default 0.3) descarta off-topic.
   */
  search(queryRaw: number[], topK = 5, minScore = 0.3): SearchResult[] {
    const q = quantizeEmbedding(queryRaw, this.precision);
    const scored: SearchResult[] = [];
    for (const entry of this.entries) {
      const score = scoreVectors(q, entry.embedding, this.precision);
      if (score >= minScore) scored.push({ entry, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}

// ============================================================
// Persistência — load/save no vault
// ============================================================

/** Caminho do arquivo de índice da plataforma atual (desktop ou mobile). */
export function indexFilePath(indexPath: string): string {
  return `${indexPath}/${indexFileName()}`;
}

/** Lê o índice do disco. Devolve null se não existe, corrompido, ou versão antiga. */
export async function loadIndex(
  adapter: DataAdapter,
  indexPath: string,
  opts?: { maxBytes?: number; onSkip?: (sizeMB: number) => void }
): Promise<VectorIndex | null> {
  const path = indexFilePath(indexPath);
  if (!(await adapter.exists(path))) return null;
  // Guard de memória (v0.1.198): um índice grande estoura o heap do WebView no
  // mobile e DERRUBA o Obsidian no read/JSON.parse — OOM não é um throw
  // capturável pelo try/catch. Acima do teto, pula o load semântico; o RAG cai
  // pro keyword (hybridSearch lida com index null normalmente).
  if (opts?.maxBytes) {
    try {
      const st = await adapter.stat(path);
      if (st && st.size > opts.maxBytes) {
        const mb = st.size / (1024 * 1024);
        console.warn(
          `[axxa/rag] índice ${mb.toFixed(1)}MB > teto ${(opts.maxBytes / (1024 * 1024)).toFixed(0)}MB — pulando load semântico (RAG via keyword).`
        );
        opts.onSkip?.(mb);
        return null;
      }
    } catch {
      /* stat indisponível — segue pro load normal */
    }
  }
  try {
    const raw = await adapter.read(path);
    const parsed = JSON.parse(raw) as IndexFile;
    if (parsed.version !== INDEX_VERSION) {
      console.warn(
        `[axxa/rag] índice versão ${parsed.version} != ${INDEX_VERSION} — descartando (reindexe do zero).`
      );
      return null;
    }
    const precision: QuantPrecision = parsed.precision ?? "float32";
    const entries: VectorEntry[] = parsed.entries.map((s: StoredEntry) => ({
      path: s.path,
      hash: s.hash,
      chunkIndex: s.chunkIndex,
      chunkCount: s.chunkCount,
      text: s.text,
      kind: s.kind,
      embedding: base64ToTypedArray(s.emb, precision),
    }));
    return new VectorIndex({
      provider: parsed.provider,
      model: parsed.model,
      dim: parsed.dim,
      precision,
      profile: parsed.profile ?? "balanced",
      entries,
      lastIndexedAt: parsed.lastIndexedAt,
    });
  } catch (err) {
    console.error("[axxa/rag] falha ao parsear índice:", err);
    return null;
  }
}

/** Salva o índice no disco (embeddings como base64 do typed array). */
export async function saveIndex(
  app: App,
  indexPath: string,
  index: VectorIndex
): Promise<void> {
  await ensureFolder(app.vault.adapter, indexPath);
  const path = indexFilePath(indexPath);
  const entries: StoredEntry[] = index.entries.map((e) => ({
    path: e.path,
    hash: e.hash,
    chunkIndex: e.chunkIndex,
    chunkCount: e.chunkCount,
    text: e.text,
    kind: e.kind,
    emb: typedArrayToBase64(e.embedding),
  }));
  const payload: IndexFile = {
    version: INDEX_VERSION,
    provider: index.provider,
    model: index.model,
    dim: index.dim,
    precision: index.precision,
    profile: index.profile,
    lastIndexedAt: index.lastIndexedAt,
    fileCount: index.fileCount,
    entries,
  };
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
