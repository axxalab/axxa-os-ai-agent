import { describe, it, expect, afterEach } from "vitest";
import {
  isEmbeddingModelId,
  inferEmbeddingSpec,
  getAllEmbeddingModels,
  getEmbeddingSpec,
  registerDiscoveredEmbeddings,
} from "../src/rag/types";

// Descoberta de modelos de embedding via fetch → entram no RAG com info.

afterEach(() => registerDiscoveredEmbeddings([])); // limpa o registro global

describe("isEmbeddingModelId", () => {
  it("reconhece ids de embedding", () => {
    expect(isEmbeddingModelId("text-embedding-3-small")).toBe(true);
    expect(isEmbeddingModelId("text-embedding-ada-002")).toBe(true);
    expect(isEmbeddingModelId("nvidia/nv-embedqa-e5-v5")).toBe(true);
    expect(isEmbeddingModelId("gemini-embedding-001")).toBe(true);
  });
  it("ignora modelos de chat/gen", () => {
    expect(isEmbeddingModelId("gpt-4o")).toBe(false);
    expect(isEmbeddingModelId("claude-opus-4-8")).toBe(false);
    expect(isEmbeddingModelId("dall-e-3")).toBe(false);
  });
});

describe("inferEmbeddingSpec", () => {
  it("usa o spec CURADO quando o modelo é conhecido", () => {
    const s = inferEmbeddingSpec("openai", "text-embedding-3-large");
    expect(s.dim).toBe(3072);
    expect(s.discovered).toBeUndefined(); // curado, não inferido
  });

  it("infere dim por heurística de nome p/ modelo desconhecido", () => {
    expect(inferEmbeddingSpec("openai", "text-embedding-3-large-2025").dim).toBe(3072);
    expect(inferEmbeddingSpec("gemini", "text-embedding-004").dim).toBe(768);
    expect(inferEmbeddingSpec("nim", "nvidia/nv-embedqa-e5-v5-next").dim).toBe(1024);
    // sem pista no nome → default 1536
    expect(inferEmbeddingSpec("openai", "embed-mistério").dim).toBe(1536);
  });

  it("marca discovered + infere flags (imagem/free)", () => {
    const vl = inferEmbeddingSpec("openrouter", "vendor/embed-vl-2b:free");
    expect(vl.discovered).toBe(true);
    expect(vl.supportsImage).toBe(true);
    expect(vl.free).toBe(true);
    // NIM é tratado como free
    expect(inferEmbeddingSpec("nim", "vendor/embed-x").free).toBe(true);
  });
});

describe("registro de descobertos", () => {
  it("getAllEmbeddingModels une curados + descobertos sem duplicar", () => {
    const before = getAllEmbeddingModels().length;
    registerDiscoveredEmbeddings([
      inferEmbeddingSpec("openai", "text-embedding-9-ultra"),
      // duplicata de um curado — não deve contar 2x
      inferEmbeddingSpec("openai", "text-embedding-3-small"),
    ]);
    const all = getAllEmbeddingModels();
    expect(all.length).toBe(before + 1);
    expect(all.some((m) => m.model === "text-embedding-9-ultra")).toBe(true);
  });

  it("getEmbeddingSpec acha um modelo descoberto (não cai no fallback)", () => {
    registerDiscoveredEmbeddings([
      inferEmbeddingSpec("nim", "nvidia/nv-embedqa-mistery-v9"),
    ]);
    const spec = getEmbeddingSpec("nvidia/nv-embedqa-mistery-v9");
    expect(spec.model).toBe("nvidia/nv-embedqa-mistery-v9");
    expect(spec.provider).toBe("nim");
  });

  it("getEmbeddingSpec cai no 1º curado se o modelo não existe", () => {
    expect(getEmbeddingSpec("inexistente-xyz").model).toBe(
      "text-embedding-3-small"
    );
  });
});
