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

// ============================================================
// Recargas de crédito (v0.1.230) — substitui a âncora única por um HISTÓRICO:
// o user vai lançando "carreguei $X em DD/MM" (sem validade), e
//   saldo = Σ recargas − gasto desde a recarga mais antiga.
// ============================================================

export interface CreditEntry {
  /** Valor carregado nessa recarga (USD). */
  amount: number;
  /** Data da recarga (ISO YYYY-MM-DD). */
  date: string;
}

/** Recarga válida? amount finito > 0 + date ISO YYYY-MM-DD. */
function isValidCredit(c: CreditEntry | undefined): c is CreditEntry {
  return (
    !!c &&
    Number.isFinite(c.amount) &&
    c.amount > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test((c.date ?? "").trim())
  );
}

/** Recargas válidas, ordenadas por data ascendente (mais antiga primeiro). */
export function validCredits(entries: CreditEntry[] | undefined): CreditEntry[] {
  return (entries ?? [])
    .filter(isValidCredit)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Soma de todas as recargas válidas (USD). */
export function totalCredits(entries: CreditEntry[] | undefined): number {
  return validCredits(entries).reduce((sum, c) => sum + c.amount, 0);
}

/** Data ISO da recarga mais antiga (pra contar gasto desde lá). null se vazio. */
export function earliestCreditDate(
  entries: CreditEntry[] | undefined
): string | null {
  const valid = validCredits(entries);
  return valid.length > 0 ? valid[0].date : null;
}

/**
 * saldo a partir do histórico de recargas: Σ recargas − gasto desde a 1ª.
 * Devolve null (sem saldo) se não há nenhuma recarga válida.
 */
export function computeCreditBalance(
  entries: CreditEntry[] | undefined,
  spent: number,
  basis: BalanceBasis
): BalanceResult {
  const total = totalCredits(entries);
  if (earliestCreditDate(entries) === null) return { balance: null, spent, basis };
  return { balance: total - spent, spent, basis };
}
