// src/usage/providerBilling.ts
// Cross-check do billing REAL de cada provider contra a estimativa do plugin.
//
// O que é possível por provider (pesquisado jun/2026):
//   - OpenRouter: uso + crédito REAIS com a chave normal (GET /api/v1/auth/key). ✅
//   - OpenAI:    custos reais só com ADMIN key (sk-admin-…) em /v1/organization/costs.
//   - Anthropic: idem — admin key em /v1/organizations/cost_report.
//   - Gemini:    billing no Google Cloud Console (sem API por chave).
//   - NIM:       créditos no build.nvidia.com (sem API por chave).
//   - Ollama:    local, sem custo.
//
// Aqui implementamos o que dá SEM credencial nova (OpenRouter) + um registro
// honesto da capacidade de cada um pra UI explicar o resto.

export type BillingCapability = "live-key" | "admin-key" | "console" | "free";

export interface BillingCapabilityInfo {
  capability: BillingCapability;
  /** Nota curta pro UI explicar o status. */
  note: string;
  /** Console de billing do provider (admin-key/console). */
  consoleUrl?: string;
}

export const BILLING_CAPABILITY: Record<string, BillingCapabilityInfo> = {
  openrouter: {
    capability: "live-key",
    note: "Uso e crédito reais via API (chave normal).",
  },
  openai: {
    capability: "admin-key",
    note: "Custos reais exigem uma Admin key (sk-admin-…).",
    consoleUrl: "https://platform.openai.com/usage",
  },
  anthropic: {
    capability: "admin-key",
    note: "Custos reais exigem uma Admin key (sk-ant-admin-…).",
    consoleUrl: "https://console.anthropic.com/settings/usage",
  },
  gemini: {
    capability: "console",
    note: "Billing no Google Cloud Console (sem API por chave).",
    consoleUrl: "https://console.cloud.google.com/billing",
  },
  nim: {
    capability: "console",
    note: "Créditos no build.nvidia.com (sem API por chave).",
    consoleUrl: "https://build.nvidia.com",
  },
  ollama: { capability: "free", note: "Local — sem custo." },
};

export function billingCapabilityFor(providerId: string): BillingCapabilityInfo {
  return (
    BILLING_CAPABILITY[providerId] ?? {
      capability: "console",
      note: "Sem cross-check disponível.",
    }
  );
}

// ── OpenRouter (real, chave normal) ─────────────────────────
export interface OpenRouterBilling {
  /** Total já gasto na key (USD). */
  usageUsd: number;
  /** Limite de crédito da key (USD) — null se ilimitado. */
  limitUsd: number | null;
  /** Crédito restante (USD) — null se ilimitado. */
  remainingUsd: number | null;
  isFreeTier: boolean;
}

/** Parser puro da resposta do /api/v1/auth/key (testável). */
export function parseOpenRouterKey(json: unknown): OpenRouterBilling {
  const d = ((json as { data?: Record<string, unknown> })?.data ?? {}) as Record<
    string,
    unknown
  >;
  // v0.1.228: clampa valores fora do esperado (uso nunca negativo; limite
  // negativo é tratado como "sem limite") — robustez barata caso a API mude.
  const usageUsd = typeof d.usage === "number" ? Math.max(0, d.usage) : 0;
  const limitUsd = typeof d.limit === "number" && d.limit >= 0 ? d.limit : null;
  const remainingUsd =
    typeof d.limit_remaining === "number"
      ? Math.max(0, d.limit_remaining)
      : limitUsd != null
        ? Math.max(0, limitUsd - usageUsd)
        : null;
  return { usageUsd, limitUsd, remainingUsd, isFreeTier: Boolean(d.is_free_tier) };
}

/** Função de request injetada (pra testar com stub; em prod = requestUrl). */
export type RequestUrlLike = (opts: {
  url: string;
  method: string;
  headers: Record<string, string>;
  throw: boolean;
}) => Promise<{ status: number; json?: unknown; text?: string }>;

/** Extrai o MOTIVO real de um erro de billing (OpenAI/Anthropic devolvem
 *  `{error:{message}}`). Sem isso o usuário só vê "HTTP 400" e não dá pra
 *  saber se é admin key errada, projeto inválido, escopo, etc. v0.1.228 */
function billingErrorDetail(res: { json?: unknown; text?: string }): string {
  const msg = (res.json as { error?: { message?: string } } | null | undefined)
    ?.error?.message;
  if (msg) return ` — ${msg}`;
  if (typeof res.text === "string" && res.text.trim())
    return ` — ${res.text.trim().slice(0, 300)}`;
  return "";
}

/** Timeout padrão (ms) das chamadas de billing — evita pendurar a UI. */
export const BILLING_REQUEST_TIMEOUT_MS = 15_000;

// v0.1.228: o requestUrl do Obsidian não aceita AbortSignal, então usamos um
// Promise.race contra um timer. A request pode terminar em background, mas o
// chamador é liberado e a UI recebe um erro acionável em vez de travar.
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label}: tempo esgotado (${ms / 1000}s).`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function fetchOpenRouterBilling(
  apiKey: string,
  requestUrlFn: RequestUrlLike
): Promise<OpenRouterBilling> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Sem API key do OpenRouter.");
  }
  const res = await withTimeout(
    requestUrlFn({
      url: "https://openrouter.ai/api/v1/auth/key",
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      throw: false,
    }),
    BILLING_REQUEST_TIMEOUT_MS,
    "OpenRouter billing"
  );
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`OpenRouter billing: HTTP ${res.status}${billingErrorDetail(res)}`);
  }
  return parseOpenRouterKey(res.json);
}

// ── OpenAI Costs API (GASTO real, exige ADMIN key) ──────────
// GET /v1/organization/costs?start_time=<unix>&bucket_width=1d → soma dos
// data[].results[].amount.value. Shape confirmado em developers.openai.com.

/** Parser puro: soma o gasto (USD) de todos os buckets. */
export function parseOpenAICosts(json: unknown): number {
  // Parser TOLERANTE por contrato (ver tests): shape inesperado → 0, nunca
  // throw — uma resposta de billing malformada não pode derrubar a UI de uso.
  const data =
    (json as { data?: Array<{ results?: Array<{ amount?: { value?: number } }> }> })
      ?.data ?? [];
  let total = 0;
  for (const bucket of data) {
    for (const r of bucket.results ?? []) {
      if (typeof r.amount?.value === "number") total += r.amount.value;
    }
  }
  return total;
}

export async function fetchOpenAICosts(
  adminKey: string,
  requestUrlFn: RequestUrlLike,
  startTimeUnix: number,
  /** Filtra o custo a UM projeto (proj_…) — atribuição. Vazio = org inteira. */
  projectId?: string
): Promise<number> {
  if (!adminKey || !adminKey.trim()) {
    throw new Error("Sem Admin key da OpenAI.");
  }
  const projectFilter =
    projectId && projectId.trim()
      ? `&project_ids=${encodeURIComponent(projectId.trim())}`
      : "";
  const url =
    `https://api.openai.com/v1/organization/costs` +
    `?start_time=${startTimeUnix}&bucket_width=1d&limit=180${projectFilter}`;
  const res = await withTimeout(
    requestUrlFn({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${adminKey.trim()}` },
      throw: false,
    }),
    BILLING_REQUEST_TIMEOUT_MS,
    "OpenAI costs"
  );
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Admin key inválida ou sem permissão de billing.${billingErrorDetail(res)}`
    );
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`OpenAI costs: HTTP ${res.status}${billingErrorDetail(res)}`);
  }
  return parseOpenAICosts(res.json);
}

// ── Anthropic cost report (GASTO real, exige ADMIN key) ─────
// GET /v1/organizations/cost_report?starting_at=YYYY-MM-DD. amount pode vir como
// number OU string decimal — parser tolerante no nível do result.
export function parseAnthropicCosts(json: unknown): number {
  // Parser TOLERANTE por contrato (ver tests): shape inesperado → 0, nunca
  // throw — billing malformado não pode derrubar a UI de uso.
  const data =
    (json as { data?: Array<{ results?: Array<Record<string, unknown>> }> })?.data ??
    [];
  let total = 0;
  for (const bucket of data) {
    for (const r of bucket.results ?? []) {
      const amt = (r as { amount?: unknown }).amount;
      const n =
        typeof amt === "number"
          ? amt
          : typeof amt === "string"
            ? parseFloat(amt)
            : NaN;
      if (Number.isFinite(n)) total += n;
    }
  }
  return total;
}

export async function fetchAnthropicCosts(
  adminKey: string,
  requestUrlFn: RequestUrlLike,
  startingAtIso: string,
  /** Filtra a UM workspace (atribuição). Vazio = org inteira. */
  workspaceId?: string
): Promise<number> {
  if (!adminKey || !adminKey.trim()) {
    throw new Error("Sem Admin key da Anthropic.");
  }
  const wsFilter =
    workspaceId && workspaceId.trim()
      ? `&workspace_ids[]=${encodeURIComponent(workspaceId.trim())}`
      : "";
  const url =
    `https://api.anthropic.com/v1/organizations/cost_report` +
    `?starting_at=${encodeURIComponent(startingAtIso)}${wsFilter}`;
  const res = await withTimeout(
    requestUrlFn({
      url,
      method: "GET",
      headers: {
        "x-api-key": adminKey.trim(),
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      throw: false,
    }),
    BILLING_REQUEST_TIMEOUT_MS,
    "Anthropic costs"
  );
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Admin key Anthropic inválida ou sem permissão.${billingErrorDetail(res)}`
    );
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Anthropic costs: HTTP ${res.status}${billingErrorDetail(res)}`);
  }
  return parseAnthropicCosts(res.json);
}
