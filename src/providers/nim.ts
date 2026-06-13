// src/providers/nim.ts
// Provider Nvidia NIM (Nvidia Inference Microservices) hospedado.
// Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
// Auth: Bearer nvapi-... (chave do build.nvidia.com — tier free de 1k créditos)
//
// 100% OpenAI-compatible (streaming SSE, tools[], tool_choice, max_tokens),
// então reusa `toOpenAIMessages()` igual o OpenRouter. Diferença: NIM não
// exige headers extras (HTTP-Referer / X-Title).
//
// Modelos com tool calling validado:
//   - nvidia/llama-3.3-nemotron-super-49b-v1.5
//   - nvidia/llama-3.1-nemotron-ultra-253b-v1
//   - meta/llama-3.3-70b-instruct
//   - qwen/qwen3-next-80b-a3b-instruct
//   - deepseek-ai/deepseek-v4-pro
//   - microsoft/phi-4
//
// Modelos pequenos (Phi-4 mini, Llama 3.2 8b, Nemotron Nano) ignoram
// silenciosamente — o agent vai falhar com "não chamei tool".

import { requestUrl } from "obsidian";
import {
  Provider,
  ProviderError,
  ProviderRequest,
  ProviderResponse,
  ProviderToolCall,
  TokenHandler,
  UsageHandler,
  ReasoningHandler,
  MediaGenerationRequest,
  MediaGenerationItem,
} from "./base";
import { isEmbeddingModelId } from "../rag/types";
import { buildChatBody, parseOpenAIChatMessage, usageFrom } from "./_shared";

const NIM_ENDPOINT =
  "https://integrate.api.nvidia.com/v1/chat/completions";
const NIM_MODELS_ENDPOINT = "https://integrate.api.nvidia.com/v1/models";
// Base de inference de qualquer modelo NIM hosted — usado pra Visual GenAI
// (Stable Diffusion, FLUX, etc). Endpoint específico do modelo é appended.
const NIM_INFER_BASE = "https://ai.api.nvidia.com/v1/genai";

export class NimProvider implements Provider {
  id = "nim";
  name = "Nvidia NIM";
  // OpenAI-compat puro — funciona em modelos modernos (Nemotron Super/Ultra,
  // Llama 3.3+, Qwen3+, DeepSeek v4, Phi-4 full). Modelos pequenos ignoram
  // silenciosamente — documentar no UI.
  supportsTools = true;

  async chat(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError(
        "API key Nvidia NIM não configurada. Gere uma em build.nvidia.com (prefixo 'nvapi-').",
        "no-key"
      );
    }

    const body = buildChatBody(req, { provider: "nim" });

    let res;
    try {
      res = await requestUrl({
        url: NIM_ENDPOINT,
        method: "POST",
        contentType: "application/json",
        headers: {
          // NIM expects standard OpenAI-style headers. Accept JSON pra
          // garantir que o servidor não responda com text/event-stream
          // em algum modo confuso quando stream:false.
          Authorization: `Bearer ${apiKey.trim()}`,
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        throw: false,
      });
    } catch (err) {
      console.error("[axxa] NIM network error:", err);
      throw new ProviderError("Falha de conexão NIM.", "network");
    }

    // Log de diagnóstico — facilita debug quando user reporta "não funciona"
    if (res.status < 200 || res.status >= 300) {
      // Tenta parsear corpo JSON; cai pra .text se não for JSON
      const errBody = res.json ?? (() => {
        try { return JSON.parse(res.text); } catch { return res.text; }
      })();
      console.error(
        "[axxa] NIM response failed:",
        res.status,
        errBody
      );
    }

    if (res.status === 401 || res.status === 403) {
      // 403 também pode significar "Public API Endpoints" permission falta.
      // Adicionei dica explícita pra esse caso (causa comum reportada nas docs NVIDIA).
      const hint =
        res.status === 403
          ? " (Verifique também se sua conta tem 'Public API Endpoints' habilitado em build.nvidia.com → Organization Settings.)"
          : "";
      throw new ProviderError(
        `API key Nvidia NIM inválida ou sem permissão.${hint}`,
        "invalid-key"
      );
    }
    if (res.status === 404) {
      // NIM retorna 404 quando o ID do modelo não existe no catálogo OU
      // quando o modelo está deprecado/não-hospedado.
      const apiMsg = res.json?.detail ?? res.json?.error?.message ?? "";
      throw new ProviderError(
        `NIM: modelo "${req.model}" não encontrado ou não hospedado. ${apiMsg}\n` +
          `Em Settings → Providers → Nvidia NIM, clique "Buscar da API" pra ver os modelos atualmente disponíveis.`,
        "unknown"
      );
    }
    if (res.status === 429) {
      throw new ProviderError(
        "Rate limit Nvidia NIM. Aguarde alguns segundos.",
        "rate-limit"
      );
    }
    if (res.status < 200 || res.status >= 300) {
      // 400/422/500: inclui detalhes do body pra facilitar diagnóstico
      const detail =
        res.json?.error?.message ??
        res.json?.detail ??
        res.json?.message ??
        (typeof res.text === "string" ? res.text.slice(0, 240) : null) ??
        `HTTP ${res.status}`;
      throw new ProviderError(`NIM (${res.status}): ${detail}`, "unknown");
    }

    const message = res.json?.choices?.[0]?.message;
    if (!message) throw new ProviderError("Resposta vazia do NIM.", "unknown");
    const { content, toolCalls, reasoning } = parseOpenAIChatMessage(message);
    if (!toolCalls && !content) {
      throw new ProviderError("Resposta vazia do NIM (sem texto nem tool_calls).", "unknown");
    }
    return { content, toolCalls, usage: usageFrom(res.json), reasoning };
  }

  /**
   * Streaming "fake" via requestUrl (não-streaming real).
   *
   * **Por que não fetch real?** integrate.api.nvidia.com não devolve CORS
   * headers liberais — o browser bloqueia o `fetch` direto com TypeError
   * ("Falha de conexão"). requestUrl do Obsidian vai pelo módulo `net` do
   * Electron / capacitor, bypassando CORS. Trade-off: a resposta inteira
   * vem de uma vez. UX: o user vê o "Pensando..." e depois a resposta
   * completa aparece num bloco só. Cancelar via AbortController não
   * funciona pra requestUrl — checamos signal antes/depois manualmente.
   */
  async streamChat(
    req: ProviderRequest,
    apiKey: string,
    onToken: TokenHandler,
    onUsage?: UsageHandler,
    signal?: AbortSignal,
    onReasoning?: ReasoningHandler
  ): Promise<ProviderResponse> {
    // Reusa a chat() que já vai por requestUrl e funciona em prod.
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const response = await this.chat(req, apiKey);
    // Verifica abort no meio do caminho (depois da resposta chegar)
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    // Reasoning (DeepSeek R1 e afins) vem inteiro no non-stream — roteia ANTES
    // do texto, igual à ordem dos deltas num stream real. v0.1.225
    if (response.reasoning && onReasoning) {
      onReasoning(response.reasoning);
    }
    if (response.content) {
      onToken(response.content);
    }
    if (response.usage && onUsage) {
      onUsage(response.usage);
    }
    // Retorna a resposta completa pra Agent loop poder consumir tool_calls.
    return response;
  }

  /**
   * Gera imagem via NIM Visual GenAI (Stable Diffusion 3, FLUX, SDXL).
   * Endpoint: https://ai.api.nvidia.com/v1/genai/{publisher}/{model}
   *
   * Confirmado via webfetch (docs.api.nvidia.com/nim/reference/stabilityai-stable-diffusion-3-medium-infer):
   *  - URL contém publisher/model na path
   *  - Body inclui: prompt, mode="text-to-image", aspect_ratio, cfg_scale,
   *    steps, seed, output_format ("png"|"jpeg"), optional negative_prompt
   *  - Stable Diffusion 3 também exige `model: "sd3"` no body além da URL
   *
   * Response: dois shapes possíveis dependendo do modelo:
   *   { artifacts: [{ base64: "...", finishReason: "SUCCESS" }] } (SDXL/FLUX clássicos)
   *   { image: "base64..." } (alguns modelos)
   *   Ambos suportados.
   */
  async generateImage(
    request: MediaGenerationRequest,
    apiKey: string
  ): Promise<MediaGenerationItem[]> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError("API key Nvidia NIM não configurada.", "no-key");
    }
    const url = `${NIM_INFER_BASE}/${request.model}`;
    const aspectRatio = sizeToAspectRatio(request.size);
    const body: Record<string, unknown> = {
      prompt: request.prompt,
      mode: "text-to-image",
      aspect_ratio: aspectRatio,
      cfg_scale: 5,
      steps: 50,
      seed: request.seed ?? 0,
      output_format: "png",
      negative_prompt: "",
    };
    // Stable Diffusion 3 family exige `model: "sd3"` no body (docs oficiais).
    // Outros modelos ignoram.
    if (request.model.includes("stable-diffusion-3")) {
      body.model = "sd3";
    }
    let res;
    try {
      res = await requestUrl({
        url,
        method: "POST",
        contentType: "application/json",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        throw: false,
      });
    } catch (err) {
      console.error("[axxa] NIM image gen network error:", err);
      throw new ProviderError("Falha de conexão NIM image gen.", "network");
    }
    if (res.status < 200 || res.status >= 300) {
      console.error("[axxa] NIM image gen failed:", res.status, res.json ?? res.text);
      const detail =
        res.json?.detail ??
        res.json?.error?.message ??
        res.json?.message ??
        (typeof res.text === "string" ? res.text.slice(0, 280) : null) ??
        `HTTP ${res.status}`;
      throw new ProviderError(`NIM image gen (${res.status}): ${detail}`, "unknown");
    }
    // Várias APIs com shapes diferentes — tenta os mais comuns
    const items: MediaGenerationItem[] = [];
    const artifacts = res.json?.artifacts;
    if (Array.isArray(artifacts)) {
      for (const a of artifacts) {
        const b64 =
          typeof a?.base64 === "string"
            ? a.base64
            : typeof a?.image === "string"
              ? a.image
              : null;
        if (b64) items.push({ data: base64ToBytes(b64), mime: "image/png" });
      }
    }
    if (items.length === 0 && typeof res.json?.image === "string") {
      items.push({ data: base64ToBytes(res.json.image), mime: "image/png" });
    }
    if (items.length === 0 && typeof res.json?.b64_json === "string") {
      items.push({ data: base64ToBytes(res.json.b64_json), mime: "image/png" });
    }
    if (items.length === 0) {
      console.error("[axxa] NIM unknown response shape:", res.json);
      throw new ProviderError(
        `NIM não retornou imagens — verifique se "${request.model}" suporta text-to-image. Veja DevTools console pra resposta raw.`,
        "unknown"
      );
    }
    return items;
  }

  /** Lista modelos NIM disponíveis no endpoint hospedado. Filtra prefixos relevantes. */
  async listModels(apiKey: string): Promise<string[]> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError(
        "API key Nvidia NIM não configurada.",
        "no-key"
      );
    }
    const res = await requestUrl({
      url: NIM_MODELS_ENDPOINT,
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      throw: false,
    });
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError("API key Nvidia NIM inválida.", "invalid-key");
    }
    if (res.status < 200 || res.status >= 300) {
      throw new ProviderError(`NIM: HTTP ${res.status}`, "unknown");
    }
    const all: string[] = (res.json?.data ?? []).map((m: { id: string }) => m.id);
    return all.filter(isRelevantNimModel).sort();
  }

  /** Modelos de EMBEDDING do catálogo (pro RAG). Graceful: [] em erro/no-key. */
  async listEmbeddingModels(apiKey: string): Promise<string[]> {
    if (!apiKey || !apiKey.trim()) return [];
    try {
      const res = await requestUrl({
        url: NIM_MODELS_ENDPOINT,
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
        throw: false,
      });
      if (res.status < 200 || res.status >= 300) return [];
      const all: string[] = (res.json?.data ?? []).map((m: { id: string }) => m.id);
      return all.filter(isEmbeddingModelId).sort();
    } catch {
      return [];
    }
  }
}

/**
 * Filtro de modelos NIM relevantes pro plugin.
 *
 * Auditoria v0.1.225: a ALLOWLIST de publishers escondia modelos válidos de
 * publishers fora dela — ex: "openai/gpt-oss-120b" e "ibm/granite-*" são
 * hospedados no NIM e NÃO apareciam. Estratégia invertida: aceita TUDO que
 * tem formato publisher/model e exclui só componentes de pipeline
 * (embedding/rerank/retriever), ASR/voz de baixo nível e visão NeMo — que
 * não fazem sentido na UI de chat.
 */
export function isRelevantNimModel(id: string): boolean {
  // Catálogo NIM é sempre publisher/model — sem "/" não é um modelo servível.
  if (!id.includes("/")) return false;
  const excludeKeywords = [
    "embed", // embedding/embedqa
    "rerank",
    "retriever",
    "parakeet", // ASR
    "canary", // ASR
    "fastpitch", // TTS de baixo nível
    "riva", // pipeline de voz
    "studiovoice",
    "maxine",
    "ocdrnet", // OCR
    "paddleocr",
    "vista", // NeMo vision pipeline
  ];
  if (excludeKeywords.some((kw) => id.includes(kw))) return false;
  return true;
}

/** Helper: mapeia size canonical → aspect_ratio do NIM Visual GenAI. */
function sizeToAspectRatio(size?: string): string {
  switch (size) {
    case "1024x1792": return "9:16";
    case "1792x1024": return "16:9";
    case "512x512":
    case "1024x1024":
    case undefined:
    case "auto":
      return "1:1";
    default: return "1:1";
  }
}

/** Decode base64 → Uint8Array. */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const nimProvider = new NimProvider();
