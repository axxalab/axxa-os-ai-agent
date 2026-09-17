import { describe, it, expect } from "vitest";
import {
  diaCurto,
  diaDePico,
  diasAtivos,
  sequenciaDeDias,
  trabalhoDoPeriodo,
} from "../src/ui/homeModules";
import type { Celula } from "../src/ui/heatmap";
import type { ChatSummary } from "../src/core/chatPersistence";

/** Uma fileira de dias em ordem, do mais antigo pro mais novo. */
const dias = (tokens: number[]): Celula[] =>
  tokens.map((t, i) => ({
    dia: `2026-09-${String(i + 1).padStart(2, "0")}`,
    tokens: t,
    nivel: t > 0 ? 1 : 0,
  }));

const chat = (over: Partial<ChatSummary> = {}): ChatSummary => ({
  id: "a",
  title: "t",
  date: "2026-09-16T10:00:00.000Z",
  mode: "agent",
  provider: "openai",
  model: "gpt-4o",
  effort: "",
  tokensIn: 100,
  tokensOut: 50,
  messageCount: 4,
  toolCount: 7,
  filePath: "p",
  starred: false,
  preview: "",
  ...over,
});

describe("sequenciaDeDias", () => {
  it("conta os dias seguidos até o último", () => {
    expect(sequenciaDeDias(dias([5, 0, 3, 3, 3]))).toBe(3);
  });

  it("HOJE em branco não zera a sequência", () => {
    // Às 9h da manhã você ainda não usou — zerar aí seria punir a pessoa por
    // acordar. A conta parte do último dia fechado.
    expect(sequenciaDeDias(dias([3, 3, 3, 0]))).toBe(3);
  });

  it("dois dias em branco no fim quebram", () => {
    expect(sequenciaDeDias(dias([3, 3, 0, 0]))).toBe(0);
  });

  it("período todo em branco não tem sequência", () => {
    expect(sequenciaDeDias(dias([0, 0, 0]))).toBe(0);
    expect(sequenciaDeDias([])).toBe(0);
  });

  it("dias que ainda não chegaram não entram na conta", () => {
    // A grade é retangular: o resto da semana atual vem como célula sem data.
    const futuro: Celula[] = [
      ...dias([4, 4]),
      { dia: null, tokens: 0, nivel: 0 },
      { dia: null, tokens: 0, nivel: 0 },
    ];
    expect(sequenciaDeDias(futuro)).toBe(2);
  });
});

describe("diasAtivos", () => {
  it("conta em quantos dias houve uso", () => {
    expect(diasAtivos(dias([1, 0, 2, 0, 3]))).toEqual({ ativos: 3, total: 5 });
  });

  it("dia sem data não conta nem como dia", () => {
    const grade: Celula[] = [...dias([1, 0]), { dia: null, tokens: 0, nivel: 0 }];
    expect(diasAtivos(grade)).toEqual({ ativos: 1, total: 2 });
  });
});

describe("diaDePico", () => {
  it("acha o dia mais forte", () => {
    const p = diaDePico(dias([1, 9, 3]));
    expect(p?.dia).toBe("2026-09-02");
    expect(p?.tokens).toBe(9);
  });

  it("empate fica com o PRIMEIRO", () => {
    // Com `>=` o rótulo pularia de dia a cada recarga quando dois empatam.
    expect(diaDePico(dias([5, 5]))?.dia).toBe("2026-09-01");
  });

  it("sem uso nenhum não há pico", () => {
    expect(diaDePico(dias([0, 0]))).toBeNull();
  });
});

describe("diaCurto", () => {
  it("vira data curta", () => {
    expect(diaCurto("2026-09-12")).toBe("Sep 12");
  });

  it("entrada estranha volta como veio, sem quebrar", () => {
    expect(diaCurto("qualquer coisa")).toBe("qualquer coisa");
  });
});

describe("trabalhoDoPeriodo", () => {
  it("soma ações do agente e mensagens", () => {
    const t = trabalhoDoPeriodo([chat(), chat({ id: "b" })], "2026-09-01");
    expect(t.acoes).toBe(14);
    expect(t.mensagens).toBe(8);
  });

  it("o que é mais velho que o período fica de fora", () => {
    // Senão os módulos discordariam do calendário logo acima deles.
    const t = trabalhoDoPeriodo(
      [chat(), chat({ id: "velho", date: "2025-01-02T10:00:00.000Z" })],
      "2026-09-01"
    );
    expect(t.acoes).toBe(7);
  });

  it("número quebrado no frontmatter não envenena o total", () => {
    const t = trabalhoDoPeriodo(
      [chat({ toolCount: NaN as unknown as number })],
      "2026-09-01"
    );
    expect(t.acoes).toBe(0);
    expect(t.mensagens).toBe(4);
  });
});
