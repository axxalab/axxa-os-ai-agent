// src/usage/freeTag.ts
// A etiqueta "free" de um modelo — o que a lista de modelos mostra ao lado do
// nome, e o que ela SIGNIFICA em cada caso.
//
// Havia um só rótulo pra duas coisas muito diferentes:
//
//   - de graça SEMPRE (um `:free` do OpenRouter, um modelo local do Ollama):
//     não existe fatura, ponto;
//   - de graça ATÉ UM LIMITE, e só se você tiver ligado o data-sharing no
//     painel da OpenAI (Data controls): passou da cota do dia, é cobrado
//     normal.
//
// Chamar as duas de "free" faz a segunda parecer a primeira — e a conta chega.
// Aqui elas viram etiquetas diferentes, e a da OpenAI carrega o NÚMERO, que é
// a única parte que interessa: 250k/dia não é o mesmo que 2,5M/dia.
//
// A cota depende do tier da conta (1–2 vs 3–5), então a etiqueta é montada com
// as settings da pessoa, e não com uma tabela fixa.

import { openaiFreeAllowance, openaiFreeTierForModel } from "./freeTokens";

export interface FreeTag {
  /** `always` = sem fatura. `daily` = cota diária já valendo. `offer` = a cota
   *  existe mas está desligada (data-sharing off) — é uma oferta, não um fato. */
  kind: "always" | "daily" | "offer";
  /** Tokens/dia da cota (só em `daily` e `offer`). */
  perDay?: number;
  /** O que aparece na etiqueta. */
  label: string;
  /** A frase inteira, pro title/tooltip. */
  detail: string;
}

/** 250000 → "250k"; 2500000 → "2.5M". O número é o recado; o resto é ruído. */
export function compactTokens(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export function freeTag(
  provider: string,
  model: string,
  opts: {
    /** O modelo é grátis "de fábrica" (capabilities do motor). */
    free: boolean;
    /** Data-sharing ligado no painel da OpenAI. */
    dataSharing: boolean;
    /** Usage tier da conta OpenAI (1–5). */
    tier: number;
  }
): FreeTag | null {
  const pool = provider === "openai" ? openaiFreeTierForModel(model) : null;
  if (pool) {
    // O tier decide a cota; sem data-sharing a conta é a do tier mesmo assim,
    // porque o que a etiqueta diz então é "é isto que você GANHARIA".
    const allow = openaiFreeAllowance(Math.max(opts.tier, 1), true);
    const perDay = pool === "mini" ? allow.miniPerDay : allow.bigPerDay;
    const qtd = compactTokens(perDay);
    if (opts.dataSharing) {
      return {
        kind: "daily",
        perDay,
        label: `${qtd}/day`,
        detail: `${qtd} tokens a day at no cost while you share API data with OpenAI. Past that, this model is billed normally — and the quota counts ALL your OpenAI API use, not just this vault.`,
      };
    }
    // O "+" é o que separa a oferta do fato: ele lê como "isto você GANHARIA".
    // Sem ele, a etiqueta de quem não ligou o programa fica igual à de quem
    // ligou — e a fatura desmente a tela no fim do mês.
    return {
      kind: "offer",
      perDay,
      label: `+${qtd}/day`,
      detail: `Turn on data sharing in OpenAI's Data controls to get ${qtd} tokens a day here at no cost.`,
    };
  }

  if (opts.free) {
    return {
      kind: "always",
      label: "free",
      detail: "No cost — this model has no billing at all.",
    };
  }
  return null;
}
