// src/usage/balance.ts
// "Saldo" por provider — o workaround pro fato de NENHUM provider expor saldo via
// API: o user ancora uma vez ("tenho $X em DD/MM") e o plugin calcula
//   saldo = âncora − gasto desde a data.
// O gasto vem REAL (Costs API com admin key / OpenRouter nativo) ou ESTIMADO
// (agregação dos chats do vault). v0.1.171

import type { BillingRow } from "./freeBilling";

export interface BalanceAnchor {
  /** Saldo informado na data (USD). */
  amount: number;
  /** Data da âncora (ISO YYYY-MM-DD). */
  date: string;
}

export type BalanceBasis = "real" | "estimate";

export interface BalanceResult {
  /** Saldo (USD). null se não há âncora válida. */
  balance: number | null;
  /** Gasto desde a âncora (USD). */
  spent: number;
  basis: BalanceBasis;
}

/** Gasto ESTIMADO desde `sinceDay` (inclusive), somando os chats do provider. */
export function spentSinceFromRows(
  rows: BillingRow[],
  provider: string,
  sinceDay: string
): number {
  let total = 0;
  for (const r of rows) {
    if (r.provider !== provider) continue;
    if (sinceDay && r.day && r.day < sinceDay) continue;
    total += r.cost ?? 0;
  }
  return total;
}

/** Âncora válida? (amount finito + date ISO YYYY-MM-DD). */
export function hasValidAnchor(a: BalanceAnchor | undefined): a is BalanceAnchor {
  // v0.1.228: endurecido — NaN/Infinity (typeof "number") e date só-espaços
  // passavam antes, vazando saldo NaN e filtro de gasto incorreto.
  return (
    !!a &&
    Number.isFinite(a.amount) &&
    /^\d{4}-\d{2}-\d{2}$/.test((a.date ?? "").trim())
  );
}

/** saldo = âncora.amount − gasto. basis indica a confiança da fonte do gasto. */
export function computeBalance(
  anchor: BalanceAnchor | undefined,
  spent: number,
  basis: BalanceBasis
): BalanceResult {
  if (!hasValidAnchor(anchor)) return { balance: null, spent, basis };
  return { balance: anchor.amount - spent, spent, basis };
}
