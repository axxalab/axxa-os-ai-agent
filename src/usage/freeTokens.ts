// src/usage/freeTokens.ts
// Programa de "data-sharing" da OpenAI: compartilhar o tráfego da API com a
// OpenAI rende TOKENS GRÁTIS por dia — MAS só em modelos de TEXTO listados, e só
// a partir do Usage Tier 1. Geração de imagem (gpt-image-1 / dall-e) NÃO entra
// na lista de modelos elegíveis → os créditos NÃO cobrem imagem.
//
// Fonte: help.openai.com (data sharing) + OpenAI Developer Community (jun/2026).
// Os termos do programa mudam de tempos em tempos — revisar `asOf`.
export const FREE_TOKENS_AS_OF = "2026-06";

export interface OpenAIFreeAllowance {
  /** Conta elegível (data-sharing ligado + tier ≥ 1). */
  eligible: boolean;
  /** Tokens/dia nos modelos "grandes" (gpt-5 / gpt-4.1 / gpt-4o / o1 / o3). */
  bigPerDay: number;
  /** Tokens/dia nos "mini/nano" (gpt-5-mini/nano, gpt-4o-mini, o4-mini…). */
  miniPerDay: number;
  /** Geração de imagem é coberta? NÃO — modelos de imagem não estão na lista. */
  imageEligible: boolean;
}

// Modelos de TEXTO elegíveis (prefixos). MINI conferido antes de BIG.
const MINI_MODELS = [
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-4o-mini",
  "o1-mini",
  "o4-mini",
  "o3-mini",
  "codex-mini",
];
const BIG_MODELS = ["gpt-5", "gpt-4.1", "gpt-4o", "chatgpt-4o", "o1", "o3"];

/**
 * Cota diária de tokens grátis por tier (data-sharing ligado).
 * Tier 1–2: 250k/dia (grandes) + 2.5M/dia (mini). Tier 3–5: 1M + 10M.
 * Imagem NUNCA é coberta.
 */
export function openaiFreeAllowance(
  tier: number,
  dataSharing: boolean
): OpenAIFreeAllowance {
  if (!dataSharing || tier < 1) {
    return { eligible: false, bigPerDay: 0, miniPerDay: 0, imageEligible: false };
  }
  const low = tier <= 2;
  return {
    eligible: true,
    bigPerDay: low ? 250_000 : 1_000_000,
    miniPerDay: low ? 2_500_000 : 10_000_000,
    imageEligible: false,
  };
}

/** Classifica um modelo de TEXTO na lista elegível do data-sharing (ou null). */
export function openaiFreeTierForModel(model: string): "big" | "mini" | null {
  const m = (model || "").toLowerCase();
  if (MINI_MODELS.some((p) => m.startsWith(p))) return "mini";
  if (BIG_MODELS.some((p) => m.startsWith(p))) return "big";
  return null;
}
