// src/usage/filters.ts
// Os FILTROS da página de uso: recortar as conversas por provider, modelo,
// modo e período antes de somar qualquer coisa.
//
// Filtrar ANTES de agregar, e não depois, é o que faz os números baterem: com
// o recorte aplicado no fim, o total diria uma coisa e as linhas da tabela
// outra — e quem está conferindo uma conta não perdoa isso.
//
// Cada filtro é uma LISTA de valores aceitos. Lista vazia = sem restrição, e
// não "nenhum": o estado inicial da página é "mostre tudo", e obrigar a
// marcar todos os providers pra ver tudo seria trabalho por nada.

import type { ChatSummary } from "../core/chatPersistence";

export interface UsageFilter {
  providers: string[];
  models: string[];
  modes: string[];
  /** Últimos N dias (0 = desde sempre). */
  days: number;
}

export const FILTRO_VAZIO: UsageFilter = {
  providers: [],
  models: [],
  modes: [],
  days: 0,
};

/** Um valor e quantas conversas ele tem — as opções de um filtro. */
export interface Opcao {
  id: string;
  count: number;
}

/**
 * As opções de uma dimensão, ordenadas da mais usada pra menos.
 *
 * Só aparece o que EXISTE nas conversas: uma lista com todos os providers do
 * mundo, a maioria em zero, faria a pessoa procurar pelo que ela usa no meio
 * do que ela não usa.
 */
export function opcoes(
  chats: readonly ChatSummary[],
  dimensao: "provider" | "model" | "mode"
): Opcao[] {
  const contagem = new Map<string, number>();
  for (const c of chats) {
    const v = (c[dimensao] ?? "").trim();
    if (!v) continue;
    contagem.set(v, (contagem.get(v) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([id, count]) => ({ id, count }))
    // Empate resolve pelo nome: ordem estável vale mais que critério esperto,
    // porque lista que troca de ordem sozinha parece defeito.
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

/** Liga/desliga um valor no filtro (é seleção múltipla). */
export function alternar(lista: string[], valor: string): string[] {
  return lista.includes(valor)
    ? lista.filter((v) => v !== valor)
    : [...lista, valor];
}

/** As conversas que sobram depois do recorte. */
export function aplicar(
  chats: readonly ChatSummary[],
  f: UsageFilter,
  agora: number = Date.now()
): ChatSummary[] {
  const corte = f.days > 0 ? agora - f.days * 86_400_000 : 0;
  return chats.filter((c) => {
    if (f.providers.length > 0 && !f.providers.includes(c.provider)) return false;
    if (f.models.length > 0 && !f.models.includes(c.model)) return false;
    if (f.modes.length > 0 && !f.modes.includes(c.mode)) return false;
    if (corte > 0) {
      const t = Date.parse(c.date);
      // Data ilegível fica de FORA de um filtro por período: dizer que ela
      // caiu dentro seria inventar uma data que o arquivo não tem.
      if (!Number.isFinite(t) || t < corte) return false;
    }
    return true;
  });
}

/** Algum recorte está ativo? (é o que decide mostrar o "limpar filtros") */
export function temFiltro(f: UsageFilter): boolean {
  return (
    f.providers.length > 0 ||
    f.models.length > 0 ||
    f.modes.length > 0 ||
    f.days > 0
  );
}
