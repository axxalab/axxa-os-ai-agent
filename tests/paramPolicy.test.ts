import { describe, it, expect } from "vitest";
import {
  isReasoningModel,
  resolveTemperature,
  resolveMaxTokens,
  paramPolicy,
} from "../src/providers/paramPolicy";

// Política de params por modelo — o que mais quebra calado é mandar temperature
// pra reasoning model da OpenAI (400) ou fora do range do Claude (0..1).

describe("isReasoningModel", () => {
  it("OpenAI o-series + gpt-5 (não -chat) são reasoning", () => {
    for (const m of ["o1", "o1-mini", "o3", "o3-mini", "o4", "gpt-5", "gpt-5-mini", "openai/o3"]) {
      expect(isReasoningModel(m)).toBe(true);
    }
  });
  it("gpt-5-chat NÃO é reasoning (aceita temperature)", () => {
    expect(isReasoningModel("gpt-5-chat-latest")).toBe(false);
  });
  it("não confunde claude-opus com o-series", () => {
    expect(isReasoningModel("claude-opus-4-8")).toBe(false);
    expect(isReasoningModel("gpt-4o")).toBe(false);
  });
  it("DeepSeek R1 / Qwen QwQ / Magistral são reasoning", () => {
    expect(isReasoningModel("deepseek-r1")).toBe(true);
    expect(isReasoningModel("deepseek/deepseek-r1")).toBe(true);
    expect(isReasoningModel("qwen/qwq-32b")).toBe(true);
    expect(isReasoningModel("mistralai/magistral-small")).toBe(true);
  });
});

describe("resolveTemperature", () => {
  it("reasoning model → OMITE temperature (undefined)", () => {
    expect(resolveTemperature("openai", "o3-mini", 0.2)).toBeUndefined();
    expect(resolveTemperature("openai", "gpt-5", 0.7)).toBeUndefined();
    expect(resolveTemperature("openrouter", "openai/o3", 0.2)).toBeUndefined();
  });

  it("modelo normal → passa a temperatura", () => {
    expect(resolveTemperature("openai", "gpt-4o", 0.2)).toBe(0.2);
    expect(resolveTemperature("gemini", "gemini-2.5-flash", 0.7)).toBe(0.7);
  });

  it("Claude clampa em 0..1 (não 0..2)", () => {
    expect(resolveTemperature("anthropic", "claude-opus-4-8", 0.7)).toBe(0.7);
    expect(resolveTemperature("anthropic", "claude-opus-4-8", 1.5)).toBe(1);
    // Claude via OpenRouter também: detecta pelo id
    expect(resolveTemperature("openrouter", "anthropic/claude-sonnet-4", 1.8)).toBe(1);
  });

  it("não-Claude clampa em 0..2", () => {
    expect(resolveTemperature("openai", "gpt-4o", 2.5)).toBe(2);
    expect(paramPolicy("gemini", "gemini-2.5-flash").tempMax).toBe(2);
  });

  it("Effort 'default do provider' (-1) ou undefined → OMITE", () => {
    expect(resolveTemperature("openai", "gpt-4o", -1)).toBeUndefined();
    expect(resolveTemperature("openai", "gpt-4o", undefined)).toBeUndefined();
  });
});

describe("resolveMaxTokens — teto de OUTPUT (≠ context window)", () => {
  it("Effort Max (~159k) clampa pro limite real de cada modelo", () => {
    // Claude 4.x = 128k (não os 159k que o Effort pede)
    expect(resolveMaxTokens("anthropic", "claude-opus-4-8", 159000)).toBe(128000);
    // gpt-4o = 16k
    expect(resolveMaxTokens("openai", "gpt-4o", 159000)).toBe(16384);
    // gpt-5 = 128k
    expect(resolveMaxTokens("openai", "gpt-5", 200000)).toBe(128000);
    // o-series = 100k (inclui reasoning)
    expect(resolveMaxTokens("openai", "o3-mini", 200000)).toBe(100000);
    // Gemini 2.5 = 64k
    expect(resolveMaxTokens("gemini", "gemini-2.5-flash", 200000)).toBe(65536);
    // Claude 3.x legado = 8k
    expect(resolveMaxTokens("anthropic", "claude-3-5-sonnet-latest", 50000)).toBe(8192);
  });

  it("pedido abaixo do teto passa intacto", () => {
    expect(resolveMaxTokens("openai", "gpt-4o", 4000)).toBe(4000);
    expect(resolveMaxTokens("anthropic", "claude-opus-4-8", 8000)).toBe(8000);
  });

  it("modelo desconhecido → default conservador 16k", () => {
    expect(resolveMaxTokens("ollama", "modelo-aleatorio", 999999)).toBe(16384);
  });
});
