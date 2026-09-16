import { describe, it, expect } from "vitest";
import { filterModels, groupModels } from "../src/ui/modelGroups";

/**
 * O catálogo de um provider chega como uma pilha só: geradores de imagem,
 * vozes de TTS e modelos de conversa no mesmo rolo, vários deles dizendo a
 * mesma frase. Escolher ali é procurar. Estes testes são o contrato do que
 * separa essa pilha — e o que ele NÃO pode fazer é esconder alguma coisa.
 */

describe("groupModels", () => {
  it("põe junto o que é da mesma natureza, e conversa vem primeiro", () => {
    const g = groupModels("openai", [
      "gpt-image-1",
      "gpt-4o",
      "o3",
      "tts-1",
      "gpt-5",
    ]);
    // O primeiro grupo é o de conversa e não se apresenta: é o assunto da tela.
    expect(g[0].label).toBe("");
    expect(g[0].models).toEqual(["gpt-4o", "gpt-5"]);
    const rotulos = g.map((x) => x.label);
    expect(rotulos).toContain("Reasoning");
    expect(rotulos).toContain("Image");
    expect(rotulos).toContain("Voice");
    // Conversa antes de qualquer outro grupo.
    expect(rotulos.indexOf("")).toBe(0);
  });

  it("não perde NENHUM modelo pelo caminho", () => {
    // Um agrupamento que engole um item é pior que nenhum agrupamento: o
    // modelo some da tela e ninguém sabe que ele existe.
    const entrada = [
      "gpt-4o",
      "o1",
      "dall-e-3",
      "tts-1-hd",
      "text-embedding-3-small",
      "modelo-que-ninguem-conhece",
    ];
    const saida = groupModels("openai", entrada).flatMap((g) => g.models);
    expect(saida.slice().sort()).toEqual(entrada.slice().sort());
  });

  it("preserva a ordem de dentro de cada grupo", () => {
    // É a ordem que a pessoa montou em Settings — reordenar seria inventar
    // uma preferência que ela não expressou.
    const g = groupModels("openai", ["gpt-5", "gpt-4o", "gpt-4o-mini"]);
    expect(g[0].models).toEqual(["gpt-5", "gpt-4o", "gpt-4o-mini"]);
  });

  it("com um grupo só, ninguém ganha título", () => {
    // Um rótulo sobre a única lista da tela não informa nada.
    const g = groupModels("openai", ["gpt-4o", "gpt-5"]);
    expect(g).toHaveLength(1);
    expect(g[0].label).toBe("");
  });

  it("lista vazia não vira grupo vazio", () => {
    expect(groupModels("openai", [])).toEqual([]);
  });
});

describe("filterModels", () => {
  const pretty = (m: string) =>
    m.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const lista = ["gpt-5.4", "gpt-4o-mini", "o3", "dall-e-3"];

  it("acha pelo id", () => {
    expect(filterModels(lista, "4o", pretty)).toEqual(["gpt-4o-mini"]);
  });

  it("acha pelo NOME que está na tela", () => {
    // Na tela lê-se "Gpt 5.4"; ninguém digita o hífen de propósito.
    expect(filterModels(lista, "gpt 5", pretty)).toEqual(["gpt-5.4"]);
  });

  it("ignora caixa e espaço em volta", () => {
    expect(filterModels(lista, "  DALL  ", pretty)).toEqual(["dall-e-3"]);
  });

  it("busca vazia devolve tudo, e uma CÓPIA", () => {
    const r = filterModels(lista, "   ", pretty);
    expect(r).toEqual(lista);
    expect(r).not.toBe(lista);
  });

  it("sem resultado é lista vazia, não a lista inteira", () => {
    expect(filterModels(lista, "zzz", pretty)).toEqual([]);
  });
});
