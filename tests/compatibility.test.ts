import { describe, it, expect } from "vitest";
import { checkCompatibility } from "../src/providers/compatibility";

// Lógica de "esse modo+modelo combinam?" — decide se o composer libera o envio
// e o que sugerir. Quebra calado quando a matriz de capabilities muda.

const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "o1-mini", "dall-e-3"];

describe("checkCompatibility", () => {
  it("agent + modelo sem tools → bloqueia com reason agent-no-tools", () => {
    const r = checkCompatibility("agent", "openai", "o1-mini", OPENAI_MODELS);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("agent-no-tools");
    // sugere modelos do mesmo provider que TÊM tools
    expect(r.suggestions).toContain("gpt-4o");
    expect(r.suggestions).not.toContain("o1-mini");
  });

  it("agent + modelo com tools → ok", () => {
    const r = checkCompatibility("agent", "openai", "gpt-4o", OPENAI_MODELS);
    expect(r.ok).toBe(true);
    expect(r.reason).toBe(null);
  });

  it("imagem anexada + modelo sem vision → reason vision-no-vision", () => {
    const r = checkCompatibility("chat", "openai", "o1-mini", OPENAI_MODELS, true);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("vision-no-vision");
    expect(r.suggestions).toContain("gpt-4o"); // tem vision
  });

  it("imagem anexada + modelo com vision → ok", () => {
    const r = checkCompatibility("chat", "openai", "gpt-4o", OPENAI_MODELS, true);
    expect(r.ok).toBe(true);
  });

  it("modelo de generation em agent → bloqueia (via agent-no-tools, ver nota)", () => {
    // NOTA/ACHADO: um modelo de generation (ex: dall-e-3) tem tools=false, então
    // cai na checagem #1 (agent-no-tools) ANTES da #3 (generation-model-in-chat).
    // Como nenhum modelo de generation tem tools=true, a reason
    // "generation-model-in-chat" é hoje praticamente inalcançável em agent — dead
    // branch inofensivo (o bloqueio + sugestão de modelos-com-tools está correto).
    // Teste documenta o comportamento REAL; não mascarar com a reason "ideal".
    const r = checkCompatibility("agent", "openai", "dall-e-3", OPENAI_MODELS);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("agent-no-tools");
  });

  it("chat normal com modelo comum → ok (sem anexo)", () => {
    const r = checkCompatibility("chat", "openai", "gpt-4o-mini", OPENAI_MODELS);
    expect(r.ok).toBe(true);
    expect(r.reason).toBe(null);
  });
});
