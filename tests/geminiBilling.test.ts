import { describe, it, expect } from "vitest";
import { isGeminiBillingError } from "../src/providers/gemini";

// Muro de billing do Gemini (v0.1.162): a assinatura consumer (AI Pro/Ultra)
// NÃO cobre a API. Detectar isso → bolha de erro com "Ativar billing no AI
// Studio" em vez de "tentar de novo" inútil.

describe("isGeminiBillingError", () => {
  it("frases fortes de billing → true em qualquer contexto/status", () => {
    const cases = [
      "Imagen API is only accessible to billed users at this time.",
      "This model is only available on the paid tier.",
      "Billing account not configured for this project.",
      "FAILED_PRECONDITION: project not allowed.",
      "You must enable a paid tier to use this model.",
      "Free tier does not support image generation.",
    ];
    for (const m of cases) {
      expect(isGeminiBillingError(400, m, "chat")).toBe(true);
      expect(isGeminiBillingError(400, m, "image")).toBe(true);
    }
  });

  it("image + 429 com quota/credit → true (free tier barra modelos de imagem)", () => {
    expect(isGeminiBillingError(429, "You exceeded your current quota", "image")).toBe(true);
    expect(isGeminiBillingError(429, "out of credits", "image")).toBe(true);
  });

  it("chat + 429 quota genérico → false (pode ser rate-limit real numa conta paga)", () => {
    expect(isGeminiBillingError(429, "You exceeded your current quota", "chat")).toBe(false);
  });

  it("erros não relacionados → false", () => {
    expect(isGeminiBillingError(400, "Invalid argument: contents is required", "image")).toBe(false);
    expect(isGeminiBillingError(404, "model not found", "chat")).toBe(false);
    expect(isGeminiBillingError(500, "internal error", "image")).toBe(false);
    expect(isGeminiBillingError(429, "", "chat")).toBe(false);
  });

  it("é case-insensitive e tolera message vazio/garbage", () => {
    expect(isGeminiBillingError(400, "PAID TIER required", "chat")).toBe(true);
    expect(isGeminiBillingError(400, "", "chat")).toBe(false);
    // @ts-expect-error — robustez a undefined em runtime
    expect(isGeminiBillingError(400, undefined, "chat")).toBe(false);
  });
});
