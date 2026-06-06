// src/providers/anthropic.ts
// Provider Anthropic (Claude) — duas modalidades:
//   chat()       — não-streaming via requestUrl
//   streamChat() — streaming SSE via fetch
//
// Diferenças em relação a OpenAI:
//   - Auth: header `x-api-key` (não Bearer)
//   - Versão obrigatória: `anthropic-version: 2023-06-01`
//   - Browser access: `anthropic-dangerous-direct-browser-access: true` (libera CORS)
//   - System prompt: campo SEPARADO no body (não dentro de messages)
//   - max_tokens: OBRIGATÓRIO (vs opcional na OpenAI)
//   - SSE events: tipos diferentes (content_block_delta com delta.text)

import { requestUrl } from "obsidian";
import { Provider, ProviderError, ProviderRequest, ProviderResponse, TokenHandler, UsageHandler } from "./base";

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

interface AnthropicBody {
  model: string;
  max_tokens: number;
  messages: { role: "user" | "assistant"; content: string }[];
  stream?: boolean;
  system?: string;
}

function buildBody(req: ProviderRequest, stream: boolean): AnthropicBody {
  // Separa o system prompt do resto das mensagens (Anthropic exige isso)
  const systemMsg = req.messages.find((m) => m.role === "system");
  const otherMsgs = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const body: AnthropicBody = {
    model: req.model,
    max_tokens: req.maxTokens ?? 2000,
    messages: otherMsgs,
    stream,
  };
  if (systemMsg?.content) {
    body.system = systemMsg.content;
  }
  return body;
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    "x-api-key": apiKey.trim(),
    "anthropic-version": ANTHROPIC_VERSION,
    "anthropic-dangerous-direct-browser-access": "true",
  };
}

export class AnthropicProvider implements Provider {
  id = "anthropic";
  name = "Anthropic";

  async chat(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError(
        "API key da Anthropic não configurada. Vá em Settings → AXXA OS.",
        "no-key"
      );
    }

    let res;
    try {
      res = await requestUrl({
        url: ANTHROPIC_ENDPOINT,
        method: "POST",
        contentType: "application/json",
        headers: authHeaders(apiKey),
        body: JSON.stringify(buildBody(req, false)),
        throw: false,
      });
    } catch (err) {
      throw new ProviderError("Falha de conexão. Confira sua internet.", "network");
    }

    if (res.status === 401) {
      throw new ProviderError("API key inválida da Anthropic.", "invalid-key");
    }
    if (res.status === 429) {
      throw new ProviderError("Rate limit Anthropic. Aguarde alguns segundos.", "rate-limit");
    }
    if (res.status < 200 || res.status >= 300) {
      const msg = res.json?.error?.message ?? `HTTP ${res.status}`;
      throw new ProviderError(`Anthropic: ${msg}`, "unknown");
    }

    // Anthropic retorna content como array de blocks tipados
    const content = res.json?.content?.[0]?.text;
    if (typeof content !== "string" || !content.length) {
      throw new ProviderError("Resposta vazia da Anthropic.", "unknown");
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
      throw new ProviderError(
        "API key da Anthropic não configurada. Vá em Settings → AXXA OS.",
        "no-key"
      );
    }

    let res: Response;
    try {
      res = await fetch(ANTHROPIC_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(apiKey),
        },
        body: JSON.stringify(buildBody(req, true)),
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new ProviderError("Falha de conexão. Confira sua internet.", "network");
    }

    if (res.status === 401) {
      throw new ProviderError("API key inválida da Anthropic.", "invalid-key");
    }
    if (res.status === 429) {
      throw new ProviderError("Rate limit Anthropic. Aguarde alguns segundos.", "rate-limit");
    }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const json = await res.json();
        msg = json?.error?.message ?? msg;
      } catch {
        /* ignora */
      }
      throw new ProviderError(`Anthropic: ${msg}`, "unknown");
    }
    if (!res.body) {
      throw new ProviderError("Stream vazio da Anthropic.", "unknown");
    }

    // Parser SSE — Anthropic envia events tipados.
    // Nos interessam: content_block_delta (texto), message_stop (fim), error.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    // Anthropic informa input_tokens em message_start e output_tokens em
    // message_delta. A gente acumula localmente e dispara onUsage no fim.
    let inputTokens = 0;
    let outputTokens = 0;

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
        if (!data) continue;
        try {
          const json = JSON.parse(data);
          if (
            json.type === "content_block_delta" &&
            json.delta?.type === "text_delta"
          ) {
            const token = json.delta.text;
            if (typeof token === "string" && token.length > 0) {
              onToken(token);
            }
          } else if (json.type === "message_start") {
            inputTokens = json.message?.usage?.input_tokens ?? 0;
          } else if (json.type === "message_delta") {
            outputTokens = json.usage?.output_tokens ?? outputTokens;
          } else if (json.type === "message_stop") {
            if (onUsage) onUsage({ input: inputTokens, output: outputTokens });
            return;
          } else if (json.type === "error") {
            throw new ProviderError(
              `Anthropic: ${json.error?.message ?? "erro durante stream"}`,
              "unknown"
            );
          }
        } catch (err) {
          if (err instanceof ProviderError) throw err;
          // JSON inválido — pula
        }
      }
    }

    // Stream encerrou sem message_stop — dispara usage com o que temos
    if (onUsage && (inputTokens > 0 || outputTokens > 0)) {
      onUsage({ input: inputTokens, output: outputTokens });
    }
  }

  /** Lista hardcoded — Anthropic não tem endpoint público de models. */
  async listModels(_apiKey: string): Promise<string[]> {
    return [
      "claude-opus-4-8",
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
    ];
  }
}

export const anthropicProvider = new AnthropicProvider();
