// src/providers/openai.ts
// Provider OpenAI — duas modalidades:
//   chat()       — não-streaming, usa requestUrl (sem CORS, mas espera resposta completa)
//   streamChat() — streaming SSE, usa fetch (ReadableStream, token a token)
//
// Por que dois? requestUrl não suporta streaming. fetch suporta mas pode ter CORS
// em alguns contextos. OpenAI permite CORS via Bearer auth, então fetch funciona.

import { requestUrl } from "obsidian";
import { Provider, ProviderError, ProviderRequest, ProviderResponse, TokenHandler, UsageHandler } from "./base";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODELS_ENDPOINT = "https://api.openai.com/v1/models";

export class OpenAIProvider implements Provider {
  id = "openai";
  name = "OpenAI";

  async chat(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError(
        "API key da OpenAI não configurada. Vá em Settings → AXXA OS para colar sua chave.",
        "no-key"
      );
    }

    let res;
    try {
      res = await requestUrl({
        url: OPENAI_ENDPOINT,
        method: "POST",
        contentType: "application/json",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          // gpt-4o e modelos mais novos exigem max_completion_tokens (max_tokens deprecado)
          max_completion_tokens: req.maxTokens ?? 2000,
        }),
        throw: false,
      });
    } catch (err) {
      throw new ProviderError(
        "Falha de conexão. Confira sua internet.",
        "network"
      );
    }

    if (res.status === 401) {
      throw new ProviderError(
        "API key inválida. Verifique a chave em Settings → AXXA OS.",
        "invalid-key"
      );
    }
    if (res.status === 429) {
      throw new ProviderError(
        "Rate limit atingido na OpenAI. Aguarde alguns segundos e tente de novo.",
        "rate-limit"
      );
    }
    if (res.status < 200 || res.status >= 300) {
      const errorMsg = res.json?.error?.message ?? `HTTP ${res.status}`;
      throw new ProviderError(`OpenAI: ${errorMsg}`, "unknown");
    }

    const content = res.json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.length) {
      throw new ProviderError("Resposta vazia da OpenAI.", "unknown");
    }

    return { content };
  }

  /**
   * Streaming SSE — chama onToken pra cada delta recebido.
   * Lança ProviderError em falhas e AbortError quando o signal aborta.
   * O caller deve tratar AbortError como cancelamento intencional (sem erro UI).
   */
  async streamChat(
    req: ProviderRequest,
    apiKey: string,
    onToken: TokenHandler,
    onUsage?: UsageHandler,
    signal?: AbortSignal
  ): Promise<void> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError(
        "API key da OpenAI não configurada. Vá em Settings → AXXA OS para colar sua chave.",
        "no-key"
      );
    }

    let res: Response;
    try {
      res = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          stream: true,
          // include_usage faz a OpenAI mandar um chunk final com `usage`
          stream_options: { include_usage: true },
          max_completion_tokens: req.maxTokens ?? 2000,
        }),
        signal,
      });
    } catch (err) {
      // AbortError sobe sem mudar pra ProviderError — caller distingue
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new ProviderError("Falha de conexão. Confira sua internet.", "network");
    }

    if (res.status === 401) {
      throw new ProviderError(
        "API key inválida. Verifique a chave em Settings → AXXA OS.",
        "invalid-key"
      );
    }
    if (res.status === 429) {
      throw new ProviderError(
        "Rate limit atingido na OpenAI. Aguarde alguns segundos e tente de novo.",
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
      throw new ProviderError(`OpenAI: ${msg}`, "unknown");
    }
    if (!res.body) {
      throw new ProviderError("Stream vazio da OpenAI.", "unknown");
    }

    // Parser SSE: cada evento é "data: {json}\n\n". Quebramos em \n,
    // mantemos o resto incompleto no buffer pra próxima leitura.
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
          // Último chunk vem com `usage` (graças ao include_usage)
          if (json?.usage && onUsage) {
            onUsage({
              input: json.usage.prompt_tokens ?? 0,
              output: json.usage.completion_tokens ?? 0,
            });
          }
        } catch {
          // chunk JSON inválido — pula
        }
      }
    }
  }

  /**
   * Lista modelos relevantes (modernos) da OpenAI.
   * Filtra legacy / audio / embeddings / etc.
   */
  async listModels(apiKey: string): Promise<string[]> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError("API key da OpenAI não configurada.", "no-key");
    }
    const res = await requestUrl({
      url: OPENAI_MODELS_ENDPOINT,
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      throw: false,
    });
    if (res.status === 401) {
      throw new ProviderError("API key inválida.", "invalid-key");
    }
    if (res.status < 200 || res.status >= 300) {
      throw new ProviderError(`OpenAI: HTTP ${res.status}`, "unknown");
    }
    const all: string[] = (res.json?.data ?? []).map((m: { id: string }) => m.id);
    return all.filter(isRelevantOpenAIModel).sort();
  }
}

/** Mantém só os modelos modernos de chat — sem legacy, sem áudio/embedding/tools. */
function isRelevantOpenAIModel(id: string): boolean {
  const allowedPrefixes = ["gpt-4o", "gpt-5", "o1", "o3", "o4"];
  if (!allowedPrefixes.some((p) => id.startsWith(p))) return false;
  const excludeKeywords = [
    "audio",
    "realtime",
    "transcribe",
    "tts",
    "search",
    "embed",
    "preview",
    "vision",
    "instruct",
    "moderation",
    "image",
  ];
  if (excludeKeywords.some((kw) => id.includes(kw))) return false;
  return true;
}

export const openaiProvider = new OpenAIProvider();
