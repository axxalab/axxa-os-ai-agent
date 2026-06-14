import { describe, it, expect } from "vitest";
import { getTranslations } from "../src/i18n";
import { EN_US } from "../src/i18n/en-us";

// EN-US virou o ÚNICO locale (PT-BR removido na base 1.0). getTranslations ignora
// o param e sempre devolve EN_US; users salvos em "pt-br" caem no EN sem quebrar.

describe("i18n — EN-US único", () => {
  it("getTranslations sempre retorna EN_US, qualquer locale (inclui pt-br legado)", () => {
    expect(getTranslations("en-us")).toBe(EN_US);
    expect(getTranslations("pt-br")).toBe(EN_US);
    expect(getTranslations("")).toBe(EN_US);
    expect(getTranslations("qualquer-coisa")).toBe(EN_US);
  });

  it("o dicionário mantém as seções principais + funções tipadas", () => {
    expect(typeof EN_US.composer).toBe("object");
    expect(typeof EN_US.settings).toBe("object");
    expect(typeof EN_US.ai.err.noKey).toBe("function");
    expect(EN_US.ai.err.noKey("OpenAI")).toContain("OpenAI");
  });

  it("textos-chave estão em inglês (sem resíduo PT)", () => {
    expect(EN_US.ai.thinking.toLowerCase()).not.toMatch(/pensando|aguarde/);
    expect(JSON.stringify(EN_US.settings).toLowerCase()).not.toContain("configurações");
  });
});
