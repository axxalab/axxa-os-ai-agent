import { describe, it, expect } from "vitest";
import {
  diasAtivos,
  modelosMaisUsados,
  sequenciaDeDias,
  trabalhoDoPeriodo,
} from "../src/ui/homeModules";
import type { Celula } from "../src/ui/heatmap";
import type { ChatSummary } from "../src/core/chatPersistence";

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

/** Quarta-feira, 16/09/2026, meio-dia local. */
const AGORA = new Date(2026, 8, 16, 12).getTime();
const local = (a: number, m: number, d: number, h = 10) =>
  new Date(a, m - 1, d, h).toISOString();

describe("sequenciaDeDias", () => {
  it("conta os dias seguidos até hoje", () => {
    const c = [
      chat({ id: "a", date: local(2026, 9, 14) }),
      chat({ id: "b", date: local(2026, 9, 15) }),
      chat({ id: "c", date: local(2026, 9, 16) }),
    ];
    expect(sequenciaDeDias(c, AGORA)).toBe(3);
  });

  it("HOJE em branco não zera: a conta parte do último dia fechado", () => {
    // Às 9h da manhã você ainda não usou — zerar aí seria punir a pessoa por
    // acordar.
    const c = [
      chat({ id: "a", date: local(2026, 9, 14) }),
      chat({ id: "b", date: local(2026, 9, 15) }),
    ];
    expect(sequenciaDeDias(c, AGORA)).toBe(2);
  });

  it("dois dias em branco quebram", () => {
    const c = [chat({ id: "a", date: local(2026, 9, 13) })];
    expect(sequenciaDeDias(c, AGORA)).toBe(0);
  });

  it("a sequência ATRAVESSA a virada do mês", () => {
    // O calendário da tela recomeça no dia 1; o hábito não. Se a conta olhasse
    // o desenho, todo dia 1 a sequência morreria sozinha.
    const agora = new Date(2026, 9, 2, 12).getTime(); // 02/10
    const c = [
      chat({ id: "a", date: local(2026, 9, 29) }),
      chat({ id: "b", date: local(2026, 9, 30) }),
      chat({ id: "c", date: local(2026, 10, 1) }),
      chat({ id: "d", date: local(2026, 10, 2) }),
    ];
    expect(sequenciaDeDias(c, agora)).toBe(4);
  });

  it("várias conversas no mesmo dia contam UM dia", () => {
    const c = [
      chat({ id: "a", date: local(2026, 9, 16, 9) }),
      chat({ id: "b", date: local(2026, 9, 16, 18) }),
    ];
    expect(sequenciaDeDias(c, AGORA)).toBe(1);
  });

  it("sem conversa nenhuma, sem sequência", () => {
    expect(sequenciaDeDias([], AGORA)).toBe(0);
  });

  it("data ilegível não quebra a conta", () => {
    expect(sequenciaDeDias([chat({ date: "sei lá" })], AGORA)).toBe(0);
  });
});

describe("diasAtivos", () => {
  const dias = (tokens: number[]): Celula[] =>
    tokens.map((t, i) => ({
      dia: `2026-09-${String(i + 1).padStart(2, "0")}`,
      tokens: t,
      nivel: t > 0 ? 1 : 0,
    }));

  it("conta em quantos dias houve uso", () => {
    expect(diasAtivos(dias([1, 0, 2, 0, 3]))).toEqual({ ativos: 3, total: 5 });
  });

  it("casa vazia da grade não conta nem como dia", () => {
    const grade: Celula[] = [...dias([1, 0]), { dia: null, tokens: 0, nivel: 0 }];
    expect(diasAtivos(grade)).toEqual({ ativos: 1, total: 2 });
  });
});

describe("trabalhoDoPeriodo", () => {
  it("soma ações do agente e mensagens", () => {
    const t = trabalhoDoPeriodo([chat(), chat({ id: "b" })], "2026-09-01");
    expect(t.acoes).toBe(14);
    expect(t.mensagens).toBe(8);
  });

  it("o que é de antes do mês fica de fora", () => {
    // Senão os números discordariam do calendário logo acima deles.
    const t = trabalhoDoPeriodo(
      [chat(), chat({ id: "velho", date: "2026-08-02T10:00:00.000Z" })],
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

describe("modelosMaisUsados", () => {
  const desde = "2026-09-01";

  it("ordena por tokens e calcula a fatia de cada um", () => {
    const lista = modelosMaisUsados(
      [
        chat({ id: "a", model: "gpt-5", tokensIn: 700, tokensOut: 0 }),
        chat({ id: "b", model: "claude-sonnet-4-6", tokensIn: 300, tokensOut: 0 }),
      ],
      desde
    );
    expect(lista.map((m) => m.model)).toEqual(["gpt-5", "claude-sonnet-4-6"]);
    expect(lista.map((m) => m.pct)).toEqual([70, 30]);
  });

  it("a fatia é de TOKENS, não de conversas", () => {
    // Contar conversas faria um "oi" pesar o mesmo que uma sessão de três
    // horas — e o número grande do cartão é em tokens.
    const lista = modelosMaisUsados(
      [
        chat({ id: "a", model: "gpt-5", tokensIn: 10, tokensOut: 0 }),
        chat({ id: "b", model: "gpt-5", tokensIn: 10, tokensOut: 0 }),
        chat({ id: "c", model: "claude-sonnet-4-6", tokensIn: 980, tokensOut: 0 }),
      ],
      desde
    );
    expect(lista[0].model).toBe("claude-sonnet-4-6");
    expect(lista[0].pct).toBe(98);
  });

  it("soma as conversas de cada modelo e guarda o provider pro logo", () => {
    const lista = modelosMaisUsados(
      [
        chat({ id: "a", model: "gemini-2.5-flash", provider: "gemini" }),
        chat({ id: "b", model: "gemini-2.5-flash", provider: "gemini" }),
      ],
      desde
    );
    expect(lista[0].chats).toBe(2);
    expect(lista[0].provider).toBe("gemini");
  });

  it("corta no limite pedido", () => {
    const lista = modelosMaisUsados(
      [
        chat({ id: "a", model: "m1", tokensIn: 400 }),
        chat({ id: "b", model: "m2", tokensIn: 300 }),
        chat({ id: "c", model: "m3", tokensIn: 200 }),
        chat({ id: "d", model: "m4", tokensIn: 100 }),
      ],
      desde,
      3
    );
    expect(lista).toHaveLength(3);
    expect(lista.map((m) => m.model)).toEqual(["m1", "m2", "m3"]);
  });

  it("o que é de antes do mês não entra", () => {
    const lista = modelosMaisUsados(
      [
        chat({ id: "a", model: "gpt-5" }),
        chat({ id: "b", model: "antigo", date: "2026-08-20T10:00:00.000Z" }),
      ],
      desde
    );
    expect(lista.map((m) => m.model)).toEqual(["gpt-5"]);
    expect(lista[0].pct).toBe(100);
  });

  it("modelo sem nome não vira linha", () => {
    // Apareceria como uma fatia anônima que não diz nada e ainda rouba
    // porcentagem de quem tem nome.
    const lista = modelosMaisUsados(
      [chat({ id: "a", model: "" }), chat({ id: "b", model: "gpt-5" })],
      desde
    );
    expect(lista).toHaveLength(1);
    expect(lista[0].model).toBe("gpt-5");
  });

  it("mês sem token nenhum não divide por zero", () => {
    const lista = modelosMaisUsados(
      [chat({ model: "gpt-5", tokensIn: 0, tokensOut: 0 })],
      desde
    );
    expect(lista[0].pct).toBe(0);
  });

  it("mês vazio devolve lista vazia", () => {
    expect(modelosMaisUsados([], desde)).toEqual([]);
  });
});
