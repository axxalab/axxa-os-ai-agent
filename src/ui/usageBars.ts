// src/ui/usageBars.ts
// As BARRAS de uso do cartão da home — no formato do `/usage` do Claude Code:
// um período, quanto dele já foi, e quando ele zera.
//
// A diferença é de onde vem a régua. Lá o limite é do plano; aqui a cobrança
// é por token, então não existe teto nenhum — quem o define é você, como
// orçamento. Sem orçamento não há barra, porque barra sem régua não mede
// nada: ela só desenha uma sensação.
//
// Os períodos são de CALENDÁRIO, não janelas corridas: "esta semana" acaba no
// domingo e "este mês" acaba no último dia, que é como a fatura pensa e como
// a pessoa lembra. Tudo em hora local — o mês vira à meia-noite de quem está
// olhando, não em UTC.

import type { ChatSummary } from "../core/chatPersistence";
import { aggregateFromSummaries } from "../usage/aggregate";

export interface Periodo {
  /** Instante do começo (inclusive). */
  inicio: number;
  /** Instante em que o período zera (exclusive) — o "resets" da linha. */
  reset: number;
}

/** Semana que começa na SEGUNDA (o domingo é fim de semana, não recomeço). */
export function semanaAtual(agora: number = Date.now()): Periodo {
  const d = new Date(agora);
  const diaDaSemana = (d.getDay() + 6) % 7; // 0 = segunda
  const inicio = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - diaDaSemana
  ).getTime();
  const reset = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - diaDaSemana + 7
  ).getTime();
  return { inicio, reset };
}

export function mesAtual(agora: number = Date.now()): Periodo {
  const d = new Date(agora);
  return {
    inicio: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
    reset: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(),
  };
}

export interface GastoDoPeriodo {
  custo: number;
  /** Algum modelo sem preço público: o custo é um PISO. */
  incompleto: boolean;
  chats: number;
  tokens: number;
}

/** O que foi gasto dentro do período. */
export function gastoNoPeriodo(
  chats: readonly ChatSummary[],
  p: Periodo
): GastoDoPeriodo {
  const dentro = chats.filter((c) => {
    const t = Date.parse(c.date);
    return Number.isFinite(t) && t >= p.inicio && t < p.reset;
  });
  const agg = aggregateFromSummaries(dentro, 0);
  return {
    custo: agg.total.cost,
    incompleto: agg.total.hasUnknownCost,
    chats: agg.total.chats,
    tokens: agg.total.tokensIn + agg.total.tokensOut,
  };
}

export interface Barra {
  /** 0..1 — o quanto da barra pintar. Estouro fica em 1: a barra não cresce
   *  além de si mesma, quem avisa do excesso é a porcentagem. */
  fracao: number;
  /** Inteiro, sem o sinal de %. Pode passar de 100. */
  porcento: number;
  estourou: boolean;
}

export function barra(gasto: number, orcamento: number): Barra {
  if (!(orcamento > 0) || !Number.isFinite(gasto) || gasto < 0) {
    return { fracao: 0, porcento: 0, estourou: false };
  }
  const bruto = gasto / orcamento;
  return {
    fracao: Math.min(1, bruto),
    // Arredonda pra BAIXO: 99,6% do orçamento não é "100% usado" — dizer que
    // acabou quando ainda não acabou é o único erro que custa caro aqui.
    porcento: Math.floor(bruto * 100),
    estourou: bruto > 1,
  };
}

/**
 * Quando o período zera, em uma palavra: "resets Mon", "resets Oct 1".
 *
 * A semana diz o DIA porque ele está a poucos dias; o mês diz a data porque
 * "resets Wed" daqui a três semanas não situa ninguém.
 */
export function rotuloReset(reset: number, tipo: "semana" | "mes"): string {
  const d = new Date(reset);
  if (tipo === "semana") {
    return `resets ${d.toLocaleDateString("en-US", { weekday: "short" })}`;
  }
  return `resets ${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}
