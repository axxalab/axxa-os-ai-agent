// src/providers/dataCollect.ts
// Módulo CENTRAL de coleta de sinais sobre modelos (v0.1.152).
//
// Hoje o plugin junta dados de modelo em vários lugares (capabilities, pricing,
// cards, enrichment do OpenRouter). Este módulo centraliza o sinal de
// POPULARIDADE ("hot") — o quanto um modelo é/está sendo usado — e é o ponto
// único pra adicionar novas coletas no futuro.
//
// Fontes do "hot" (privacidade primeiro — SEM telemetria):
//   1. Baseline curado: modelos reconhecidamente populares/acima-da-média.
//   2. Uso LOCAL do próprio usuário (nº de chats por modelo) — o plugin
//      registra via registerLocalUsage() no load. É o seu uso, fica no device.
//
// O "hot" final é um blend dos dois → nível 0..3 (chama de chama 🔥).

/** Baseline de popularidade por padrão de id de modelo. 1ª regra que casa vence.
 *  Score 0..1 — quão "above average" o modelo é no mercado (curado, jun/2026). */
const HOT_BASELINE: [RegExp, number][] = [
  [/claude-(fable|opus|sonnet)/, 0.96],
  [/(^|\/)gpt-5/, 0.95],
  [/(^|\/)gpt-4o/, 0.92],
  [/gemini-(3|2\.5-(pro|flash))/, 0.9],
  [/(^|\/)o[34](\b|-)/, 0.82],
  [/deepseek-(r1|v3)/, 0.82],
  [/llama-3\.[123]/, 0.74],
  [/claude-haiku/, 0.7],
  [/(^|\/)o1(\b|-)/, 0.68],
  [/qwen(2\.5|3)/, 0.62],
  [/(mistral-large|mixtral|pixtral)/, 0.6],
  [/(flux|stable-?diffusion|sdxl)/, 0.62],
  [/(dall-e|gpt-image|nano-?banana|imagen)/, 0.6],
  [/claude-3/, 0.5],
  [/gemini-(1\.5|2\.0)/, 0.5],
  [/(mistral|gemma|phi)/, 0.42],
];

/** Uso local normalizado (0..1) por model id lowercase. Vazio até o registro. */
let LOCAL_USAGE: Record<string, number> = {};

/**
 * Registra o uso LOCAL do usuário (ex: nº de chats por modelo). Normaliza pelo
 * máximo → 0..1. Chamado pelo plugin no load (best-effort). v0.1.152
 */
export function registerLocalUsage(byModelCount: Record<string, number>): void {
  const values = Object.values(byModelCount);
  const max = Math.max(1, ...values);
  const next: Record<string, number> = {};
  for (const [model, count] of Object.entries(byModelCount)) {
    if (count > 0) next[model.toLowerCase()] = count / max;
  }
  LOCAL_USAGE = next;
}

export interface HotInfo {
  /** 0 = sem destaque, 1 = morno, 2 = quente, 3 = em alta (acima da média). */
  level: 0 | 1 | 2 | 3;
  /** Score combinado 0..1 (baseline + uso local). */
  score: number;
  /** O usuário usa esse modelo localmente? (boost veio do uso dele). */
  usedLocally: boolean;
}

function baselineFor(id: string): number {
  for (const [re, s] of HOT_BASELINE) {
    if (re.test(id)) return s;
  }
  return 0;
}

/**
 * "Hot" de um modelo: blend do baseline curado com o uso local do usuário.
 * O uso local pesa mais (mostra o que VOCÊ realmente usa), mas o baseline
 * garante destaque pros populares mesmo num vault novo.
 */
export function getHotLevel(provider: string, model: string): HotInfo {
  const id = (model || "").toLowerCase();
  const base = baselineFor(id);
  const local = LOCAL_USAGE[id] ?? 0;
  const score = Math.min(1, base * 0.65 + local * 0.7);
  const level: HotInfo["level"] =
    score >= 0.72 ? 3 : score >= 0.45 ? 2 : score >= 0.2 ? 1 : 0;
  return { level, score, usedLocally: local > 0 };
}

/** Label curto do nível pro tooltip. */
export function hotLabel(info: HotInfo): string {
  switch (info.level) {
    case 3: return info.usedLocally ? "Em alta · você usa muito" : "Em alta";
    case 2: return info.usedLocally ? "Popular · você usa" : "Popular";
    case 1: return "Conhecido";
    default: return "";
  }
}
