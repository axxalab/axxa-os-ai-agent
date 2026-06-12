import { describe, it, expect } from "vitest";
import {
  VectorIndex,
  saveIndex,
  loadIndex,
  deleteIndex,
  manifestFilePath,
} from "../src/rag/vectorIndex";
import { quantizeEmbedding } from "../src/rag/quant";
import type { VectorEntry } from "../src/rag/types";
import type { App, DataAdapter } from "obsidian";

// FS em memória — captura writes, serve reads. Cobre o round-trip sharded.
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

const mk = (raw: number[]): Float32Array =>
  quantizeEmbedding(raw, "float32") as Float32Array;

function entry(path: string, raw: number[]): VectorEntry {
  return {
    path,
    hash: "h-" + path,
    chunkIndex: 0,
    chunkCount: 1,
    text: "texto de " + path,
    kind: "text",
    embedding: mk(raw),
  };
}

function buildIndex(): VectorIndex {
  return new VectorIndex({
    provider: "openai",
    model: "text-embedding-3-small",
    dim: 4,
    precision: "float32",
    profile: "precision",
    entries: [
      entry("a.md", [1, 0, 0, 0]),
      entry("b.md", [0, 1, 0, 0]),
      entry("c.md", [0.8, 0.6, 0, 0]),
    ],
  });
}

const PATH = "axxa-ai/index";

describe("índice sharded — save/load/search streamed (v0.1.200)", () => {
  it("saveIndex sharded escreve manifesto + N shards (shardSize=2 → 2 shards)", async () => {
    const adapter = memAdapter();
    const app = { vault: { adapter } } as unknown as App;
    await saveIndex(app, PATH, buildIndex(), { shardSize: 2 });

    expect(adapter.files.has(manifestFilePath(PATH))).toBe(true);
    const manifest = JSON.parse(adapter.files.get(manifestFilePath(PATH))!);
    expect(manifest.sharded).toBe(true);
    expect(manifest.totalEntries).toBe(3);
    expect(manifest.shardCount).toBe(2); // 3 entries / 2 por shard
    expect(manifest.shards).toHaveLength(2);
    // os arquivos de shard existem
    for (const s of manifest.shards) {
      expect(adapter.files.has(`${PATH}/${s}`)).toBe(true);
    }
    // o single-file NÃO existe (modo sharded é exclusivo)
    expect(adapter.files.has(`${PATH}/embeddings.json`)).toBe(false);
  });

  it("loadIndex detecta o manifesto → índice streamed (metadados, sem entries na RAM)", async () => {
    const adapter = memAdapter();
    const app = { vault: { adapter } } as unknown as App;
    await saveIndex(app, PATH, buildIndex(), { shardSize: 2 });

    const loaded = await loadIndex(adapter as unknown as DataAdapter, PATH);
    expect(loaded).not.toBeNull();
    expect(loaded!.streamed).toBe(true);
    expect(loaded!.size).toBe(3); // vem do manifesto
    expect(loaded!.entries).toHaveLength(0); // NÃO materializou na RAM
    expect(loaded!.model).toBe("text-embedding-3-small");
    expect(loaded!.dim).toBe(4);
  });

  it("searchStreamed = mesma ordem da busca in-memory (merge cross-shard correto)", async () => {
    const adapter = memAdapter();
    const app = { vault: { adapter } } as unknown as App;
    const inMem = buildIndex();
    await saveIndex(app, PATH, inMem, { shardSize: 2 });

    const loaded = await loadIndex(adapter as unknown as DataAdapter, PATH);
    const query = [1, 0, 0, 0];
    const streamed = await loaded!.searchStreamed(query, 2, 0);
    const memory = inMem.search(query, 2, 0);

    // top-2 esperado: a.md (1.0) depois c.md (0.8) — c.md vem do shard1 e
    // precisa "passar na frente" de b.md (0.0) do shard0 no merge.
    expect(streamed.map((r) => r.entry.path)).toEqual(["a.md", "c.md"]);
    expect(streamed.map((r) => r.entry.path)).toEqual(
      memory.map((r) => r.entry.path)
    );
    expect(streamed[0].score).toBeCloseTo(1.0, 4);
    expect(streamed[1].score).toBeCloseTo(0.8, 3);
  });

  it("deleteIndex remove manifesto + todos os shards", async () => {
    const adapter = memAdapter();
    const app = { vault: { adapter } } as unknown as App;
    await saveIndex(app, PATH, buildIndex(), { shardSize: 2 });
    expect(adapter.files.size).toBeGreaterThan(0);

    await deleteIndex(adapter as unknown as DataAdapter, PATH);
    // sobra nada de índice
    const leftover = [...adapter.files.keys()].filter((k) =>
      k.includes("embeddings")
    );
    expect(leftover).toEqual([]);
  });

  it("reindexar (save 2×) NÃO deixa shards órfãos (cleanup pós-commit)", async () => {
    const adapter = memAdapter();
    const app = { vault: { adapter } } as unknown as App;
    await saveIndex(app, PATH, buildIndex(), { shardSize: 2 });
    await saveIndex(app, PATH, buildIndex(), { shardSize: 2 }); // reindex
    const manifest = JSON.parse(adapter.files.get(manifestFilePath(PATH))!);
    const shardFiles = [...adapter.files.keys()].filter((k) =>
      k.includes(".shard")
    );
    // só os shards do manifesto atual sobram — nada do save anterior
    expect(shardFiles).toHaveLength(manifest.shardCount);
    for (const s of manifest.shards) {
      expect(adapter.files.has(`${PATH}/${s}`)).toBe(true);
    }
  });

  it("shard ausente no load → null (não serve índice incompleto)", async () => {
    const adapter = memAdapter();
    const app = { vault: { adapter } } as unknown as App;
    await saveIndex(app, PATH, buildIndex(), { shardSize: 2 });
    const manifest = JSON.parse(adapter.files.get(manifestFilePath(PATH))!);
    adapter.files.delete(`${PATH}/${manifest.shards[0]}`); // some um shard
    const loaded = await loadIndex(adapter as unknown as DataAdapter, PATH);
    expect(loaded).toBeNull(); // validação no load pega
  });

  it("shard por ORÇAMENTO DE BYTES: trechos grandes forçam mais shards que a contagem", async () => {
    const adapter = memAdapter();
    const app = { vault: { adapter } } as unknown as App;
    // 5 entries com ~1.5MB de texto cada; shardSize alto (count não corta) →
    // o orçamento de bytes (4MB) deve cortar em ~2 por shard → 3 shards.
    const big = "x".repeat(1_500_000);
    const entries: VectorEntry[] = Array.from({ length: 5 }, (_, i) => ({
      path: `n${i}.md`,
      hash: "h" + i,
      chunkIndex: 0,
      chunkCount: 1,
      text: big,
      kind: "text",
      embedding: mk([1, 0, 0, 0]),
    }));
    const idx = new VectorIndex({
      provider: "openai",
      model: "m",
      dim: 4,
      precision: "float32",
      profile: "precision",
      entries,
    });
    await saveIndex(app, PATH, idx, { shardSize: 1000 });
    const manifest = JSON.parse(adapter.files.get(manifestFilePath(PATH))!);
    expect(manifest.shardCount).toBeGreaterThanOrEqual(3);
  });

  it("trocar sharded→single limpa os shards (sem estado misto)", async () => {
    const adapter = memAdapter();
    const app = { vault: { adapter } } as unknown as App;
    await saveIndex(app, PATH, buildIndex(), { shardSize: 2 }); // sharded
    await saveIndex(app, PATH, buildIndex()); // single (sem shardSize)

    expect(adapter.files.has(manifestFilePath(PATH))).toBe(false);
    expect(adapter.files.has(`${PATH}/embeddings.json`)).toBe(true);
    // load agora pega o single-file (não streamed)
    const loaded = await loadIndex(adapter as unknown as DataAdapter, PATH);
    expect(loaded!.streamed).toBe(false);
    expect(loaded!.size).toBe(3);
  });
});
