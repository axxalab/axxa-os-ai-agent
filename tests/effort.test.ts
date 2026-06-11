import { describe, it, expect } from "vitest";
import {
  resolveEffortConfig,
  effortToMaxTokens,
  effortToMaxTokensSmart,
  effortToVaultLookup,
  isEffortLevel,
  DEFAULT_EFFORT_CONFIGS,
} from "../src/components/_shared/effort";

describe("isEffortLevel", () => {
  it("aceita os 5 níveis válidos", () => {
    for (const lvl of ["low", "med", "high", "xhigh", "max"]) {
      expect(isEffortLevel(lvl)).toBe(true);
    }
  });
  it("rejeita lixo", () => {
    expect(isEffortLevel("ultra")).toBe(false);
    expect(isEffortLevel("")).toBe(false);
  });
});

describe("resolveEffortConfig", () => {
  it("nível desconhecido cai pra 'med'", () => {
    expect(resolveEffortConfig("bogus")).toEqual(DEFAULT_EFFORT_CONFIGS.med);
  });

  it("sem overrides devolve o default do nível", () => {
    expect(resolveEffortConfig("low")).toEqual(DEFAULT_EFFORT_CONFIGS.low);
  });

  it("override parcial mescla só os campos presentes", () => {
    const cfg = resolveEffortConfig("low", { low: { maxTokens: 999 } });
    expect(cfg.maxTokens).toBe(999);
    // resto continua o default de 'low'
    expect(cfg.agentMaxTurns).toBe(DEFAULT_EFFORT_CONFIGS.low.agentMaxTurns);
    expect(cfg.vaultTopK).toBe(DEFAULT_EFFORT_CONFIGS.low.vaultTopK);
  });

  it("REGRESSÃO: override com 0/false é respeitado (não cai no default por falsy)", () => {
    // `?? base` precisa tratar 0 e false como valores válidos, não ausência.
    const cfg = resolveEffortConfig("high", {
      high: { temperature: 0, toolRetryOnError: 0, parallelToolCalls: false },
    });
    expect(cfg.temperature).toBe(0);
    expect(cfg.toolRetryOnError).toBe(0);
    expect(cfg.parallelToolCalls).toBe(false);
  });
});

describe("effortToMaxTokens (legacy)", () => {
  it("usa o cap fixo do nível", () => {
    expect(effortToMaxTokens("low")).toBe(512);
    expect(effortToMaxTokens("high")).toBe(6000);
  });
  it("max (uncapped=0) vira 16000", () => {
    expect(effortToMaxTokens("max")).toBe(16000);
  });
  it("nível inválido cai em 2048", () => {
    expect(effortToMaxTokens("bogus")).toBe(2048);
  });
});

describe("effortToMaxTokensSmart", () => {
  it("níveis com cap fixo ignoram o context window", () => {
    expect(effortToMaxTokensSmart("low", 200_000)).toBe(512);
    expect(effortToMaxTokensSmart("high", 200_000)).toBe(6000);
  });

  it("max usa ~80% do context window menos 1k de reserva", () => {
    // 200k * 0.8 - 1000 = 159000
    expect(effortToMaxTokensSmart("max", 200_000)).toBe(159_000);
  });

  it("max nunca devolve menos que o piso de 2048", () => {
    // 1000 * 0.8 - 1000 = -200 → clamp pra 2048
    expect(effortToMaxTokensSmart("max", 1000)).toBe(2048);
  });

  it("override do contextReservePercent é clampado em [10, 95]", () => {
    // pct=200 → clamp 95 → 100000*0.95 - 1000 = 94000
    const v = effortToMaxTokensSmart("max", 100_000, {
      max: { contextReservePercent: 200 },
    });
    expect(v).toBe(94_000);
  });
});

describe("effortToVaultLookup", () => {
  it("extrai topK + excerptChars do config do nível", () => {
    expect(effortToVaultLookup("low")).toEqual({ topK: 3, excerptChars: 300 });
    expect(effortToVaultLookup("max")).toEqual({ topK: 12, excerptChars: 2000 });
  });
});
