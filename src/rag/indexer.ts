// src/rag/indexer.ts
// Orquestra a indexação RAG:
//   1. Walks vault (skip pastas internas do AXXA)
//   2. Pra cada .md: hash → compara com índice → re-embedda se mudou
//   3. Chunking + batch embedding (16 por API call) com progress callback
//   4. Persiste a cada batch (durável contra crash)
//
// Cancelamento: aceita AbortSignal — checa antes/depois de cada batch.

import type { App, TFile } from "obsidian";
import {
  chunkText,
  embedBatch,
  estimateTokens,
  sha1Hex,
} from "./embeddings";
import { saveIndex, VectorIndex } from "./vectorIndex";
import { getEmbeddingSpec, type VectorEntry } from "./types";

export interface IndexProgress {
  /** "scanning" → percorrendo vault | "embedding" → embedando chunks | "done" */
  phase: "scanning" | "embedding" | "done";
  filesScanned: number;
  filesTotal: number;
  /** Quantos arquivos vão ser efetivamente re-embedados (diff vs índice). */
  filesToEmbed: number;
  filesEmbedded: number;
  chunksEmbedded: number;
  /** Estimativa rude de tokens consumidos. */
  tokensUsed: number;
  /** Caminho do arquivo atual sendo processado (opcional, pra UI). */
  currentFile?: string;
}

export interface IndexerOptions {
  app: App;
  apiKey: string;
  model: string;
  indexPath: string;
  /** Pastas a IGNORAR (paths absolutos no vault). Sempre inclui o indexPath. */
  excludePaths: string[];
  /** Callback chamado a cada update de progresso. */
  onProgress?: (p: IndexProgress) => void;
  /** Sinal pra cancelar a indexação. */
  signal?: AbortSignal;
}

const BATCH_SIZE = 16;
const CHUNK_MAX_CHARS = 1500;
const CHUNK_OVERLAP = 200;

/**
 * Indexa o vault. Reutiliza entries existentes pra arquivos NÃO modificados
 * (incremental). Devolve o índice atualizado.
 *
 * Se o índice prévio usar um modelo/dim diferente, ignora e indexa do zero.
 */
export async function indexVault(
  prev: VectorIndex | null,
  opts: IndexerOptions
): Promise<VectorIndex> {
  const { app, apiKey, model, indexPath, excludePaths, onProgress, signal } = opts;
  const spec = getEmbeddingSpec(model);

  // Se modelo mudou desde o índice anterior, começa do zero
  const startFresh = !prev || prev.model !== model || prev.dim !== spec.dim;
  const index = startFresh
    ? new VectorIndex({
        provider: spec.provider,
        model: spec.model,
        dim: spec.dim,
      })
    : prev;

  const prevHashes = startFresh ? new Map<string, string>() : prev.hashMap();

  // Walk vault — só .md, exclui pastas internas
  const allFiles = app.vault.getMarkdownFiles();
  const includedFiles = allFiles.filter((f) => {
    const path = f.path;
    return !excludePaths.some((ex) => {
      const exNorm = ex.endsWith("/") ? ex : ex + "/";
      return path === ex || path.startsWith(exNorm);
    });
  });

  const filesTotal = includedFiles.length;
  // Conjunto pra detectar deletions: paths que continuam no vault
  const stillPresent = new Set(includedFiles.map((f) => f.path));

  // Remove entries de arquivos deletados (mesmo que não reindexamos)
  index.pruneToPaths(stillPresent);

  // ============================================================
  // Phase 1: Scan — descobre quais arquivos precisam re-embed
  // ============================================================
  const toEmbed: { file: TFile; content: string; hash: string }[] = [];
  let filesScanned = 0;

  for (const file of includedFiles) {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
    filesScanned++;
    let content: string;
    try {
      content = await app.vault.cachedRead(file);
    } catch {
      continue;
    }
    if (!content.trim()) continue;
    const hash = await sha1Hex(content);
    if (prevHashes.get(file.path) !== hash) {
      toEmbed.push({ file, content, hash });
    }
    onProgress?.({
      phase: "scanning",
      filesScanned,
      filesTotal,
      filesToEmbed: toEmbed.length,
      filesEmbedded: 0,
      chunksEmbedded: 0,
      tokensUsed: 0,
      currentFile: file.path,
    });
  }

  if (toEmbed.length === 0) {
    index.lastIndexedAt = new Date().toISOString();
    await saveIndex(app, indexPath, index);
    onProgress?.({
      phase: "done",
      filesScanned: filesTotal,
      filesTotal,
      filesToEmbed: 0,
      filesEmbedded: 0,
      chunksEmbedded: 0,
      tokensUsed: 0,
    });
    return index;
  }

  // ============================================================
  // Phase 2: Embed — batches de 16 chunks
  // ============================================================
  let filesEmbedded = 0;
  let chunksEmbedded = 0;
  let tokensUsed = 0;

  // Buffer de chunks pendentes a embedar — agrupa de múltiplos arquivos
  type PendingChunk = {
    text: string;
    file: TFile;
    chunkIndex: number;
    chunkCount: number;
    hash: string;
  };
  let pending: PendingChunk[] = [];

  // Pra cada arquivo modificado, chunkifica e empilha
  for (const { file, content, hash } of toEmbed) {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
    const chunks = chunkText(content, CHUNK_MAX_CHARS, CHUNK_OVERLAP);
    for (let i = 0; i < chunks.length; i++) {
      pending.push({
        text: chunks[i],
        file,
        chunkIndex: i,
        chunkCount: chunks.length,
        hash,
      });
    }

    // Quando o buffer alcança BATCH_SIZE, embeda
    while (pending.length >= BATCH_SIZE) {
      const batch = pending.splice(0, BATCH_SIZE);
      await embedAndStore(batch);
    }
    filesEmbedded++;
    onProgress?.({
      phase: "embedding",
      filesScanned: filesTotal,
      filesTotal,
      filesToEmbed: toEmbed.length,
      filesEmbedded,
      chunksEmbedded,
      tokensUsed,
      currentFile: file.path,
    });
  }

  // Flush do que sobrou
  if (pending.length > 0) {
    await embedAndStore(pending);
    pending = [];
  }

  index.lastIndexedAt = new Date().toISOString();
  await saveIndex(app, indexPath, index);

  onProgress?.({
    phase: "done",
    filesScanned: filesTotal,
    filesTotal,
    filesToEmbed: toEmbed.length,
    filesEmbedded,
    chunksEmbedded,
    tokensUsed,
  });

  return index;

  // ============================================================
  // Helper local: embeda um batch e adiciona ao índice
  // ============================================================
  async function embedAndStore(batch: PendingChunk[]) {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
    const texts = batch.map((p) => p.text);
    const embeddings = await embedBatch(texts, apiKey, model);

    // Agrupa por arquivo pra fazer replaceFile uma vez por arquivo
    const byFile = new Map<string, VectorEntry[]>();
    for (let i = 0; i < batch.length; i++) {
      const p = batch[i];
      const entry: VectorEntry = {
        path: p.file.path,
        hash: p.hash,
        chunkIndex: p.chunkIndex,
        chunkCount: p.chunkCount,
        text: p.text,
        embedding: embeddings[i],
      };
      if (!byFile.has(p.file.path)) byFile.set(p.file.path, []);
      byFile.get(p.file.path)!.push(entry);
      tokensUsed += estimateTokens(p.text);
    }

    // Pra cada arquivo: remove entries antigos + adiciona os novos
    // (replaceFile já faz isso)
    // Mas só queremos replaceFile na 1ª vez que vemos esse path neste run,
    // pra não apagar entries do mesmo arquivo embedados em batches anteriores.
    for (const [path, entries] of byFile) {
      // Se entries deste path JÁ foram parcialmente adicionados neste run,
      // só adiciona; senão substitui (remove old + add new)
      const alreadyTouched = index.entries.some(
        (e) => e.path === path && e.hash === entries[0].hash
      );
      if (alreadyTouched) {
        index.entries.push(...entries);
      } else {
        index.replaceFile(path, entries);
      }
    }

    chunksEmbedded += batch.length;
    // Persiste a cada batch — durabilidade contra crash
    await saveIndex(app, indexPath, index);
  }
}
