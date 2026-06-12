// src/rag/hybrid.ts
// Busca híbrida: funde resultados SEMÂNTICOS (embeddings/cosine) com KEYWORD
// (BM25-ish do vaultSearch) via Reciprocal Rank Fusion (RRF). Pega o melhor dos
// dois mundos — conceito/sinônimos (semantic) + nomes próprios/termos raros
// (keyword) — e ainda re-rankeia usando o GRAFO de links do Obsidian.
//
// RRF: score(path) = Σ 1/(k + rank_na_lista). k=60 é o valor canônico.
// Graph-aware: um resultado linkado por OUTRO resultado relevante ganha boost
// (co-citação) — usa só o metadataCache (em memória, sem I/O de arquivo).

import type { App, TFile } from "obsidian";
import type { VectorIndex } from "./vectorIndex";
import { embedQuery, type EmbedCredentials } from "./embeddings";
import { searchVault } from "../components/_shared/vaultSearch";

export interface HybridHit {
  path: string;
  /** Melhor trecho/excerpt do path (chunk semântico ou excerpt keyword). */
  text: string;
  /** Score RRF (após boost de grafo). */
  score: number;
  /** Origem: "semantic", "keyword", "semantic+keyword". */
  via: string;
}

const RRF_K = 60;
const GRAPH_BOOST = 1.15;

export interface HybridOptions {
  app: App;
  index: VectorIndex | null;
  creds: EmbedCredentials;
  query: string;
  topK: number;
  /** Re-rankeia por co-citação no grafo de links. Default true. */
  useGraph?: boolean;
}

export async function hybridSearch(opts: HybridOptions): Promise<HybridHit[]> {
  const { app, index, creds, query, topK, useGraph = true } = opts;

  const acc = new Map<
    string,
    { rrf: number; text: string; via: Set<string> }
  >();
  const bump = (path: string, rank: number, text: string, via: string) => {
    const cur = acc.get(path) ?? { rrf: 0, text: "", via: new Set<string>() };
    cur.rrf += 1 / (RRF_K + rank);
    cur.via.add(via);
    if (!cur.text && text) cur.text = text;
    acc.set(path, cur);
  };

  // ---- Semântico (se índice populado) ----
  if (index && index.size > 0) {
    try {
      const vec = await embedQuery(query, creds, index.model, index.dim);
      // Sharded → busca streamed (lê shards do disco, memória limitada);
      // single-file → busca in-memory. Mesmos resultados. v0.1.200
      const sem = index.streamed
        ? await index.searchStreamed(vec, topK * 3, 0.3)
        : index.search(vec, topK * 3, 0.3);
      // Dedup por path — fica o melhor chunk (lista já vem ordenada por score)
      const seen = new Set<string>();
      let rank = 0;
      for (const r of sem) {
        if (seen.has(r.entry.path)) continue;
        seen.add(r.entry.path);
        bump(r.entry.path, rank++, r.entry.text.slice(0, 500), "semantic");
      }
    } catch {
      // embed falhou (sem key / rate limit) → segue só com keyword
    }
  }

  // ---- Keyword ----
  const kw = await searchVault(app, query, topK * 3, 500);
  kw.forEach((m, rank) => bump(m.path, rank, m.excerpt, "keyword"));

  let hits: HybridHit[] = Array.from(acc.entries()).map(([path, v]) => ({
    path,
    text: v.text,
    score: v.rrf,
    via: Array.from(v.via).sort().join("+"),
  }));

  // ---- Graph-aware: co-citação entre os próprios resultados ----
  if (useGraph && hits.length > 1) {
    const inResults = new Set(hits.map((h) => h.path));
    const scoreBoost = new Map<string, number>();
    for (const h of hits) {
      const file = app.vault.getAbstractFileByPath(h.path) as TFile | null;
      if (!file) continue;
      const links = app.metadataCache.getFileCache(file)?.links ?? [];
      for (const l of links) {
        const dest = app.metadataCache.getFirstLinkpathDest(l.link, h.path);
        if (dest && dest.path !== h.path && inResults.has(dest.path)) {
          // dest é citado por um resultado relevante → boost
          scoreBoost.set(dest.path, (scoreBoost.get(dest.path) ?? 1) * GRAPH_BOOST);
        }
      }
    }
    if (scoreBoost.size > 0) {
      hits = hits.map((h) => ({
        ...h,
        score: h.score * (scoreBoost.get(h.path) ?? 1),
      }));
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, topK);
}

/** Formata os hits como bloco de contexto markdown (pro system prompt / tool). */
export function formatHybridContext(hits: HybridHit[]): string {
  return hits
    .map((h) => `### ${h.path} (${h.via})\n${h.text}`)
    .join("\n\n---\n\n");
}
