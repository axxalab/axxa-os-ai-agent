// src/components/_shared/effort.ts
// Effort = intensidade do processamento. Mapeia pra max_tokens (e no futuro
// pra temperature / thinking_budget conforme o provider suportar).
// Low → resposta rápida e barata. Max → pensamento profundo, mais cara.

export type EffortLevel = "low" | "med" | "high" | "xhigh" | "max";

export const EFFORT_LEVELS: EffortLevel[] = ["low", "med", "high", "xhigh", "max"];

export const EFFORT_LABELS: Record<EffortLevel, string> = {
  low: "Low",
  med: "Med",
  high: "High",
  xhigh: "xHigh",
  max: "Max",
};

export const EFFORT_DESCRIPTIONS: Record<EffortLevel, string> = {
  low: "Rápido e econômico",
  med: "Equilibrado (padrão)",
  high: "Mais detalhado",
  xhigh: "Profundo",
  max: "Pensamento máximo",
};

const EFFORT_MAX_TOKENS: Record<EffortLevel, number> = {
  low: 500,
  med: 2000,
  high: 4000,
  xhigh: 8000,
  max: 16000,
};

export function effortToMaxTokens(level: string): number {
  return EFFORT_MAX_TOKENS[level as EffortLevel] ?? 2000;
}

export function isEffortLevel(value: string): value is EffortLevel {
  return EFFORT_LEVELS.includes(value as EffortLevel);
}

// Escala do Vault Q&A por effort:
//   topK = quantas notas o keyword-search retorna
//   excerptChars = tamanho do trecho de cada nota injetado no system prompt
// Total ~ topK × excerptChars chars (~ /4 tokens).
export interface VaultLookupConfig {
  topK: number;
  excerptChars: number;
}

const EFFORT_VAULT_LOOKUP: Record<EffortLevel, VaultLookupConfig> = {
  low:   { topK: 3,  excerptChars: 300  },
  med:   { topK: 5,  excerptChars: 500  },
  high:  { topK: 7,  excerptChars: 800  },
  xhigh: { topK: 9,  excerptChars: 1200 },
  max:   { topK: 12, excerptChars: 2000 },
};

export function effortToVaultLookup(level: string): VaultLookupConfig {
  return EFFORT_VAULT_LOOKUP[level as EffortLevel] ?? EFFORT_VAULT_LOOKUP.med;
}
