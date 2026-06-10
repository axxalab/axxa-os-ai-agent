// src/providers/modelInfoStore.ts
// Camada de COLETA de dados dos modelos (v0.1.130).
//
// Estratégia pra plugin público (decidida com o dev):
//   - Baseline = registro local curado (modelDescriptions.ts) → offline, pt/en,
//     review-safe, renderiza instantâneo.
//   - Enriquecimento = botão "Fetch info" busca specs/pricing/modalidade ao vivo
//     via OpenRouter /api/v1/models (público, sem API key, cobre fechados+open),
//     e faz MERGE num cache persistido em JSON no diretório do plugin.
//   - O card lê cache-sobre-bundled (enriched override do curado).
//
// Rede via requestUrl do Obsidian (fura CORS). Inglês vem da API; o pt fica
// curado no baseline.

import { requestUrl } from "obsidian";

/** Specs enriquecidas de um modelo (vindas do fetch — OpenRouter por ora). */
export interface EnrichedModelInfo {
  /** Descrição em inglês (a API só dá EN; pt fica curado no baseline). */
  descriptionEn?: string;
  contextWindow?: number;
  inputPerMillion?: number | null;
  outputPerMillion?: number | null;
  /** USD por imagem (image gen / input de imagem). */
  imagePerCall?: number | null;
  /** Modalidades de INPUT aceitas: text / image / audio / file ... */
  modalities?: string[];
  /** Modalidades de OUTPUT: text / image ... */
  outputModalities?: string[];
  /** Suporta tool/function calling. */
  supportsTools?: boolean;
  tier?: "free" | "paid" | "unknown";
  /** Fonte do dado ("openrouter") + quando foi buscado (ISO). */
  source?: string;
  fetchedAt?: string;
}

// Cache em memória (hidratado do disco no onload do plugin).
let CACHE: Record<string, EnrichedModelInfo> = {};
// Catálogo do OpenRouter cacheado por sessão (1 GET serve pra vários fetches).
let openRouterCatalog: OpenRouterModel[] | null = null;

interface OpenRouterModel {
  id?: string;
  name?: string;
  description?: string;
  context_length?: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
  pricing?: { prompt?: string; completion?: string; image?: string };
  supported_parameters?: string[];
}

export function cacheKey(provider: string, model: string): string {
  return provider + "::" + model;
}

/** Hidrata o cache em memória a partir do que o plugin leu do disco. */
export function hydrateModelInfoCache(
  data: Record<string, EnrichedModelInfo> | undefined | null
): void {
  CACHE = data && typeof data === "object" ? data : {};
}

/** Snapshot do cache pra persistir em disco. */
export function getModelInfoCache(): Record<string, EnrichedModelInfo> {
  return CACHE;
}

/** Lê specs enriquecidas de um modelo (cache-sobre-bundled no card). */
export function getEnrichedInfo(
  provider: string,
  model: string
): EnrichedModelInfo | undefined {
  return CACHE[cacheKey(provider, model)];
}

async function loadOpenRouterCatalog(): Promise<OpenRouterModel[]> {
  if (openRouterCatalog) return openRouterCatalog;
  const res = await requestUrl({
    url: "https://openrouter.ai/api/v1/models",
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const data = (res.json && res.json.data) as OpenRouterModel[] | undefined;
  openRouterCatalog = Array.isArray(data) ? data : [];
  return openRouterCatalog;
}

/** "openai/gpt-4o" / "gpt-4o:free" → "gpt-4o" (cauda, sem vendor nem :free). */
function tailOf(id: string): string {
  const lower = (id || "").toLowerCase().replace(/:free$/, "");
  return lower.includes("/") ? lower.slice(lower.lastIndexOf("/") + 1) : lower;
}

/** Acha o modelo no catálogo do OpenRouter: id exato → cauda igual → prefixo. */
function matchOpenRouter(
  catalog: OpenRouterModel[],
  model: string
): OpenRouterModel | null {
  const lower = (model || "").toLowerCase().replace(/:free$/, "");
  let hit = catalog.find((m) => (m.id || "").toLowerCase() === lower);
  if (hit) return hit;
  const tail = tailOf(model);
  hit = catalog.find((m) => tailOf(m.id || "") === tail);
  if (hit) return hit;
  hit = catalog.find((m) => {
    const mt = tailOf(m.id || "");
    return mt.length > 2 && (mt.startsWith(tail) || tail.startsWith(mt));
  });
  return hit ?? null;
}

function perMillion(usdPerToken: string | undefined): number | null {
  const v = parseFloat(usdPerToken ?? "");
  if (isNaN(v)) return null;
  return Math.round(v * 1_000_000 * 100) / 100;
}

function toEnriched(raw: OpenRouterModel): EnrichedModelInfo {
  const arch = raw.architecture ?? {};
  const inModal =
    arch.input_modalities ??
    (arch.modality ? String(arch.modality).split(/[+>-]/).map((s) => s.trim()) : []);
  const params = raw.supported_parameters ?? [];
  const input = perMillion(raw.pricing?.prompt);
  const output = perMillion(raw.pricing?.completion);
  const imgRaw = parseFloat(raw.pricing?.image ?? "");
  const isFree =
    (input === 0 || input === null) && (output === 0 || output === null);
  return {
    descriptionEn:
      typeof raw.description === "string" ? raw.description.trim() : undefined,
    contextWindow:
      typeof raw.context_length === "number" ? raw.context_length : undefined,
    inputPerMillion: input,
    outputPerMillion: output,
    imagePerCall: isNaN(imgRaw) || imgRaw === 0 ? null : imgRaw,
    modalities: inModal.filter(Boolean),
    outputModalities: (arch.output_modalities ?? []).filter(Boolean),
    supportsTools:
      params.includes("tools") || params.includes("tool_choice"),
    tier: input === 0 && output === 0 ? "free" : isFree ? "unknown" : "paid",
    source: "openrouter",
  };
}

/**
 * Busca e cacheia as specs de um modelo via OpenRouter. Retorna a info
 * (e atualiza o cache em memória) ou null se não achou correspondência.
 * O CALLER persiste em disco (plugin.saveModelInfoCache) após sucesso.
 */
export async function fetchAndCacheModelInfo(
  provider: string,
  model: string
): Promise<EnrichedModelInfo | null> {
  const catalog = await loadOpenRouterCatalog();
  const raw = matchOpenRouter(catalog, model);
  if (!raw) return null;
  const info = toEnriched(raw);
  info.fetchedAt = new Date().toISOString();
  CACHE[cacheKey(provider, model)] = info;
  return info;
}
