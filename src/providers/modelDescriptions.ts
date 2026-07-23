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
  { prefix: "dall-e-3", card: { category: "image-gen", description: "OpenAI's classic image generation. Good at artistic styles and illustration. Supports 3 sizes.", contextWindow: 4_000, goodFor: "Art, illustration, visual concepts" } },
  { prefix: "dall-e-2", card: { category: "image-gen", description: "Previous version, cheaper. Handy for quick prototyping.", goodFor: "Cheap prototyping" } },
  { prefix: "gpt-image-1", card: { category: "image-gen", description: "New GPT-4o-based image generation. Long prompts + inline editing. Requires org verification.", contextWindow: 50_000, goodFor: "Photorealism, text in images" } },
  // TTS
  { prefix: "tts-1-hd", card: { category: "audio-gen", description: "HD text-to-speech. More natural voice, higher latency.", goodFor: "Voiceover for video/podcast" } },
  { prefix: "tts-1", card: { category: "audio-gen", description: "Fast text-to-speech. Low latency, good quality.", goodFor: "Real-time voice" } },
  { prefix: "gpt-4o-mini-tts", card: { category: "audio-gen", description: "New TTS based on GPT-4o-mini. Supports style direction in the prompt.", goodFor: "Controllable voice personality" } },
  // Reasoning / o-series
  { prefix: "o4-mini", card: { category: "reasoning", description: "Compact o4-generation reasoning. Thinks before answering, great at STEM.", contextWindow: 200_000, goodFor: "Logic, math, complex code" } },
  { prefix: "o4", card: { category: "reasoning", description: "State-of-the-art reasoning. Internal chain-of-thought. Pricey but cracks hard problems.", contextWindow: 200_000, goodFor: "Problems other models get wrong" } },
  { prefix: "o3-mini", card: { category: "reasoning", description: "Mid-tier, balanced reasoning.", contextWindow: 200_000, goodFor: "Cost-effective STEM" } },
  { prefix: "o3", card: { category: "reasoning", description: "Strong reasoning. Excellent at agentic coding.", contextWindow: 200_000, goodFor: "Long coding tasks" } },
  { prefix: "o1-mini", card: { category: "reasoning", description: "Fast reasoning. Limited function calling support.", contextWindow: 128_000, goodFor: "Quick STEM" } },
  { prefix: "o1", card: { category: "reasoning", description: "OpenAI's first reasoning model. Pricey but powerful at pure reasoning.", contextWindow: 200_000, goodFor: "Pure reasoning" } },
  // GPT-5
  { prefix: "gpt-5-nano", card: { category: "chat-vision", description: "Cheapest of the GPT-5 family. Multimodal + tools.", contextWindow: 256_000, goodFor: "Cheap chat at scale" } },
  { prefix: "gpt-5-mini", card: { category: "chat-vision", description: "Economical GPT-5 with near-base quality.", contextWindow: 256_000, goodFor: "Daily driver" } },
  { prefix: "gpt-5", card: { category: "chat-vision", description: "OpenAI's multimodal flagship. Tool calling, vision, code.", contextWindow: 256_000, goodFor: "Complex multimodal tasks" } },
  // GPT-4o
  { prefix: "gpt-4o-mini", card: { category: "chat-vision", description: "Cheap multimodal. Excellent cost/perf for agents.", contextWindow: 128_000, goodFor: "Cheap agent loops" } },
  { prefix: "gpt-4o", card: { category: "chat-vision", description: "GPT-4 omni: fluid chat, vision and tool calling. Agent default.", contextWindow: 128_000, goodFor: "General agent, vision" } },
];

// ─────────────────────────── Anthropic ───────────────────────────
const ANTHROPIC_CARDS: CardEntry[] = [
  { prefix: "claude-fable-5", card: { category: "chat-vision", description: "Claude Fable 5 — Anthropic's latest model. Multimodal + tool calling, strong at reasoning and code.", contextWindow: 200_000, goodFor: "Complex tasks, agent, vision" } },
  { prefix: "claude-opus-4-8", card: { category: "chat-vision", description: "Claude Opus 4.8 — top tier. Excellent at agentic coding + long reasoning.", contextWindow: 200_000, goodFor: "Complex agentic coding" } },
  { prefix: "claude-opus-4", card: { category: "chat-vision", description: "Opus 4 — deep reasoning. Expensive.", contextWindow: 200_000, goodFor: "Tasks that demand depth" } },
  { prefix: "claude-sonnet-4-6", card: { category: "chat-vision", description: "Sonnet 4.6 — balance of cost and quality. Excellent at tools.", contextWindow: 200_000, goodFor: "Daily driver, general agent" } },
  { prefix: "claude-sonnet-4", card: { category: "chat-vision", description: "Sonnet 4 — fast, multimodal, strong tool calling.", contextWindow: 200_000, goodFor: "General agent" } },
  { prefix: "claude-haiku-4-5", card: { category: "chat-vision", description: "Haiku 4.5 — cheap and fast. Good for short tasks.", contextWindow: 200_000, goodFor: "Cheap chat, classification" } },
  { prefix: "claude-haiku-4", card: { category: "chat-vision", description: "Haiku 4 — the cheap, fast version.", contextWindow: 200_000, goodFor: "Cheap high volume" } },
  { prefix: "claude-3-5-sonnet", card: { category: "chat-vision", description: "Sonnet 3.5 — previous generation. Still great for coding.", contextWindow: 200_000, goodFor: "Coding (legacy)" } },
  { prefix: "claude-3-5-haiku", card: { category: "chat-vision", description: "Haiku 3.5 — old but stable.", contextWindow: 200_000, goodFor: "Legacy volume" } },
  { prefix: "claude-3", card: { category: "chat-vision", description: "Claude 3 family — the original opus/sonnet/haiku.", contextWindow: 200_000, goodFor: "Legacy compat" } },
];

// ─────────────────────────────── Gemini ───────────────────────────────
const GEMINI_CARDS: CardEntry[] = [
  // Image gen
  { prefix: "gemini-2.5-flash-image", card: { category: "image-gen", description: "Nano Banana — Google's fast image gen. Up to 20 refs, conversational editing, character consistency. Free tier 500 img/day.", contextWindow: 32_000, goodFor: "Fast generation + editing, free tier" } },
  { prefix: "gemini-2.0-flash-exp-image", card: { category: "image-gen", description: "Earlier experimental image gen. Still works.", goodFor: "Experiments" } },
  { prefix: "imagen-4", card: { category: "image-gen", description: "Imagen 4 — premium quality for art/marketing.", goodFor: "Quality > speed" } },
  { prefix: "imagen-3", card: { category: "image-gen", description: "Imagen 3 — stable high quality. Good at photorealism.", goodFor: "Photorealism" } },
  // TTS
  { prefix: "gemini-2.5-flash-preview-tts", card: { category: "audio-gen", description: "Gemini 2.5 TTS preview. Multilingual, low latency.", goodFor: "Cheap multilingual TTS" } },
  // Video gen
  { prefix: "veo", card: { category: "video-gen", description: "Veo — Google's text-to-video. Available in preview.", goodFor: "Short video" } },
  // Chat
  { prefix: "gemini-3-pro", card: { category: "chat-vision", description: "Gemini 3 Pro — top tier, natively multimodal including video.", contextWindow: 2_000_000, goodFor: "Long tasks + video" } },
  { prefix: "gemini-3.5-flash", card: { category: "chat-vision", description: "Gemini 3.5 Flash — fast and economical.", contextWindow: 1_000_000, goodFor: "Google daily driver" } },
  { prefix: "gemini-3.1-flash-lite", card: { category: "chat-vision", description: "Lite version, still multimodal, lower cost.", contextWindow: 1_000_000, goodFor: "Economical volume" } },
  { prefix: "gemini-2.5-pro", card: { category: "chat-vision", description: "Gemini 2.5 Pro — long thinking + full multimodal.", contextWindow: 2_000_000, goodFor: "Long tasks, huge RAG" } },
  { prefix: "gemini-2.5-flash-lite", card: { category: "chat-vision", description: "Flash lite — cheaper than Flash.", contextWindow: 1_000_000, goodFor: "Cheap volume" } },
  { prefix: "gemini-2.5-flash", card: { category: "chat-vision", description: "Flash — balance of speed and quality. Gemini default.", contextWindow: 1_000_000, goodFor: "Daily driver" } },
  { prefix: "gemini-2.0-flash", card: { category: "chat-vision", description: "Gemini 2.0 Flash — previous generation, stable.", contextWindow: 1_000_000, goodFor: "Compat" } },
  { prefix: "gemini-1.5-pro", card: { category: "chat-vision", description: "Gemini 1.5 Pro — the legendary 2M context window.", contextWindow: 2_000_000, goodFor: "Huge context" } },
  { prefix: "gemini-1.5-flash", card: { category: "chat-vision", description: "1.5 Flash — old but still in use.", contextWindow: 1_000_000, goodFor: "Legacy compat" } },
];

// ─────────────────────────── OpenRouter ───────────────────────────
const OPENROUTER_CARDS: CardEntry[] = [
  // Reusa descrições dos upstreams quando possível
  { prefix: "anthropic/claude-opus-4", card: { category: "chat-vision", description: "Claude Opus 4 via OpenRouter — proxied. Upstream pricing + small margin.", contextWindow: 200_000 } },
  { prefix: "anthropic/claude-sonnet-4", card: { category: "chat-vision", description: "Claude Sonnet 4 via OpenRouter.", contextWindow: 200_000 } },
  { prefix: "anthropic/claude-haiku-4", card: { category: "chat-vision", description: "Claude Haiku 4 via OpenRouter.", contextWindow: 200_000 } },
  { prefix: "anthropic/claude-3.5-sonnet", card: { category: "chat-vision", description: "Claude 3.5 Sonnet via OpenRouter — legacy coding.", contextWindow: 200_000 } },
  { prefix: "openai/gpt-5", card: { category: "chat-vision", description: "GPT-5 via OpenRouter.", contextWindow: 256_000 } },
  { prefix: "openai/gpt-4o", card: { category: "chat-vision", description: "GPT-4o via OpenRouter — strong agent.", contextWindow: 128_000 } },
  { prefix: "openai/o1", card: { category: "reasoning", description: "o1 via OpenRouter — premium reasoning.", contextWindow: 200_000 } },
  { prefix: "google/gemini-2.5-pro", card: { category: "chat-vision", description: "Gemini 2.5 Pro via OpenRouter.", contextWindow: 2_000_000 } },
  { prefix: "google/gemini-2.5-flash", card: { category: "chat-vision", description: "Gemini 2.5 Flash via OpenRouter.", contextWindow: 1_000_000 } },
  { prefix: "meta-llama/llama-3.3-70b", card: { category: "chat-text", description: "Llama 3.3 70B — open source, great at coding.", contextWindow: 131_000, goodFor: "Open-source coding" } },
  { prefix: "meta-llama/llama-3.1-405b", card: { category: "chat-text", description: "Llama 3.1 405B — Meta's largest open-weight model.", contextWindow: 131_000, goodFor: "Open-source quality" } },
  { prefix: "qwen/qwen3-coder", card: { category: "agent", description: "Qwen3 Coder — purpose-built for agentic coding with 256k context.", contextWindow: 256_000, goodFor: "Open-source coding agent" } },
  { prefix: "deepseek/deepseek-r1", card: { category: "reasoning", description: "DeepSeek R1 — open-source reasoning competitive with o1.", contextWindow: 64_000, goodFor: "Cheap reasoning" } },
];

// ─────────────────────────── Nvidia NIM ───────────────────────────
const NIM_CARDS: CardEntry[] = [
  // Image gen
  { prefix: "stabilityai/stable-diffusion-3", card: { category: "image-gen", description: "Stable Diffusion 3 Medium — classic image generation. NIM free tier.", goodFor: "Open image gen" } },
  { prefix: "stabilityai/sdxl", card: { category: "image-gen", description: "SDXL — older image gen, still popular.", goodFor: "Cinematic style" } },
  { prefix: "black-forest-labs/flux", card: { category: "image-gen", description: "FLUX — premium-quality open-source image generation.", goodFor: "Open premium quality" } },
  // Chat
  { prefix: "meta/llama-3.3-70b", card: { category: "chat-text", description: "Llama 3.3 70B Instruct — open-source chat via NIM.", contextWindow: 131_000, goodFor: "Fast coding" } },
  { prefix: "meta/llama-3.1-405b", card: { category: "chat-text", description: "Llama 3.1 405B — largest open-weight model.", contextWindow: 131_000, goodFor: "Open quality" } },
  { prefix: "meta/llama-3.1-70b", card: { category: "chat-text", description: "Llama 3.1 70B — popular open source.", contextWindow: 131_000, goodFor: "Daily open" } }, // v0.1.228: corrige typo 'populärst'
  { prefix: "nvidia/llama-3.1-nemotron-70b", card: { category: "agent", description: "Nemotron 70B — fine-tuned for agentic use.", contextWindow: 131_000, goodFor: "Open agent" } },
  { prefix: "mistralai/mixtral-8x22b", card: { category: "chat-text", description: "Mixtral 8x22B — Mistral's MoE.", contextWindow: 65_000, goodFor: "Quality EU open" } },
  { prefix: "deepseek-ai/deepseek-r1", card: { category: "reasoning", description: "DeepSeek R1 via NIM — open reasoning.", contextWindow: 64_000, goodFor: "Open reasoning" } },
  { prefix: "qwen/qwen2.5-72b", card: { category: "chat-text", description: "Qwen 2.5 72B — open chat, strong multilingual.", contextWindow: 131_000, goodFor: "Multilingual" } },
  { prefix: "microsoft/phi-4", card: { category: "chat-text", description: "Microsoft's Phi-4 — small but capable.", contextWindow: 16_000, goodFor: "Small and cheap" } },
];

// ─────────────────────────── Ollama (local) ───────────────────────────
const OLLAMA_CARDS: CardEntry[] = [
  { prefix: "llava", card: { category: "chat-vision", description: "LLaVA — local vision. Runs 100% on your hardware.", goodFor: "Vision privacy" } },
  { prefix: "llama3.2-vision", card: { category: "chat-vision", description: "Local Llama 3.2 Vision — open multimodal.", goodFor: "Vision privacy" } },
  { prefix: "llama3.3", card: { category: "chat-text", description: "Local Llama 3.3 — chat without internet.", goodFor: "Total privacy" } },
  { prefix: "llama3.2", card: { category: "chat-text", description: "Local Llama 3.2 — light on RAM.", goodFor: "Laptop privacy" } },
  { prefix: "llama3.1", card: { category: "chat-text", description: "Local Llama 3.1 — the open classic.", goodFor: "Default privacy" } },
  { prefix: "qwen2.5-vl", card: { category: "chat-vision", description: "Qwen 2.5 VL — local vision, strong multilingual.", goodFor: "Multilingual vision" } },
  { prefix: "qwen2.5", card: { category: "chat-text", description: "Local Qwen 2.5 — strong multilingual.", goodFor: "Multilingual privacy" } },
  { prefix: "qwen3", card: { category: "chat-text", description: "Local Qwen3 — new generation.", goodFor: "Up-to-date open" } },
  { prefix: "mistral-large", card: { category: "chat-text", description: "Local Mistral Large — quality EU open model.", goodFor: "Quality privacy" } },
  { prefix: "mistral", card: { category: "chat-text", description: "Local Mistral — the EU classic.", goodFor: "Default privacy" } },
  { prefix: "deepseek-r1", card: { category: "reasoning", description: "Local DeepSeek R1 — reasoning without internet.", goodFor: "Reasoning privacy" } },
  { prefix: "deepseek", card: { category: "chat-text", description: "Local DeepSeek.", goodFor: "Privacy" } },
  { prefix: "phi", card: { category: "chat-text", description: "Local Phi — small and fast.", goodFor: "Laptop CPU" } },
  { prefix: "gemma", card: { category: "chat-text", description: "Local Gemma — Google's open model.", goodFor: "Default privacy" } },
  { prefix: "minicpm-v", card: { category: "chat-vision", description: "MiniCPM-V — tiny local vision.", goodFor: "Mobile vision" } },
  { prefix: "moondream", card: { category: "chat-vision", description: "Moondream — tiny vision model.", goodFor: "Edge vision" } },
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
  description: "No description registered for this model — it may work fine, just no usage hint.",
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
  if (c.imageGen) return { category: "image-gen", description: "Image generation model." };
  if (c.audioGen) return { category: "audio-gen", description: "TTS / voice model." };
  if (c.videoGen) return { category: "video-gen", description: "Video generation model." };
  if (c.vision) return { category: "chat-vision", description: "Multimodal chat (text + image)." };
  return { category: "chat-text", description: "Text chat." };
}

/** Labels semânticos por categoria (EN). */
export const CATEGORY_LABELS: Record<ModelCategory, string> = {
  "chat-vision": "Chat multimodal",
  "chat-text": "Text chat",
  "reasoning": "Deep reasoning",
  "agent": "Agent / tools",
  "image-gen": "Image generation",
  "audio-gen": "Audio generation",
  "video-gen": "Video generation",
  "embedding": "Embeddings",
  "other": "Other",
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
