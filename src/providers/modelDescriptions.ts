// src/providers/modelDescriptions.ts
// Model cards — descrição curta + categoria pra cada modelo conhecido.
// Match por prefixo igual ao modelCapabilities.ts.
//
// Usado por:
//   - StarterScreen: agrupa <optgroup> por categoria + mostra card abaixo do select
//   - Settings: mostra cards no editor de activeModels
//   - Tooltip "?" pra explicar o que cada modelo faz

import type { ModelCapabilities } from "./modelCapabilities";
import { getModelCapabilities, isGenerationModel } from "./modelCapabilities";
import { getPricing, type ModelPricing } from "../usage/pricing";
import { getEnrichedInfo, type EnrichedModelInfo } from "./modelInfoStore";

/** Categoria semântica que vira <optgroup> no select. */
export type ModelCategory =
  | "chat-vision"      // Multimodal chat (texto + imagem input)
  | "chat-text"        // Chat text-only
  | "reasoning"        // Reasoning models (o1, o3, DeepSeek R1, etc)
  | "agent"            // Otimizado pra tool calling/agent loops
  | "image-gen"        // Text-to-image
  | "audio-gen"        // TTS
  | "video-gen"        // Text-to-video (Veo, Sora, Cosmos)
  | "embedding"        // Não chega aqui mas reservado
  | "other";

export interface ModelCard {
  /** Categoria pra agrupamento no UI. */
  category: ModelCategory;
  /** Descrição curta humanizada (1-2 frases, sem jargão). */
  description: string;
  /** Janela de contexto em tokens (heurística — não sempre exato). */
  contextWindow?: number;
  /** Boa pra quê (tagline marketing). */
  goodFor?: string;
}

interface CardEntry {
  prefix: string;
  card: ModelCard;
}

// ─────────────────────────────── OpenAI ───────────────────────────────
const OPENAI_CARDS: CardEntry[] = [
  // Image gen
  { prefix: "dall-e-3", card: { category: "image-gen", description: "Geração de imagem clássica da OpenAI. Bom em estilos artísticos e ilustrações. Aceita 3 tamanhos.", contextWindow: 4_000, goodFor: "Arte, ilustração, conceitos visuais" } },
  { prefix: "dall-e-2", card: { category: "image-gen", description: "Versão anterior, mais barata. Útil pra prototipagem rápida.", goodFor: "Prototipagem barata" } },
  { prefix: "gpt-image-1", card: { category: "image-gen", description: "Geração nova baseada em GPT-4o. Aceita prompt longo + edição inline. Exige org verification.", contextWindow: 50_000, goodFor: "Fotorealismo, texto em imagens" } },
  // TTS
  { prefix: "tts-1-hd", card: { category: "audio-gen", description: "Text-to-speech HD. Voz mais natural, latência maior.", goodFor: "Voz pra video/podcast" } },
  { prefix: "tts-1", card: { category: "audio-gen", description: "Text-to-speech rápido. Latência baixa, qualidade boa.", goodFor: "Voz em tempo real" } },
  { prefix: "gpt-4o-mini-tts", card: { category: "audio-gen", description: "TTS novo baseado em GPT-4o-mini. Suporta direção de estilo no prompt.", goodFor: "Voz com personalidade controlável" } },
  // Reasoning / o-series
  { prefix: "o4-mini", card: { category: "reasoning", description: "Reasoning compacto da geração o4. Pensa antes de responder, ótimo em STEM.", contextWindow: 200_000, goodFor: "Lógica, matemática, código complexo" } },
  { prefix: "o4", card: { category: "reasoning", description: "Reasoning de ponta. Chain-of-thought interno. Caro mas resolve problemas difíceis.", contextWindow: 200_000, goodFor: "Problemas que outros modelos erram" } },
  { prefix: "o3-mini", card: { category: "reasoning", description: "Reasoning intermediário, equilibrado.", contextWindow: 200_000, goodFor: "STEM custo-benefício" } },
  { prefix: "o3", card: { category: "reasoning", description: "Reasoning forte. Excelente em coding agentic.", contextWindow: 200_000, goodFor: "Coding tasks longas" } },
  { prefix: "o1-mini", card: { category: "reasoning", description: "Reasoning rápido. Suporte ao function calling limitado.", contextWindow: 128_000, goodFor: "STEM rápido" } },
  { prefix: "o1", card: { category: "reasoning", description: "Primeiro reasoning da OpenAI. Caro mas potente em raciocínio puro.", contextWindow: 200_000, goodFor: "Raciocínio puro" } },
  // GPT-5
  { prefix: "gpt-5-nano", card: { category: "chat-vision", description: "Versão mais barata da família GPT-5. Multimodal + tools.", contextWindow: 256_000, goodFor: "Chat barato em escala" } },
  { prefix: "gpt-5-mini", card: { category: "chat-vision", description: "GPT-5 econômico com qualidade próxima ao base.", contextWindow: 256_000, goodFor: "Daily driver" } },
  { prefix: "gpt-5", card: { category: "chat-vision", description: "Topo de linha multimodal da OpenAI. Tool calling, vision, código.", contextWindow: 256_000, goodFor: "Tasks complexas multimodais" } },
  // GPT-4o
  { prefix: "gpt-4o-mini", card: { category: "chat-vision", description: "Multimodal econômico. Excelente custo-benefício pra agent.", contextWindow: 128_000, goodFor: "Agent loops baratos" } },
  { prefix: "gpt-4o", card: { category: "chat-vision", description: "GPT-4 omni: chat, vision e tool calling fluido. Padrão pra agent.", contextWindow: 128_000, goodFor: "Agent geral, vision" } },
];

// ─────────────────────────── Anthropic ───────────────────────────
const ANTHROPIC_CARDS: CardEntry[] = [
  { prefix: "claude-fable-5", card: { category: "chat-vision", description: "Claude Fable 5 — modelo Anthropic mais recente. Multimodal + tool calling, forte em raciocínio e código.", contextWindow: 200_000, goodFor: "Tasks complexas, agent, vision" } },
  { prefix: "claude-opus-4-8", card: { category: "chat-vision", description: "Claude Opus 4.8 — topo de linha. Excelente em coding agentic + raciocínio extenso.", contextWindow: 200_000, goodFor: "Coding agentic complexo" } },
  { prefix: "claude-opus-4", card: { category: "chat-vision", description: "Opus 4 — raciocínio profundo. Caro.", contextWindow: 200_000, goodFor: "Tasks que exigem profundidade" } },
  { prefix: "claude-sonnet-4-6", card: { category: "chat-vision", description: "Sonnet 4.6 — equilíbrio entre custo e qualidade. Excelente em tools.", contextWindow: 200_000, goodFor: "Daily driver, agent geral" } },
  { prefix: "claude-sonnet-4", card: { category: "chat-vision", description: "Sonnet 4 — rápido, multimodal, com tool calling forte.", contextWindow: 200_000, goodFor: "Agent geral" } },
  { prefix: "claude-haiku-4-5", card: { category: "chat-vision", description: "Haiku 4.5 — econômico e veloz. Bom em tarefas curtas.", contextWindow: 200_000, goodFor: "Chat barato, classificação" } },
  { prefix: "claude-haiku-4", card: { category: "chat-vision", description: "Haiku 4 — versão econômica e rápida.", contextWindow: 200_000, goodFor: "Volume alto barato" } },
  { prefix: "claude-3-5-sonnet", card: { category: "chat-vision", description: "Sonnet 3.5 — gerada anterior. Ainda ótimo pra coding.", contextWindow: 200_000, goodFor: "Coding (legacy)" } },
  { prefix: "claude-3-5-haiku", card: { category: "chat-vision", description: "Haiku 3.5 — antigo mas estável.", contextWindow: 200_000, goodFor: "Volume legacy" } },
  { prefix: "claude-3", card: { category: "chat-vision", description: "Família Claude 3 — opus/sonnet/haiku originais.", contextWindow: 200_000, goodFor: "Compat legacy" } },
];

// ─────────────────────────────── Gemini ───────────────────────────────
const GEMINI_CARDS: CardEntry[] = [
  // Image gen
  { prefix: "gemini-2.5-flash-image", card: { category: "image-gen", description: 'Nano Banana — image gen rápido da Google. Aceita até 20 refs, edição conversacional, character consistency. Free tier 500 img/dia.', contextWindow: 32_000, goodFor: "Geração + edição rápida, free tier" } },
  { prefix: "gemini-2.0-flash-exp-image", card: { category: "image-gen", description: "Experimental image gen anterior. Ainda funcional.", goodFor: "Experimentos" } },
  { prefix: "imagen-4", card: { category: "image-gen", description: "Imagen 4 — qualidade premium pra arte/marketing.", goodFor: "Quality > speed" } },
  { prefix: "imagen-3", card: { category: "image-gen", description: "Imagen 3 — high quality stable. Bom em fotorealismo.", goodFor: "Fotorealismo" } },
  // TTS
  { prefix: "gemini-2.5-flash-preview-tts", card: { category: "audio-gen", description: "TTS preview do Gemini 2.5. Multi-língua, latência baixa.", goodFor: "TTS multi-língua barato" } },
  // Video gen
  { prefix: "veo", card: { category: "video-gen", description: "Veo — text-to-video da Google. Disponível em preview.", goodFor: "Video curto" } },
  // Chat
  { prefix: "gemini-3-pro", card: { category: "chat-vision", description: "Gemini 3 Pro — topo de linha, multimodal nativo incluindo vídeo.", contextWindow: 2_000_000, goodFor: "Tasks longas + vídeo" } },
  { prefix: "gemini-3.5-flash", card: { category: "chat-vision", description: "Gemini 3.5 Flash — rápido e econômico.", contextWindow: 1_000_000, goodFor: "Daily driver Google" } },
  { prefix: "gemini-3.1-flash-lite", card: { category: "chat-vision", description: "Versão lite, ainda multimodal, custo mais baixo.", contextWindow: 1_000_000, goodFor: "Volume econômico" } },
  { prefix: "gemini-2.5-pro", card: { category: "chat-vision", description: "Gemini 2.5 Pro — pensamento longo + multimodal completo.", contextWindow: 2_000_000, goodFor: "Tasks longas, RAG enorme" } },
  { prefix: "gemini-2.5-flash-lite", card: { category: "chat-vision", description: "Flash lite — mais econômico que o flash.", contextWindow: 1_000_000, goodFor: "Volume barato" } },
  { prefix: "gemini-2.5-flash", card: { category: "chat-vision", description: "Flash — equilíbrio entre velocidade e qualidade. Padrão Gemini.", contextWindow: 1_000_000, goodFor: "Daily driver" } },
  { prefix: "gemini-2.0-flash", card: { category: "chat-vision", description: "Gemini 2.0 Flash — geração anterior, estável.", contextWindow: 1_000_000, goodFor: "Compat" } },
  { prefix: "gemini-1.5-pro", card: { category: "chat-vision", description: "Gemini 1.5 Pro — 2M context window legendário.", contextWindow: 2_000_000, goodFor: "Context enorme" } },
  { prefix: "gemini-1.5-flash", card: { category: "chat-vision", description: "1.5 Flash — antigo mas ainda usado.", contextWindow: 1_000_000, goodFor: "Compat legacy" } },
];

// ─────────────────────────── OpenRouter ───────────────────────────
const OPENROUTER_CARDS: CardEntry[] = [
  // Reusa descrições dos upstreams quando possível
  { prefix: "anthropic/claude-opus-4", card: { category: "chat-vision", description: "Claude Opus 4 via OpenRouter — proxied. Pricing igual upstream + margem pequena.", contextWindow: 200_000 } },
  { prefix: "anthropic/claude-sonnet-4", card: { category: "chat-vision", description: "Claude Sonnet 4 via OpenRouter.", contextWindow: 200_000 } },
  { prefix: "anthropic/claude-haiku-4", card: { category: "chat-vision", description: "Claude Haiku 4 via OpenRouter.", contextWindow: 200_000 } },
  { prefix: "anthropic/claude-3.5-sonnet", card: { category: "chat-vision", description: "Claude 3.5 Sonnet via OpenRouter — coding legacy.", contextWindow: 200_000 } },
  { prefix: "openai/gpt-5", card: { category: "chat-vision", description: "GPT-5 via OpenRouter.", contextWindow: 256_000 } },
  { prefix: "openai/gpt-4o", card: { category: "chat-vision", description: "GPT-4o via OpenRouter — agent forte.", contextWindow: 128_000 } },
  { prefix: "openai/o1", card: { category: "reasoning", description: "o1 via OpenRouter — reasoning premium.", contextWindow: 200_000 } },
  { prefix: "google/gemini-2.5-pro", card: { category: "chat-vision", description: "Gemini 2.5 Pro via OpenRouter.", contextWindow: 2_000_000 } },
  { prefix: "google/gemini-2.5-flash", card: { category: "chat-vision", description: "Gemini 2.5 Flash via OpenRouter.", contextWindow: 1_000_000 } },
  { prefix: "meta-llama/llama-3.3-70b", card: { category: "chat-text", description: "Llama 3.3 70B — open source, ótimo em coding.", contextWindow: 131_000, goodFor: "Coding open source" } },
  { prefix: "meta-llama/llama-3.1-405b", card: { category: "chat-text", description: "Llama 3.1 405B — maior open weight da Meta.", contextWindow: 131_000, goodFor: "Quality open source" } },
  { prefix: "qwen/qwen3-coder", card: { category: "agent", description: "Qwen3 Coder — purpose-built pra coding agentic com 256k context.", contextWindow: 256_000, goodFor: "Coding agent open source" } },
  { prefix: "deepseek/deepseek-r1", card: { category: "reasoning", description: "DeepSeek R1 — reasoning open source competitivo com o1.", contextWindow: 64_000, goodFor: "Reasoning barato" } },
];

// ─────────────────────────── Nvidia NIM ───────────────────────────
const NIM_CARDS: CardEntry[] = [
  // Image gen
  { prefix: "stabilityai/stable-diffusion-3", card: { category: "image-gen", description: "Stable Diffusion 3 Medium — geração de imagem clássica. Free tier NIM.", goodFor: "Image gen aberta" } },
  { prefix: "stabilityai/sdxl", card: { category: "image-gen", description: "SDXL — image gen antiga mas ainda popular.", goodFor: "Estilo cinematográfico" } },
  { prefix: "black-forest-labs/flux", card: { category: "image-gen", description: "FLUX — geração de imagem de qualidade premium open source.", goodFor: "Qualidade premium open" } },
  // Chat
  { prefix: "meta/llama-3.3-70b", card: { category: "chat-text", description: "Llama 3.3 70B Instruct — chat open source via NIM.", contextWindow: 131_000, goodFor: "Coding rápido" } },
  { prefix: "meta/llama-3.1-405b", card: { category: "chat-text", description: "Llama 3.1 405B — maior open weight.", contextWindow: 131_000, goodFor: "Quality open" } },
  { prefix: "meta/llama-3.1-70b", card: { category: "chat-text", description: "Llama 3.1 70B — open source popular.", contextWindow: 131_000, goodFor: "Daily open" } }, // v0.1.228: corrige typo 'populärst'
  { prefix: "nvidia/llama-3.1-nemotron-70b", card: { category: "agent", description: "Nemotron 70B — fine-tuned pra agentic.", contextWindow: 131_000, goodFor: "Agent open" } },
  { prefix: "mistralai/mixtral-8x22b", card: { category: "chat-text", description: "Mixtral 8x22B — MoE da Mistral.", contextWindow: 65_000, goodFor: "Quality EU open" } },
  { prefix: "deepseek-ai/deepseek-r1", card: { category: "reasoning", description: "DeepSeek R1 via NIM — reasoning open.", contextWindow: 64_000, goodFor: "Reasoning open" } },
  { prefix: "qwen/qwen2.5-72b", card: { category: "chat-text", description: "Qwen 2.5 72B — chat open Asian.", contextWindow: 131_000, goodFor: "Multilíngue" } },
  { prefix: "microsoft/phi-4", card: { category: "chat-text", description: "Phi-4 da Microsoft — pequeno mas potente.", contextWindow: 16_000, goodFor: "Pequeno e barato" } },
];

// ─────────────────────────── Ollama (local) ───────────────────────────
const OLLAMA_CARDS: CardEntry[] = [
  { prefix: "llava", card: { category: "chat-vision", description: "LLaVA — vision local. Rodando 100% no seu hardware.", goodFor: "Vision privacy" } },
  { prefix: "llama3.2-vision", card: { category: "chat-vision", description: "Llama 3.2 Vision local — multimodal open.", goodFor: "Vision privacy" } },
  { prefix: "llama3.3", card: { category: "chat-text", description: "Llama 3.3 local — chat sem internet.", goodFor: "Privacy total" } },
  { prefix: "llama3.2", card: { category: "chat-text", description: "Llama 3.2 local — econômico em RAM.", goodFor: "Privacy laptop" } },
  { prefix: "llama3.1", card: { category: "chat-text", description: "Llama 3.1 local — clássico open.", goodFor: "Privacy padrão" } },
  { prefix: "qwen2.5-vl", card: { category: "chat-vision", description: "Qwen 2.5 VL — vision local Asian.", goodFor: "Vision multi-língua" } },
  { prefix: "qwen2.5", card: { category: "chat-text", description: "Qwen 2.5 local — multilíngue forte.", goodFor: "Multi-língua privacy" } },
  { prefix: "qwen3", card: { category: "chat-text", description: "Qwen3 local — geração nova.", goodFor: "Atualizado open" } },
  { prefix: "mistral-large", card: { category: "chat-text", description: "Mistral Large local — quality open EU.", goodFor: "Quality privacy" } },
  { prefix: "mistral", card: { category: "chat-text", description: "Mistral local — clássico EU.", goodFor: "Privacy padrão" } },
  { prefix: "deepseek-r1", card: { category: "reasoning", description: "DeepSeek R1 local — reasoning sem internet.", goodFor: "Reasoning privacy" } },
  { prefix: "deepseek", card: { category: "chat-text", description: "DeepSeek local.", goodFor: "Privacy" } },
  { prefix: "phi", card: { category: "chat-text", description: "Phi local — pequeno e rápido.", goodFor: "Laptop CPU" } },
  { prefix: "gemma", card: { category: "chat-text", description: "Gemma local — Google open.", goodFor: "Privacy padrão" } },
  { prefix: "minicpm-v", card: { category: "chat-vision", description: "MiniCPM-V — vision local minúsculo.", goodFor: "Mobile vision" } },
  { prefix: "moondream", card: { category: "chat-vision", description: "Moondream — vision tiny modelo.", goodFor: "Edge vision" } },
];

const CARDS_BY_PROVIDER: Record<string, CardEntry[]> = {
  openai: OPENAI_CARDS,
  anthropic: ANTHROPIC_CARDS,
  gemini: GEMINI_CARDS,
  openrouter: OPENROUTER_CARDS,
  nim: NIM_CARDS,
  ollama: OLLAMA_CARDS,
};

const DEFAULT_CARD: ModelCard = {
  category: "other",
  description: "Modelo sem descrição cadastrada — pode funcionar normalmente, mas sem hint de uso.",
};

/**
 * Retorna ModelCard pelo provider + modelo. Match por prefixo, fallback genérico.
 * Se caps já são conhecidas, deduz categoria delas quando a card não bate.
 */
export function getModelCard(
  provider: string,
  model: string,
  caps?: ModelCapabilities
): ModelCard {
  if (!model) return DEFAULT_CARD;
  const entries = CARDS_BY_PROVIDER[provider];
  if (entries) {
    const lower = model.toLowerCase();
    for (const e of entries) {
      if (lower.startsWith(e.prefix.toLowerCase())) {
        return e.card;
      }
    }
  }
  // Fallback: deduz categoria a partir das caps
  const c = caps ?? getModelCapabilities(provider, model);
  if (c.imageGen) return { category: "image-gen", description: "Modelo de geração de imagem." };
  if (c.audioGen) return { category: "audio-gen", description: "Modelo de TTS / voz." };
  if (c.videoGen) return { category: "video-gen", description: "Modelo de geração de vídeo." };
  if (c.vision) return { category: "chat-vision", description: "Chat multimodal (texto + imagem)." };
  return { category: "chat-text", description: "Chat texto." };
}

/** Labels semânticos por categoria (PT-BR — i18n vem depois). */
export const CATEGORY_LABELS: Record<ModelCategory, string> = {
  "chat-vision": "Chat multimodal",
  "chat-text": "Chat texto",
  "reasoning": "Raciocínio profundo",
  "agent": "Agent / tools",
  "image-gen": "Geração de imagem",
  "audio-gen": "Geração de áudio",
  "video-gen": "Geração de vídeo",
  "embedding": "Embeddings",
  "other": "Outros",
};

/** Ordem canônica das categorias no UI (mais usados em cima). */
export const CATEGORY_ORDER: ModelCategory[] = [
  "chat-vision",
  "chat-text",
  "reasoning",
  "agent",
  "image-gen",
  "audio-gen",
  "video-gen",
  "embedding",
  "other",
];

/**
 * Agrupa uma lista de model IDs em buckets por categoria.
 * Pra usar como <optgroup> num <select>.
 */
export function groupModelsByCategory(
  provider: string,
  models: string[]
): Map<ModelCategory, string[]> {
  const groups = new Map<ModelCategory, string[]>();
  for (const m of models) {
    const card = getModelCard(provider, m);
    const list = groups.get(card.category) ?? [];
    list.push(m);
    groups.set(card.category, list);
  }
  return groups;
}

/** Helper de UI: combina ModelCard + ModelPricing + ModelCapabilities num bundle.
 *  `enriched` = specs vindas do Fetch info (OpenRouter), cache-sobre-bundled. */
export interface ModelFullInfo {
  card: ModelCard;
  caps: ModelCapabilities;
  pricing: ModelPricing;
  enriched?: EnrichedModelInfo;
}

export function getModelFullInfo(
  provider: string,
  model: string
): ModelFullInfo {
  const caps = getModelCapabilities(provider, model);
  const card = getModelCard(provider, model, caps);
  const pricing = getPricing(provider, model);
  const enriched = getEnrichedInfo(provider, model);
  void isGenerationModel; // silenciar unused warning na re-export
  return { card, caps, pricing, enriched };
}

/**
 * Nome CURTO/apresentável a partir do id do modelo — mesmo quando a API devolve um
 * id longo. Ex: "claude-opus-4-8" → "Opus 4.8", "anthropic/claude-3.5-sonnet" →
 * "3.5 Sonnet", "llama3.2:latest" → "Llama3.2". Usado no pill do composer + sheet.
 */
export function prettyModelName(id: string): string {
  let s = (id || "").trim();
  if (s.includes("/")) s = s.slice(s.lastIndexOf("/") + 1); // vendor/model → model
  if (s.includes(":")) s = s.slice(0, s.indexOf(":")); // tira tag tipo :latest
  s = s.replace(/^(claude-|models-)/, "");
  s = s.replace(/(\d)-(\d)/g, "$1.$2"); // versões: 4-8 → 4.8
  s = s.replace(/[-_]/g, " ").trim();
  return s
    .split(/\s+/)
    .map((w) => {
      if (/^gpt$/i.test(w)) return "GPT";
      if (/^\d/.test(w)) return w; // números de versão / 4o
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

// EN curado pros modelos mais comuns (baseline offline, match por prefixo, mais
// específico primeiro). O resto pega EN via Fetch info (OpenRouter) ou cai no
// pt como fallback até buscar. Mantém o "phrase to phrase" nos flagships.
const DESCRIPTION_EN: { prefix: string; text: string }[] = [
  { prefix: "gpt-5-nano", text: "Cheapest of the GPT-5 family. Multimodal + tools." },
  { prefix: "gpt-5-mini", text: "Economical GPT-5 with near-base quality." },
  { prefix: "gpt-5", text: "OpenAI's multimodal flagship. Tool calling, vision, code." },
  { prefix: "gpt-4o-mini", text: "Cheap multimodal. Excellent cost/perf for agents." },
  { prefix: "gpt-4o", text: "GPT-4 omni: fluid chat, vision and tool calling. Agent default." },
  { prefix: "o4-mini", text: "Compact o4 reasoning. Thinks before answering, great at STEM." },
  { prefix: "o3", text: "Strong reasoning. Excellent at agentic coding." },
  { prefix: "o1", text: "OpenAI's first reasoning model. Pricey but powerful at pure reasoning." },
  { prefix: "claude-opus-4-8", text: "Claude Opus 4.8 — top tier. Excellent at agentic coding + long reasoning." },
  { prefix: "claude-opus-4", text: "Opus 4 — deep reasoning. Expensive." },
  { prefix: "claude-sonnet-4-6", text: "Sonnet 4.6 — balance of cost and quality. Excellent at tools." },
  { prefix: "claude-sonnet-4", text: "Sonnet 4 — fast, multimodal, strong tool calling." },
  { prefix: "claude-haiku-4-5", text: "Haiku 4.5 — cheap and fast. Good for short tasks." },
  { prefix: "gemini-3-pro", text: "Gemini 3 Pro — top tier, natively multimodal including video." },
  { prefix: "gemini-2.5-flash-image", text: "Nano Banana — Google's fast image gen. Up to 20 refs, conversational editing." },
  { prefix: "gemini-2.5-pro", text: "Gemini 2.5 Pro — long thinking + full multimodal." },
  { prefix: "gemini-2.5-flash", text: "Flash — balance of speed and quality. Gemini default." },
];

function curatedEn(model: string): string | undefined {
  const lower = (model || "").toLowerCase();
  for (const e of DESCRIPTION_EN) {
    if (lower.startsWith(e.prefix.toLowerCase())) return e.text;
  }
  return undefined;
}

/**
 * Descrição localizada do modelo, phrase-to-phrase:
 *   en  → enriched (Fetch info) → EN curado → fallback no pt curado.
 *   pt  → pt curado (baseline).
 *   outras langs → prefere EN (neutro) → fallback no pt curado.
 */
export function localizedDescription(
  info: ModelFullInfo,
  model: string,
  lang: string
): string {
  const lower = (lang || "").toLowerCase();
  // pt mantém o baseline curado em português.
  if (lower.startsWith("pt")) {
    return info.card.description;
  }
  // v0.1.228: en e demais idiomas preferem o EN (neutro) antes de cair no pt.
  return (
    info.enriched?.descriptionEn ||
    curatedEn(model) ||
    info.card.description
  );
}
