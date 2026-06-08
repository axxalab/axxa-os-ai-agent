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

/**
 * Converte ProviderMessage[] pro formato wire-level do OpenAI.
 * Tratamento especial:
 *   - assistant com toolCalls vira { role:"assistant", tool_calls: [...] }
 *   - tool result vira { role:"tool", tool_call_id, content }
 *   - user com attachments (imagens) vira content array `[{type:"text"},{type:"image_url"}]`
 *     — formato vision GPT-4o / GPT-5 / o1+
 */
export function toOpenAIMessages(
  messages: import("./base").ProviderMessage[]
): unknown[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool",
        tool_call_id: m.toolCallId,
        content: m.content,
      };
    }
    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      };
    }
    if (m.role === "user" && m.attachments && m.attachments.length > 0) {
      const parts: Array<Record<string, unknown>> = [];
      if (m.content) parts.push({ type: "text", text: m.content });
      for (const att of m.attachments) {
        if (att.type === "image") {
          parts.push({
            type: "image_url",
            image_url: { url: att.dataUrl },
          });
        }
      }
      return { role: "user", content: parts };
    }
    return { role: m.role, content: m.content };
  });
}

export class OpenAIProvider implements Provider {
  id = "openai";
  name = "OpenAI";
  supportsTools = true;

  async chat(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError(
        "API key da OpenAI não configurada. Vá em Settings → AXXA OS para colar sua chave.",
        "no-key"
      );
    }

    // Monta body — tools só vai se o request pediu
    const body: Record<string, unknown> = {
      model: req.model,
      messages: toOpenAIMessages(req.messages),
      // gpt-4o e modelos mais novos exigem max_completion_tokens (max_tokens deprecado)
      max_completion_tokens: req.maxTokens ?? 2000,
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
        url: OPENAI_ENDPOINT,
        method: "POST",
        contentType: "application/json",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(body),
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

    const message = res.json?.choices?.[0]?.message;
    if (!message) {
      throw new ProviderError("Resposta vazia da OpenAI.", "unknown");
    }

    // Parseia tool_calls se vieram
    let toolCalls: import("./base").ProviderToolCall[] | undefined;
    if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      toolCalls = message.tool_calls
        .filter((tc: { type: string }) => tc.type === "function")
        .map((tc: { id: string; function: { name: string; arguments: string } }) => {
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
            // LLM produziu JSON inválido — devolve string raw como erro
            parsedArgs = { _raw: tc.function.arguments };
          }
          return {
            id: tc.id,
            name: tc.function.name,
            arguments: parsedArgs,
          };
        });
    }

    const content = typeof message.content === "string" ? message.content : "";
    // Se NÃO tem toolCalls e content também é vazio, é erro
    if (!toolCalls && !content) {
      throw new ProviderError(
        "Resposta vazia da OpenAI (sem texto nem tool_calls).",
        "unknown"
      );
    }

    // Usage (se vier)
    const usage = res.json?.usage
      ? {
          input: res.json.usage.prompt_tokens ?? 0,
          output: res.json.usage.completion_tokens ?? 0,
        }
      : undefined;

    return { content, toolCalls, usage };
  }

  /**
   * Streaming SSE — chama onToken pra cada delta recebido.
   * Retorna ProviderResponse com o estado FINAL acumulado: content total,
   * toolCalls (se houve) e usage. Agent mode usa esse retorno pra decidir
   * se executa tools ou se a resposta tá completa.
   *
   * Lança ProviderError em falhas e AbortError quando o signal aborta.
   * O caller deve tratar AbortError como cancelamento intencional.
   */
  async streamChat(
    req: ProviderRequest,
    apiKey: string,
    onToken: TokenHandler,
    onUsage?: UsageHandler,
    signal?: AbortSignal
  ): Promise<ProviderResponse> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError(
        "API key da OpenAI não configurada. Vá em Settings → AXXA OS para colar sua chave.",
        "no-key"
      );
    }

    // Body com tools — necessário pra Agent mode com streaming
    const body: Record<string, unknown> = {
      model: req.model,
      messages: toOpenAIMessages(req.messages),
      stream: true,
      // include_usage faz a OpenAI mandar um chunk final com `usage`
      stream_options: { include_usage: true },
      max_completion_tokens: req.maxTokens ?? 2000,
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
      res = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(body),
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

    // Acumuladores pro retorno final
    let accumulatedText = "";
    // tool_calls vêm em deltas indexados — accumulator por index
    const toolCallAccum: Record<number, {
      id: string;
      name: string;
      argsBuf: string;
    }> = {};
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
            return finalizeOpenAI(accumulatedText, toolCallAccum, usage);
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
            // tool_calls em delta — formato:
            //   { tool_calls: [{ index: 0, id?: "call_x", function: { name?, arguments? } }] }
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
          // Último chunk vem com `usage` (graças ao include_usage)
          if (json?.usage) {
            usage = {
              input: json.usage.prompt_tokens ?? 0,
              output: json.usage.completion_tokens ?? 0,
            };
            if (onUsage) onUsage(usage);
          }
        } catch {
          // chunk JSON inválido — pula
        }
      }
    }

    return finalizeOpenAI(accumulatedText, toolCallAccum, usage);
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

/** Monta o ProviderResponse final a partir dos buffers do stream.
 *  Exportado pra reuso por providers OpenAI-compat (Gemini, OpenRouter, NIM, Ollama). */
export function finalizeOpenAIResponse(
  content: string,
  toolCallAccum: Record<number, { id: string; name: string; argsBuf: string }>,
  usage?: { input: number; output: number },
  idPrefix = "openai_call"
): ProviderResponse {
  const indices = Object.keys(toolCallAccum)
    .map((k) => Number(k))
    .sort((a, b) => a - b);
  const toolCalls: import("./base").ProviderToolCall[] = [];
  for (const i of indices) {
    const acc = toolCallAccum[i];
    if (!acc.name) continue;
    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = acc.argsBuf ? JSON.parse(acc.argsBuf) : {};
    } catch {
      parsedArgs = { _raw: acc.argsBuf };
    }
    toolCalls.push({
      id: acc.id || `${idPrefix}_${Date.now()}_${i}`,
      name: acc.name,
      arguments: parsedArgs,
    });
  }
  const result: ProviderResponse = { content };
  if (toolCalls.length > 0) result.toolCalls = toolCalls;
  if (usage) result.usage = usage;
  return result;
}

/** Monta o ProviderResponse final a partir dos buffers do stream. */
function finalizeOpenAI(
  content: string,
  toolCallAccum: Record<number, { id: string; name: string; argsBuf: string }>,
  usage?: { input: number; output: number }
): ProviderResponse {
  const indices = Object.keys(toolCallAccum)
    .map((k) => Number(k))
    .sort((a, b) => a - b);
  const toolCalls: import("./base").ProviderToolCall[] = [];
  for (const i of indices) {
    const acc = toolCallAccum[i];
    if (!acc.name) continue;
    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = acc.argsBuf ? JSON.parse(acc.argsBuf) : {};
    } catch {
      parsedArgs = { _raw: acc.argsBuf };
    }
    toolCalls.push({
      id: acc.id || `openai_call_${Date.now()}_${i}`,
      name: acc.name,
      arguments: parsedArgs,
    });
  }
  const result: ProviderResponse = { content };
  if (toolCalls.length > 0) result.toolCalls = toolCalls;
  if (usage) result.usage = usage;
  return result;
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
