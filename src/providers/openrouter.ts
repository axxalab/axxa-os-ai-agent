// src/providers/openrouter.ts
// Provider OpenRouter — proxy multi-modelo OpenAI-compatible.
// Endpoint: https://openrouter.ai/api/v1/chat/completions
// Auth: Bearer (igual OpenAI)
// Modelos: prefixados por provider — ex: "anthropic/claude-3.5-sonnet", "openai/gpt-4o"
// Streaming SSE no mesmo formato da OpenAI.
//
// Headers extras opcionais (boa prática do OpenRouter):
//   HTTP-Referer: identifica seu site/app
//   X-Title:      nome legível

import { requestUrl } from "obsidian";
import {
  Provider,
  ProviderError,
  ProviderRequest,
  ProviderResponse,
  ProviderToolCall,
  TokenHandler,
  UsageHandler,
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

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";

const APP_HEADERS = {
  "HTTP-Referer": "https://axxa.lab",
  "X-Title": "AXXA OS - AI Agent",
};

export class OpenRouterProvider implements Provider {
  id = "openrouter";
  name = "OpenRouter";
  // OpenRouter é OpenAI-compatible. Tool calling FUNCIONA pra modelos que
  // suportam (Claude, GPT-4o, Gemini, Llama 3.1+, etc). Modelos antigos
  // ignoram tools silenciosamente — agent vai falhar com erro do LLM.
  supportsTools = true;

  async chat(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError("API key OpenRouter não configurada.", "no-key");
    }

    const body = buildChatBody(req, { provider: "openrouter" });

    let res;
    try {
      res = await requestUrl({
        url: OPENROUTER_ENDPOINT,
        method: "POST",
        contentType: "application/json",
        headers: { Authorization: `Bearer ${apiKey.trim()}`, ...APP_HEADERS },
        body: JSON.stringify(body),
        throw: false,
      });
    } catch {
      throw new ProviderError("Falha de conexão.", "network");
    }
    ensureOkRequest(res, { label: "OpenRouter" });

    const message = res.json?.choices?.[0]?.message;
    if (!message) throw new ProviderError("Resposta vazia.", "unknown");
    const { content, toolCalls } = parseOpenAIChatMessage(message);
    if (!toolCalls && !content) {
      throw new ProviderError("Resposta vazia da OpenRouter (sem texto nem tool_calls).", "unknown");
    }
    return { content, toolCalls, usage: usageFrom(res.json) };
  }

  async streamChat(
    req: ProviderRequest,
    apiKey: string,
    onToken: TokenHandler,
    onUsage?: UsageHandler,
    signal?: AbortSignal,
    onReasoning?: (delta: string) => void
  ): Promise<ProviderResponse> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError("API key OpenRouter não configurada.", "no-key");
    }

    const body = buildChatBody(req, {
      provider: "openrouter",
      stream: true,
      includeUsage: true,
    });

    let res: Response;
    try {
      res = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
          ...APP_HEADERS,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new ProviderError("Falha de conexão.", "network");
    }
    await ensureOkStream(res, { label: "OpenRouter" });
    if (!res.body) throw new ProviderError("Stream vazio.", "unknown");

    return parseOpenAICompatSSE(res.body, onToken, onUsage, "openrouter_call", onReasoning);
  }

  /** Lista modelos modernos do OpenRouter (sem free/auto/etc) */
  async listModels(apiKey: string): Promise<string[]> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError("API key OpenRouter não configurada.", "no-key");
    }
    const res = await requestUrl({
      url: OPENROUTER_MODELS_ENDPOINT,
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        ...APP_HEADERS,
      },
      throw: false,
    });
    if (res.status === 401) {
      throw new ProviderError("API key OpenRouter inválida.", "invalid-key");
    }
    if (res.status < 200 || res.status >= 300) {
      throw new ProviderError(`OpenRouter: HTTP ${res.status}`, "unknown");
    }
    const all: string[] = (res.json?.data ?? []).map((m: { id: string }) => m.id);
    return all
      .filter((id) => !id.includes(":free") && !id.includes("auto"))
      .sort();
  }

  /** Modelos de EMBEDDING do catálogo (pro RAG). Mantém os :free (o embedding
   *  multimodal da NVIDIA no OpenRouter é :free). Graceful: [] em erro/no-key. */
  async listEmbeddingModels(apiKey: string): Promise<string[]> {
    if (!apiKey || !apiKey.trim()) return [];
    try {
      const res = await requestUrl({
        url: OPENROUTER_MODELS_ENDPOINT,
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey.trim()}`, ...APP_HEADERS },
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

export const openrouterProvider = new OpenRouterProvider();
