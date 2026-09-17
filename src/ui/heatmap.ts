// src/ui/heatmap.ts
// O CALENDÁRIO do MÊS: um quadradinho por dia, mais forte nos dias em que
// você usou mais.
//
// É a única coisa do cartão que responde uma pergunta que número nenhum
// responde: "como tem sido?". Total diz o tamanho, o calendário diz o hábito —
// se você usa todo dia um pouco, se some por uma semana, se o mês inteiro
// coube em duas madrugadas.
//
// É o MÊS VIGENTE, e não uma janela corrida: mês é a unidade em que a pessoa
// pensa ("este mês eu usei muito") e a unidade em que a fatura chega. Janela
// corrida dá um número que nunca bate com nenhum dos dois.
//
// A grade tem sete colunas — segunda a domingo —, como um calendário de
// parede: a coluna é o dia da semana e a linha é a semana. Os dias antes do
// dia 1 e depois do último entram como células VAZIAS, porque a grade é
// retangular e o mês não é.

import type { ChatSummary } from "../core/chatPersistence";

export interface Celula {
  /** "YYYY-MM-DD", ou null quando não é um dia do mês (ou ainda não chegou). */
  dia: string | null;
  tokens: number;
  /** 0 = não usou; 1..4 = do mais fraco ao mais forte. */
  nivel: number;
  /** Dia DESTE mês que ainda não chegou. Não conta em nada — mas existe no
   *  desenho, senão o mês perde a forma no meio e a grade parece cortada. */
  futuro?: boolean;
}

export interface Heatmap {
  /** Em ordem de LINHA: 7 células por semana, de segunda a domingo. */
  celulas: Celula[];
  /** Quantas semanas o mês ocupa na grade (4, 5 ou 6). */
  linhas: number;
  /** O maior dia do mês — é ele que define a escala. */
  pico: number;
  /** Soma do mês. */
  total: number;
  /** Nome do mês, pro rótulo ("September"). */
  rotulo: string;
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
 * Quartil daria quatro tons sempre, mesmo num mês em que todos os dias foram
 * iguais — e aí o desenho inventaria um contraste que não existe. Faixa do
 * pico mantém a verdade: dia pequeno fica claro mesmo sendo o maior de um mês
 * fraco, e o pico continua sendo o mais escuro, que é o que ancora a leitura.
 */
export function nivelDoDia(tokens: number, pico: number): number {
  if (tokens <= 0 || pico <= 0) return 0;
  const f = tokens / pico;
  if (f > 0.75) return 4;
  if (f > 0.5) return 3;
  if (f > 0.25) return 2;
  return 1;
}

/** Tokens por dia local. Conversa sem data legível não entra: ela não tem
 *  quadradinho onde cair. */
function porDia(chats: readonly ChatSummary[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const c of chats) {
    const t = Date.parse(c.date);
    if (!Number.isFinite(t)) continue;
    const dia = diaLocal(t);
    const tin = Number.isFinite(c.tokensIn) ? c.tokensIn : 0;
    const tout = Number.isFinite(c.tokensOut) ? c.tokensOut : 0;
    mapa.set(dia, (mapa.get(dia) ?? 0) + tin + tout);
  }
  return mapa;
}

export function heatmapDoMes(
  chats: readonly ChatSummary[],
  agora: number = Date.now()
): Heatmap {
  const somas = porDia(chats);
  const hoje = new Date(agora);
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();

  const primeiro = new Date(ano, mes, 1);
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  // Quantas casas vazias antes do dia 1 (0 = o mês começa numa segunda).
  const vazioInicial = (primeiro.getDay() + 6) % 7;
  const linhas = Math.ceil((vazioInicial + diasNoMes) / 7);

  const celulas: Celula[] = [];
  let pico = 0;
  let total = 0;
  for (let i = 0; i < linhas * 7; i++) {
    const diaDoMes = i - vazioInicial + 1;
    if (diaDoMes < 1 || diaDoMes > diasNoMes) {
      celulas.push({ dia: null, tokens: 0, nivel: 0 });
      continue;
    }
    const d = new Date(ano, mes, diaDoMes);
    // Dia no futuro: o quadradinho existe (a grade é retangular) mas não é um
    // dia — pintar zero ali diria "não usei", e não é isso, ainda não chegou.
    if (d.getTime() > agora) {
      celulas.push({ dia: null, tokens: 0, nivel: 0, futuro: true });
      continue;
    }
    const chave = diaLocal(d.getTime());
    const tokens = somas.get(chave) ?? 0;
    if (tokens > pico) pico = tokens;
    total += tokens;
    celulas.push({ dia: chave, tokens, nivel: 0 });
  }
  // O nível só dá pra calcular depois de conhecer o pico.
  for (const c of celulas) c.nivel = nivelDoDia(c.tokens, pico);

  return {
    celulas,
    linhas,
    pico,
    total,
    rotulo: primeiro.toLocaleDateString("en-US", { month: "long" }),
  };
}

/** O primeiro dia do mês vigente, em "YYYY-MM-DD" — o corte que TODO número
 *  do cartão usa, pra nenhum deles discordar do desenho. */
export function inicioDoMes(agora: number = Date.now()): string {
  const d = new Date(agora);
  return diaLocal(new Date(d.getFullYear(), d.getMonth(), 1).getTime());
}
