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
/** Nome do arquivo de índice (single-file) da plataforma ATUAL. */
export function indexFileName(): string {
  return Platform.isMobile ? INDEX_FILENAME_MOBILE : INDEX_FILENAME_DESKTOP;
}

// ── Modo SHARDED (streamed) — v0.1.200 ─────────────────────
// Em vez de um JSON único (que ocupa o índice INTEIRO na RAM), o índice vira:
//   manifesto (pequeno: metadados + lista de shards) + N arquivos de shard.
// A busca lê um shard por vez, pontua, funde no top-K e descarta → memória
// limitada a UM shard. Por plataforma (desktop/mobile) igual ao single-file.
const SHARDED_VERSION = 2;
/** Máx. de entries por shard (teto secundário; o corte primário é por bytes). */
export const RAG_SHARD_SIZE = 400;
/** Orçamento de bytes por shard (~4MB) — corta o shard antes de crescer demais,
 *  mesmo com trechos de texto longos. Limita o pico de memória da busca (ler+
 *  parsear UM shard fica em ~3× isso no pior caso). */
const SHARD_TARGET_BYTES = 4 * 1024 * 1024;
/** Base do nome (sem extensão) por plataforma — pra derivar manifest/shards. */
function indexBaseName(): string {
  return Platform.isMobile ? "embeddings.mobile" : "embeddings";
}
function manifestFileName(): string {
  return `${indexBaseName()}.manifest.json`;
}
export function manifestFilePath(indexPath: string): string {
  return `${indexPath}/${manifestFileName()}`;
}
function shardFileName(gen: string, i: number): string {
  return `${indexBaseName()}.${gen}.shard${i}.json`;
}

interface ShardManifest {
  version: number;
  sharded: true;
  provider: string;
  model: string;
  dim: number;
  precision: QuantPrecision;
  profile: string;
  lastIndexedAt: string;
  fileCount: number;
  totalEntries: number;
  shardCount: number;
  shardSize: number;
  /** Nomes dos arquivos de shard (relativos ao indexPath). */
  shards: string[];
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

  // ── Modo streamed (sharded) — no LOAD e na BUSCA, entries NÃO ficam na RAM:
  //    ficam nos shards do disco e são lidos sob demanda (um por vez). Nota: a
  //    INDEXAÇÃO/save ainda monta o entries[] completo na RAM (a economia é em
  //    runtime, não na geração). v0.1.200 ──
  streamed = false;
  private _adapter: DataAdapter | null = null;
  private _indexPath = "";
  private _shards: string[] = [];
  private _streamedSize = 0;
  private _streamedFileCount = 0;

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

  /** Configura este índice como streamed (sharded) — sem entries na RAM. */
  setStreamed(adapter: DataAdapter, indexPath: string, manifest: ShardManifest) {
    this.streamed = true;
    this._adapter = adapter;
    this._indexPath = indexPath;
    this._shards = manifest.shards;
    this._streamedSize = manifest.totalEntries;
    this._streamedFileCount = manifest.fileCount;
  }

  get size(): number {
    return this.streamed ? this._streamedSize : this.entries.length;
  }

  get fileCount(): number {
    if (this.streamed) return this._streamedFileCount;
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

  /**
   * Busca STREAMED (modo sharded): lê um shard por vez do disco, pontua, funde
   * no top-K e DESCARTA o shard → pico de memória = um shard, não o índice
   * inteiro. Mesmos resultados da busca in-memory (recall 100% — varre tudo).
   * v0.1.200
   */
  async searchStreamed(
    queryRaw: number[],
    topK = 5,
    minScore = 0.3
  ): Promise<SearchResult[]> {
    if (!this._adapter) return [];
    const q = quantizeEmbedding(queryRaw, this.precision);
    let top: SearchResult[] = [];
    for (const shardName of this._shards) {
      let parsed: { entries: StoredEntry[] };
      try {
        const raw = await this._adapter.read(`${this._indexPath}/${shardName}`);
        parsed = JSON.parse(raw) as { entries: StoredEntry[] };
      } catch (err) {
        // Shard ausente/corrompido — pula (não derruba a busca), mas AVISA:
        // os resultados ficam incompletos. (loadIndex já valida no load, mas
        // um shard pode sumir entre o load e a busca.)
        console.warn(`[axxa/rag] shard ilegível, pulando: ${shardName}`, err);
        continue;
      }
      for (const s of parsed.entries) {
        let embedding: Float32Array | Int8Array;
        try {
          embedding = base64ToTypedArray(s.emb, this.precision);
        } catch {
          continue; // entry corrompida — pula em vez de derrubar a busca. v0.1.227
        }
        // Dim divergente da query (corrupção/mistura de modelos) → ignora.
        if (embedding.length !== q.length) continue;
        const score = scoreVectors(q, embedding, this.precision);
        if (score >= minScore) {
          top.push({
            entry: {
              path: s.path,
              hash: s.hash,
              chunkIndex: s.chunkIndex,
              chunkCount: s.chunkCount,
              text: s.text,
              kind: s.kind,
              embedding,
            },
            score,
          });
        }
      }
      // Mantém só o top-K após cada shard → memória limitada (descarta o resto).
      if (top.length > topK) {
        top.sort((a, b) => b.score - a.score);
        top = top.slice(0, topK);
      }
    }
    top.sort((a, b) => b.score - a.score);
    return top.slice(0, topK);
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
  // Modo SHARDED (v0.1.200): se há manifesto, carrega SÓ os metadados — os
  // vetores ficam nos shards do disco e são lidos sob demanda na busca. Sem
  // materializar o índice na RAM → sem OOM, independente do tamanho.
  const manifestPath = manifestFilePath(indexPath);
  if (await adapter.exists(manifestPath)) {
    try {
      const manifest = JSON.parse(
        await adapter.read(manifestPath)
      ) as ShardManifest;
      // Valida que TODOS os shards do manifesto existem — pega um índice
      // incompleto (ex: save interrompido) no LOAD em vez de degradar calado
      // na busca. Faltando algum → null (cai pro keyword; user reindexa).
      // v0.1.228: exists() em PARALELO (Promise.all) — load O(1) round em vez
      // de N awaits sequenciais; mesma semântica (faltando algum → null).
      const shardNames = manifest.shards ?? [];
      const present = await Promise.all(
        shardNames.map((s) => adapter.exists(`${indexPath}/${s}`))
      );
      const missingIdx = present.findIndex((ok) => !ok);
      if (missingIdx !== -1) {
        console.warn(
          `[axxa/rag] índice sharded incompleto — shard ausente: ${shardNames[missingIdx]}. Reindexe.`
        );
        return null;
      }
      const idx = new VectorIndex({
        provider: manifest.provider,
        model: manifest.model,
        dim: manifest.dim,
        precision: manifest.precision,
        profile: manifest.profile,
        lastIndexedAt: manifest.lastIndexedAt,
      });
      idx.setStreamed(adapter, indexPath, manifest);
      return idx;
    } catch (err) {
      console.error("[axxa/rag] manifesto sharded inválido:", err);
      return null;
    }
  }

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
function toStored(e: VectorEntry): StoredEntry {
  return {
    path: e.path,
    hash: e.hash,
    chunkIndex: e.chunkIndex,
    chunkCount: e.chunkCount,
    text: e.text,
    kind: e.kind,
    emb: typedArrayToBase64(e.embedding),
  };
}

/**
 * Salva o índice. `opts.shardSize > 0` → modo SHARDED (manifesto + N shards;
 * cada write é pequeno → não estoura o WebView no mobile, e a busca depois
 * streama). Sem shardSize → single-file (comportamento legado). v0.1.200
 */
export async function saveIndex(
  app: App,
  indexPath: string,
  index: VectorIndex,
  opts?: { shardSize?: number }
): Promise<void> {
  const adapter = app.vault.adapter;
  await ensureFolder(adapter, indexPath);
  const shardSize = opts?.shardSize ?? 0;

  if (shardSize > 0) {
    // Lê os shards do índice ANTERIOR pra limpar DEPOIS do commit (não antes —
    // assim um crash no meio do save NÃO destrói o índice válido que já existe).
    const manifestPath = manifestFilePath(indexPath);
    let oldShards: string[] = [];
    try {
      if (await adapter.exists(manifestPath)) {
        oldShards =
          (JSON.parse(await adapter.read(manifestPath)) as ShardManifest)
            .shards ?? [];
      }
    } catch {
      /* manifesto velho corrompido — segue */
    }

    // Nomes ÚNICOS por save (gen) → nunca sobrescrevem shards antigos in-place
    // (evita corromper o índice válido se crashar no meio). v0.1.200
    // v0.1.228: gen via randomUUID (sem colisão) em vez de Date.now()+Math.random().
    const gen = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const shards: string[] = [];
    let cur: StoredEntry[] = [];
    let curBytes = 0;
    const flush = async () => {
      if (cur.length === 0) return;
      const name = shardFileName(gen, shards.length);
      await adapter.write(
        `${indexPath}/${name}`,
        JSON.stringify({ entries: cur })
      );
      shards.push(name);
      cur = [];
      curBytes = 0;
    };
    // Shard por ORÇAMENTO DE BYTES (não só por contagem): garante que cada
    // shard seja pequeno mesmo com trechos de texto longos → o pico de memória
    // da busca (ler+parsear UM shard) fica limitado. v0.1.200
    for (const e of index.entries) {
      const s = toStored(e);
      // v0.1.228: estimativa com folga p/ overhead de JSON (escapes do texto,
      // chaves, aspas) — text*1.3 + path + 160. Antes (emb+text+96) subestimava
      // → shards reais maiores que o alvo. Estimar a MAIS corta o shard mais
      // cedo, mantendo o pico de memória da busca dentro do orçamento.
      const sz = s.emb.length + Math.ceil(s.text.length * 1.3) + s.path.length + 160; // bytes aprox do entry
      if (
        cur.length > 0 &&
        (curBytes + sz > SHARD_TARGET_BYTES || cur.length >= shardSize)
      ) {
        await flush();
      }
      cur.push(s);
      curBytes += sz;
    }
    await flush();

    const manifest: ShardManifest = {
      version: SHARDED_VERSION,
      sharded: true,
      provider: index.provider,
      model: index.model,
      dim: index.dim,
      precision: index.precision,
      profile: index.profile,
      lastIndexedAt: index.lastIndexedAt,
      fileCount: index.fileCount,
      totalEntries: index.entries.length,
      shardCount: shards.length,
      shardSize,
      shards,
    };
    // COMMIT: escrever o manifesto (1 arquivo) valida o índice novo de forma
    // atômica — antes disso, o índice antigo ainda é o válido.
    await adapter.write(manifestPath, JSON.stringify(manifest));

    // Cleanup PÓS-commit: remove shards antigos (não reaproveitados) + o
    // single-file. Preciso (só toca arquivos do manifesto antigo, da plataforma
    // atual) → não mexe no índice da outra plataforma.
    const keep = new Set(shards);
    for (const old of oldShards) {
      if (keep.has(old)) continue;
      const p = `${indexPath}/${old}`;
      try {
        if (await adapter.exists(p)) await adapter.remove(p);
      } catch {
        /* segue */
      }
    }
    const single = indexFilePath(indexPath);
    try {
      if (await adapter.exists(single)) await adapter.remove(single);
    } catch {
      /* segue */
    }
    return;
  }

  // Single-file (legado). Limpa shards antigos se trocou de modo.
  await removeShardedFiles(adapter, indexPath);
  const payload: IndexFile = {
    version: INDEX_VERSION,
    provider: index.provider,
    model: index.model,
    dim: index.dim,
    precision: index.precision,
    profile: index.profile,
    lastIndexedAt: index.lastIndexedAt,
    fileCount: index.fileCount,
    entries: index.entries.map(toStored),
  };
  await adapter.write(indexFilePath(indexPath), JSON.stringify(payload));
}

/** Remove o manifesto + todos os shards (se existirem). */
async function removeShardedFiles(
  adapter: DataAdapter,
  indexPath: string
): Promise<void> {
  const manifestPath = manifestFilePath(indexPath);
  if (!(await adapter.exists(manifestPath))) return;
  try {
    const manifest = JSON.parse(await adapter.read(manifestPath)) as ShardManifest;
    for (const s of manifest.shards ?? []) {
      const p = `${indexPath}/${s}`;
      if (await adapter.exists(p)) await adapter.remove(p);
    }
  } catch {
    /* manifesto corrompido — segue removendo o que der */
  }
  if (await adapter.exists(manifestPath)) await adapter.remove(manifestPath);
}

/** Deleta o índice do disco (single-file E sharded). Usado em "Limpar índice". */
export async function deleteIndex(
  adapter: DataAdapter,
  indexPath: string
): Promise<void> {
  const path = indexFilePath(indexPath);
  if (await adapter.exists(path)) {
    await adapter.remove(path);
  }
  await removeShardedFiles(adapter, indexPath);
}
