import { describe, it, expect } from "vitest";
import { resumoDeUso, rotuloDaJanela } from "../src/ui/homeStats";
import type { ChatSummary } from "../src/core/chatPersistence";

const hoje = (dias: number) =>
  new Date(Date.now() - dias * 86_400_000).toISOString();

const chat = (over: Partial<ChatSummary> = {}): ChatSummary => ({
  id: "a",
  title: "t",
  date: hoje(0),
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

describe("resumoDeUso", () => {
  it("soma tokens e conversas da janela", () => {
    const r = resumoDeUso([chat({ id: "a" }), chat({ id: "b" })], 7);
    expect(r.chats).toBe(2);
    expect(r.tokens).toBe(3000);
  });

  it("conversa FORA da janela não entra", () => {
    // É o que faz o número significar alguma coisa: "esta semana" tem que ser
    // esta semana, senão é o total de sempre com outro nome.
    const r = resumoDeUso([chat({ id: "a" }), chat({ id: "b", date: hoje(30) })], 7);
    expect(r.chats).toBe(1);
  });

  it("modelo favorito é o de mais CONVERSAS, não o de mais tokens", () => {
    // Uma sessão gigante não faz do modelo dela o seu preferido.
    const r = resumoDeUso(
      [
        chat({ id: "a", model: "gpt-4o" }),
        chat({ id: "b", model: "gpt-4o" }),
        chat({ id: "c", model: "claude-sonnet-4-6", tokensIn: 900_000 }),
      ],
      7
    );
    expect(r.modeloFavorito?.model).toBe("gpt-4o");
    expect(r.modeloFavorito?.chats).toBe(2);
  });

  it("empate em conversas desempata por tokens", () => {
    const r = resumoDeUso(
      [
        chat({ id: "a", model: "gpt-4o", tokensIn: 10 }),
        chat({ id: "b", model: "claude-sonnet-4-6", tokensIn: 5000 }),
      ],
      7
    );
    expect(r.modeloFavorito?.model).toBe("claude-sonnet-4-6");
  });

  it("o favorito carrega o provider — é o logo que vai no cartão", () => {
    const r = resumoDeUso([chat({ model: "gemini-2.5-flash", provider: "gemini" })], 7);
    expect(r.modeloFavorito?.provider).toBe("gemini");
  });

  it("sem conversa nenhuma não inventa favorito", () => {
    const r = resumoDeUso([], 7);
    expect(r.modeloFavorito).toBeNull();
    expect(r.chats).toBe(0);
    expect(r.temCusto).toBe(false);
  });

  it("tudo local/grátis: custo zero, e o cartão sabe que não é manchete", () => {
    const r = resumoDeUso([chat({ provider: "ollama", model: "llama3.2" })], 7);
    expect(r.custo).toBe(0);
    expect(r.temCusto).toBe(false);
  });

  it("modelo sem preço conhecido marca o custo como incompleto", () => {
    // O número vira um PISO. Mostrar como se fosse exato seria prometer uma
    // precisão que não existe.
    const r = resumoDeUso([chat({ provider: "openai", model: "modelo-que-nao-existe" })], 7);
    expect(r.custoIncompleto).toBe(true);
  });

  it("as barras são uma por dia da janela, normalizadas pelo pico", () => {
    const r = resumoDeUso(
      [chat({ id: "a", date: hoje(0), tokensIn: 100, tokensOut: 0 })],
      7
    );
    expect(r.barras).toHaveLength(7);
    expect(Math.max(...r.barras)).toBe(1);
    expect(Math.min(...r.barras)).toBe(0);
  });

  it("semana vazia: barras todas em zero, sem divisão por zero", () => {
    const r = resumoDeUso([], 7);
    expect(r.barras).toHaveLength(7);
    expect(r.barras.every((b) => b === 0)).toBe(true);
  });
});

describe("rotuloDaJanela", () => {
  it("diz a janela em palavras", () => {
    expect(rotuloDaJanela(7)).toBe("Last 7 days");
    expect(rotuloDaJanela(30)).toBe("Last 30 days");
    expect(rotuloDaJanela(1)).toBe("Today");
  });
});
