import { describe, it, expect } from "vitest";
import { detectKeyKind, providerHasAdminTier } from "../src/providers/keyFormat";
import { parseOpenAICosts } from "../src/usage/providerBilling";

describe("detectKeyKind", () => {
  it("OpenAI: sk-admin- = admin; sk-/sk-proj- = normal", () => {
    expect(detectKeyKind("openai", "sk-admin-abc")).toBe("admin");
    expect(detectKeyKind("openai", "sk-proj-abc")).toBe("normal");
    expect(detectKeyKind("openai", "sk-abc")).toBe("normal");
    expect(detectKeyKind("openai", "nope")).toBe("unknown");
  });

  it("Anthropic: sk-ant-admin = admin; sk-ant- = normal", () => {
    expect(detectKeyKind("anthropic", "sk-ant-admin01-xxx")).toBe("admin");
    expect(detectKeyKind("anthropic", "sk-ant-api03-xxx")).toBe("normal");
    expect(detectKeyKind("anthropic", "sk-ant-xxx")).toBe("normal");
    expect(detectKeyKind("anthropic", "zzz")).toBe("unknown");
  });

  it("OpenRouter: sk-or- = normal", () => {
    expect(detectKeyKind("openrouter", "sk-or-v1-xxx")).toBe("normal");
    expect(detectKeyKind("openrouter", "xxx")).toBe("unknown");
  });

  it("vazio → empty; trim aplicado", () => {
    expect(detectKeyKind("openai", "")).toBe("empty");
    expect(detectKeyKind("openai", "   ")).toBe("empty");
    expect(detectKeyKind("openai", "  sk-admin-x  ")).toBe("admin");
  });

  it("providerHasAdminTier só OpenAI/Anthropic", () => {
    expect(providerHasAdminTier("openai")).toBe(true);
    expect(providerHasAdminTier("anthropic")).toBe(true);
    expect(providerHasAdminTier("gemini")).toBe(false);
    expect(providerHasAdminTier("openrouter")).toBe(false);
  });
});

describe("parseOpenAICosts", () => {
  it("soma data[].results[].amount.value", () => {
    const json = {
      data: [
        { results: [{ amount: { value: 1.5, currency: "usd" } }] },
        { results: [{ amount: { value: 2.25 } }, { amount: { value: 0.25 } }] },
      ],
    };
    expect(parseOpenAICosts(json)).toBeCloseTo(4.0);
  });

  it("shape vazio/ruído → 0", () => {
    expect(parseOpenAICosts({})).toBe(0);
    expect(parseOpenAICosts(null)).toBe(0);
    expect(parseOpenAICosts({ data: [{ results: [] }] })).toBe(0);
  });
});
