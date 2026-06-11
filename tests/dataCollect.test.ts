import { describe, it, expect, afterEach } from "vitest";
import {
  getHotLevel,
  registerLocalUsage,
  hotLabel,
} from "../src/providers/dataCollect";

// "Hot" = popularidade (baseline curado + uso local). Sem telemetria.

afterEach(() => registerLocalUsage({})); // limpa o overlay de uso local

describe("getHotLevel — baseline curado (sem uso local)", () => {
  it("modelos populares ficam quentes (nível ≥ 2)", () => {
    expect(getHotLevel("openai", "gpt-4o").level).toBeGreaterThanOrEqual(2);
    expect(getHotLevel("anthropic", "claude-opus-4-8").level).toBeGreaterThanOrEqual(2);
    expect(getHotLevel("anthropic", "claude-fable-5").level).toBeGreaterThanOrEqual(2);
  });

  it("modelo obscuro/desconhecido → nível 0", () => {
    const h = getHotLevel("openrouter", "vendor-aleatorio/modelo-xyz");
    expect(h.level).toBe(0);
    expect(h.usedLocally).toBe(false);
  });

  it("nível 3 (em alta) NÃO vem só do baseline — precisa de uso local", () => {
    // teto do baseline puro fica em nível 2
    expect(getHotLevel("openai", "gpt-4o").level).toBe(2);
  });
});

describe("getHotLevel — overlay de uso local", () => {
  it("uso local pesado empurra pro nível 3 + marca usedLocally", () => {
    registerLocalUsage({ "gpt-4o": 50, "claude-3-haiku": 2 });
    const h = getHotLevel("openai", "gpt-4o");
    expect(h.level).toBe(3);
    expect(h.usedLocally).toBe(true);
  });

  it("modelo SEM baseline mas muito usado ainda esquenta", () => {
    registerLocalUsage({ "vendor/modelo-meu": 10 });
    const h = getHotLevel("openrouter", "vendor/modelo-meu");
    expect(h.level).toBeGreaterThanOrEqual(2);
    expect(h.usedLocally).toBe(true);
  });

  it("normaliza pelo máximo (o mais usado = 1.0)", () => {
    registerLocalUsage({ "modelo-a": 100, "modelo-b": 1 });
    // 'a' (top) deve esquentar mais que 'b'
    const a = getHotLevel("openai", "modelo-a").score;
    const b = getHotLevel("openai", "modelo-b").score;
    expect(a).toBeGreaterThan(b);
  });
});

describe("hotLabel", () => {
  it("nível 0 → string vazia", () => {
    expect(hotLabel({ level: 0, score: 0, usedLocally: false })).toBe("");
  });
  it("inclui menção ao uso local quando aplicável", () => {
    expect(hotLabel({ level: 3, score: 1, usedLocally: true })).toMatch(/você/i);
  });
});
