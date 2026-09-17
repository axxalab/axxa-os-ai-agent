import { describe, it, expect } from "vitest";
import {
  barra,
  gastoNoPeriodo,
  mesAtual,
  rotuloReset,
  semanaAtual,
} from "../src/ui/usageBars";
import type { ChatSummary } from "../src/core/chatPersistence";

const chat = (over: Partial<ChatSummary> = {}): ChatSummary => ({
  id: "a",
  title: "t",
  date: new Date().toISOString(),
  mode: "chat",
  provider: "openai",
  model: "gpt-4o",
  effort: "",
  tokensIn: 1000,
  tokensOut: 500,
  messageCount: 2,
  toolCount: 0,
  filePath: "p",
  starred: false,
  preview: "",
  ...over,
});

describe("semanaAtual", () => {
  it("começa na SEGUNDA e zera na segunda seguinte", () => {
    // Quarta, 16/09/2026 (hora local).
    const quarta = new Date(2026, 8, 16, 15, 30).getTime();
    const p = semanaAtual(quarta);
    expect(new Date(p.inicio).getDay()).toBe(1);
    expect(new Date(p.reset).getDay()).toBe(1);
    expect(new Date(p.inicio).getDate()).toBe(14);
    expect(new Date(p.reset).getDate()).toBe(21);
  });

  it("no DOMINGO ainda é a semana que começou na segunda anterior", () => {
    // Semana que virasse no domingo poria sábado e domingo em semanas
    // diferentes — o fim de semana é o fim de uma semana, não o começo.
    const domingo = new Date(2026, 8, 20, 10).getTime();
    expect(new Date(semanaAtual(domingo).inicio).getDate()).toBe(14);
  });

  it("a própria segunda já é o começo, não o fim", () => {
    const segunda = new Date(2026, 8, 14, 0, 5).getTime();
    expect(new Date(semanaAtual(segunda).inicio).getDate()).toBe(14);
  });
});

describe("mesAtual", () => {
  it("vai do dia 1 ao dia 1 do mês seguinte", () => {
    const p = mesAtual(new Date(2026, 11, 20).getTime());
    expect(new Date(p.inicio).getMonth()).toBe(11);
    expect(new Date(p.inicio).getDate()).toBe(1);
    // Dezembro vira janeiro do ANO seguinte.
    expect(new Date(p.reset).getFullYear()).toBe(2027);
    expect(new Date(p.reset).getMonth()).toBe(0);
  });
});

describe("gastoNoPeriodo", () => {
  const agora = new Date(2026, 8, 16, 12).getTime();
  const p = semanaAtual(agora);
  const dentro = new Date(2026, 8, 15, 10).toISOString();
  const fora = new Date(2026, 8, 10, 10).toISOString();

  it("só conta o que caiu dentro da janela", () => {
    const g = gastoNoPeriodo(
      [chat({ id: "a", date: dentro }), chat({ id: "b", date: fora })],
      p
    );
    expect(g.chats).toBe(1);
    expect(g.tokens).toBe(1500);
  });

  it("data ilegível não entra nem quebra a conta", () => {
    const g = gastoNoPeriodo([chat({ id: "x", date: "não é data" })], p);
    expect(g.chats).toBe(0);
    expect(g.custo).toBe(0);
  });

  it("modelo sem preço marca o período como incompleto", () => {
    const g = gastoNoPeriodo(
      [chat({ date: dentro, model: "modelo-que-nao-existe" })],
      p
    );
    expect(g.incompleto).toBe(true);
  });
});

describe("barra", () => {
  it("metade do orçamento pinta metade", () => {
    expect(barra(5, 10)).toEqual({ fracao: 0.5, porcento: 50, estourou: false });
  });

  it("estouro não estica a barra, mas aparece na porcentagem", () => {
    const b = barra(15, 10);
    expect(b.fracao).toBe(1);
    expect(b.porcento).toBe(150);
    expect(b.estourou).toBe(true);
  });

  it("arredonda pra BAIXO: 99,6% não é 100%", () => {
    // Dizer que o orçamento acabou quando ainda não acabou é o único erro
    // caro nesta conta.
    expect(barra(9.96, 10).porcento).toBe(99);
  });

  it("sem orçamento não há barra", () => {
    expect(barra(5, 0).porcento).toBe(0);
    expect(barra(5, -1).fracao).toBe(0);
  });

  it("gasto zero é barra vazia, não barra cheia", () => {
    expect(barra(0, 10)).toEqual({ fracao: 0, porcento: 0, estourou: false });
  });
});

describe("rotuloReset", () => {
  it("a semana diz o dia; o mês diz a data", () => {
    expect(rotuloReset(new Date(2026, 8, 21).getTime(), "semana")).toBe(
      "resets Mon"
    );
    expect(rotuloReset(new Date(2026, 9, 1).getTime(), "mes")).toBe(
      "resets Oct 1"
    );
  });
});
