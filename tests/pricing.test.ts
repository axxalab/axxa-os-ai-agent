import { describe, it, expect } from "vitest";
import { getPricing } from "../src/usage/pricing";

// O tier (free/paid/unknown) é o que a UI usa pra mostrar o badge FREE/PAID
// na lista de modelos. Esses testes travam o sinal de "é grátis ou não".

describe("getPricing — tier free/paid", () => {
  it("modelos cloud de chat são paid", () => {
    expect(getPricing("openai", "gpt-4o").tier).toBe("paid");
    expect(getPricing("anthropic", "claude-opus-4-8").tier).toBe("paid");
  });

  it("claude-fable-5 é paid (preço exato TBD, valores null)", () => {
    const p = getPricing("anthropic", "claude-fable-5");
    expect(p.tier).toBe("paid");
    expect(p.inputPerMillion).toBeNull();
  });

  it("Ollama (local) é sempre free", () => {
    expect(getPricing("ollama", "llama3.2").tier).toBe("free");
    expect(getPricing("ollama", "qualquer-modelo").tier).toBe("free");
  });

  it("OpenRouter :free é free, mesmo modelo sem :free é tratado pelo upstream", () => {
    expect(getPricing("openrouter", "meta-llama/llama-3.1-8b:free").tier).toBe(
      "free"
    );
    expect(getPricing("openrouter", "anthropic/claude-sonnet-4").tier).toBe(
      "paid"
    );
  });

  it("provider/modelo desconhecido → unknown (UI esconde o badge)", () => {
    expect(getPricing("provider-fake", "x").tier).toBe("unknown");
    expect(getPricing("openai", "").tier).toBe("unknown");
  });
});
