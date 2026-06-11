// src/providers/anthropic.ts
// Provider Anthropic (Claude) — duas modalidades:
//   chat()       — não-streaming via requestUrl, com TOOL USE (Agent mode)
//   streamChat() — streaming SSE via fetch (chat mode)
//
// Diferenças em relação a OpenAI:
//   - Auth: header `x-api-key` (não Bearer)
//   - Versão obrigatória: `anthropic-version: 2023-06-01`
//   - Browser access: `anthropic-dangerous-direct-browser-access: true` (libera CORS)
//   - System prompt: campo SEPARADO no body (não dentro de messages)
//   - max_tokens: OBRIGATÓRIO (vs opcional na OpenAI)
//   - SSE events: tipos diferentes (content_block_delta com delta.text)
//
// Tool use (v0.1.32):
//   - Tools: `{ name, description, input_schema }` (vs `{ type:"function", function:{...} }`)
//   - Assistant w/ tools: content = array de blocks [text, tool_use]
//   - Tool result: vira role "user" com content array `[{ type:"tool_result", tool_use_id, content }]`
//   - Anthropic exige alternância user/assistant — tool_results consecutivos viram 1 user msg

import { requestUrl } from "obsidian";
import {
  Provider,
  ProviderError,
  ProviderRequest,
  ProviderResponse,
  ProviderMessage,
  ProviderToolCall,
  TokenHandler,
  UsageHandler,
} from "./base";
import { resolveTemperature, resolveMaxTokens } from "./paramPolicy";
import { ensureOkRequest, ensureOkStream } from "./_shared";

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// ============================================================
// Content blocks — formato Anthropic
// ============================================================

interface TextBlock {
  type: "text";
  text: string;
}
interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}
interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}
interface ImageBlock {
  type: "image";
  source: {
    type: "base64" | "url";
    media_type?: string;
    data?: string;
    url?: string;
  };
}
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ImageBlock;

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: object;
}

interface AnthropicBody {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  stream?: boolean;
  system?: string;
  tools?: AnthropicTool[];
  temperature?: number;
}

/**
 * Converte ProviderMessage[] pro formato wire-level do Anthropic.
 * - system → extraído em campo separado
 * - role "tool" → vira role "user" com content array contendo tool_result block
 * - role "assistant" com toolCalls → content array com text + tool_use blocks
 * - tool_results consecutivos viram 1 user msg com content[] mergeado
 *   (Anthropic exige alternância user/assistant)
 */
export function toAnthropicPayload(messages: ProviderMessage[]): {
  system: string | undefined;
  messages: AnthropicMessage[];
} {
  let system: string | undefined;
  const converted: AnthropicMessage[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      // Concatena se tiver vários systems (raro mas seguro)
      system = system ? system + "\n\n" + m.content : m.content;
      continue;
    }

    if (m.role === "tool") {
      converted.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: m.toolCallId ?? "",
            content: m.content,
          },
        ],
      });
      continue;
    }

    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      const blocks: ContentBlock[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls) {
        blocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        });
      }
      converted.push({ role: "assistant", content: blocks });
      continue;
    }

    // User normal — pode ter attachments (imagens) em content array.
    // Note/audio/pdf vêm inlinados como texto pelo caller (não wire).
    const imageAtt =
      m.role === "user" && m.attachments
        ? m.attachments.filter((a) => a.type === "image")
        : [];
    if (m.role === "user" && imageAtt.length > 0) {
      const blocks: ContentBlock[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const att of imageAtt) {
        if (att.type === "image") {
          // Anthropic aceita base64 inline OU URL externa
          const isDataUrl = att.dataUrl.startsWith("data:");
          if (isDataUrl) {
            // data:image/png;base64,XXXX → media_type + data separados
            const match = /^data:([^;]+);base64,(.+)$/.exec(att.dataUrl);
            if (match) {
              blocks.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: match[1],
                  data: match[2],
                },
              });
            }
          } else {
            blocks.push({
              type: "image",
              source: { type: "url", url: att.dataUrl },
            });
          }
        }
      }
      converted.push({ role: "user", content: blocks });
      continue;
    }

    // Assistant text-only
    converted.push({
      role: m.role as "user" | "assistant",
      content: m.content,
    });
  }

  // Anthropic exige alternância ESTRITA user/assistant. Juntamos msgs
  // consecutivas do MESMO role num content[] só. Cobre dois casos:
  //   - user: tool_results consecutivos (expansão do agentSteps)
  //   - assistant: múltiplos turns do agent (ao reabrir um chat de agente
  //     multi-turn, cada turn vira um ai-response → assistant consecutivos).
  //     OpenAI-compat tolera, Anthropic não — sem o merge, dá 400. v0.1.162
  // toBlocks dropa texto vazio (assistant com toolCalls tem content:"" → não
  // vira um text-block vazio, que o Anthropic rejeita).
  const toBlocks = (c: string | ContentBlock[]): ContentBlock[] =>
    Array.isArray(c) ? c : c ? [{ type: "text" as const, text: c }] : [];

  const merged: AnthropicMessage[] = [];
  for (const m of converted) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) {
      last.content = [...toBlocks(last.content), ...toBlocks(m.content)];
    } else {
      merged.push({ ...m });
    }
  }

  return { system, messages: merged };
}

function buildBody(req: ProviderRequest, stream: boolean): AnthropicBody {
  const { system, messages } = toAnthropicPayload(req.messages);

  const body: AnthropicBody = {
    model: req.model,
    max_tokens: resolveMaxTokens("anthropic", req.model, req.maxTokens ?? 2000),
    messages,
    stream,
  };
  if (system) body.system = system;
  // Claude usa range 0..1 (paramPolicy clampa) — não 0..2 como a OpenAI.
  const temp = resolveTemperature("anthropic", req.model, req.temperature);
  if (temp !== undefined) body.temperature = temp;
  if (req.tools && req.tools.length > 0) {
    body.tools = req.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
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
  supportsTools = true;

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

    ensureOkRequest(res, { label: "Anthropic" });

    // Anthropic devolve content como array de blocks tipados (text + tool_use)
    const content = res.json?.content;
    if (!Array.isArray(content)) {
      throw new ProviderError("Resposta vazia da Anthropic.", "unknown");
    }

    let text = "";
    const toolCalls: ProviderToolCall[] = [];
    for (const block of content) {
      if (block.type === "text" && typeof block.text === "string") {
        text += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: (block.input as Record<string, unknown>) ?? {},
        });
      }
    }

    if (!text && toolCalls.length === 0) {
      throw new ProviderError(
        "Resposta vazia da Anthropic (sem texto nem tool_use).",
        "unknown"
      );
    }

    const result: ProviderResponse = { content: text };
    if (toolCalls.length > 0) result.toolCalls = toolCalls;

    // Usage tokens
    const usage = res.json?.usage;
    if (usage) {
      result.usage = {
        input: usage.input_tokens ?? 0,
        output: usage.output_tokens ?? 0,
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

    await ensureOkStream(res, { label: "Anthropic" });
    if (!res.body) {
      throw new ProviderError("Stream vazio da Anthropic.", "unknown");
    }

    // Parser SSE — Anthropic envia events tipados.
    // Nos interessam:
    //   content_block_start (text ou tool_use), content_block_delta (text_delta
    //   ou input_json_delta), content_block_stop, message_stop, error.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let accumulatedText = "";
    // Tool use accumulator por content_block_index
    const toolUseAccum: Record<number, { id: string; name: string; jsonBuf: string }> = {};

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
          if (json.type === "content_block_start") {
            const block = json.content_block;
            if (block?.type === "tool_use") {
              toolUseAccum[json.index] = {
                id: block.id ?? "",
                name: block.name ?? "",
                jsonBuf: "",
              };
            }
          } else if (json.type === "content_block_delta") {
            if (json.delta?.type === "text_delta") {
              const token = json.delta.text;
              if (typeof token === "string" && token.length > 0) {
                accumulatedText += token;
                onToken(token);
              }
            } else if (json.delta?.type === "input_json_delta") {
              const idx = json.index;
              if (toolUseAccum[idx]) {
                toolUseAccum[idx].jsonBuf += json.delta.partial_json ?? "";
              }
            }
          } else if (json.type === "message_start") {
            inputTokens = json.message?.usage?.input_tokens ?? 0;
          } else if (json.type === "message_delta") {
            outputTokens = json.usage?.output_tokens ?? outputTokens;
          } else if (json.type === "message_stop") {
            if (onUsage) onUsage({ input: inputTokens, output: outputTokens });
            return buildAnthropicStreamResponse(
              accumulatedText,
              toolUseAccum,
              inputTokens,
              outputTokens
            );
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
    return buildAnthropicStreamResponse(
      accumulatedText,
      toolUseAccum,
      inputTokens,
      outputTokens
    );
  }

  /** Monta ProviderResponse do stream — text + tool_use blocks parseados. */

  /** Lista curada — fallback quando não há key ou o fetch falha. Manter em
   *  sincronia com os 5 arquivos de metadata (caps/pricing/cards/ctx). */
  private curatedModels(): string[] {
    return [
      "claude-fable-5",
      "claude-opus-4-8",
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
    ];
  }

  async listModels(apiKey: string): Promise<string[]> {
    // Com key, busca o catálogo VIVO da Anthropic (GET /v1/models) — assim a
    // lista nunca fica presa nos hardcoded. Sem key / em erro, cai na curada.
    if (!apiKey || !apiKey.trim()) return this.curatedModels();
    try {
      const res = await requestUrl({
        url: "https://api.anthropic.com/v1/models?limit=100",
        method: "GET",
        headers: {
          "x-api-key": apiKey.trim(),
          "anthropic-version": ANTHROPIC_VERSION,
          "anthropic-dangerous-direct-browser-access": "true",
        },
        throw: false,
      });
      if (res.status < 200 || res.status >= 300) return this.curatedModels();
      const ids: string[] = (res.json?.data ?? [])
        .map((m: { id?: string }) => m.id)
        .filter((id: unknown): id is string => typeof id === "string");
      // Une com a curada (garante Fable/4.x mesmo se a API atrasar) + dedup.
      const merged = Array.from(new Set([...ids, ...this.curatedModels()]));
      return merged.length > 0 ? merged : this.curatedModels();
    } catch {
      return this.curatedModels();
    }
  }
}

/**
 * Helper compartilhado pra montar ProviderResponse após o stream Anthropic terminar.
 * Parseia input_json_delta acumulado em cada tool_use block.
 */
function buildAnthropicStreamResponse(
  text: string,
  toolUseAccum: Record<number, { id: string; name: string; jsonBuf: string }>,
  inputTokens: number,
  outputTokens: number
): ProviderResponse {
  const indices = Object.keys(toolUseAccum)
    .map((k) => Number(k))
    .sort((a, b) => a - b);
  const toolCalls: ProviderToolCall[] = [];
  for (const i of indices) {
    const acc = toolUseAccum[i];
    if (!acc.name) continue;
    let parsedArgs: Record<string, unknown> = {};
    try {
      // input_json_delta às vezes vem vazio quando o input é {} — buf vazio = {}
      parsedArgs = acc.jsonBuf ? JSON.parse(acc.jsonBuf) : {};
    } catch {
      parsedArgs = { _raw: acc.jsonBuf };
    }
    toolCalls.push({
      id: acc.id || `anthropic_call_${Date.now()}_${i}`,
      name: acc.name,
      arguments: parsedArgs,
    });
  }
  const result: ProviderResponse = { content: text };
  if (toolCalls.length > 0) result.toolCalls = toolCalls;
  if (inputTokens > 0 || outputTokens > 0) {
    result.usage = { input: inputTokens, output: outputTokens };
  }
  return result;
}

export const anthropicProvider = new AnthropicProvider();
