// src/rag/indexer.ts
// Orquestra a indexação RAG:
//   1. Walks vault (skip pastas internas do AXXA + arquivos de áudio)
//   2. Pra cada .md: hash → compara com índice → chunk + re-embedda
//   3. Pra cada imagem (se modelo suporta): hash → re-embedda inteira (1 chunk)
//   4. Batch embedding (16 por API call no OpenAI, 1-por-1 no OpenRouter)
//   5. Persiste a cada batch (durável contra crash)
//
// Áudio (mp3/wav/etc): detectado e CONTADO em progress mas SKIPADO — modelos
// VL atuais não embedam áudio. Pipeline Whisper → texto → embed vem em sprint
// próprio (precisa lidar com API Whisper paga ou whisper.cpp local).
//
// Cancelamento: aceita AbortSignal — checa antes/depois de cada batch.

import type { App, CachedMetadata, TFile } from "obsidian";
import {
  arrayBufferToDataUrl,
  chunkMarkdown,
  embedItems,
  estimateTokens,
  sha1Hex,
  type EmbedInput,
} from "./embeddings";
import { saveIndex, VectorIndex } from "./vectorIndex";
import { getQuantProfile, quantizeEmbedding } from "./quant";
import {
  getEmbeddingSpec,
  imageMimeFromPath,
  isImagePath,
  type VectorEntry,
} from "./types";

export interface IndexProgress {
  /** "scanning" → percorrendo vault | "embedding" → embedando chunks | "done" */
  phase: "scanning" | "embedding" | "done";
  filesScanned: number;
  filesTotal: number;
  /** Quantos arquivos vão ser efetivamente re-embedados (diff vs índice). */
  filesToEmbed: number;
  filesEmbedded: number;
  chunksEmbedded: number;
  /** Quantas imagens foram embedadas no run (pra mostrar separado de texto). */
  imagesEmbedded: number;
  /** Quantos áudios foram pulados (modelo VL atual não suporta). */
  audioSkipped: number;
  /** Estimativa rude de tokens consumidos. */
  tokensUsed: number;
  /** Caminho do arquivo atual sendo processado (opcional, pra UI). */
  currentFile?: string;
}

export interface IndexerOptions {
  app: App;
  /** API keys de TODOS os providers (router escolhe via spec do modelo). */
  openaiApiKey: string;
  openrouterApiKey: string;
  model: string;
  /** Perfil de quantização (precision/balanced/light/minimal). */
  profile: string;
  indexPath: string;
  /** Pastas a IGNORAR (paths absolutos no vault). Sempre inclui o indexPath. */
  excludePaths: string[];
  /** Callback chamado a cada update de progresso. */
  onProgress?: (p: IndexProgress) => void;
  /** Sinal pra cancelar a indexação. */
  signal?: AbortSignal;
}

/** Extensões de áudio que detectamos pra avisar/pular. */
const AUDIO_EXTENSIONS = ["mp3", "wav", "webm", "m4a", "ogg", "flac"];

function isAudioPath(path: string): boolean {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  return AUDIO_EXTENSIONS.includes(ext);
}

const BATCH_SIZE = 16;
const CHUNK_MAX_CHARS = 1500;
const CHUNK_OVERLAP = 200;
/**
 * v0.1.29 fix mobile crash: salvar o índice inteiro a cada batch causava
 * out-of-memory no WebView do Android (40MB JSON × dezenas de saves).
 * Agora salvamos a cada N arquivos processados + sempre no final.
 * Trade-off: durabilidade reduzida (perde até N arquivos se crashar) por
 * estabilidade (não crasha).
 */
const SAVE_EVERY_N_FILES = 25;

/**
 * Monta um cabeçalho de contexto Obsidian-native pra prefixar nos chunks antes
 * de embedar. Melhora o recall porque a query passa a casar com título, tags,
 * aliases e wikilinks mesmo quando esses termos não estão no corpo do chunk.
 * Usa o `metadataCache` nativo do Obsidian (sem regex/parse YAML na mão).
 *
 * Ex: "Nota: Arquitetura · Tags: projeto, axxa · Links: RAG, Effort Engine"
 */
function buildObsidianContext(
  file: TFile,
  cache: CachedMetadata | null
): string {
  const parts: string[] = [`Nota: ${file.basename}`];
  const fm = cache?.frontmatter;
  if (fm) {
    const aliases = fm.aliases ?? fm.alias;
    if (aliases) {
      const arr = Array.isArray(aliases) ? aliases : [aliases];
      if (arr.length) parts.push(`Aliases: ${arr.join(", ")}`);
    }
  }
  // Tags: frontmatter (tags/tag) + inline (#tag) — dedupe, sem o "#"
  const tagSet = new Set<string>();
  const fmTags = fm?.tags ?? fm?.tag;
  if (fmTags) {
    (Array.isArray(fmTags) ? fmTags : [fmTags]).forEach((tg) =>
      tagSet.add(String(tg).replace(/^#/, ""))
    );
  }
  cache?.tags?.forEach((t) => tagSet.add(t.tag.replace(/^#/, "")));
  if (tagSet.size) parts.push(`Tags: ${Array.from(tagSet).join(", ")}`);
  // Wikilinks do corpo — nomes/displayText, dedupe, cap 25 pra não inflar
  if (cache?.links?.length) {
    const linked = Array.from(
      new Set(cache.links.map((l) => l.displayText || l.link))
    ).slice(0, 25);
    if (linked.length) parts.push(`Links: ${linked.join(", ")}`);
  }
  return parts.join(" · ");
}

/**
 * Indexa o vault. Reutiliza entries existentes pra arquivos NÃO modificados
 * (incremental). Devolve o índice atualizado.
 *
 * Se o modelo suporta imagem (`spec.supportsImage`), também indexa arquivos
 * de imagem (png/jpg/jpeg/webp/gif). Áudio é detectado mas pulado.
 */
export async function indexVault(
  prev: VectorIndex | null,
  opts: IndexerOptions
): Promise<VectorIndex> {
  const {
    app,
    openaiApiKey,
    openrouterApiKey,
    model,
    profile,
    indexPath,
    excludePaths,
    onProgress,
    signal,
  } = opts;
  const spec = getEmbeddingSpec(model);
  const prof = getQuantProfile(profile);
  const creds = { openaiApiKey, openrouterApiKey };
  // Dim efetiva: reduzida (Matryoshka) só se o modelo suporta `dimensions`.
  // Senão, perfis "Leve/Mínimo" caem pra dim cheia (só a precisão int8 vale).
  const effectiveDim =
    prof.targetDim > 0 && spec.supportsDimensions ? prof.targetDim : spec.dim;
  const embedDims = spec.supportsDimensions ? effectiveDim : undefined;

  // Recomeça do zero se modelo, dim OU precisão mudaram desde o índice anterior.
  const startFresh =
    !prev ||
    prev.model !== model ||
    prev.dim !== effectiveDim ||
    prev.precision !== prof.precision;
  const index = startFresh
    ? new VectorIndex({
        provider: spec.provider,
        model: spec.model,
        dim: effectiveDim,
        precision: prof.precision,
        profile: prof.id,
      })
    : prev;

  const prevHashes = startFresh ? new Map<string, string>() : prev.hashMap();

  // ============================================================
  // Walk vault — markdown SEMPRE, imagens só se modelo suportar
  // ============================================================
  const includedFiles: TFile[] = [];
  let audioSkipped = 0;

  function isExcluded(path: string): boolean {
    return excludePaths.some((ex) => {
      const exNorm = ex.endsWith("/") ? ex : ex + "/";
      return path === ex || path.startsWith(exNorm);
    });
  }

  // Markdown
  for (const f of app.vault.getMarkdownFiles()) {
    if (!isExcluded(f.path)) includedFiles.push(f);
  }

  // Imagens (e detecção de áudio) — só varremos `getFiles()` se modelo é VL
  // ou se queremos contar áudio pulado. Por economia, fazemos sempre.
  for (const f of app.vault.getFiles()) {
    if (isExcluded(f.path)) continue;
    const path = f.path;
    if (isAudioPath(path)) {
      audioSkipped++;
      continue;
    }
    if (spec.supportsImage && isImagePath(path)) {
      includedFiles.push(f);
    }
  }

  const filesTotal = includedFiles.length;
  const stillPresent = new Set(includedFiles.map((f) => f.path));

  // Remove entries de arquivos deletados ou que não estão mais no escopo
  index.pruneToPaths(stillPresent);

  // ============================================================
  // Phase 1: Scan — descobre quais arquivos precisam re-embed
  // ============================================================
  // toEmbed armazena ENTRIES no formato unificado: text ou image
  type PendingFile =
    | { kind: "text"; file: TFile; content: string; hash: string }
    | { kind: "image"; file: TFile; dataUrl: string; hash: string };
  const toEmbed: PendingFile[] = [];
  let filesScanned = 0;

  for (const file of includedFiles) {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
    filesScanned++;

    const isImage = isImagePath(file.path);
    try {
      if (isImage) {
        const buffer = await app.vault.adapter.readBinary(file.path);
        const mime = imageMimeFromPath(file.path);
        const dataUrl = arrayBufferToDataUrl(buffer, mime);
        const hash = await sha1Hex(dataUrl);
        if (prevHashes.get(file.path) !== hash) {
          toEmbed.push({ kind: "image", file, dataUrl, hash });
        }
      } else {
        const content = await app.vault.cachedRead(file);
        if (!content.trim()) continue;
        const hash = await sha1Hex(content);
        if (prevHashes.get(file.path) !== hash) {
          toEmbed.push({ kind: "text", file, content, hash });
        }
      }
    } catch (err) {
      console.warn(`[axxa/rag] skip ${file.path}:`, err);
      continue;
    }

    onProgress?.({
      phase: "scanning",
      filesScanned,
      filesTotal,
      filesToEmbed: toEmbed.length,
      filesEmbedded: 0,
      chunksEmbedded: 0,
      imagesEmbedded: 0,
      audioSkipped,
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
      imagesEmbedded: 0,
      audioSkipped,
      tokensUsed: 0,
    });
    return index;
  }

  // ============================================================
  // Phase 2: Embed — UM ARQUIVO POR VEZ com try-catch isolado
  //
  // v0.1.29 fix: antes batchávamos chunks de múltiplos arquivos juntos e
  // salvávamos o índice (40MB+) a CADA batch — explodia o WebView no Android.
  // Agora: processa file → embeda todos chunks dele → adiciona ao índice →
  // salva A CADA N arquivos. Erros em 1 arquivo não derrubam o resto.
  // ============================================================
  let filesEmbedded = 0;
  let chunksEmbedded = 0;
  let imagesEmbedded = 0;
  let tokensUsed = 0;
  let filesSinceLastSave = 0;
  const failedFiles: { path: string; error: string }[] = [];

  for (const item of toEmbed) {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");

    try {
      const fileEntries: VectorEntry[] = [];

      if (item.kind === "text") {
        // Contexto Obsidian-native (título · tags · aliases · wikilinks) —
        // prefixado SÓ no texto que vai pro embed (enriquece recall). O `text`
        // guardado na entry segue sendo o chunk puro (excerpt limpo na busca).
        const cache = app.metadataCache.getFileCache(item.file);
        const ctxHeader = buildObsidianContext(item.file, cache);
        const chunks = chunkMarkdown(item.content, CHUNK_MAX_CHARS, CHUNK_OVERLAP);
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
          const slice = chunks.slice(i, i + BATCH_SIZE);
          // Texto embedado = contexto Obsidian (título/tags/links) + breadcrumb
          // de heading + o chunk. O `text` guardado fica puro (excerpt limpo).
          const embedTexts = slice.map((c) => {
            const prefix = [ctxHeader, c.breadcrumb].filter(Boolean).join(" · ");
            return prefix ? `${prefix}\n\n${c.text}` : c.text;
          });
          const inputs: EmbedInput[] = embedTexts.map((t) => ({
            kind: "text",
            text: t,
          }));
          const embeddings = await embedItems(inputs, creds, model, embedDims);
          for (let j = 0; j < slice.length; j++) {
            fileEntries.push({
              path: item.file.path,
              hash: item.hash,
              chunkIndex: i + j,
              chunkCount: chunks.length,
              text: slice[j].text,
              embedding: quantizeEmbedding(embeddings[j], prof.precision),
              kind: "text",
            });
            tokensUsed += estimateTokens(embedTexts[j]);
          }
        }
      } else {
        // Imagem: 1 entry, 1 request
        const embeddings = await embedItems(
          [{ kind: "image", dataUrl: item.dataUrl }],
          creds,
          model,
          embedDims
        );
        fileEntries.push({
          path: item.file.path,
          hash: item.hash,
          chunkIndex: 0,
          chunkCount: 1,
          text: `Image: ${item.file.name}`,
          embedding: quantizeEmbedding(embeddings[0], prof.precision),
          kind: "image",
        });
        imagesEmbedded++;
      }

      // Substitui (ou adiciona) as entries deste arquivo no índice
      index.replaceFile(item.file.path, fileEntries);
      chunksEmbedded += fileEntries.length;
      filesEmbedded++;
      filesSinceLastSave++;

      // Save periódico — controla o I/O em vez de salvar cada batch
      if (filesSinceLastSave >= SAVE_EVERY_N_FILES) {
        await saveIndex(app, indexPath, index);
        filesSinceLastSave = 0;
      }

      onProgress?.({
        phase: "embedding",
        filesScanned: filesTotal,
        filesTotal,
        filesToEmbed: toEmbed.length,
        filesEmbedded,
        chunksEmbedded,
        imagesEmbedded,
        audioSkipped,
        tokensUsed,
        currentFile: item.file.path,
      });
    } catch (err) {
      // Skip arquivo com erro, log, continua próximo
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[axxa/rag] file failed: ${item.file.path}`,
        err
      );
      failedFiles.push({ path: item.file.path, error: msg });
      // Abort propagado deve parar tudo
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      // Senão continua
    }
  }

  // Save final — garante que tudo que rolou tá no disco
  index.lastIndexedAt = new Date().toISOString();
  await saveIndex(app, indexPath, index);

  // Log final de arquivos que falharam (pra user inspeccionar no DevTools)
  if (failedFiles.length > 0) {
    console.warn(
      `[axxa/rag] ${failedFiles.length} arquivos falharam durante indexação:`,
      failedFiles
    );
  }

  onProgress?.({
    phase: "done",
    filesScanned: filesTotal,
    filesTotal,
    filesToEmbed: toEmbed.length,
    filesEmbedded,
    chunksEmbedded,
    imagesEmbedded,
    audioSkipped,
    tokensUsed,
  });

  return index;
}
