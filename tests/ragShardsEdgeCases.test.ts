import { describe, it, expect } from "vitest";
import {
  VectorIndex,
  saveIndex,
  loadIndex,
  deleteIndex,
  manifestFilePath,
  RAG_SHARD_SIZE,
} from "../src/rag/vectorIndex";
import type { App, DataAdapter } from "obsidian";

function memAdapter() {
  const files = new Map<string, string>();
  const adapter = {
    files,
    exists: async (p: string) => files.has(p),
    read: async (p: string) => {
      const v = files.get(p);
      if (v === undefined) throw new Error("ENOENT " + p);
      return v;
    },
    write: async (p: string, c: string) => {
      files.set(p, c);
    },
    remove: async (p: string) => {
      files.delete(p);
    },
    stat: async (p: string) =>
      files.has(p)
        ? { type: "file", ctime: 0, mtime: 0, size: files.get(p)!.length }
        : null,
    mkdir: async () => {},
  };
  return adapter;
}

const PATH = "axxa-ai/index";

describe("edge cases: empty + mode switching + backward compat", () => {
  it("empty index (0 entries) sharded → manifesto with shards:[] → loads & searches OK", async () => {
    const adapter = memAdapter();
    const app = { vault: { adapter } } as unknown as App;

    const emptyIdx = new VectorIndex({
      provider: "openai",
      model: "text-embedding-3-small",
      dim: 4,
      precision: "float32",
      profile: "balanced",
      entries: [],
    });

    await saveIndex(app, PATH, emptyIdx, { shardSize: RAG_SHARD_SIZE });

    const loaded = await loadIndex(adapter as unknown as DataAdapter, PATH);
    expect(loaded).not.toBeNull();
    expect(loaded!.streamed).toBe(true);
    expect(loaded!.size).toBe(0);

    const results = await loaded!.searchStreamed([1, 0, 0, 0], 5, 0);
    expect(results).toEqual([]);

    const manifest = JSON.parse(adapter.files.get(manifestFilePath(PATH))!);
    expect(manifest.shards).toEqual([]);
    expect(manifest.totalEntries).toBe(0);
  });

  it("corrupted shard in middle → searchStreamed skips it, continues", async () => {
    const adapter = memAdapter();
    const app = { vault: { adapter } } as unknown as App;

    // Build & save 3 shards
    const idx = new VectorIndex({
      provider: "openai",
      model: "text-embedding-3-small",
      dim: 1,
      precision: "float32",
      profile: "balanced",
      entries: [
        { path: "a.md", hash: "ha", chunkIndex: 0, chunkCount: 1, text: "a", kind: "text", embedding: new Float32Array([1]) },
        { path: "b.md", hash: "hb", chunkIndex: 0, chunkCount: 1, text: "b", kind: "text", embedding: new Float32Array([0]) },
        { path: "c.md", hash: "hc", chunkIndex: 0, chunkCount: 1, text: "c", kind: "text", embedding: new Float32Array([1]) },
      ],
    });

    await saveIndex(app, PATH, idx, { shardSize: 1 });

    // Corrompe o shard do MEIO de verdade (nome real vem do manifesto — os
    // shards têm prefixo único por save, então hardcodar o nome não corromperia
    // nada). O arquivo ainda EXISTE (loadIndex valida existência), mas o JSON é
    // inválido → searchStreamed pula na leitura.
    const files = adapter.files;
    const manifest = JSON.parse(files.get(manifestFilePath(PATH))!);
    files.set(`${PATH}/${manifest.shards[1]}`, "not valid json");

    const loaded = await loadIndex(adapter as unknown as DataAdapter, PATH);
    expect(loaded).not.toBeNull();

    // searchStreamed must not crash; should get results from shards 0 and 2.
    // Query dim = índice dim (1): searchStreamed agora pula vetores de dim
    // divergente (corrupção/mistura de modelos), então a query precisa casar. v0.1.227
    const results = await loaded!.searchStreamed([1], 10, 0.5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.map((r) => r.entry.path)).toContain("a.md");
    expect(results.map((r) => r.entry.path)).toContain("c.md");
  });
});
