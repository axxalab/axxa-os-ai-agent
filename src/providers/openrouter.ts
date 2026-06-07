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
import { Provider, ProviderError, ProviderRequest, ProviderResponse, TokenHandler, UsageHandler } from "./base";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";

const APP_HEADERS = {
  "HTTP-Referer": "https://axxa.lab",
  "X-Title": "AXXA OS - AI Agent",
};

export class OpenRouterProvider implements Provider {
  id = "openrouter";
  name = "OpenRouter";

  async chat(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError("API key OpenRouter não configurada.", "no-key");
    }

    let res;
    try {
      res = await requestUrl({
        url: OPENROUTER_ENDPOINT,
        method: "POST",
        contentType: "application/json",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          ...APP_HEADERS,
        },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          max_tokens: req.maxTokens ?? 2000,
        }),
        throw: false,
      });
    } catch (err) {
      throw new ProviderError("Falha de conexão.", "network");
    }

    if (res.status === 401) {
      throw new ProviderError("API key OpenRouter inválida.", "invalid-key");
    }
    if (res.status === 429) {
      throw new ProviderError("Rate limit OpenRouter.", "rate-limit");
    }
    if (res.status < 200 || res.status >= 300) {
      const msg = res.json?.error?.message ?? `HTTP ${res.status}`;
      throw new ProviderError(`OpenRouter: ${msg}`, "unknown");
    }
    const content = res.json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.length) {
      throw new ProviderError("Resposta vazia.", "unknown");
    }
    return { content };
  }

  async streamChat(
    req: ProviderRequest,
    apiKey: string,
    onToken: TokenHandler,
    onUsage?: UsageHandler,
    signal?: AbortSignal
  ): Promise<void> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError("API key OpenRouter não configurada.", "no-key");
    }

    let res: Response;
    try {
      res = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
          ...APP_HEADERS,
        },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          stream: true,
          stream_options: { include_usage: true },
          max_tokens: req.maxTokens ?? 2000,
        }),
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new ProviderError("Falha de conexão.", "network");
    }

    if (res.status === 401) {
      throw new ProviderError("API key OpenRouter inválida.", "invalid-key");
    }
    if (res.status === 429) {
      throw new ProviderError("Rate limit OpenRouter.", "rate-limit");
    }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const json = await res.json();
        msg = json?.error?.message ?? msg;
      } catch {
        /* ignore */
      }
      throw new ProviderError(`OpenRouter: ${msg}`, "unknown");
    }
    if (!res.body) {
      throw new ProviderError("Stream vazio.", "unknown");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

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
          if (data === "[DONE]") return;
          continue;
        }
        try {
          const json = JSON.parse(data);
          const token = json?.choices?.[0]?.delta?.content;
          if (typeof token === "string" && token.length > 0) {
            onToken(token);
          }
          if (json?.usage && onUsage) {
            onUsage({
              input: json.usage.prompt_tokens ?? 0,
              output: json.usage.completion_tokens ?? 0,
            });
          }
        } catch {
          /* skip */
        }
      }
    }
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
}

export const openrouterProvider = new OpenRouterProvider();
