import { describe, it, expect } from "vitest";
import {
  getContextWindow,
  formatTokens,
} from "../src/components/_shared/contextWindows";

describe("getContextWindow", () => {
  it("match exato de modelos conhecidos", () => {
    expect(getContextWindow("gpt-4o")).toBe(128_000);
    expect(getContextWindow("claude-opus-4-8")).toBe(200_000);
    expect(getContextWindow("gpt-5")).toBe(256_000);
  });

  it("match por prefixo pra versões datadas", () => {
    expect(getContextWindow("gpt-4o-2024-08-06")).toBe(128_000);
    expect(getContextWindow("claude-opus-4-8-20260101")).toBe(200_000);
  });

  it("modelo desconhecido cai no fallback de 128k", () => {
    expect(getContextWindow("modelo-aleatorio-xyz")).toBe(128_000);
    expect(getContextWindow("")).toBe(128_000);
  });
});

describe("formatTokens", () => {
  it("abaixo de mil mostra o número cru", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(999)).toBe("999");
  });

  it("milhares com 1 casa abaixo de 10k, sem casas acima", () => {
    expect(formatTokens(1234)).toBe("1.2k");
    expect(formatTokens(128_000)).toBe("128k");
    expect(formatTokens(10_000)).toBe("10k");
  });

  it("milhões com 1 casa", () => {
    expect(formatTokens(1_500_000)).toBe("1.5M");
  });
});
