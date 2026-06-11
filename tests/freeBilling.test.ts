import { describe, it, expect } from "vitest";
import {
  computeBilledUsage,
  todayFreeStatus,
  type BillingRow,
} from "../src/usage/freeBilling";

const row = (over: Partial<BillingRow>): BillingRow => ({
  day: "2026-06-11",
  provider: "openai",
  model: "gpt-4o",
  tokensIn: 0,
  tokensOut: 0,
  cost: 0,
  ...over,
});

describe("computeBilledUsage", () => {
  it("data-sharing OFF → cobrado == bruto (sem cota)", () => {
    const rows = [row({ tokensIn: 100_000, tokensOut: 50_000, cost: 1 })];
    const r = computeBilledUsage(rows, { tier: 1, dataSharing: false });
    expect(r.billedCost).toBeCloseTo(1);
    expect(r.saved).toBe(0);
    expect(r.freeTokens).toBe(0);
  });

  it("abaixo da cota (big, Tier 1 = 250k) → cobrado 0, tudo economizado", () => {
    const rows = [row({ tokensIn: 100_000, tokensOut: 50_000, cost: 1 })]; // 150k
    const r = computeBilledUsage(rows, { tier: 1, dataSharing: true });
    expect(r.billedCost).toBeCloseTo(0);
    expect(r.saved).toBeCloseTo(1);
    expect(r.freeTokens).toBe(150_000);
  });

  it("acima da cota → cobra proporcional ao excedente", () => {
    const rows = [row({ tokensIn: 300_000, tokensOut: 200_000, cost: 4 })]; // 500k, cota 250k
    const r = computeBilledUsage(rows, { tier: 1, dataSharing: true });
    // billedFraction = (500k-250k)/500k = 0.5 → 4 * 0.5 = 2
    expect(r.billedCost).toBeCloseTo(2);
    expect(r.saved).toBeCloseTo(2);
    expect(r.freeTokens).toBe(250_000);
  });

  it("pool mini é separado do big (cota 2.5M)", () => {
    const rows = [row({ model: "gpt-4o-mini", tokensIn: 2_000_000, tokensOut: 1_000_000, cost: 1 })]; // 3M
    const r = computeBilledUsage(rows, { tier: 1, dataSharing: true });
    // (3M-2.5M)/3M = 0.1667 → ~0.1667
    expect(r.billedCost).toBeCloseTo(1 / 6, 3);
  });

  it("não-elegível (outro provider / imagem) é sempre cheio", () => {
    const rows = [
      row({ provider: "anthropic", model: "claude-opus-4-8", tokensIn: 10, tokensOut: 10, cost: 5 }),
      row({ model: "gpt-image-1", tokensIn: 1000, tokensOut: 0, cost: 0.5 }),
    ];
    const r = computeBilledUsage(rows, { tier: 1, dataSharing: true });
    expect(r.billedCost).toBeCloseTo(5.5);
    expect(r.saved).toBe(0);
  });

  it("cota reseta por DIA (200k+200k em dias diferentes = ambos grátis)", () => {
    const rows = [
      row({ day: "2026-06-10", tokensIn: 200_000, tokensOut: 0, cost: 1 }),
      row({ day: "2026-06-11", tokensIn: 200_000, tokensOut: 0, cost: 1 }),
    ];
    const r = computeBilledUsage(rows, { tier: 1, dataSharing: true });
    expect(r.billedCost).toBeCloseTo(0);
    expect(r.saved).toBeCloseTo(2);
  });

  it("Tier 3 tem cota maior (1M big) que Tier 1", () => {
    const rows = [row({ tokensIn: 600_000, tokensOut: 0, cost: 3 })]; // 600k
    const t1 = computeBilledUsage(rows, { tier: 1, dataSharing: true }); // cota 250k → cobra
    const t3 = computeBilledUsage(rows, { tier: 3, dataSharing: true }); // cota 1M → grátis
    expect(t1.billedCost).toBeGreaterThan(0);
    expect(t3.billedCost).toBeCloseTo(0);
  });
});

describe("todayFreeStatus", () => {
  it("soma só os tokens elegíveis de HOJE por pool", () => {
    const rows = [
      row({ day: "2026-06-11", tokensIn: 100_000, tokensOut: 0 }),
      row({ day: "2026-06-11", model: "gpt-4o-mini", tokensIn: 50_000, tokensOut: 0 }),
      row({ day: "2026-06-10", tokensIn: 999_999, tokensOut: 0 }), // ontem → ignora
      row({ day: "2026-06-11", provider: "anthropic", model: "claude-opus-4-8", tokensIn: 9, tokensOut: 0 }),
    ];
    const st = todayFreeStatus(rows, { tier: 1, dataSharing: true }, "2026-06-11");
    expect(st.eligible).toBe(true);
    expect(st.big.used).toBe(100_000);
    expect(st.big.allowance).toBe(250_000);
    expect(st.mini.used).toBe(50_000);
  });

  it("data-sharing OFF → não elegível, cotas 0", () => {
    const st = todayFreeStatus([], { tier: 1, dataSharing: false }, "2026-06-11");
    expect(st.eligible).toBe(false);
    expect(st.big.allowance).toBe(0);
  });
});
