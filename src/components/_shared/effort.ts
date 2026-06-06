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
