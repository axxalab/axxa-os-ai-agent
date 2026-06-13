// src/usage/freeBilling.ts
// Aplica a cota GRÁTIS do data-sharing da OpenAI ao custo do usage.
//
// A cota é DIÁRIA e por POOL (modelos grandes vs mini têm cotas separadas) e
// reseta a cada dia. Então o custo "cobrado" = só o que EXCEDE a cota do dia +
// tudo que NÃO entra no plano (outros providers, imagem, modelos OpenAI fora da
// lista elegível). Tudo isto é ESTIMATIVA, igual ao resto do usage.
//
// Caveat importante (a UI avisa): a cota é compartilhada com TODO o seu uso da
// OpenAI API — o plugin só enxerga os chats do vault, então "grátis restante" é
// otimista se você usa a API em outro lugar.

import { openaiFreeAllowance, openaiFreeTierForModel } from "./freeTokens";

/** Forma mínima de uma linha de usage (compatível com ChatUsageRow). */
export interface BillingRow {
  day: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number | null;
}

export interface BilledUsage {
  /** Custo normal, sem desconto. */
  grossCost: number;
  /** Custo após a cota grátis: só excedente + não-coberto. */
  billedCost: number;
  /** Economia (gross − billed). */
  saved: number;
  /** Tokens cobertos pela cota grátis (in+out somados). */
  freeTokens: number;
}

interface PoolAcc {
  tok: number;
  cost: number;
}

// v0.1.228: a cota é rateada pela fração de TOKENS, não de custo. Como o pool
// agrega modelos de preços diferentes (ex: vários modelos "big"), a fração de
// tokens coberta ≠ fração de custo coberta — o desconto é aproximado. Tudo aqui
// já é estimativa (ver header), e ordenar por custo/token mudaria o resultado
// sem cobertura de teste, então fica documentado em vez de "corrigido".
function applyAllowance(pool: PoolAcc, allowance: number): { cost: number; free: number } {
  if (pool.tok <= 0) return { cost: 0, free: 0 };
  const covered = Math.min(pool.tok, allowance);
  const billedFraction = (pool.tok - covered) / pool.tok;
  return { cost: pool.cost * billedFraction, free: covered };
}

/**
 * Custo cobrado aplicando a cota diária por pool. Para cada DIA, soma os tokens
 * elegíveis (OpenAI big/mini) e cobra só a fração que passou da cota; o resto
 * (não-elegível) entra a preço cheio.
 */
export function computeBilledUsage(
  rows: BillingRow[],
  opts: { tier: number; dataSharing: boolean }
): BilledUsage {
  const allow = openaiFreeAllowance(opts.tier, opts.dataSharing);

  const byDay = new Map<
    string,
    { big: PoolAcc; mini: PoolAcc; otherCost: number }
  >();
  for (const r of rows) {
    const cost = r.cost ?? 0;
    const day = r.day || "(sem data)";
    const g =
      byDay.get(day) ??
      { big: { tok: 0, cost: 0 }, mini: { tok: 0, cost: 0 }, otherCost: 0 };
    const pool =
      r.provider === "openai" && allow.eligible
        ? openaiFreeTierForModel(r.model)
        : null;
    // v0.1.228: sanear NaN/Infinity de frontmatter corrompido pra não envenenar a cota.
    const tin = Number.isFinite(r.tokensIn) ? r.tokensIn : 0;
    const tout = Number.isFinite(r.tokensOut) ? r.tokensOut : 0;
    const tok = tin + tout;
    if (pool === "big") {
      g.big.tok += tok;
      g.big.cost += cost;
    } else if (pool === "mini") {
      g.mini.tok += tok;
      g.mini.cost += cost;
    } else {
      g.otherCost += cost;
    }
    byDay.set(day, g);
  }

  let grossCost = 0;
  let billedCost = 0;
  let freeTokens = 0;
  for (const g of byDay.values()) {
    grossCost += g.big.cost + g.mini.cost + g.otherCost;
    const big = applyAllowance(g.big, allow.bigPerDay);
    const mini = applyAllowance(g.mini, allow.miniPerDay);
    billedCost += big.cost + mini.cost + g.otherCost;
    freeTokens += big.free + mini.free;
  }
  // Proteção contra ruído de ponto flutuante.
  billedCost = Math.max(0, billedCost);
  return {
    grossCost,
    billedCost,
    saved: Math.max(0, grossCost - billedCost),
    freeTokens,
  };
}

export interface TodayFreeStatus {
  eligible: boolean;
  big: { used: number; allowance: number };
  mini: { used: number; allowance: number };
}

/** Consumo de HOJE das cotas grátis, por pool (pra barra de progresso). */
export function todayFreeStatus(
  rows: BillingRow[],
  opts: { tier: number; dataSharing: boolean },
  today: string
): TodayFreeStatus {
  const allow = openaiFreeAllowance(opts.tier, opts.dataSharing);
  let bigTok = 0;
  let miniTok = 0;
  for (const r of rows) {
    if (r.day !== today) continue;
    if (r.provider !== "openai" || !allow.eligible) continue;
    const pool = openaiFreeTierForModel(r.model);
    // v0.1.228: idem — saneia NaN/Infinity de linhas corrompidas.
    const tin = Number.isFinite(r.tokensIn) ? r.tokensIn : 0;
    const tout = Number.isFinite(r.tokensOut) ? r.tokensOut : 0;
    const tok = tin + tout;
    if (pool === "big") bigTok += tok;
    else if (pool === "mini") miniTok += tok;
  }
  return {
    eligible: allow.eligible,
    big: { used: bigTok, allowance: allow.bigPerDay },
    mini: { used: miniTok, allowance: allow.miniPerDay },
  };
}
