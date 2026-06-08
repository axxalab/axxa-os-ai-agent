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
import { toOpenAIMessages, finalizeOpenAIResponse } from "./openai";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_MODELS_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai/models";
// Endpoint nativo do Gemini pra image generation ("Nano Banana" e Imagen).
// Não usa o OpenAI-compat porque image gen tem formato próprio (responseModalities).
const GEMINI_NATIVE_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiProvider implements Provider {
  id = "gemini";
  name = "Gemini";
  // OpenAI-compat endpoint do Google aceita tools[] + tool_choice
  // exatamente igual à OpenAI. Funciona nos modelos 2.5+ e 3.x.
  supportsTools = true;

  async chat(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError(
        "API key do Gemini não configurada. Gere uma em aistudio.google.com/apikey.",
        "no-key"
      );
    }

    const body: Record<string, unknown> = {
      model: req.model,
      messages: toOpenAIMessages(req.messages),
      max_tokens: req.maxTokens ?? 2000,
    };
    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = "auto";
    }

    let res;
    try {
      res = await requestUrl({
        url: GEMINI_ENDPOINT,
        method: "POST",
        contentType: "application/json",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(body),
        throw: false,
      });
    } catch (err) {
      throw new ProviderError("Falha de conexão.", "network");
    }

    if (res.status === 401 || res.status === 403) {
      throw new ProviderError(
        "API key Gemini inválida. Verifique em aistudio.google.com/apikey.",
        "invalid-key"
      );
    }
    if (res.status === 429) {
      throw new ProviderError(
        "Rate limit Gemini. Aguarde alguns segundos.",
        "rate-limit"
      );
    }
    if (res.status < 200 || res.status >= 300) {
      const msg = res.json?.error?.message ?? `HTTP ${res.status}`;
      throw new ProviderError(`Gemini: ${msg}`, "unknown");
    }

    const message = res.json?.choices?.[0]?.message;
    if (!message) throw new ProviderError("Resposta vazia do Gemini.", "unknown");

    let toolCalls: ProviderToolCall[] | undefined;
    if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      toolCalls = message.tool_calls
        .filter((tc: { type: string }) => tc.type === "function")
        .map((tc: { id: string; function: { name: string; arguments: string } }) => {
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
            parsedArgs = { _raw: tc.function.arguments };
          }
          return { id: tc.id, name: tc.function.name, arguments: parsedArgs };
        });
    }

    const content = typeof message.content === "string" ? message.content : "";
    if (!toolCalls && !content) {
      throw new ProviderError(
        "Resposta vazia do Gemini (sem texto nem tool_calls).",
        "unknown"
      );
    }

    const result: ProviderResponse = { content };
    if (toolCalls) result.toolCalls = toolCalls;
    const usage = res.json?.usage;
    if (usage) {
      result.usage = {
        input: usage.prompt_tokens ?? 0,
        output: usage.completion_tokens ?? 0,
      };
    }
    return result;
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

    const body: Record<string, unknown> = {
      model: req.model,
      messages: toOpenAIMessages(req.messages),
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: req.maxTokens ?? 2000,
    };
    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = "auto";
    }

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

    if (res.status === 401 || res.status === 403) {
      throw new ProviderError(
        "API key Gemini inválida. Verifique em aistudio.google.com/apikey.",
        "invalid-key"
      );
    }
    if (res.status === 429) {
      throw new ProviderError(
        "Rate limit Gemini. Aguarde alguns segundos.",
        "rate-limit"
      );
    }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const json = await res.json();
        msg = json?.error?.message ?? msg;
      } catch {
        /* ignora — usa o HTTP status mesmo */
      }
      throw new ProviderError(`Gemini: ${msg}`, "unknown");
    }
    if (!res.body) {
      throw new ProviderError("Stream vazio do Gemini.", "unknown");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulatedText = "";
    const toolCallAccum: Record<number, { id: string; name: string; argsBuf: string }> = {};
    let usage: { input: number; output: number } | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") {
          if (data === "[DONE]") {
            return finalizeOpenAIResponse(accumulatedText, toolCallAccum, usage, "gemini_call");
          }
          continue;
        }
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta;
          if (delta) {
            const token = delta.content;
            if (typeof token === "string" && token.length > 0) {
              accumulatedText += token;
              onToken(token);
            }
            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallAccum[idx]) {
                  toolCallAccum[idx] = { id: "", name: "", argsBuf: "" };
                }
                if (tc.id) toolCallAccum[idx].id = tc.id;
                if (tc.function?.name) toolCallAccum[idx].name = tc.function.name;
                if (typeof tc.function?.arguments === "string") {
                  toolCallAccum[idx].argsBuf += tc.function.arguments;
                }
              }
            }
          }
          if (json?.usage) {
            usage = {
              input: json.usage.prompt_tokens ?? 0,
              output: json.usage.completion_tokens ?? 0,
            };
            if (onUsage) onUsage(usage);
          }
        } catch {
          /* JSON inválido — pula */
        }
      }
    }
    return finalizeOpenAIResponse(accumulatedText, toolCallAccum, usage, "gemini_call");
  }

  /**
   * Gera imagem via Gemini Nano Banana (gemini-2.5-flash-image) ou Imagen.
   * Endpoint nativo:  /v1beta/models/{model}:generateContent
   *
   * Body:
   *   {
   *     contents: [{ parts: [{ text: prompt }] }],
   *     generationConfig: { responseModalities: ["IMAGE"] }
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
    const body = {
      contents: [{ parts: [{ text: request.prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
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
      throw new ProviderError("Falha de conexão.", "network");
    }
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError(
        "API key Gemini inválida.",
        "invalid-key"
      );
    }
    if (res.status === 429) {
      throw new ProviderError(
        "Rate limit Gemini.",
        "rate-limit"
      );
    }
    if (res.status < 200 || res.status >= 300) {
      const msg = res.json?.error?.message ?? `HTTP ${res.status}`;
      throw new ProviderError(`Gemini imagens: ${msg}`, "unknown");
    }
    const parts: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }> =
      res.json?.candidates?.[0]?.content?.parts ?? [];
    const items: MediaGenerationItem[] = [];
    let textAccum = "";
    for (const p of parts) {
      if (p.inlineData?.data) {
        const data = base64ToBytes(p.inlineData.data);
        items.push({
          data,
          mime: p.inlineData.mimeType || "image/png",
        });
      } else if (p.text) {
        textAccum += p.text;
      }
    }
    if (items.length === 0) {
      throw new ProviderError(
        "Gemini não retornou imagens — verifique se o modelo suporta IMAGE modality.",
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
