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
  const usageUsd = typeof d.usage === "number" ? d.usage : 0;
  const limitUsd = typeof d.limit === "number" ? d.limit : null;
  const remainingUsd =
    typeof d.limit_remaining === "number"
      ? d.limit_remaining
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
}) => Promise<{ status: number; json?: unknown }>;

export async function fetchOpenRouterBilling(
  apiKey: string,
  requestUrlFn: RequestUrlLike
): Promise<OpenRouterBilling> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Sem API key do OpenRouter.");
  }
  const res = await requestUrlFn({
    url: "https://openrouter.ai/api/v1/auth/key",
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
    throw: false,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`OpenRouter billing: HTTP ${res.status}`);
  }
  return parseOpenRouterKey(res.json);
}
