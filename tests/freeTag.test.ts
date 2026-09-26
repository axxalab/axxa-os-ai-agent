import { describe, it, expect } from "vitest";
import { compactTokens, freeTag } from "../src/usage/freeTag";

const cfg = (over: Partial<{ free: boolean; dataSharing: boolean; tier: number }> = {}) => ({
  free: false,
  dataSharing: false,
  tier: 1,
  ...over,
});

describe("compactTokens", () => {
  it("encurta sem inventar casas", () => {
    expect(compactTokens(250_000)).toBe("250k");
    expect(compactTokens(2_500_000)).toBe("2.5M");
    expect(compactTokens(1_000_000)).toBe("1M");
    expect(compactTokens(900)).toBe("900");
  });
});

describe("freeTag", () => {
  it("modelo sem nada não ganha etiqueta", () => {
    expect(freeTag("anthropic", "claude-sonnet-5", cfg())).toBeNull();
  });

  it("grátis de fábrica é 'free', sem número", () => {
    const t = freeTag("openrouter", "meta/llama-3.3-70b:free", cfg({ free: true }));
    expect(t?.kind).toBe("always");
    expect(t?.label).toBe("free");
    expect(t?.perDay).toBeUndefined();
  });

  it("com data-sharing ligado, a etiqueta carrega a COTA do dia", () => {
    // 250k e 2,5M são cotas diferentes: dizer só "free" nas duas esconde
    // justamente o que separa uma da outra.
    expect(freeTag("openai", "gpt-5", cfg({ dataSharing: true })).label).toBe(
      "250k/day"
    );
    expect(
      freeTag("openai", "gpt-5-mini", cfg({ dataSharing: true })).label
    ).toBe("2.5M/day");
  });

  it("tier 3+ tem cota maior", () => {
    const t = freeTag("openai", "gpt-5", cfg({ dataSharing: true, tier: 4 }));
    expect(t?.perDay).toBe(1_000_000);
    expect(t?.label).toBe("1M/day");
  });

  it("sem data-sharing a cota vira OFERTA, não fato", () => {
    // Mostrar "free" numa conta que não ligou o programa é prometer desconto
    // que não existe — a fatura desmentiria a tela.
    const t = freeTag("openai", "gpt-4o", cfg({ dataSharing: false }));
    expect(t?.kind).toBe("offer");
    // O "+" é o que separa "você ganharia" de "você tem".
    expect(t?.label).toBe("+250k/day");
    expect(t?.detail).toMatch(/data sharing/i);
  });

  it("modelo OpenAI fora da lista elegível não vira cota", () => {
    // Imagem nunca entra no programa (ver usage/freeTokens.ts).
    expect(freeTag("openai", "gpt-image-1", cfg({ dataSharing: true }))).toBeNull();
  });

  it("a cota vence o 'free' de fábrica quando os dois valem", () => {
    // O número diz mais: a pessoa precisa saber que existe um limite.
    const t = freeTag("openai", "gpt-4o-mini", cfg({ free: true, dataSharing: true }));
    expect(t?.kind).toBe("daily");
  });

  it("outro provider não herda o programa da OpenAI", () => {
    expect(freeTag("openrouter", "gpt-4o", cfg({ dataSharing: true }))).toBeNull();
  });
});
