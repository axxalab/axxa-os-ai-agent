import { describe, it, expect } from "vitest";
import {
  openaiFreeAllowance,
  openaiFreeTierForModel,
} from "../src/usage/freeTokens";

// Data-sharing da OpenAI: tokens grátis em modelos de TEXTO, nunca em imagem.
describe("openaiFreeAllowance", () => {
  it("Tier 1 com data-sharing → 250k grandes + 2.5M mini, imagem NÃO coberta", () => {
    const a = openaiFreeAllowance(1, true);
    expect(a.eligible).toBe(true);
    expect(a.bigPerDay).toBe(250_000);
    expect(a.miniPerDay).toBe(2_500_000);
    expect(a.imageEligible).toBe(false);
  });

  it("Tier 3+ com data-sharing → 1M grandes + 10M mini", () => {
    const a = openaiFreeAllowance(3, true);
    expect(a.bigPerDay).toBe(1_000_000);
    expect(a.miniPerDay).toBe(10_000_000);
    expect(a.imageEligible).toBe(false);
  });

  it("sem data-sharing OU tier < 1 → não elegível (zeros)", () => {
    expect(openaiFreeAllowance(1, false).eligible).toBe(false);
    expect(openaiFreeAllowance(0, true).eligible).toBe(false);
    expect(openaiFreeAllowance(1, false).bigPerDay).toBe(0);
  });
});

describe("openaiFreeTierForModel", () => {
  it("classifica mini antes de big (prefixos sobrepostos)", () => {
    expect(openaiFreeTierForModel("gpt-4o-mini")).toBe("mini");
    expect(openaiFreeTierForModel("gpt-4o")).toBe("big");
    expect(openaiFreeTierForModel("gpt-5-nano")).toBe("mini");
    expect(openaiFreeTierForModel("gpt-5")).toBe("big");
    expect(openaiFreeTierForModel("o3-mini")).toBe("mini");
    expect(openaiFreeTierForModel("o3")).toBe("big");
  });

  it("modelos de imagem NÃO estão na lista elegível → null", () => {
    expect(openaiFreeTierForModel("dall-e-3")).toBeNull();
    expect(openaiFreeTierForModel("gpt-image-1")).toBeNull();
  });
});
