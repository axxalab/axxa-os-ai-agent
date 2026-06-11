import { describe, it, expect } from "vitest";
import {
  modelModalities,
  MODALITY_INFO,
  ALL_MODALITIES,
} from "../src/providers/modelModality";
import type { ModelCapabilities } from "../src/providers/modelCapabilities";
import {
  generationSupported,
  generationSupportSummary,
} from "../src/generation/save";

const caps = (over: Partial<ModelCapabilities>): ModelCapabilities => ({
  vision: false,
  tools: false,
  streaming: true,
  ...over,
});

describe("modelModalities — derivação do par I/O", () => {
  it("chat texto-only → TXT2TXT", () => {
    expect(modelModalities(caps({}))).toEqual(["TXT2TXT"]);
  });

  it("chat com vision → TXT2TXT + IMG2TXT", () => {
    expect(modelModalities(caps({ vision: true }))).toEqual(["TXT2TXT", "IMG2TXT"]);
  });

  it("image gen sem vision (DALL·E) → TXT2IMG", () => {
    expect(modelModalities(caps({ imageGen: true }))).toEqual(["TXT2IMG"]);
  });

  it("image gen + vision (Nano Banana) → TXT2IMG + IMG2IMG", () => {
    expect(modelModalities(caps({ imageGen: true, vision: true }))).toEqual([
      "TXT2IMG",
      "IMG2IMG",
    ]);
  });

  it("audio gen → TXT2AUD", () => {
    expect(modelModalities(caps({ audioGen: true }))).toEqual(["TXT2AUD"]);
  });

  it("video gen Veo/Sora → TXT2VID + IMG2VID (animam imagem)", () => {
    expect(modelModalities(caps({ videoGen: true }), "veo-3.0")).toEqual([
      "TXT2VID",
      "IMG2VID",
    ]);
    expect(modelModalities(caps({ videoGen: true }), "sora")).toEqual([
      "TXT2VID",
      "IMG2VID",
    ]);
  });

  it("video gen genérico (sem vision, não Veo/Sora) → só TXT2VID", () => {
    expect(modelModalities(caps({ videoGen: true }), "cosmos-1")).toEqual(["TXT2VID"]);
  });

  it("MODALITY_INFO cobre TODOS os códigos de ALL_MODALITIES, com descrição", () => {
    for (const code of ALL_MODALITIES) {
      const info = MODALITY_INFO[code];
      expect(info).toBeTruthy();
      expect(info.code).toBe(code);
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.description.length).toBeGreaterThan(0);
      expect(info.icon.length).toBeGreaterThan(0);
    }
  });
});

describe("generationSupported — auditoria do que é gerável hoje", () => {
  it("imagem: OpenAI/Gemini/NIM sim", () => {
    expect(generationSupported("openai", "image")).toBe(true);
    expect(generationSupported("gemini", "image")).toBe(true);
    expect(generationSupported("nim", "image")).toBe(true);
  });

  it("áudio: só OpenAI (Gemini TTS flagado mas não wired)", () => {
    expect(generationSupported("openai", "audio")).toBe(true);
    expect(generationSupported("gemini", "audio")).toBe(false);
    expect(generationSupported("nim", "audio")).toBe(false);
  });

  it("vídeo: nenhum provider (Veo/Sora ainda não implementados)", () => {
    expect(generationSupported("openai", "video")).toBe(false);
    expect(generationSupported("gemini", "video")).toBe(false);
    expect(generationSupported("anthropic", "video")).toBe(false);
  });

  it("resumo cita imagem + áudio e NÃO cita vídeo", () => {
    const s = generationSupportSummary();
    expect(s).toContain("imagem");
    expect(s).toContain("áudio");
    expect(s).toContain("OpenAI");
    expect(s).not.toContain("vídeo");
  });
});
