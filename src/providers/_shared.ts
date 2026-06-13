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
    | {
        error?: unknown;
        errors?: unknown;
        detail?: string;
        message?: string;
      }
    | undefined;
  // error pode vir como string crua, objeto { message } ou objeto/array
  // aninhado (alguns hosts OpenAI-compat). v0.1.228: cobre os 3 casos.
  if (typeof j?.error === "string") return j.error;
  if (j?.error && typeof j.error === "object") {
    const m = (j.error as { message?: unknown }).message;
    if (typeof m === "string") return m;
    if (m != null) return shortJson(m);
  }
  // Alguns provedores devolvem `errors: [...]` em vez de `error`.
  if (Array.isArray(j?.errors) && j.errors.length > 0) {
    const first = j.errors[0] as { message?: unknown };
    if (typeof first?.message === "string") return first.message;
    return shortJson(j.errors);
  }
  return j?.detail ?? j?.message ?? null;
}

/** Serializa um valor não-string em JSON curto (cap 200 chars) p/ detalhe de erro. */
function shortJson(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    return s.length > 200 ? `${s.slice(0, 200)}…` : s;
  } catch {
    return String(v);
  }
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
  // Transientes/retryáveis: 5xx (inclui 529 "overloaded" do Anthropic), 408
  // (timeout) e 409 (conflito). Mapeados em "rate-limit" porque é o único code
  // transiente da union e a UI já o re-localiza como "tente de novo". v0.1.228.
  if (status >= 500 || status === 408 || status === 409) {
    return new ProviderError(
      `Serviço ${opts.label} indisponível. Tente novamente.`,
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
  // Lê como texto e tenta parsear JSON: assim também capturamos detalhe em
  // corpos text/plain (alguns gateways/proxies). v0.1.228.
  let json: unknown;
  try {
    const raw = await res.text();
    if (raw) {
      try {
        json = JSON.parse(raw);
      } catch {
        json = { message: raw };
      }
    }
  } catch {
    /* sem corpo legível — usa o status */
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
  reasoning_content?: unknown;
  reasoning?: unknown;
}): { content: string; toolCalls?: ProviderToolCall[]; reasoning?: string } {
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
  // content pode vir como string OU array de parts ({ type:"text", text }) em
  // alguns hosts OpenAI-compat. v0.1.228: concatena os parts de texto; '' só
  // quando content é realmente nulo/ausente.
  const content =
    typeof message.content === "string"
      ? message.content
      : Array.isArray(message.content)
        ? (message.content as Array<{ type?: string; text?: unknown }>)
            .filter((p) => p?.type === "text" && typeof p.text === "string")
            .map((p) => p.text as string)
            .join("")
        : "";
  // Reasoning de resposta NÃO-stream (DeepSeek R1 e afins expõem
  // reasoning_content; alguns hosts usam "reasoning"). Auditoria v0.1.225.
  const reasoning =
    (typeof message.reasoning_content === "string" && message.reasoning_content) ||
    (typeof message.reasoning === "string" && message.reasoning) ||
    undefined;
  return { content, toolCalls, reasoning };
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
      // Fallback de id: randomUUID garante unicidade absoluta entre turnos
      // (Date.now() podia colidir entre finalizes no mesmo ms). v0.1.228.
      id: acc.id || `${idPrefix}_${crypto.randomUUID()}`,
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
  // Fallback p/ quando o chunk de tool_call vem SEM `index` (raro, mas alguns
  // hosts OpenAI-compat omitem): em vez de cair sempre em 0 e fundir tools
  // distintas, avança um contador no 1º chunk de cada tool (id/name presentes).
  // v0.1.228.
  let lastToolIdx = -1;
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
              // `index` presente (caminho padrão OpenAI) é sempre respeitado;
              // só usamos o contador quando ele falta. O 1º chunk de uma tool
              // traz id/name, então é nele que avançamos o contador.
              let idx: number;
              if (typeof tc.index === "number") {
                idx = tc.index;
                if (idx > lastToolIdx) lastToolIdx = idx;
              } else {
                if (tc.id || tc.function?.name) lastToolIdx += 1;
                idx = lastToolIdx < 0 ? 0 : lastToolIdx;
              }
              if (!toolCallAccum[idx]) {
                toolCallAccum[idx] = { id: "", name: "", argsBuf: "" };
              }
              if (tc.id) toolCallAccum[idx].id = tc.id;
              // name só é setado se ainda vazio: hosts mandam o name uma vez no
              // 1º chunk; reescrever (ou concatenar) corromperia o nome.
              if (tc.function?.name && !toolCallAccum[idx].name) {
                toolCallAccum[idx].name = tc.function.name;
              }
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
