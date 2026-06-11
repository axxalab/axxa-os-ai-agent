import { describe, it, expect } from "vitest";
import {
  getEffectiveTier,
  canAccess,
  viewRequiresPro,
  isLicensePro,
  PAID_VIEWS,
  NAV_ITEMS,
  PRIMARY_COUNT,
} from "../src/entitlements";

describe("getEffectiveTier", () => {
  it("override de admin tem prioridade sobre o plano real", () => {
    expect(getEffectiveTier({ accountTier: "pro", devTierOverride: "free" })).toBe("free");
    expect(getEffectiveTier({ accountTier: "free", devTierOverride: "pro" })).toBe("pro");
  });
  it("auto/ausente → usa o plano real (default pro)", () => {
    expect(getEffectiveTier({ accountTier: "pro", devTierOverride: "auto" })).toBe("pro");
    expect(getEffectiveTier({ accountTier: "free", devTierOverride: "auto" })).toBe("free");
    expect(getEffectiveTier({})).toBe("pro");
  });

  it("license válida desbloqueia pro (acima do accountTier free)", () => {
    expect(
      getEffectiveTier({ accountTier: "free", licenseKey: "AXXA-PRO-TEST-2026" })
    ).toBe("pro");
    // mas o override de admin ainda manda
    expect(
      getEffectiveTier({ devTierOverride: "free", licenseKey: "AXXA-PRO-TEST-2026" })
    ).toBe("free");
  });
});

describe("isLicensePro", () => {
  it("aceita AXXA-PRO-XXXX-XXXX (case-insensitive), rejeita o resto", () => {
    expect(isLicensePro("AXXA-PRO-TEST-2026")).toBe(true);
    expect(isLicensePro("axxa-pro-test-2026")).toBe(true);
    expect(isLicensePro("AXXA-PRO-TEST")).toBe(false);
    expect(isLicensePro("FREE-KEY")).toBe(false);
    expect(isLicensePro("")).toBe(false);
    expect(isLicensePro(undefined)).toBe(false);
  });
});

describe("canAccess / viewRequiresPro", () => {
  it("telas pagas exigem pro; chat/conversations/settings são livres", () => {
    expect(viewRequiresPro("media")).toBe(true);
    expect(viewRequiresPro("statistics")).toBe(true);
    expect(viewRequiresPro("chat")).toBe(false);
    expect(viewRequiresPro("conversations")).toBe(false);
  });
  it("free bloqueia pagas, libera livres; pro libera tudo", () => {
    expect(canAccess("media", "free")).toBe(false);
    expect(canAccess("media", "pro")).toBe(true);
    expect(canAccess("conversations", "free")).toBe(true);
    expect(canAccess("chat", "free")).toBe(true);
  });
});

describe("estrutura da navegação", () => {
  it("PAID_VIEWS = media/statistics (profile livre; projects fora da nav)", () => {
    expect([...PAID_VIEWS].sort()).toEqual(["media", "statistics"]);
  });
  it("3 itens primários e todos têm ícone", () => {
    expect(PRIMARY_COUNT).toBe(3);
    expect(NAV_ITEMS.length).toBeGreaterThanOrEqual(PRIMARY_COUNT);
    for (const i of NAV_ITEMS) expect(i.icon.length).toBeGreaterThan(0);
  });
});
