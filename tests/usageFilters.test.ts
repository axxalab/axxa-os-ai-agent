import { describe, it, expect } from "vitest";
import {
  FILTRO_VAZIO,
  alternar,
  aplicar,
  opcoes,
  temFiltro,
} from "../src/usage/filters";
import type { ChatSummary } from "../src/core/chatPersistence";

const chat = (over: Partial<ChatSummary> = {}): ChatSummary => ({
  id: "a",
  title: "t",
  date: new Date().toISOString(),
  mode: "chat",
  provider: "openai",
  model: "gpt-5",
  effort: "",
  tokensIn: 100,
  tokensOut: 50,
  messageCount: 2,
  toolCount: 0,
  filePath: "p",
  starred: false,
  preview: "",
  ...over,
});

const dias = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

describe("opcoes", () => {
  const chats = [
    chat({ id: "a", provider: "openai" }),
    chat({ id: "b", provider: "openai" }),
    chat({ id: "c", provider: "anthropic" }),
  ];

  it("lista o que existe, do mais usado pro menos", () => {
    expect(opcoes(chats, "provider")).toEqual([
      { id: "openai", count: 2 },
      { id: "anthropic", count: 1 },
    ]);
  });

  it("valor vazio não vira opção", () => {
    // Uma opção sem nome não diz nada e ainda ocupa uma linha da lista.
    expect(opcoes([chat({ model: "" })], "model")).toEqual([]);
  });

  it("empate resolve pelo nome — ordem estável", () => {
    // Lista que troca de ordem sozinha a cada abertura parece defeito.
    const empate = [chat({ id: "a", model: "zzz" }), chat({ id: "b", model: "aaa" })];
    expect(opcoes(empate, "model").map((o) => o.id)).toEqual(["aaa", "zzz"]);
  });
});

describe("alternar", () => {
  it("liga o que estava fora e desliga o que estava dentro", () => {
    expect(alternar([], "openai")).toEqual(["openai"]);
    expect(alternar(["openai"], "openai")).toEqual([]);
  });

  it("não mexe no array original", () => {
    const antes = ["openai"];
    alternar(antes, "anthropic");
    expect(antes).toEqual(["openai"]);
  });
});

describe("aplicar", () => {
  const chats = [
    chat({ id: "a", provider: "openai", model: "gpt-5", mode: "chat" }),
    chat({ id: "b", provider: "anthropic", model: "claude-sonnet-4-6", mode: "agent" }),
    chat({ id: "c", provider: "openai", model: "gpt-4o", mode: "agent" }),
  ];

  it("sem filtro, passa tudo", () => {
    expect(aplicar(chats, FILTRO_VAZIO)).toHaveLength(3);
  });

  it("lista vazia é 'sem restrição', não 'nenhum'", () => {
    // O estado inicial da página é "mostre tudo": obrigar a marcar todos os
    // providers pra ver tudo seria trabalho por nada.
    expect(aplicar(chats, { ...FILTRO_VAZIO, providers: [] })).toHaveLength(3);
  });

  it("filtra por provider, modelo e modo", () => {
    expect(
      aplicar(chats, { ...FILTRO_VAZIO, providers: ["openai"] }).map((c) => c.id)
    ).toEqual(["a", "c"]);
    expect(
      aplicar(chats, { ...FILTRO_VAZIO, models: ["gpt-4o"] }).map((c) => c.id)
    ).toEqual(["c"]);
    expect(
      aplicar(chats, { ...FILTRO_VAZIO, modes: ["agent"] }).map((c) => c.id)
    ).toEqual(["b", "c"]);
  });

  it("dois filtros se somam (E, não OU)", () => {
    const r = aplicar(chats, {
      ...FILTRO_VAZIO,
      providers: ["openai"],
      modes: ["agent"],
    });
    expect(r.map((c) => c.id)).toEqual(["c"]);
  });

  it("vários valores na mesma dimensão são OU", () => {
    const r = aplicar(chats, {
      ...FILTRO_VAZIO,
      providers: ["openai", "anthropic"],
    });
    expect(r).toHaveLength(3);
  });

  it("período corta pelo tempo", () => {
    const velhas = [
      chat({ id: "nova", date: dias(2) }),
      chat({ id: "velha", date: dias(40) }),
    ];
    expect(aplicar(velhas, { ...FILTRO_VAZIO, days: 7 }).map((c) => c.id)).toEqual([
      "nova",
    ]);
  });

  it("data ilegível fica de fora de um filtro por período", () => {
    // Dizer que ela caiu dentro seria inventar uma data que o arquivo não tem.
    const r = aplicar([chat({ date: "sei lá" })], { ...FILTRO_VAZIO, days: 7 });
    expect(r).toHaveLength(0);
  });

  it("sem período, a data ilegível continua passando", () => {
    // Ela existe e gastou tokens: sumir dela sem ninguém ter filtrado nada
    // esconderia gasto.
    const r = aplicar([chat({ date: "sei lá" })], FILTRO_VAZIO);
    expect(r).toHaveLength(1);
  });
});

describe("temFiltro", () => {
  it("sabe quando há recorte", () => {
    expect(temFiltro(FILTRO_VAZIO)).toBe(false);
    expect(temFiltro({ ...FILTRO_VAZIO, days: 7 })).toBe(true);
    expect(temFiltro({ ...FILTRO_VAZIO, models: ["gpt-5"] })).toBe(true);
  });
});
