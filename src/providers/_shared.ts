// src/providers/_shared.ts
// Núcleo COMPARTILHADO dos providers (v0.1.156). Os providers OpenAI-compatible
// (openai/gemini/nim/openrouter) eram ~90% código idêntico — body, parser SSE,
// error mapping, tool-calls. Tudo isso vive aqui agora; cada provider vira um
// wrapper fino que só declara suas diferenças (endpoint, auth, filtro, quirks).
//
// Nota sobre mensagens de erro: desde v0.1.147 a UI re-localiza o erro pelo
// CÓDIGO (no-key/invalid-key/rate-limit/network), então o TEXTO genérico daqui
// é só fallback/detalhe — não há regressão de UX em genericizar.

import {
  ProviderError,
  type ProviderRequest,
  type ProviderResponse,
  type ProviderToolCall,
  type ProviderToolDefinition,
  type ProviderMessage,
  type ImageAttachment,
  type TokenHandler,
  type UsageHandler,
} from "./base";
import { resolveTemperature, resolveMaxTokens } from "./paramPolicy";

// ============================================================
// Mensagens → formato wire OpenAI (text + tool_calls + vision)
// ============================================================
export function toOpenAIMessages(messages: ProviderMessage[]): unknown[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
    }
    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      };
    }
    if (m.role === "user" && m.attachments && m.attachments.length > 0) {
      const imageAtt = m.attachments.filter(
        (a): a is ImageAttachment => a.type === "image"
      );
      if (imageAtt.length === 0) return { role: "user", content: m.content };
      const parts: Array<Record<string, unknown>> = [];
      if (m.content) parts.push({ type: "text", text: m.content });
      for (const att of imageAtt) {
        parts.push({ type: "image_url", image_url: { url: att.dataUrl } });
      }
      return { role: "user", content: parts };
    }
    return { role: m.role, content: m.content };
  });
}

/** Tools → formato `function` da OpenAI. undefined se não há tools. */
export function toOpenAITools(tools?: ProviderToolDefinition[]) {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

// ============================================================
// Body builder — aplica paramPolicy (temperature/max_tokens) + tools
// ============================================================
export interface BodyOpts {
  /** Id do provider (pra paramPolicy). */
  provider: string;
  stream?: boolean;
  /** Campo de max tokens: "max_tokens" (default) ou "max_completion_tokens". */
  maxTokensField?: "max_tokens" | "max_completion_tokens";
  /** Pede `stream_options: { include_usage: true }` (OpenAI/Gemini/OpenRouter). */
  includeUsage?: boolean;
}

export function buildChatBody(
  req: ProviderRequest,
  opts: BodyOpts
): Record<string, unknown> {
  const field = opts.maxTokensField ?? "max_tokens";
  const body: Record<string, unknown> = {
    model: req.model,
    messages: toOpenAIMessages(req.messages),
    [field]: resolveMaxTokens(opts.provider, req.model, req.maxTokens ?? 2000),
  };
  if (opts.stream) {
    body.stream = true;
    if (opts.includeUsage) body.stream_options = { include_usage: true };
  }
  const temp = resolveTemperature(opts.provider, req.model, req.temperature);
  if (temp !== undefined) body.temperature = temp;
  const tools = toOpenAITools(req.tools);
  if (tools) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  return body;
}

// ============================================================
// Error mapping (HTTP status → ProviderError). Detalhe vem do body da API.
// ============================================================
export interface ErrorMapOpts {
  /** Rótulo do provider no texto do erro ("OpenAI", "Gemini", …). */
  label: string;
  /** Status tratados como invalid-key. Default [401]. Gemini/NIM usam [401,403]. */
  authStatuses?: number[];
}

function extractApiMessage(json: unknown): string | null {
  const j = json as
    | { error?: { message?: string }; detail?: string; message?: string }
    | undefined;
  return j?.error?.message ?? j?.detail ?? j?.message ?? null;
}

/** Retorna o ProviderError pra um status de erro, ou null se status é OK. */
export function mapHttpError(
  status: number,
  bodyJson: unknown,
  opts: ErrorMapOpts
): ProviderError | null {
  if (status >= 200 && status < 300) return null;
  const auth = opts.authStatuses ?? [401];
  if (auth.includes(status)) {
    return new ProviderError(`API key ${opts.label} inválida.`, "invalid-key");
  }
  if (status === 429) {
    return new ProviderError(
      `Rate limit ${opts.label}. Aguarde alguns segundos.`,
      "rate-limit"
    );
  }
  const detail = extractApiMessage(bodyJson) ?? `HTTP ${status}`;
  return new ProviderError(`${opts.label}: ${detail}`, "unknown");
}

/** Valida uma Response de fetch (stream); lê o body p/ detalhe e lança se erro. */
export async function ensureOkStream(
  res: Response,
  opts: ErrorMapOpts
): Promise<void> {
  if (res.ok) return;
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    /* sem corpo JSON — usa o status */
  }
  const err = mapHttpError(res.status, json, opts);
  if (err) throw err;
}

/** Valida uma resposta de requestUrl (json síncrono) e lança se erro. */
export function ensureOkRequest(
  res: { status: number; json?: unknown },
  opts: ErrorMapOpts
): void {
  const err = mapHttpError(res.status, res.json, opts);
  if (err) throw err;
}

// ============================================================
// Resposta non-stream (chat): message → content + toolCalls
// ============================================================
export function parseOpenAIChatMessage(message: {
  content?: unknown;
  tool_calls?: Array<{ type: string; id: string; function: { name: string; arguments: string } }>;
}): { content: string; toolCalls?: ProviderToolCall[] } {
  let toolCalls: ProviderToolCall[] | undefined;
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    toolCalls = message.tool_calls
      .filter((tc) => tc.type === "function")
      .map((tc) => {
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
  return { content, toolCalls };
}

export function usageFrom(json: {
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}): { input: number; output: number } | undefined {
  return json.usage
    ? {
        input: json.usage.prompt_tokens ?? 0,
        output: json.usage.completion_tokens ?? 0,
      }
    : undefined;
}

// ============================================================
// Finalize do stream — buffers acumulados → ProviderResponse
// ============================================================
type ToolAccum = Record<number, { id: string; name: string; argsBuf: string }>;

export function finalizeOpenAIResponse(
  content: string,
  toolCallAccum: ToolAccum,
  usage?: { input: number; output: number },
  idPrefix = "openai_call"
): ProviderResponse {
  const indices = Object.keys(toolCallAccum)
    .map((k) => Number(k))
    .sort((a, b) => a - b);
  const toolCalls: ProviderToolCall[] = [];
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

// ============================================================
// Parser SSE OpenAI-compat: `data: {choices[0].delta}` … `data: [DONE]`
// Reusado por openai / gemini / openrouter (mesmo formato).
// ============================================================
export async function parseOpenAICompatSSE(
  body: ReadableStream<Uint8Array>,
  onToken: TokenHandler,
  onUsage: UsageHandler | undefined,
  idPrefix: string,
  onReasoning?: (delta: string) => void
): Promise<ProviderResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulatedText = "";
  const toolCallAccum: ToolAccum = {};
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
          return finalizeOpenAIResponse(accumulatedText, toolCallAccum, usage, idPrefix);
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
          // Reasoning/thinking exposto por alguns modelos (DeepSeek R1 via
          // reasoning_content; OpenRouter via reasoning). Roteado à parte.
          if (onReasoning) {
            const r =
              (typeof delta.reasoning === "string" && delta.reasoning) ||
              (typeof delta.reasoning_content === "string" &&
                delta.reasoning_content) ||
              "";
            if (r) onReasoning(r);
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
        /* chunk JSON inválido — pula */
      }
    }
  }
  return finalizeOpenAIResponse(accumulatedText, toolCallAccum, usage, idPrefix);
}

// ============================================================
// Fetch de catálogo (/models) — usado por listModels/listEmbeddingModels.
// Graceful: devolve [] em erro quando `soft` (pro embedding não derrubar).
// ============================================================
export async function fetchModelIds(
  url: string,
  apiKey: string,
  opts: ErrorMapOpts & {
    requestUrlFn: (o: {
      url: string;
      method: string;
      headers: Record<string, string>;
      throw: boolean;
    }) => Promise<{ status: number; json?: { data?: Array<{ id: string }> } }>;
    headers?: Record<string, string>;
    soft?: boolean;
  }
): Promise<string[]> {
  if (!apiKey || !apiKey.trim()) {
    if (opts.soft) return [];
    throw new ProviderError(`API key ${opts.label} não configurada.`, "no-key");
  }
  try {
    const res = await opts.requestUrlFn({
      url,
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        ...(opts.headers ?? {}),
      },
      throw: false,
    });
    if (res.status < 200 || res.status >= 300) {
      if (opts.soft) return [];
      const err = mapHttpError(res.status, res.json, opts);
      if (err) throw err;
    }
    return (res.json?.data ?? []).map((m) => m.id);
  } catch (e) {
    if (opts.soft) return [];
    throw e;
  }
}
