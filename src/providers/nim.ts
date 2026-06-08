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
} from "./base";
import { toOpenAIMessages } from "./openai";

const NIM_ENDPOINT =
  "https://integrate.api.nvidia.com/v1/chat/completions";
const NIM_MODELS_ENDPOINT = "https://integrate.api.nvidia.com/v1/models";

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
        url: NIM_ENDPOINT,
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
        "API key Nvidia NIM inválida. Verifique em build.nvidia.com.",
        "invalid-key"
      );
    }
    if (res.status === 429) {
      throw new ProviderError(
        "Rate limit Nvidia NIM. Aguarde alguns segundos.",
        "rate-limit"
      );
    }
    if (res.status < 200 || res.status >= 300) {
      const msg = res.json?.error?.message ?? `HTTP ${res.status}`;
      throw new ProviderError(`NIM: ${msg}`, "unknown");
    }

    const message = res.json?.choices?.[0]?.message;
    if (!message) throw new ProviderError("Resposta vazia do NIM.", "unknown");

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
        "Resposta vazia do NIM (sem texto nem tool_calls).",
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
  ): Promise<void> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError(
        "API key Nvidia NIM não configurada. Gere uma em build.nvidia.com.",
        "no-key"
      );
    }

    let res: Response;
    try {
      res = await fetch(NIM_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
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

    if (res.status === 401 || res.status === 403) {
      throw new ProviderError(
        "API key Nvidia NIM inválida. Verifique em build.nvidia.com.",
        "invalid-key"
      );
    }
    if (res.status === 429) {
      throw new ProviderError(
        "Rate limit Nvidia NIM. Aguarde alguns segundos.",
        "rate-limit"
      );
    }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const json = await res.json();
        msg = json?.error?.message ?? msg;
      } catch {
        /* ignora */
      }
      throw new ProviderError(`NIM: ${msg}`, "unknown");
    }
    if (!res.body) {
      throw new ProviderError("Stream vazio do NIM.", "unknown");
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
          /* JSON inválido — pula */
        }
      }
    }
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
}

/**
 * Mantém só modelos de chat dos publishers principais.
 * Exclui embeddings, vision-only (rerank/parse), TTS, NeMo retriever, etc.
 */
function isRelevantNimModel(id: string): boolean {
  const allowedPrefixes = [
    "nvidia/",
    "meta/",
    "qwen/",
    "deepseek-ai/",
    "microsoft/",
    "mistralai/",
    "google/",
  ];
  if (!allowedPrefixes.some((p) => id.startsWith(p))) return false;
  const excludeKeywords = [
    "embed",
    "embedqa",
    "rerank",
    "retriever",
    "tts",
    "parakeet",
    "canary",
    "ocdrnet",
    "vista",
  ];
  if (excludeKeywords.some((kw) => id.includes(kw))) return false;
  return true;
}

export const nimProvider = new NimProvider();
