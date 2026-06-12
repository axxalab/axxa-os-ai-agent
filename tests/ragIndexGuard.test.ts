import { describe, it, expect, vi, afterEach } from "vitest";
import { loadIndex, indexFilePath, indexFileName } from "../src/rag/vectorIndex";
import { Platform } from "obsidian";
import type { DataAdapter } from "obsidian";

// Guard de memória do índice RAG (v0.1.198): no mobile, índice acima do teto
// é PULADO (em vez de estourar o heap do WebView e derrubar o Obsidian).
// hybridSearch lida com index null → RAG cai pro keyword.

const INDEX_PATH = "axxa-ai/index";
const FILE = `${INDEX_PATH}/embeddings.json`;

// IndexFile mínimo e VÁLIDO (versão 2, sem entries) → carrega um índice vazio.
const emptyIndexJson = JSON.stringify({
  version: 2,
  provider: "openai",
  model: "text-embedding-3-small",
  dim: 1536,
  precision: "float32",
  profile: "balanced",
  lastIndexedAt: 0,
  fileCount: 0,
  entries: [],
});

function mockAdapter(size: number): { adapter: DataAdapter; read: ReturnType<typeof vi.fn> } {
  const read = vi.fn(async () => emptyIndexJson);
  const adapter = {
    // Só o single-file existe (sem manifesto sharded) → testa o caminho legado.
    exists: vi.fn(async (p: string) => p === FILE),
    stat: vi.fn(async () => ({ type: "file", ctime: 0, mtime: 0, size })),
    read,
  } as unknown as DataAdapter;
  return { adapter, read };
}

describe("loadIndex — guard de tamanho (mobile)", () => {
  it("acima do teto → retorna null, chama onSkip, NÃO lê o arquivo", async () => {
    const { adapter, read } = mockAdapter(40 * 1024 * 1024); // 40MB
    const onSkip = vi.fn();
    const idx = await loadIndex(adapter, INDEX_PATH, {
      maxBytes: 16 * 1024 * 1024,
      onSkip,
    });
    expect(idx).toBeNull();
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onSkip.mock.calls[0][0]).toBeCloseTo(40, 0); // ~40 MB
    expect(read).not.toHaveBeenCalled(); // pulou o read pesado
  });

  it("abaixo do teto → carrega normalmente (lê o arquivo)", async () => {
    const { adapter, read } = mockAdapter(2 * 1024 * 1024); // 2MB
    const onSkip = vi.fn();
    const idx = await loadIndex(adapter, INDEX_PATH, {
      maxBytes: 16 * 1024 * 1024,
      onSkip,
    });
    expect(onSkip).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledTimes(1);
    expect(idx).not.toBeNull();
    expect(idx!.size).toBe(0);
  });

  it("sem maxBytes (desktop) → nunca gateia, carrega direto", async () => {
    const { adapter, read } = mockAdapter(500 * 1024 * 1024); // 500MB
    const idx = await loadIndex(adapter, INDEX_PATH); // sem opts
    expect(read).toHaveBeenCalledTimes(1);
    expect(idx).not.toBeNull();
  });

  it("arquivo ausente → null sem stat/read", async () => {
    const read = vi.fn(async () => emptyIndexJson);
    const adapter = {
      exists: vi.fn(async () => false),
      stat: vi.fn(),
      read,
    } as unknown as DataAdapter;
    const idx = await loadIndex(adapter, INDEX_PATH, { maxBytes: 1 });
    expect(idx).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});

// Índices SEPARADOS por plataforma (v0.1.199) — desktop e mobile usam arquivos
// diferentes; um nunca toca o índice do outro.
describe("indexFilePath — separação desktop/mobile", () => {
  afterEach(() => {
    (Platform as { isMobile: boolean }).isMobile = false;
  });

  it("desktop → embeddings.json (nome legado, sem reindex forçado)", () => {
    (Platform as { isMobile: boolean }).isMobile = false;
    expect(indexFileName()).toBe("embeddings.json");
    expect(indexFilePath("axxa-ai/index")).toBe("axxa-ai/index/embeddings.json");
  });

  it("mobile → embeddings.mobile.json (arquivo próprio)", () => {
    (Platform as { isMobile: boolean }).isMobile = true;
    expect(indexFileName()).toBe("embeddings.mobile.json");
    expect(indexFilePath("axxa-ai/index")).toBe(
      "axxa-ai/index/embeddings.mobile.json"
    );
  });

  it("os dois caminhos são distintos (isolamento garantido)", () => {
    (Platform as { isMobile: boolean }).isMobile = false;
    const desk = indexFilePath("p");
    (Platform as { isMobile: boolean }).isMobile = true;
    const mob = indexFilePath("p");
    expect(desk).not.toBe(mob);
  });
});
