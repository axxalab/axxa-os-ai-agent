// src/components/_shared/contextWindows.ts
// Lookup do context window (em tokens) de cada modelo conhecido.
// Usado pelo status do composer pra mostrar X/Y tokens.
// Atualizar quando aparecerem novos modelos.

const WINDOWS: Record<string, number> = {
  // OpenAI
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  "gpt-5": 256_000,
  "o1": 200_000,
  "o1-mini": 128_000,
  "o3": 200_000,
  "o3-mini": 200_000,
  "o4": 256_000,

  // Anthropic
  "claude-opus-4-8": 200_000,
  "claude-sonnet-4-6": 200_000,
  "claude-haiku-4-5-20251001": 200_000,
};

/** Retorna o context window do modelo. Fallback 128k se desconhecido. */
export function getContextWindow(model: string): number {
  // Match exato primeiro
  if (WINDOWS[model] != null) return WINDOWS[model];
  // Match por prefixo (ex: "gpt-4o-2024-08-06" → "gpt-4o")
  for (const key of Object.keys(WINDOWS)) {
    if (model.startsWith(key)) return WINDOWS[key];
  }
  return 128_000;
}

/** Formato compacto: 1234 → "1.2k", 128000 → "128k", 1500000 → "1.5M" */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "k";
  return String(n);
}
