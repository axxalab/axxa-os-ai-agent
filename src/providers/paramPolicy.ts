// src/providers/paramPolicy.ts
// Política de PARÂMETROS por provider/modelo (v0.1.155).
//
// Cada provider/modelo aceita params diferentes. O caso que mais quebra calado:
// modelos de REASONING da OpenAI (o1/o3/o4 + gpt-5) RECUSAM `temperature`
// (e top_p, penalties…) → HTTP 400 "Unsupported value". Mandar a temperatura do
// Effort nesses modelos derruba o request.
//
// Quirks tratados aqui (fonte: docs oficiais + community, jun/2026):
//   - OpenAI o-series + gpt-5 (não -chat): SEM temperature/top_p/penalties.
//     System role vira "developer" automaticamente no lado deles → ok mandar.
//   - DeepSeek R1 / reasoner, Qwen QwQ/thinking, Magistral: reasoning → sem temp.
//   - Anthropic (Claude): temperature é 0..1 (NÃO 0..2). Effort usa 0.2..0.7 →
//     dentro do range, funciona. (Extended thinking exigiria temp=1, mas a
//     gente não liga thinking.) max_tokens é obrigatório (já mandamos).
//   - OpenAI exige max_completion_tokens (não max_tokens) — já tratado no provider.
//   - Demais (Gemini, NIM, Ollama, OpenRouter): temperature 0..2.
//
// Este módulo é o ponto ÚNICO pra adaptar params. Effort manda a temperatura;
// aqui ela é clampada pro range do modelo ou OMITIDA quando não é suportada.

export interface ParamPolicy {
  /** O modelo aceita o param `temperature`? false p/ reasoning models. */
  supportsTemperature: boolean;
  /** Range válido de temperatura [min, max] (Anthropic = 0..1, resto 0..2). */
  tempMin: number;
  tempMax: number;
  /** Modelo de reasoning (chain-of-thought interno) — recusa sampling params. */
  reasoning: boolean;
}

/** Tail = parte após "/" (ex: "openai/o3-mini" → "o3-mini"). */
function tailOf(model: string): string {
  const id = (model || "").toLowerCase();
  return id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id;
}

/** Modelo de reasoning que recusa temperature/top_p/penalties. */
export function isReasoningModel(model: string): boolean {
  const tail = tailOf(model);
  // OpenAI o-series (o1/o3/o4/o5…) — exige dígito após o "o" (não pega "opus").
  if (/^o[1-9]([-.]|$)/.test(tail)) return true;
  // GPT-5 reasoning — o gpt-5-chat (não-reasoning) AINDA aceita temperature.
  if (/(^|[-/])gpt-5/.test(tail) && !tail.includes("chat")) return true;
  // DeepSeek R1 / reasoner (via NIM / OpenRouter / Ollama).
  if (/deepseek-?(r1|reasoner)/.test(tail)) return true;
  // Qwen QwQ / Qwen3 "thinking", Magistral (Mistral reasoning).
  if (/(qwq|qwen3[\w.-]*think|magistral)/.test(tail)) return true;
  return false;
}

/** Modelo da família Claude (provider direto OU via OpenRouter `anthropic/…`). */
function isClaude(provider: string, model: string): boolean {
  const id = (model || "").toLowerCase();
  return provider === "anthropic" || id.includes("claude") || id.includes("anthropic/");
}

export function paramPolicy(provider: string, model: string): ParamPolicy {
  const reasoning = isReasoningModel(model);
  const tempMax = isClaude(provider, model) ? 1 : 2;
  return { supportsTemperature: !reasoning, tempMin: 0, tempMax, reasoning };
}

/**
 * Temperatura FINAL a enviar pro provider, ou `undefined` = NÃO enviar.
 *   - requested < 0 ou null → não enviar (Effort "default do provider").
 *   - modelo reasoning → não enviar (evita 400).
 *   - senão → clampa pro range do modelo.
 */
export function resolveTemperature(
  provider: string,
  model: string,
  requested: number | undefined
): number | undefined {
  if (requested == null || requested < 0) return undefined;
  const p = paramPolicy(provider, model);
  if (!p.supportsTemperature) return undefined;
  return Math.max(p.tempMin, Math.min(p.tempMax, requested));
}

/**
 * Teto de tokens de OUTPUT por modelo (≠ context window!). O Effort "Max" pede
 * ~80% do context (ex: 159k num Claude de 200k), mas o output máximo é bem
 * menor → 400. Aqui clampa pro limite real. Valores curados (jun/2026):
 *   Claude 4.x/Fable = 128k · Claude 3.x = 8k
 *   GPT-5.x = 128k · o-series = 100k (inclui tokens de reasoning) · GPT-4.1 = 32k
 *   GPT-4o = 16k · Gemini 2.5/3 = 64k · resto = 16k (conservador)
 */
export function maxOutputTokens(provider: string, model: string): number {
  const id = (model || "").toLowerCase();
  const tail = tailOf(model);
  // Anthropic
  if (/claude-(fable|opus-4|sonnet-4|haiku-4)/.test(id)) return 128000;
  if (/claude-3/.test(id)) return 8192;
  // OpenAI (direto ou via openrouter "openai/…")
  if (/(^|[-/])gpt-5/.test(tail)) return 128000;
  if (/^o[1-9]([-.]|$)/.test(tail)) return 100000;
  if (/(^|[-/])gpt-4\.1/.test(tail)) return 32768;
  if (/(^|[-/])gpt-4o/.test(tail)) return 16384;
  // Gemini
  if (/gemini-(3|2\.5)/.test(id)) return 65536;
  if (/gemini/.test(id)) return 8192;
  return 16384;
}

/** maxTokens FINAL: clampado pro teto de output do modelo (evita 400). */
export function resolveMaxTokens(
  provider: string,
  model: string,
  requested: number
): number {
  return Math.min(requested, maxOutputTokens(provider, model));
}
