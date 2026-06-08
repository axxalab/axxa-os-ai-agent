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

/** Emojis pra usar em seletores compactos (StarterScreen segmented pill). */
export const EFFORT_EMOJIS: Record<EffortLevel, string> = {
  low: "🐢",    // tartaruga — devagar e econômico
  med: "⚖️",   // balança — equilibrado
  high: "⚡",   // raio — rápido
  xhigh: "🔥",  // fogo — intenso
  max: "🚀",   // foguete — uncapped
};

export const EFFORT_DESCRIPTIONS: Record<EffortLevel, string> = {
  low: "Rápido e econômico (≤512 tok)",
  med: "Equilibrado (≤2k tok)",
  high: "Detalhado (≤6k tok)",
  xhigh: "Profundo (≤16k tok)",
  max: "Sem limite (até 80% da janela de contexto)",
};

/**
 * Rebalanced v0.1.66: max agora é UNCAPPED — limita apenas em 80% do
 * context window (calculado dynamicamente em effortToMaxTokensSmart).
 * Outros niveis tem valores mais agressivos pra utilizar bem o modelo.
 */
const EFFORT_MAX_TOKENS: Record<EffortLevel, number> = {
  low: 512,
  med: 2048,
  high: 6000,
  xhigh: 16000,
  max: 0,     // 0 = uncapped, calc dynamico
};

/** Versao legacy (sem context window). Max retorna 16k como cap razoavel. */
export function effortToMaxTokens(level: string): number {
  const v = EFFORT_MAX_TOKENS[level as EffortLevel] ?? 2048;
  return v === 0 ? 16000 : v;
}

/**
 * Versao SMART (v0.1.66): max retorna 80% do context window do modelo.
 * Outros niveis retornam o cap fixo (low/med/high/xhigh).
 * Usado pelo AxxaApp pra mandar max_tokens pro provider.
 */
export function effortToMaxTokensSmart(
  level: string,
  contextWindow: number
): number {
  const v = EFFORT_MAX_TOKENS[level as EffortLevel];
  if (v === 0) {
    // Max: 80% do context. Subtrai 1k pra reserva pra prompt+system.
    return Math.max(2048, Math.floor(contextWindow * 0.8) - 1000);
  }
  return v ?? 2048;
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
