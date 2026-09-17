// src/ui/homeStats.ts
// O que a home diz sobre o SEU uso: quanto saiu, em quantas conversas, com
// qual modelo, e o desenho dos últimos dias.
//
// Nada disso é medido aqui: quem soma tokens e calcula custo é `usage/
// aggregate`, o mesmo motor do relatório de uso — dois lugares contando a
// mesma coisa acabariam discordando, e aí nenhum dos dois serve.
// Este módulo só escolhe O QUE cabe num cartão e como ele se lê.

import type { ChatSummary } from "../core/chatPersistence";
import { aggregateFromSummaries, lastNDays } from "../usage/aggregate";

/** Janela padrão do cartão. Uma semana é o que a pessoa ainda lembra de ter
 *  feito — total de sempre é um número que nunca muda de tamanho na tela. */
export const JANELA_PADRAO = 7;

export interface ModeloFavorito {
  model: string;
  provider: string;
  chats: number;
  tokens: number;
}

export interface ResumoDeUso {
  dias: number;
  chats: number;
  tokens: number;
  custo: number;
  /** Algum modelo do período não tem preço conhecido: o custo é um PISO, não
   *  o valor. O cartão tem que dizer isso, senão promete exatidão que não tem. */
  custoIncompleto: boolean;
  /** Vale mostrar dinheiro? Com tudo local/grátis o custo é 0, e um "$0.00"
   *  gigante não é a manchete de ninguém — aí quem manda é o token. */
  temCusto: boolean;
  modeloFavorito: ModeloFavorito | null;
  /** Um valor por dia, de 0 a 1, do mais antigo pro mais novo. É a forma da
   *  semana, não a medida dela — por isso normalizado pelo próprio pico. */
  barras: number[];
}

export function resumoDeUso(
  chats: readonly ChatSummary[],
  dias: number = JANELA_PADRAO
): ResumoDeUso {
  const agg = aggregateFromSummaries([...chats], dias);
  const linhas = agg.chats;

  // Modelo favorito = o de mais CONVERSAS, não o de mais tokens: uma única
  // sessão gigante não faz dele o modelo que você escolhe.
  const porModelo = new Map<string, ModeloFavorito>();
  for (const r of linhas) {
    if (!r.model) continue;
    const atual = porModelo.get(r.model) ?? {
      model: r.model,
      provider: r.provider,
      chats: 0,
      tokens: 0,
    };
    atual.chats += 1;
    atual.tokens += r.tokensIn + r.tokensOut;
    // O provider vem do registro mais recente daquele modelo (as linhas vêm
    // ordenadas por custo, então não dá pra assumir ordem de data aqui).
    if (!atual.provider) atual.provider = r.provider;
    porModelo.set(r.model, atual);
  }
  let favorito: ModeloFavorito | null = null;
  for (const m of porModelo.values()) {
    if (
      !favorito ||
      m.chats > favorito.chats ||
      (m.chats === favorito.chats && m.tokens > favorito.tokens)
    ) {
      favorito = m;
    }
  }

  const porDia = lastNDays(agg.byDay, dias).map(
    (d) => d.bucket.tokensIn + d.bucket.tokensOut
  );
  const pico = Math.max(...porDia, 0);
  const barras = porDia.map((v) => (pico > 0 ? v / pico : 0));

  return {
    dias,
    chats: agg.total.chats,
    tokens: agg.total.tokensIn + agg.total.tokensOut,
    custo: agg.total.cost,
    custoIncompleto: agg.total.hasUnknownCost,
    temCusto: agg.total.cost > 0,
    modeloFavorito: favorito,
    barras,
  };
}

/** "Last 7 days" — e "Today" quando a janela é de um dia só. */
export function rotuloDaJanela(dias: number): string {
  if (dias <= 1) return "Today";
  return `Last ${dias} days`;
}
