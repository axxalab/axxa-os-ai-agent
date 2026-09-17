import { describe, it, expect } from "vitest";
import { diaLocal, heatmap, nivelDoDia } from "../src/ui/heatmap";
import type { ChatSummary } from "../src/core/chatPersistence";

const chat = (over: Partial<ChatSummary> = {}): ChatSummary => ({
  id: "a",
  title: "t",
  date: new Date().toISOString(),
  mode: "chat",
  provider: "openai",
  model: "gpt-4o",
  effort: "",
  tokensIn: 600,
  tokensOut: 400,
  messageCount: 2,
  toolCount: 0,
  filePath: "p",
  starred: false,
  preview: "",
  ...over,
});

/** Quarta-feira, 16/09/2026, meio-dia local. */
const AGORA = new Date(2026, 8, 16, 12).getTime();
const local = (a: number, m: number, d: number, h = 10) =>
  new Date(a, m - 1, d, h).toISOString();

describe("diaLocal", () => {
  it("é o dia do relógio de quem olha, não o de UTC", () => {
    // 23h50 local continua sendo hoje, ainda que em UTC já seja amanhã (ou
    // ontem) dependendo do fuso — o quadradinho tem que cair no dia em que a
    // pessoa lembra de ter usado.
    const t = new Date(2026, 8, 16, 23, 50).getTime();
    expect(diaLocal(t)).toBe("2026-09-16");
  });

  it("zero à esquerda no mês e no dia", () => {
    expect(diaLocal(new Date(2026, 0, 5, 8).getTime())).toBe("2026-01-05");
  });
});

describe("nivelDoDia", () => {
  it("dia sem uso não tem nível", () => {
    expect(nivelDoDia(0, 1000)).toBe(0);
  });

  it("o pico é o mais forte", () => {
    expect(nivelDoDia(1000, 1000)).toBe(4);
  });

  it("as faixas são do PICO, não do ranking", () => {
    // Todos os dias iguais numa semana fraca = todos no mesmo tom. Quartil
    // daria quatro cores e inventaria um contraste que não existe.
    expect(nivelDoDia(100, 1000)).toBe(1);
    expect(nivelDoDia(300, 1000)).toBe(2);
    expect(nivelDoDia(600, 1000)).toBe(3);
    expect(nivelDoDia(800, 1000)).toBe(4);
  });

  it("sem pico não há escala", () => {
    expect(nivelDoDia(500, 0)).toBe(0);
  });
});

describe("heatmap", () => {
  it("a grade é retangular: 7 linhas por semana", () => {
    const h = heatmap([], 12, AGORA);
    expect(h.celulas).toHaveLength(84);
    expect(h.semanas).toBe(12);
  });

  it("a última coluna é ESTA semana, e começa numa segunda", () => {
    const h = heatmap([], 12, AGORA);
    const ultimaColuna = h.celulas.slice(-7);
    // 16/09/2026 é quarta; a semana dela começou na segunda, dia 14.
    expect(ultimaColuna[0].dia).toBe("2026-09-14");
  });

  it("dia no FUTURO não é dia: fica sem data em vez de valer zero", () => {
    // Pintar zero num dia que ainda não chegou diria "não usei" — e não é
    // isso; a grade só é retangular porque grade é retangular.
    const h = heatmap([], 12, AGORA);
    const ultimaColuna = h.celulas.slice(-7);
    // Quarta é o índice 2: quinta em diante ainda não aconteceu.
    expect(ultimaColuna[2].dia).toBe("2026-09-16");
    expect(ultimaColuna[3].dia).toBeNull();
    expect(ultimaColuna[6].dia).toBeNull();
  });

  it("soma os tokens do dia, de todas as conversas", () => {
    const h = heatmap(
      [
        chat({ id: "a", date: local(2026, 9, 15), tokensIn: 100, tokensOut: 50 }),
        chat({ id: "b", date: local(2026, 9, 15), tokensIn: 30, tokensOut: 20 }),
      ],
      12,
      AGORA
    );
    const quinze = h.celulas.find((c) => c.dia === "2026-09-15");
    expect(quinze?.tokens).toBe(200);
    expect(h.pico).toBe(200);
    expect(h.total).toBe(200);
  });

  it("conversa mais velha que a grade não conta no total mostrado", () => {
    // O cartão promete "os últimos meses"; somar o que está fora faria o
    // total discordar do desenho logo acima dele.
    const h = heatmap([chat({ date: local(2025, 1, 10) })], 12, AGORA);
    expect(h.total).toBe(0);
    expect(h.pico).toBe(0);
  });

  it("data ilegível não entra nem quebra a grade", () => {
    const h = heatmap([chat({ date: "ontem de manhã" })], 12, AGORA);
    expect(h.total).toBe(0);
    expect(h.celulas).toHaveLength(84);
  });

  it("o dia mais forte fica no nível 4 e o mais fraco no 1", () => {
    const h = heatmap(
      [
        chat({ id: "a", date: local(2026, 9, 15), tokensIn: 1000, tokensOut: 0 }),
        chat({ id: "b", date: local(2026, 9, 14), tokensIn: 50, tokensOut: 0 }),
      ],
      12,
      AGORA
    );
    expect(h.celulas.find((c) => c.dia === "2026-09-15")?.nivel).toBe(4);
    expect(h.celulas.find((c) => c.dia === "2026-09-14")?.nivel).toBe(1);
  });
});
