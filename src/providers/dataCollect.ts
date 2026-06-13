// src/providers/dataCollect.ts
// Módulo CENTRAL de coleta de sinais sobre modelos (v0.1.152).
//
// Hoje o plugin junta dados de modelo em vários lugares (capabilities, pricing,
// cards, enrichment do OpenRouter). Este módulo centraliza o sinal de
// POPULARIDADE ("hot") — o quanto um modelo é/está sendo usado — e é o ponto
// único pra adicionar novas coletas no futuro.
//
// Fontes do "hot" (privacidade primeiro — SEM telemetria):
//   1. Baseline de POPULARIDADE (hotData.generated.ts): dado REAL do HuggingFace
//      (downloads) pros modelos open + curado pros closed. Atualizado semanal
//      por scripts/collect-hot.mjs (automação) — ver scripts/README.md.
//   2. Uso LOCAL do próprio usuário (nº de chats por modelo) — o plugin
//      registra via registerLocalUsage() no load. É o seu uso, fica no device.
//
// O "hot" final é um blend dos dois → nível 0..3 (chama de chama 🔥).

// Baseline de popularidade vem do arquivo GERADO (dado REAL do HuggingFace pros
// open + curado pros closed), atualizado semanalmente por scripts/collect-hot.mjs.
// Compila os padrões (string → RegExp) uma vez. Fallback minúsculo se vazio.
import { HOT_DATA } from "./hotData.generated";

const HOT_BASELINE: [RegExp, number][] = (
  HOT_DATA.length > 0
    ? HOT_DATA
    : ([
        ["claude-(fable|opus|sonnet)", 0.96],
        ["(^|/)gpt-(4o|5)", 0.9],
        ["gemini-(3|2\\.5)", 0.85],
      ] as [string, number][])
)
  // v0.1.228: HOT_DATA é dado GERADO (semanal por script). Se um padrão vier
  // malformado, new RegExp lança e derrubaria o módulo no import — então cada
  // compilação fica num try/catch que descarta o padrão inválido (e loga).
  .reduce<[RegExp, number][]>((acc, [pat, score]) => {
    try {
      acc.push([new RegExp(pat), score]);
    } catch (e) {
      console.warn(`[dataCollect] padrão de baseline inválido, ignorado: ${pat}`, e);
    }
    return acc;
  }, []);

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

// v0.1.228: o baseline depende SÓ do id (HOT_BASELINE é imutável após o import),
// então memoiza por id — evita re-escanear os ~N padrões a cada render/linha.
const BASELINE_CACHE = new Map<string, number>();

function baselineFor(id: string): number {
  const cached = BASELINE_CACHE.get(id);
  if (cached !== undefined) return cached;
  // Maior score entre TODOS os padrões que casam (robusto à ordem da lista).
  let best = 0;
  for (const [re, s] of HOT_BASELINE) {
    if (s > best && re.test(id)) best = s;
  }
  BASELINE_CACHE.set(id, best);
  return best;
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
