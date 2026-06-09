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
import { toOpenAIMessages, finalizeOpenAIResponse } from "./openai";

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

    // Body OpenAI-compat — reusa o converter de mensagens do openai.ts
    const body: Record<string, unknown> = {
      model: req.model,
      messages: toOpenAIMessages(req.messages),
      max_tokens: req.maxTokens ?? 2000,
    };
    if (typeof req.temperature === "number" && req.temperature >= 0) {
      body.temperature = req.temperature;
    }
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
        url: OPENROUTER_ENDPOINT,
        method: "POST",
        contentType: "application/json",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          ...APP_HEADERS,
        },
        body: JSON.stringify(body),
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

    const message = res.json?.choices?.[0]?.message;
    if (!message) throw new ProviderError("Resposta vazia.", "unknown");

    // Parseia tool_calls (formato OpenAI) se vieram
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
        "Resposta vazia da OpenRouter (sem texto nem tool_calls).",
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
      throw new ProviderError("API key OpenRouter não configurada.", "no-key");
    }

    const body: Record<string, unknown> = {
      model: req.model,
      messages: toOpenAIMessages(req.messages),
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: req.maxTokens ?? 2000,
    };
    if (typeof req.temperature === "number" && req.temperature >= 0) {
      body.temperature = req.temperature;
    }
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
            return finalizeOpenAIResponse(accumulatedText, toolCallAccum, usage, "openrouter_call");
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
          /* skip */
        }
      }
    }
    return finalizeOpenAIResponse(accumulatedText, toolCallAccum, usage, "openrouter_call");
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
