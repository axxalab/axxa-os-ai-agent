// src/providers/gemini.ts
// Provider Google Gemini — via endpoint OpenAI-compatible do Google AI.
// Endpoint: https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
// Auth: Bearer ${GEMINI_API_KEY} (chave do aistudio.google.com/apikey)
//
// Por que OpenAI-compat e não /generateContent nativo?
//   - Reuso TOTAL de toOpenAIMessages() + parser SSE existentes
//   - Tool calling funciona no mesmo formato (tools[] + tool_choice:"auto")
//   - Trade-off: perde features Gemini-only (grounding, thinking budget,
//     native multimodal de vídeo). Migrar pra generateContent vira upgrade
//     futuro se algum cliente pedir.
//
// Modelos com tool calling validado: gemini-2.5-pro, 2.5-flash, 2.5-flash-lite,
// 3.5-flash, 3.1-flash-lite. Modelos *-tts, *-live, *-image, *-embedding são
// pulados no listModels (não são chat).

import { requestUrl } from "obsidian";
import {
  Provider,
  ProviderError,
  ProviderRequest,
  ProviderResponse,
  ProviderToolCall,
  TokenHandler,
  UsageHandler,
  MediaGenerationRequest,
  MediaGenerationItem,
} from "./base";
import { isEmbeddingModelId } from "../rag/types";
import {
  buildChatBody,
  ensureOkStream,
  ensureOkRequest,
  parseOpenAIChatMessage,
  usageFrom,
  parseOpenAICompatSSE,
} from "./_shared";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_MODELS_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai/models";
// Endpoint nativo do Gemini pra image generation ("Nano Banana" e Imagen).
// Usa /v1beta porque /v1 reclama "Unknown name 'responseModalities'" (não
// suporta image gen ainda). Confirmado via ai.google.dev/api/generate-content
// que tudo de generation passa por v1beta com fields snake_case.
const GEMINI_NATIVE_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Detecta o "muro" de billing do Gemini (free tier / sem billing ativo na API).
 *
 * Contexto (v0.1.162): a assinatura CONSUMER (Google AI Pro/Ultra) NÃO cobre a
 * Gemini API — ela é cobrada à parte no AI Studio (Cloud Billing / Prepay).
 * Quando o user só tem a assinatura, a API responde com erro de quota/billing.
 * A ação certa nesse caso é "ativar billing", não "tentar de novo" — por isso
 * mapeamos pro código `billing` (bolha de erro com botão dedicado).
 *
 * - Frases fortes (billed users / paid tier / billing / FAILED_PRECONDITION /
 *   free tier) → billing em QUALQUER contexto.
 * - context="image": 429 com quota/credit é quase sempre free-tier barrando
 *   modelos de imagem (Imagen/Nano Banana não entram no free tier) → billing.
 *   No chat deixamos 429 genérico como rate-limit (pode ser limite real numa
 *   conta JÁ paga).
 */
export function isGeminiBillingError(
  status: number,
  message: string,
  context: "chat" | "image"
): boolean {
  const m = (message || "").toLowerCase();
  if (
    m.includes("billed users") ||
    m.includes("paid tier") ||
    m.includes("only available on the paid") ||
    m.includes("only accessible to billed") ||
    m.includes("billing") ||
    m.includes("failed_precondition") ||
    m.includes("free tier") ||
    m.includes("free_tier")
  ) {
    return true;
  }
  if (
    context === "image" &&
    status === 429 &&
    (m.includes("quota") || m.includes("credit"))
  ) {
    return true;
  }
  return false;
}

export class GeminiProvider implements Provider {
  id = "gemini";
  name = "Gemini";
  // OpenAI-compat endpoint do Google aceita tools[] + tool_choice
  // exatamente igual à OpenAI. Funciona nos modelos 2.5+ e 3.x.
  supportsTools = true;

  async chat(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError("API key do Gemini não configurada.", "no-key");
    }
    const body = buildChatBody(req, { provider: "gemini" });

    let res;
    try {
      res = await requestUrl({
        url: GEMINI_ENDPOINT,
        method: "POST",
        contentType: "application/json",
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
        body: JSON.stringify(body),
        throw: false,
      });
    } catch {
      throw new ProviderError("Falha de conexão.", "network");
    }
    // Muro de billing ANTES do mapeamento genérico (senão 429 vira rate-limit).
    if (res.status >= 400) {
      const detail = res.json?.error?.message ?? "";
      if (isGeminiBillingError(res.status, detail, "chat")) {
        throw new ProviderError(`Gemini billing: ${detail}`, "billing");
      }
    }
    ensureOkRequest(res, { label: "Gemini", authStatuses: [401, 403] });

    const message = res.json?.choices?.[0]?.message;
    if (!message) throw new ProviderError("Resposta vazia do Gemini.", "unknown");
    const { content, toolCalls } = parseOpenAIChatMessage(message);
    if (!toolCalls && !content) {
      throw new ProviderError("Resposta vazia do Gemini (sem texto nem tool_calls).", "unknown");
    }
    return { content, toolCalls, usage: usageFrom(res.json) };
  }

  async streamChat(
    req: ProviderRequest,
    apiKey: string,
    onToken: TokenHandler,
    onUsage?: UsageHandler,
    signal?: AbortSignal
  ): Promise<ProviderResponse> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError(
        "API key do Gemini não configurada. Gere uma em aistudio.google.com/apikey.",
        "no-key"
      );
    }

    const body = buildChatBody(req, {
      provider: "gemini",
      stream: true,
      includeUsage: true,
    });

    let res: Response;
    try {
      res = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new ProviderError("Falha de conexão.", "network");
    }
    // Billing primeiro (lê uma cópia do corpo; ensureOkStream ainda lê o original).
    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.clone().json();
        detail = j?.error?.message ?? JSON.stringify(j ?? "");
      } catch {
        /* corpo não-JSON — segue pro mapeamento padrão */
      }
      if (isGeminiBillingError(res.status, detail, "chat")) {
        throw new ProviderError(`Gemini billing: ${detail}`, "billing");
      }
    }
    await ensureOkStream(res, { label: "Gemini", authStatuses: [401, 403] });
    if (!res.body) throw new ProviderError("Stream vazio do Gemini.", "unknown");

    return parseOpenAICompatSSE(res.body, onToken, onUsage, "gemini_call");
  }

  /**
   * Gera imagem via Gemini Nano Banana (gemini-2.5-flash-image) ou Imagen.
   * Endpoint nativo:  /v1/models/{model}:generateContent
   *
   * Quirks confirmados via webfetch (ai.google.dev/gemini-api/docs/image-generation):
   *  - **responseModalities** precisa de `["TEXT", "IMAGE"]`, não só `["IMAGE"]`
   *  - **Endpoint** é `/v1/` (não `/v1beta/`) pro Nano Banana
   *  - **Response shape** usa `inlineData` (camelCase) no JSON
   *  - **Model ID** correto é `gemini-2.5-flash-image` (sem "-preview")
   *
   * Body:
   *   {
   *     contents: [{ parts: [{ text: prompt }] }],
   *     generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
   *   }
   *
   * Response: candidates[0].content.parts[i].inlineData.{data, mimeType}
   */
  async generateImage(
    request: MediaGenerationRequest,
    apiKey: string
  ): Promise<MediaGenerationItem[]> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError(
        "API key do Gemini não configurada.",
        "no-key"
      );
    }
    const url = `${GEMINI_NATIVE_BASE}/${request.model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
    // CRÍTICO: API v1beta exige snake_case nos campos.
    // Erro observado: "Unknown name 'responseModalities' at 'generation_config'"
    // → mudar pra response_modalities (snake_case) resolve.
    // Também precisa de TEXT + IMAGE (só IMAGE retorna parts vazio).
    const body = {
      contents: [{ parts: [{ text: request.prompt }] }],
      generation_config: {
        response_modalities: ["TEXT", "IMAGE"],
        ...(request.seed != null ? { seed: request.seed } : {}),
      },
    };
    let res;
    try {
      res = await requestUrl({
        url,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify(body),
        throw: false,
      });
    } catch (err) {
      console.error("[axxa] Gemini image gen network error:", err);
      throw new ProviderError("Falha de conexão.", "network");
    }
    if (res.status < 200 || res.status >= 300) {
      const detail =
        res.json?.error?.message ??
        (typeof res.text === "string" ? res.text.slice(0, 240) : null) ??
        `HTTP ${res.status}`;
      console.error("[axxa] Gemini image gen failed:", res.status, res.json ?? res.text);
      if (res.status === 401 || res.status === 403) {
        throw new ProviderError("API key Gemini inválida.", "invalid-key");
      }
      // Muro de billing: modelos de imagem (Imagen/Nano Banana) NÃO entram no
      // free tier — sem billing ativo na API o request é barrado. A assinatura
      // consumer (AI Pro/Ultra) não cobre a API. Ação certa = ativar billing.
      if (isGeminiBillingError(res.status, detail, "image")) {
        throw new ProviderError(`Gemini billing: ${detail}`, "billing");
      }
      if (res.status === 429) {
        throw new ProviderError("Rate limit Gemini.", "rate-limit");
      }
      throw new ProviderError(`Gemini imagens (${res.status}): ${detail}`, "unknown");
    }
    // Aceita ambos os shapes: inlineData (camelCase, comum em REST JS clients)
    // OU inline_data (snake_case, formato cru REST)
    const parts: Array<{
      inlineData?: { data: string; mimeType: string };
      inline_data?: { data: string; mime_type: string };
      text?: string;
    }> = res.json?.candidates?.[0]?.content?.parts ?? [];
    const items: MediaGenerationItem[] = [];
    let textAccum = "";
    for (const p of parts) {
      const inline = p.inlineData ?? (
        p.inline_data
          ? { data: p.inline_data.data, mimeType: p.inline_data.mime_type }
          : null
      );
      if (inline?.data) {
        const data = base64ToBytes(inline.data);
        items.push({
          data,
          mime: inline.mimeType || "image/png",
        });
      } else if (p.text) {
        textAccum += p.text;
      }
    }
    if (items.length === 0) {
      // Erro mais claro: cita modelo + sugere usar gemini-2.5-flash-image
      throw new ProviderError(
        `Gemini "${request.model}" não retornou imagens. ` +
          `Modelos confirmados pra image gen: gemini-2.5-flash-image (Nano Banana), imagen-3.0-generate-002.`,
        "unknown"
      );
    }
    // Anexa o texto auxiliar (se houver) no primeiro item
    if (textAccum && items[0]) items[0].text = textAccum;
    return items;
  }

  /**
   * Lista modelos Gemini relevantes (chat + image gen + TTS).
   * Alguns endpoints retornam IDs prefixados com "models/" — normalizamos.
   */
  async listModels(apiKey: string): Promise<string[]> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError(
        "API key do Gemini não configurada.",
        "no-key"
      );
    }
    const res = await requestUrl({
      url: GEMINI_MODELS_ENDPOINT,
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      throw: false,
    });
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError("API key Gemini inválida.", "invalid-key");
    }
    if (res.status < 200 || res.status >= 300) {
      throw new ProviderError(`Gemini: HTTP ${res.status}`, "unknown");
    }
    const all: string[] = (res.json?.data ?? []).map((m: { id: string }) => m.id);
    return all
      .map((id) => (id.startsWith("models/") ? id.slice(7) : id))
      .filter(isRelevantGeminiModel)
      .sort();
  }

  /** Modelos de EMBEDDING do catálogo (pro RAG). Graceful: [] em erro/no-key. */
  async listEmbeddingModels(apiKey: string): Promise<string[]> {
    if (!apiKey || !apiKey.trim()) return [];
    try {
      const res = await requestUrl({
        url: GEMINI_MODELS_ENDPOINT,
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
        throw: false,
      });
      if (res.status < 200 || res.status >= 300) return [];
      const all: string[] = (res.json?.data ?? []).map((m: { id: string }) => m.id);
      return all
        .map((id) => (id.startsWith("models/") ? id.slice(7) : id))
        .filter(isEmbeddingModelId)
        .sort();
    } catch {
      return [];
    }
  }
}

/**
 * Mantém modelos relevantes — chat, image gen (Nano Banana / Imagen),
 * TTS (gemini-*-preview-tts) e Veo (video gen).
 * Filtra só embed e legacy (aqa).
 */
function isRelevantGeminiModel(id: string): boolean {
  // Chat / multimodal
  if (id.startsWith("gemini-")) {
    if (id.includes("embedding") || id.includes("aqa") || id.includes("live")) return false;
    return true;
  }
  // Image generation
  if (id.startsWith("imagen-")) return true;
  // Video generation
  if (id.startsWith("veo")) return true;
  return false;
}

/** Decode base64 → Uint8Array. */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const geminiProvider = new GeminiProvider();
