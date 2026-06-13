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
// v0.1.228: dedupe da Promise em voo — N fetches concorrentes compartilham 1 GET.
let catalogPromise: Promise<OpenRouterModel[]> | null = null;

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
  // v0.1.228: valida o shape — só aceita objetos plain (rejeita Array/null),
  // descartando entradas corrompidas do JSON em disco em vez de confiar nelas.
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    CACHE = {};
    return;
  }
  const clean: Record<string, EnrichedModelInfo> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      clean[key] = val;
    }
  }
  CACHE = clean;
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
  // v0.1.228: memoiza a Promise em voo (não só o resultado) — fetches
  // concorrentes compartilham 1 GET; limpa pra null se rejeitar (permite retry).
  if (catalogPromise) return catalogPromise;
  catalogPromise = (async () => {
    const res = await requestUrl({
      url: "https://openrouter.ai/api/v1/models",
      method: "GET",
      headers: { Accept: "application/json" },
      // requestUrl lança em status >=400 quando throw=true (padrão); checamos
      // explícito abaixo pra não confiar em corpo vazio/200 sem data.
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error("OpenRouter /models HTTP " + res.status);
    }
    const data = (res.json && res.json.data) as OpenRouterModel[] | undefined;
    // v0.1.228: só cacheia catálogo válido e não-vazio; em falha deixa null
    // pra permitir retry numa próxima chamada (não fixa um array vazio).
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("OpenRouter /models payload vazio/inválido");
    }
    openRouterCatalog = data;
    return data;
  })();
  try {
    return await catalogPromise;
  } catch (e) {
    catalogPromise = null;
    throw e;
  }
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
  // v0.1.228: prefixo só casa com limite de borda (próximo char é separador
  // -/:/. ou fim) e prefixo >=5 chars, evitando "gpt-4" casar "gpt-4o-mini".
  // Entre vários candidatos, prefere o de maior overlap (prefixo mais longo).
  const boundary = (full: string, prefix: string): boolean => {
    if (!full.startsWith(prefix)) return false;
    const next = full.charAt(prefix.length);
    return next === "" || next === "-" || next === ":" || next === "/" || next === ".";
  };
  let best: OpenRouterModel | null = null;
  let bestLen = 0;
  for (const m of catalog) {
    const mt = tailOf(m.id || "");
    let overlap = 0;
    if (tail.length >= 5 && boundary(mt, tail)) overlap = tail.length;
    else if (mt.length >= 5 && boundary(tail, mt)) overlap = mt.length;
    if (overlap > bestLen) {
      bestLen = overlap;
      best = m;
    }
  }
  return best;
}

function perMillion(usdPerToken: string | undefined): number | null {
  const v = parseFloat(usdPerToken ?? "");
  if (isNaN(v)) return null;
  // v0.1.228: 6 casas decimais — preços sub-centavo por milhão (modelos
  // baratos) não colapsam a 0, evitando classificá-los como gratuitos.
  return Math.round(v * 1_000_000 * 1_000_000) / 1_000_000;
}

function toEnriched(raw: OpenRouterModel): EnrichedModelInfo {
  const arch = raw.architecture ?? {};
  // v0.1.228: prefere input_modalities; no fallback do campo `modality`
  // (ex: "text+image->text") pega só a parte ANTES do fluxo "->" e faz split
  // por "+". Não usa classe com "-" (quebrava "text-to-image" e ids hifenizados).
  const inModal =
    arch.input_modalities ??
    (arch.modality
      ? String(arch.modality)
          .split("->")[0]
          .split("+")
          .map((s) => s.trim())
      : []);
  const params = raw.supported_parameters ?? [];
  const input = perMillion(raw.pricing?.prompt);
  const output = perMillion(raw.pricing?.completion);
  const imgRaw = parseFloat(raw.pricing?.image ?? "");
  // v0.1.228: separa "preço zero confirmado" de "preço desconhecido (null)".
  // free só quando ambos são 0 reais; se algum for null → "unknown".
  const tier: "free" | "paid" | "unknown" =
    input === 0 && output === 0
      ? "free"
      : input === null || output === null
        ? "unknown"
        : "paid";
  const rawDesc =
    typeof raw.description === "string" ? raw.description.trim() : undefined;
  return {
    // v0.1.228: trunca a 280 chars (com reticências) — limita o tamanho do
    // cache. O consumidor renderiza como texto, nunca dangerouslySetInnerHTML.
    descriptionEn:
      rawDesc && rawDesc.length > 280 ? rawDesc.slice(0, 279) + "…" : rawDesc,
    contextWindow:
      typeof raw.context_length === "number" ? raw.context_length : undefined,
    inputPerMillion: input,
    outputPerMillion: output,
    // v0.1.228: 0 é preço válido (imagem grátis) — null só quando ausente/NaN.
    imagePerCall: isNaN(imgRaw) ? null : imgRaw,
    modalities: inModal.filter(Boolean),
    outputModalities: (arch.output_modalities ?? []).filter(Boolean),
    supportsTools:
      params.includes("tools") || params.includes("tool_choice"),
    tier,
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
