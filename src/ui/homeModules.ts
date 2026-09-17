// src/ui/homeModules.ts
// Os números do cartão de uso: o que o calendário sugere mas não diz.
//
// Tudo aqui sai do que o app já grava por conversa — data, tokens, mensagens,
// ações do agente. Nada é estimado e nada depende de você configurar coisa
// nenhuma: régua que a pessoa precisa inventar (um orçamento, um limite) mede
// a régua, não o uso.

import type { ChatSummary } from "../core/chatPersistence";
import { diaLocal, type Celula } from "./heatmap";

/**
 * Dias SEGUIDOS de uso terminando hoje.
 *
 * Olha os dias de verdade, não o calendário da tela: a sequência não pode
 * morrer na virada do mês só porque o desenho recomeça no dia 1.
 *
 * O dia de hoje não conta contra: às 9h da manhã você ainda não usou, e zerar
 * a sequência aí seria punir a pessoa por acordar. A conta parte do último
 * dia FECHADO — se hoje já teve uso, ele entra.
 */
export function sequenciaDeDias(
  chats: readonly ChatSummary[],
  agora: number = Date.now()
): number {
  const usados = new Set<string>();
  for (const c of chats) {
    const t = Date.parse(c.date);
    if (!Number.isFinite(t)) continue;
    const tin = Number.isFinite(c.tokensIn) ? c.tokensIn : 0;
    const tout = Number.isFinite(c.tokensOut) ? c.tokensOut : 0;
    if (tin + tout <= 0 && !Number.isFinite(c.messageCount)) continue;
    usados.add(diaLocal(t));
  }
  if (usados.size === 0) return 0;

  const hoje = new Date(agora);
  const cursor = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  // Hoje ainda em aberto: começa de ontem.
  if (!usados.has(diaLocal(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let n = 0;
  while (usados.has(diaLocal(cursor.getTime()))) {
    n += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

export interface DiasAtivos {
  ativos: number;
  total: number;
}

/** Em quantos dos dias já vividos do mês houve uso. */
export function diasAtivos(celulas: readonly Celula[]): DiasAtivos {
  const dias = celulas.filter((c) => c.dia !== null);
  return {
    ativos: dias.filter((c) => c.tokens > 0).length,
    total: dias.length,
  };
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

export interface ModeloUsado {
  model: string;
  provider: string;
  tokens: number;
  chats: number;
  /** Fatia do total do período, de 0 a 100 (inteiro). */
  pct: number;
}

/**
 * Os modelos mais usados do período, do maior pro menor.
 *
 * A fatia é de TOKENS, não de conversas: o cartão é sobre volume — o número
 * grande logo acima é em tokens —, e contar conversas faria um "oi" pesar o
 * mesmo que uma sessão de três horas.
 *
 * Modelo sem nome não vira linha: ele apareceria como uma fatia anônima, que
 * não diz nada e ainda rouba porcentagem de quem tem nome.
 */
export function modelosMaisUsados(
  chats: readonly ChatSummary[],
  desde: string,
  limite: number = 3
): ModeloUsado[] {
  const porModelo = new Map<string, ModeloUsado>();
  let total = 0;
  for (const c of chats) {
    if (desde && (c.date ?? "").slice(0, 10) < desde) continue;
    if (!c.model) continue;
    const tin = Number.isFinite(c.tokensIn) ? c.tokensIn : 0;
    const tout = Number.isFinite(c.tokensOut) ? c.tokensOut : 0;
    const atual = porModelo.get(c.model) ?? {
      model: c.model,
      provider: c.provider,
      tokens: 0,
      chats: 0,
      pct: 0,
    };
    atual.tokens += tin + tout;
    atual.chats += 1;
    if (!atual.provider) atual.provider = c.provider;
    porModelo.set(c.model, atual);
    total += tin + tout;
  }

  const lista = [...porModelo.values()].sort((a, b) => {
    if (b.tokens !== a.tokens) return b.tokens - a.tokens;
    // Empate em tokens (dois modelos sem token gravado, por exemplo): desempata
    // por conversas, e depois pelo nome — ordem estável vale mais que critério
    // esperto, porque lista que troca de ordem sozinha parece defeito.
    if (b.chats !== a.chats) return b.chats - a.chats;
    return a.model.localeCompare(b.model);
  });
  for (const m of lista) {
    m.pct = total > 0 ? Math.round((m.tokens / total) * 100) : 0;
  }
  return lista.slice(0, limite);
}
