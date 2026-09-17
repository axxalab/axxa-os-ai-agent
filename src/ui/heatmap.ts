// src/ui/heatmap.ts
// O CALENDÁRIO de uso: um quadradinho por dia, mais forte nos dias em que
// você usou mais.
//
// É a única coisa do cartão que responde uma pergunta que número nenhum
// responde: "como tem sido?". Total diz o tamanho, o heatmap diz o hábito —
// se você usa todo dia um pouco, se some por uma semana, se o mês inteiro
// coube em duas madrugadas.
//
// Colunas são SEMANAS e linhas são dias da semana, como todo heatmap de
// calendário: é o formato que deixa ler a coluna ("esta semana") e a linha
// ("domingos") sem precisar de legenda.

import type { ChatSummary } from "../core/chatPersistence";

/** Quantos níveis de intensidade, fora o vazio. */
export const NIVEIS = 4;

export interface Celula {
  /** "YYYY-MM-DD", ou null quando é só preenchimento antes/depois do período. */
  dia: string | null;
  tokens: number;
  /** 0 = não usou; 1..4 = do mais fraco ao mais forte. */
  nivel: number;
}

export interface Heatmap {
  /** Em ordem de COLUNA: 7 células por semana, de segunda a domingo. */
  celulas: Celula[];
  semanas: number;
  /** O maior dia do período — é ele que define a escala. */
  pico: number;
  /** Soma do período mostrado. */
  total: number;
}

/** "YYYY-MM-DD" do instante, em hora LOCAL (o dia é o do relógio de quem olha). */
export function diaLocal(t: number): string {
  const d = new Date(t);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * Nível de 1 a 4 por FAIXA DO PICO, não por quartil de distribuição.
 *
 * Quartil daria quatro cores sempre, mesmo numa semana em que todos os dias
 * foram iguais — e aí o desenho inventaria um contraste que não existe. Faixa
 * do pico mantém a verdade: dia pequeno fica claro mesmo que seja o maior de
 * uma semana fraca... e o pico continua sendo o mais escuro, que é o que
 * ancora a leitura.
 */
export function nivelDoDia(tokens: number, pico: number): number {
  if (tokens <= 0 || pico <= 0) return 0;
  const f = tokens / pico;
  if (f > 0.75) return 4;
  if (f > 0.5) return 3;
  if (f > 0.25) return 2;
  return 1;
}

export function heatmap(
  chats: readonly ChatSummary[],
  semanas: number = 12,
  agora: number = Date.now()
): Heatmap {
  // Soma por dia local. Conversa sem data legível não entra: ela não tem
  // quadradinho onde cair.
  const porDia = new Map<string, number>();
  for (const c of chats) {
    const t = Date.parse(c.date);
    if (!Number.isFinite(t)) continue;
    const dia = diaLocal(t);
    const tin = Number.isFinite(c.tokensIn) ? c.tokensIn : 0;
    const tout = Number.isFinite(c.tokensOut) ? c.tokensOut : 0;
    porDia.set(dia, (porDia.get(dia) ?? 0) + tin + tout);
  }

  // A grade termina na semana ATUAL e começa `semanas-1` semanas antes, sempre
  // numa segunda — é o que faz a última coluna ser "esta semana".
  const hoje = new Date(agora);
  const diaDaSemana = (hoje.getDay() + 6) % 7; // 0 = segunda
  const inicio = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate() - diaDaSemana - (semanas - 1) * 7
  );

  const celulas: Celula[] = [];
  let pico = 0;
  let total = 0;
  for (let i = 0; i < semanas * 7; i++) {
    const d = new Date(
      inicio.getFullYear(),
      inicio.getMonth(),
      inicio.getDate() + i
    );
    // Dia no futuro: o quadradinho existe (a grade é retangular) mas não é um
    // dia — pintar zero ali diria "não usei", e não é isso, ainda não chegou.
    if (d.getTime() > agora) {
      celulas.push({ dia: null, tokens: 0, nivel: 0 });
      continue;
    }
    const chave = diaLocal(d.getTime());
    const tokens = porDia.get(chave) ?? 0;
    if (tokens > pico) pico = tokens;
    total += tokens;
    celulas.push({ dia: chave, tokens, nivel: 0 });
  }
  // O nível só dá pra calcular depois de conhecer o pico.
  for (const c of celulas) c.nivel = nivelDoDia(c.tokens, pico);

  return { celulas, semanas, pico, total };
}
