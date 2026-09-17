// src/ui/homeModules.ts
// Os MÓDULOS do cartão de uso: os números que o calendário sugere mas não diz.
//
// Tudo aqui sai do que o app já grava por conversa — data, tokens, mensagens,
// ações do agente. Nada é estimado, nada depende de você configurar coisa
// nenhuma: régua que a pessoa precisa inventar (um orçamento, um limite) mede
// a régua, não o uso.
//
// Cada módulo responde uma pergunta que os outros não respondem:
//   • sequência  → "estou mantendo o hábito?"
//   • dias ativos → "uso sempre ou só às vezes?"
//   • dia de pico → dá nome ao quadradinho mais escuro do calendário
//   • ações       → "quanto trabalho o agente fez no vault?"

import type { ChatSummary } from "../core/chatPersistence";
import type { Celula } from "./heatmap";

/**
 * Dias SEGUIDOS de uso terminando hoje.
 *
 * O dia de hoje não conta contra: às 9h da manhã você ainda não usou, e zerar
 * a sequência aí seria punir a pessoa por acordar. A conta olha a partir do
 * último dia FECHADO — se hoje já teve uso, ele entra.
 */
export function sequenciaDeDias(celulas: readonly Celula[]): number {
  const dias = celulas.filter((c) => c.dia !== null);
  if (dias.length === 0) return 0;
  let i = dias.length - 1;
  // Hoje ainda em aberto: começa de ontem.
  if (dias[i].tokens <= 0) i -= 1;
  let n = 0;
  for (; i >= 0; i--) {
    if (dias[i].tokens <= 0) break;
    n += 1;
  }
  return n;
}

export interface DiasAtivos {
  ativos: number;
  total: number;
}

/** Em quantos dos dias do período houve uso. */
export function diasAtivos(celulas: readonly Celula[]): DiasAtivos {
  const dias = celulas.filter((c) => c.dia !== null);
  return {
    ativos: dias.filter((c) => c.tokens > 0).length,
    total: dias.length,
  };
}

export interface DiaDePico {
  dia: string;
  tokens: number;
}

/** O dia mais forte do período — o quadradinho mais escuro, com nome. */
export function diaDePico(celulas: readonly Celula[]): DiaDePico | null {
  let melhor: DiaDePico | null = null;
  for (const c of celulas) {
    if (!c.dia || c.tokens <= 0) continue;
    // `>` e não `>=`: empate fica com o PRIMEIRO. O contrário faria o rótulo
    // pular de dia a cada recarga quando dois dias empatam.
    if (!melhor || c.tokens > melhor.tokens) {
      melhor = { dia: c.dia, tokens: c.tokens };
    }
  }
  return melhor;
}

/** "Sep 12" — data curta, no idioma da interface. */
export function diaCurto(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  if (!a || !m || !d) return dia;
  return new Date(a, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export interface Trabalho {
  /** Ações de ferramenta que o agente rodou no vault. */
  acoes: number;
  mensagens: number;
}

/**
 * O que foi FEITO no período — não o que foi gasto.
 *
 * Ações é o número mais AXXA de todos: é o equivalente daqui às linhas de
 * código do painel do Claude Code. Token mede consumo; ação mede trabalho no
 * vault.
 */
export function trabalhoDoPeriodo(
  chats: readonly ChatSummary[],
  desde: string
): Trabalho {
  let acoes = 0;
  let mensagens = 0;
  for (const c of chats) {
    if (desde && (c.date ?? "").slice(0, 10) < desde) continue;
    acoes += Number.isFinite(c.toolCount) ? c.toolCount : 0;
    mensagens += Number.isFinite(c.messageCount) ? c.messageCount : 0;
  }
  return { acoes, mensagens };
}
