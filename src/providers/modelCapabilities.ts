// src/providers/modelCapabilities.ts
// Matriz de capacidades por modelo — usada por:
//   - UI: badges visuais ao lado do nome do modelo (StarterScreen, PlusModal)
//   - Composer: habilita botão "anexar imagem" quando modelo aceita vision
//   - Agent: só permite Agent Mode em modelos com tools=true
//   - Stream: indica se streaming é "real" (fetch SSE) ou "fake" (NIM via requestUrl)
//
// Match é por prefixo (mais resiliente a versões), com lookup ordenado por
// especificidade. Quando o modelo não bate em nenhum prefixo, retorna
// fallback conservador (apenas streaming).

export interface ModelCapabilities {
  /** Aceita imagens (input multimodal: image_url / image base64) */
  vision: boolean;
  /** Suporta function/tool calling (Agent Mode) */
  tools: boolean;
  /** Streaming SSE real (fetch). false = streaming "fake" via requestUrl */
  streaming: boolean;
  /** Modelo gratuito (sem custo de uso). null = informação desconhecida */
  free?: boolean;
  /** Gera imagens (text-to-image). Salvas em axxa-ai/generation/images/ */
  imageGen?: boolean;
  /** Gera áudio (TTS ou voice models). Salvos em axxa-ai/generation/audio/ */
  audioGen?: boolean;
  /** Gera vídeo (Veo, Sora, Cosmos, etc). Salvos em axxa-ai/generation/video/ */
  videoGen?: boolean;
}

const DEFAULT_CAPS: ModelCapabilities = {
  vision: false,
  tools: false,
  streaming: true,
};

interface CapsEntry {
  prefix: string;
  caps: ModelCapabilities;
}

// Ordem importa: prefixos mais específicos vêm antes (ex: "gpt-4o-mini" antes de "gpt-4o").
// Provider-prefixed (OpenRouter / NIM) também são mapeados pra reusar conhecimento dos
// upstream labs.
const ENTRIES_BY_PROVIDER: Record<string, CapsEntry[]> = {
  // ─────────────────────────────── OpenAI ───────────────────────────────
  openai: [
    // Image generation
    { prefix: "dall-e-3", caps: { vision: false, tools: false, streaming: false, imageGen: true } },
    { prefix: "dall-e-2", caps: { vision: false, tools: false, streaming: false, imageGen: true } },
    { prefix: "gpt-image", caps: { vision: false, tools: false, streaming: false, imageGen: true } },
    // Audio (TTS)
    { prefix: "tts-1-hd", caps: { vision: false, tools: false, streaming: false, audioGen: true } },
    { prefix: "tts-1", caps: { vision: false, tools: false, streaming: false, audioGen: true } },
    { prefix: "gpt-4o-mini-tts", caps: { vision: false, tools: false, streaming: false, audioGen: true } },
    // Video gen — Sora API (quando GA)
    { prefix: "sora", caps: { vision: false, tools: false, streaming: false, videoGen: true } },
    // Chat LLM
    { prefix: "gpt-4o-mini", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "gpt-4o", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "gpt-5", caps: { vision: true, tools: true, streaming: true } },
    // o1/o3/o4 séries — reasoning, com vision a partir do o1
    { prefix: "o1-mini", caps: { vision: false, tools: false, streaming: true } },
    { prefix: "o1", caps: { vision: true, tools: false, streaming: true } },
    { prefix: "o3-mini", caps: { vision: false, tools: true, streaming: true } },
    { prefix: "o3", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "o4", caps: { vision: true, tools: true, streaming: true } },
  ],

  // ─────────────────────────────── Anthropic ───────────────────────────
  anthropic: [
    // Toda família Claude 3/4 tem vision + tools + streaming
    { prefix: "claude-opus-4", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "claude-sonnet-4", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "claude-haiku-4", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "claude-3", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "claude-2", caps: { vision: false, tools: false, streaming: true } },
  ],

  // ─────────────────────────────── Gemini ──────────────────────────────
  gemini: [
    // Image generation — "Nano Banana" é o codename do gemini-2.5-flash-image
    // ID correto (sem -preview) confirmado em ai.google.dev/gemini-api/docs/image-generation
    { prefix: "gemini-2.5-flash-image", caps: { vision: true, tools: false, streaming: false, imageGen: true, free: true } },
    { prefix: "gemini-2.0-flash-exp-image", caps: { vision: true, tools: false, streaming: false, imageGen: true, free: true } },
    { prefix: "imagen-3", caps: { vision: false, tools: false, streaming: false, imageGen: true } },
    { prefix: "imagen-4", caps: { vision: false, tools: false, streaming: false, imageGen: true } },
    { prefix: "imagen-", caps: { vision: false, tools: false, streaming: false, imageGen: true } },
    // Audio (TTS)
    { prefix: "gemini-2.5-flash-preview-tts", caps: { vision: false, tools: false, streaming: false, audioGen: true, free: true } },
    // Video gen (Veo)
    { prefix: "veo", caps: { vision: false, tools: false, streaming: false, videoGen: true } },
    // Chat LLM — toda família Gemini 1.5+ aceita imagem nativa
    { prefix: "gemini-3", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "gemini-2.5", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "gemini-2.0", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "gemini-1.5", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "gemini-1.0", caps: { vision: true, tools: false, streaming: true } },
  ],

  // ─────────────────────────── OpenRouter ───────────────────────────
  // Modelos prefixados por upstream — reusa as caps do lab origem.
  openrouter: [
    // Anthropic via OpenRouter
    { prefix: "anthropic/claude-3", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "anthropic/claude-4", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "anthropic/claude-", caps: { vision: true, tools: true, streaming: true } },
    // OpenAI via OpenRouter
    { prefix: "openai/gpt-4o", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "openai/gpt-5", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "openai/o", caps: { vision: true, tools: true, streaming: true } },
    // Google
    { prefix: "google/gemini-2", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "google/gemini-1.5", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "google/gemini", caps: { vision: true, tools: false, streaming: true } },
    // Meta Llama 3.2+ tem vision em variantes "vision"; Llama 3.3 base é texto-only
    { prefix: "meta-llama/llama-3.3", caps: { vision: false, tools: true, streaming: true } },
    { prefix: "meta-llama/llama-3.2-vision", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "meta-llama/llama-3.2", caps: { vision: false, tools: true, streaming: true } },
    { prefix: "meta-llama/llama-3.1", caps: { vision: false, tools: true, streaming: true } },
    // Mistral, DeepSeek, Qwen — vision em variantes específicas
    { prefix: "mistralai/pixtral", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "mistralai/", caps: { vision: false, tools: true, streaming: true } },
    { prefix: "qwen/qwen2.5-vl", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "qwen/qwen-vl", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "qwen/qwen", caps: { vision: false, tools: true, streaming: true } },
    { prefix: "deepseek/deepseek-vl", caps: { vision: true, tools: true, streaming: true } },
    { prefix: "deepseek/", caps: { vision: false, tools: true, streaming: true } },
    // :free suffix indica modelo gratuito
    { prefix: ":free", caps: { vision: false, tools: false, streaming: true, free: true } },
  ],

  // ─────────────────────────── Nvidia NIM ──────────────────────────
  // NIM streaming é "fake" (requestUrl bypass CORS) — streaming:false marca isso.
  nim: [
    // ===== Image generation (NIM Visual GenAI) =====
    { prefix: "stabilityai/stable-diffusion", caps: { vision: false, tools: false, streaming: false, imageGen: true, free: true } },
    { prefix: "stabilityai/sdxl", caps: { vision: false, tools: false, streaming: false, imageGen: true, free: true } },
    { prefix: "black-forest-labs/flux", caps: { vision: false, tools: false, streaming: false, imageGen: true, free: true } },
    { prefix: "shutterstock/", caps: { vision: false, tools: false, streaming: false, imageGen: true, free: true } },
    // Nemotron VL / Vision tem suporte multimodal
    { prefix: "nvidia/llama-3.2-nv-embedqa", caps: { vision: false, tools: false, streaming: false } },
    { prefix: "nvidia/llama-nemotron-embed", caps: { vision: true, tools: false, streaming: false } },
    { prefix: "nvidia/vila", caps: { vision: true, tools: false, streaming: false } },
    { prefix: "nvidia/llama-3.2-90b-vision", caps: { vision: true, tools: true, streaming: false } },
    { prefix: "nvidia/llama-3.2-11b-vision", caps: { vision: true, tools: true, streaming: false } },
    { prefix: "nvidia/", caps: { vision: false, tools: true, streaming: false } },
    { prefix: "meta/llama-3.2-90b-vision", caps: { vision: true, tools: true, streaming: false } },
    { prefix: "meta/llama-3.2-11b-vision", caps: { vision: true, tools: true, streaming: false } },
    { prefix: "meta/llama-3.3", caps: { vision: false, tools: true, streaming: false } },
    { prefix: "meta/llama-3.1", caps: { vision: false, tools: true, streaming: false } },
    { prefix: "meta/", caps: { vision: false, tools: true, streaming: false } },
    { prefix: "qwen/qwen2-vl", caps: { vision: true, tools: true, streaming: false } },
    { prefix: "qwen/qwen2.5-vl", caps: { vision: true, tools: true, streaming: false } },
    { prefix: "qwen/", caps: { vision: false, tools: true, streaming: false } },
    { prefix: "deepseek-ai/", caps: { vision: false, tools: true, streaming: false } },
    { prefix: "microsoft/phi-4", caps: { vision: false, tools: true, streaming: false } },
    { prefix: "microsoft/", caps: { vision: false, tools: false, streaming: false } },
    { prefix: "mistralai/", caps: { vision: false, tools: true, streaming: false } },
    { prefix: "google/gemma", caps: { vision: false, tools: false, streaming: false } },
  ],

  // ─────────────────────────── Ollama (local) ──────────────────────
  // Models são nome simples (sem prefixo de publisher). Vision em llava, bakllava, minicpm-v, etc.
  ollama: [
    { prefix: "llava", caps: { vision: true, tools: false, streaming: true, free: true } },
    { prefix: "bakllava", caps: { vision: true, tools: false, streaming: true, free: true } },
    { prefix: "minicpm-v", caps: { vision: true, tools: false, streaming: true, free: true } },
    { prefix: "moondream", caps: { vision: true, tools: false, streaming: true, free: true } },
    { prefix: "llama3.2-vision", caps: { vision: true, tools: true, streaming: true, free: true } },
    { prefix: "llama3.2", caps: { vision: false, tools: true, streaming: true, free: true } },
    { prefix: "llama3.1", caps: { vision: false, tools: true, streaming: true, free: true } },
    { prefix: "llama3.3", caps: { vision: false, tools: true, streaming: true, free: true } },
    { prefix: "qwen2.5-vl", caps: { vision: true, tools: true, streaming: true, free: true } },
    { prefix: "qwen2.5", caps: { vision: false, tools: true, streaming: true, free: true } },
    { prefix: "qwen3", caps: { vision: false, tools: true, streaming: true, free: true } },
    { prefix: "mistral-large", caps: { vision: false, tools: true, streaming: true, free: true } },
    { prefix: "mistral", caps: { vision: false, tools: false, streaming: true, free: true } },
    { prefix: "deepseek-r1", caps: { vision: false, tools: true, streaming: true, free: true } },
    { prefix: "deepseek", caps: { vision: false, tools: false, streaming: true, free: true } },
    { prefix: "phi", caps: { vision: false, tools: false, streaming: true, free: true } },
    { prefix: "gemma", caps: { vision: false, tools: false, streaming: true, free: true } },
  ],
};

/**
 * Lookup das capacidades do modelo dado o provider.
 * Match por prefixo, ordem do array (mais específico primeiro).
 * Fallback: DEFAULT_CAPS (texto only, sem tools, streaming).
 *
 * Para OpenRouter, faz dupla checagem do sufixo `:free` pra marcar free=true
 * sem perder as caps do modelo upstream.
 */
export function getModelCapabilities(
  provider: string,
  model: string
): ModelCapabilities {
  if (!model) return { ...DEFAULT_CAPS };

  const entries = ENTRIES_BY_PROVIDER[provider];
  if (!entries) return { ...DEFAULT_CAPS };

  const lower = model.toLowerCase();
  let matched: ModelCapabilities | null = null;
  for (const entry of entries) {
    if (lower.startsWith(entry.prefix.toLowerCase())) {
      matched = entry.caps;
      break;
    }
  }
  // Sufixo :free no OpenRouter — overlay no flag free sem mudar outras caps
  if (provider === "openrouter" && lower.endsWith(":free")) {
    if (matched) return { ...matched, free: true };
    return { ...DEFAULT_CAPS, free: true };
  }

  return matched ? { ...matched } : { ...DEFAULT_CAPS };
}

export type CapabilityBadgeId =
  | "vision"
  | "tools"
  | "stream"
  | "free"
  | "img-gen"
  | "audio-gen"
  | "video-gen";

/**
 * Helper utilitário pra UI: lista os flags ativos como strings curtas.
 * Ordem fixa: generation flags primeiro (mais distintivas), depois input
 * capabilities, depois stream/free.
 */
export function capabilityBadges(caps: ModelCapabilities): Array<{
  id: CapabilityBadgeId;
  label: string;
  icon: string;
}> {
  const badges: Array<{ id: CapabilityBadgeId; label: string; icon: string }> = [];
  if (caps.imageGen) badges.push({ id: "img-gen", label: "img-gen", icon: "image-plus" });
  if (caps.audioGen) badges.push({ id: "audio-gen", label: "audio-gen", icon: "volume-2" });
  if (caps.videoGen) badges.push({ id: "video-gen", label: "video-gen", icon: "video" });
  if (caps.vision) badges.push({ id: "vision", label: "vision", icon: "image" });
  if (caps.tools) badges.push({ id: "tools", label: "tools", icon: "wrench" });
  if (caps.streaming) badges.push({ id: "stream", label: "stream", icon: "zap" });
  if (caps.free) badges.push({ id: "free", label: "free", icon: "gift" });
  return badges;
}

/** Helper conveniência: o modelo é qualquer tipo de generation? */
export function isGenerationModel(caps: ModelCapabilities): boolean {
  return Boolean(caps.imageGen || caps.audioGen || caps.videoGen);
}
