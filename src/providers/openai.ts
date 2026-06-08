// src/providers/openai.ts
// Provider OpenAI — duas modalidades:
//   chat()       — não-streaming, usa requestUrl (sem CORS, mas espera resposta completa)
//   streamChat() — streaming SSE, usa fetch (ReadableStream, token a token)
//
// Por que dois? requestUrl não suporta streaming. fetch suporta mas pode ter CORS
// em alguns contextos. OpenAI permite CORS via Bearer auth, então fetch funciona.

import { requestUrl } from "obsidian";
import {
  Provider,
  ProviderError,
  ProviderRequest,
  ProviderResponse,
  TokenHandler,
  UsageHandler,
  MediaGenerationRequest,
  MediaGenerationItem,
} from "./base";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODELS_ENDPOINT = "https://api.openai.com/v1/models";
const OPENAI_IMAGES_ENDPOINT = "https://api.openai.com/v1/images/generations";
const OPENAI_AUDIO_SPEECH_ENDPOINT = "https://api.openai.com/v1/audio/speech";

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
      const imageAtt = m.attachments.filter(
        (a): a is import("./base").ImageAttachment => a.type === "image"
      );
      // Imagens vão como content array OpenAI-vision; demais anexos (note,
      // audio, pdf) já foram inlinados como texto antes pelo caller — não
      // precisam ir pro wire.
      if (imageAtt.length === 0) {
        return { role: "user", content: m.content };
      }
      const parts: Array<Record<string, unknown>> = [];
      if (m.content) parts.push({ type: "text", text: m.content });
      for (const att of imageAtt) {
        parts.push({
          type: "image_url",
          image_url: { url: att.dataUrl },
        });
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
   * Gera imagem via DALL-E 3 ou gpt-image-1.
   * Endpoint: /v1/images/generations.
   *
   * Quirks confirmados via webfetch:
   *  - **gpt-image-1** NÃO aceita `response_format` — sempre devolve `b64_json`.
   *    Mandar o param dá erro 400 "Unknown parameter: response_format".
   *  - **DALL-E 3** aceita só sizes `1024x1024`, `1024x1792`, `1792x1024`.
   *  - **DALL-E 2** aceita `256x256`, `512x512`, `1024x1024`.
   *  - **gpt-image-1** aceita `1024x1024`, `1024x1536`, `1536x1024`, `auto`.
   */
  async generateImage(
    request: MediaGenerationRequest,
    apiKey: string
  ): Promise<MediaGenerationItem[]> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError("API key da OpenAI não configurada.", "no-key");
    }
    const isGptImage = request.model.startsWith("gpt-image");
    const isDallE3 = request.model.startsWith("dall-e-3");

    const body: Record<string, unknown> = {
      model: request.model,
      prompt: request.prompt,
      n: request.n ?? 1,
      size: request.size && request.size !== "auto" ? request.size : "1024x1024",
    };
    // gpt-image-1 NÃO aceita response_format (sempre b64_json). DALL-E aceita.
    if (!isGptImage) {
      body.response_format = "b64_json";
    }
    // DALL-E 3 só gera 1 imagem por chamada
    if (isDallE3) body.n = 1;

    // Retry com backoff em 500 (server-side transitório). 3 tentativas, 1s/2s/4s.
    let res;
    let attempt = 0;
    const MAX_ATTEMPTS = 3;
    while (attempt < MAX_ATTEMPTS) {
      attempt++;
      try {
        res = await requestUrl({
          url: OPENAI_IMAGES_ENDPOINT,
          method: "POST",
          contentType: "application/json",
          headers: { Authorization: `Bearer ${apiKey.trim()}` },
          body: JSON.stringify(body),
          throw: false,
        });
      } catch (err) {
        console.error("[axxa] OpenAI image gen network error:", err);
        throw new ProviderError("Falha de conexão na geração.", "network");
      }
      if (res.status < 500 || attempt >= MAX_ATTEMPTS) break;
      // 500/502/503 → retry com backoff exponencial
      console.warn(`[axxa] OpenAI image gen ${res.status}, retry ${attempt}/${MAX_ATTEMPTS}`);
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
    if (!res) {
      throw new ProviderError("OpenAI imagens: sem resposta.", "unknown");
    }
    if (res.status < 200 || res.status >= 300) {
      console.error("[axxa] OpenAI image gen failed:", res.status, res.json ?? res.text);
    }
    if (res.status === 401) {
      throw new ProviderError("API key inválida.", "invalid-key");
    }
    if (res.status === 403) {
      // Verifica se é problema de org verification (gpt-image-1)
      const apiMsg = res.json?.error?.message ?? "";
      const isOrgIssue = /verif|organization/i.test(apiMsg);
      if (isOrgIssue || isGptImage) {
        throw new ProviderError(
          `OpenAI: organização não verificada pra ${request.model}. ` +
            `Vá em platform.openai.com → Settings → Organization → General → "Verify Organization" ` +
            `(precisa de telefone + ID válido). Após verificar, aguarde até 30min e tente de novo.`,
          "invalid-key"
        );
      }
      throw new ProviderError(`OpenAI: acesso negado. ${apiMsg}`, "invalid-key");
    }
    if (res.status === 429) {
      throw new ProviderError("Rate limit OpenAI.", "rate-limit");
    }
    if (res.status >= 500) {
      throw new ProviderError(
        `OpenAI servidor com problema (${res.status}). ` +
          `Pode ser incidente temporário — verifique status.openai.com. ` +
          `Já tentei ${MAX_ATTEMPTS} vezes com backoff.`,
        "unknown"
      );
    }
    if (res.status < 200 || res.status >= 300) {
      const msg =
        res.json?.error?.message ??
        (typeof res.text === "string" ? res.text.slice(0, 240) : null) ??
        `HTTP ${res.status}`;
      throw new ProviderError(`OpenAI imagens (${res.status}): ${msg}`, "unknown");
    }
    const items = res.json?.data;
    if (!Array.isArray(items) || items.length === 0) {
      throw new ProviderError("OpenAI: resposta sem imagens (data vazio).", "unknown");
    }
    const [width, height] = parseSize(body.size as string);
    return items.map((it: { b64_json?: string; url?: string; revised_prompt?: string }) => {
      const b64 = it.b64_json ?? "";
      if (!b64) {
        // Fallback se vier `url` em vez de b64 (caso raro)
        throw new ProviderError(
          "OpenAI: imagem retornada sem b64_json (apenas url). Fetch da URL não implementado.",
          "unknown"
        );
      }
      const data = base64ToBytes(b64);
      return {
        data,
        mime: "image/png",
        width,
        height,
        text: it.revised_prompt,
      } as MediaGenerationItem;
    });
  }

  /**
   * Gera áudio (TTS) via /v1/audio/speech.
   * Modelos: tts-1, tts-1-hd, gpt-4o-mini-tts. Voice default "alloy".
   * Retorna 1 item (a API só gera 1 saída por chamada).
   */
  async generateAudio(
    request: MediaGenerationRequest,
    apiKey: string
  ): Promise<MediaGenerationItem[]> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError("API key da OpenAI não configurada.", "no-key");
    }
    const body: Record<string, unknown> = {
      model: request.model,
      input: request.prompt,
      voice: request.voice ?? "alloy",
      response_format: "mp3",
    };
    let res;
    try {
      res = await requestUrl({
        url: OPENAI_AUDIO_SPEECH_ENDPOINT,
        method: "POST",
        contentType: "application/json",
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
        body: JSON.stringify(body),
        throw: false,
      });
    } catch (err) {
      throw new ProviderError("Falha de conexão TTS.", "network");
    }
    if (res.status === 401) {
      throw new ProviderError("API key inválida.", "invalid-key");
    }
    if (res.status === 429) {
      throw new ProviderError("Rate limit OpenAI TTS.", "rate-limit");
    }
    if (res.status < 200 || res.status >= 300) {
      const msg = res.json?.error?.message ?? `HTTP ${res.status}`;
      throw new ProviderError(`OpenAI TTS: ${msg}`, "unknown");
    }
    // Retorna binário (audio/mpeg). res.arrayBuffer é o buffer cru.
    const buf = res.arrayBuffer;
    const data = new Uint8Array(buf);
    return [{ data, mime: "audio/mpeg" }];
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

/** Mantém modelos relevantes — chat moderno + image gen (DALL-E, gpt-image)
 *  + TTS (tts-*, gpt-4o-mini-tts). Filtra só embed/legacy/moderation. */
function isRelevantOpenAIModel(id: string): boolean {
  // Chat
  if (
    id.startsWith("gpt-4o") ||
    id.startsWith("gpt-5") ||
    id.startsWith("o1") ||
    id.startsWith("o3") ||
    id.startsWith("o4")
  ) {
    const excludeKeywords = [
      "audio",
      "realtime",
      "transcribe",
      "search",
      "preview",
      "vision",
      "instruct",
      "moderation",
    ];
    return !excludeKeywords.some((kw) => id.includes(kw));
  }
  // Image generation
  if (id.startsWith("dall-e") || id.startsWith("gpt-image")) return true;
  // TTS
  if (id === "tts-1" || id === "tts-1-hd" || id.startsWith("gpt-4o-mini-tts"))
    return true;
  return false;
}

/** Helper: parse "1024x1024" → [1024, 1024]. */
function parseSize(s: string): [number | undefined, number | undefined] {
  const m = /^(\d+)x(\d+)$/.exec(s);
  if (!m) return [undefined, undefined];
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

/** Decode base64 → Uint8Array. */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const openaiProvider = new OpenAIProvider();
