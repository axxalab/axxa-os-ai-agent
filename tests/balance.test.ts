import { describe, it, expect } from "vitest";
import {
  spentSinceFromRows,
  computeBalance,
  hasValidAnchor,
} from "../src/usage/balance";
import type { BillingRow } from "../src/usage/freeBilling";
import { parseAnthropicCosts } from "../src/usage/providerBilling";

const row = (over: Partial<BillingRow>): BillingRow => ({
  day: "2026-06-11",
  provider: "openai",
  model: "gpt-4o",
  tokensIn: 0,
  tokensOut: 0,
  cost: 0,
  ...over,
});

describe("spentSinceFromRows", () => {
  it("soma só o provider certo e a partir da data (inclusive)", () => {
    const rows = [
      row({ provider: "openai", day: "2026-06-09", cost: 1 }), // antes → fora
      row({ provider: "openai", day: "2026-06-10", cost: 2 }), // desde → conta
      row({ provider: "openai", day: "2026-06-12", cost: 3 }),
      row({ provider: "anthropic", day: "2026-06-12", cost: 9 }), // outro provider
    ];
    expect(spentSinceFromRows(rows, "openai", "2026-06-10")).toBeCloseTo(5);
  });

  it("cost null conta como 0", () => {
    const rows = [row({ cost: null }), row({ cost: 2 })];
    expect(spentSinceFromRows(rows, "openai", "2026-06-01")).toBeCloseTo(2);
  });
});

describe("computeBalance", () => {
  it("âncora válida → saldo = amount − spent", () => {
    const r = computeBalance({ amount: 20, date: "2026-06-10" }, 7, "real");
    expect(r.balance).toBeCloseTo(13);
    expect(r.basis).toBe("real");
  });

  it("sem âncora → balance null", () => {
    expect(computeBalance(undefined, 5, "estimate").balance).toBeNull();
    expect(computeBalance({ amount: 10, date: "" }, 5, "estimate").balance).toBeNull();
  });
});

describe("hasValidAnchor", () => {
  it("exige amount numérico + date", () => {
    expect(hasValidAnchor({ amount: 5, date: "2026-06-10" })).toBe(true);
    expect(hasValidAnchor({ amount: 5, date: "" })).toBe(false);
    expect(hasValidAnchor(undefined)).toBe(false);
  });
});

describe("parseAnthropicCosts (tolerante)", () => {
  it("amount como number OU string decimal", () => {
    const json = {
      data: [
        { results: [{ amount: 1.5, currency: "USD" }] },
        { results: [{ amount: "2.25" }] },
      ],
    };
    expect(parseAnthropicCosts(json)).toBeCloseTo(3.75);
  });
  it("shape estranho → 0 (não quebra)", () => {
    expect(parseAnthropicCosts({})).toBe(0);
    expect(parseAnthropicCosts({ data: [{ results: [{ foo: 1 }] }] })).toBe(0);
  });
});
