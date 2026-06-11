import { describe, it, expect } from "vitest";
import {
  parseOpenRouterKey,
  billingCapabilityFor,
  fetchOpenRouterBilling,
  type RequestUrlLike,
} from "../src/usage/providerBilling";

describe("parseOpenRouterKey", () => {
  it("usage + limit → remaining computado", () => {
    const r = parseOpenRouterKey({ data: { usage: 3.5, limit: 10, is_free_tier: false } });
    expect(r.usageUsd).toBe(3.5);
    expect(r.limitUsd).toBe(10);
    expect(r.remainingUsd).toBe(6.5);
    expect(r.isFreeTier).toBe(false);
  });

  it("limit null → remaining null (ilimitado)", () => {
    const r = parseOpenRouterKey({ data: { usage: 2, limit: null } });
    expect(r.limitUsd).toBeNull();
    expect(r.remainingUsd).toBeNull();
  });

  it("limit_remaining explícito tem prioridade", () => {
    const r = parseOpenRouterKey({ data: { usage: 1, limit: 10, limit_remaining: 7 } });
    expect(r.remainingUsd).toBe(7);
  });

  it("json vazio/ruído → zeros seguros", () => {
    expect(parseOpenRouterKey({}).usageUsd).toBe(0);
    expect(parseOpenRouterKey(null).usageUsd).toBe(0);
    expect(parseOpenRouterKey(undefined).remainingUsd).toBeNull();
  });
});

describe("billingCapabilityFor", () => {
  it("mapeia a capacidade real de cada provider", () => {
    expect(billingCapabilityFor("openrouter").capability).toBe("live-key");
    expect(billingCapabilityFor("openai").capability).toBe("admin-key");
    expect(billingCapabilityFor("anthropic").capability).toBe("admin-key");
    expect(billingCapabilityFor("gemini").capability).toBe("console");
    expect(billingCapabilityFor("nim").capability).toBe("console");
    expect(billingCapabilityFor("ollama").capability).toBe("free");
  });

  it("provider desconhecido → fallback console", () => {
    expect(billingCapabilityFor("zzz").capability).toBe("console");
  });
});

describe("fetchOpenRouterBilling", () => {
  it("chama /auth/key com Bearer e parseia", async () => {
    const fake: RequestUrlLike = async (opts) => {
      expect(opts.url).toContain("/api/v1/auth/key");
      expect(opts.headers.Authorization).toBe("Bearer sk-or-x");
      return { status: 200, json: { data: { usage: 4, limit: 20 } } };
    };
    const r = await fetchOpenRouterBilling("sk-or-x", fake);
    expect(r.usageUsd).toBe(4);
    expect(r.remainingUsd).toBe(16);
  });

  it("sem key → erro", async () => {
    const noop: RequestUrlLike = async () => ({ status: 200 });
    await expect(fetchOpenRouterBilling("", noop)).rejects.toThrow();
  });

  it("HTTP de erro → throw", async () => {
    const fake: RequestUrlLike = async () => ({ status: 401, json: {} });
    await expect(fetchOpenRouterBilling("k", fake)).rejects.toThrow();
  });
});
