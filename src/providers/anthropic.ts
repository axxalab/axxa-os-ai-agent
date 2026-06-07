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
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

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
}

/**
 * Converte ProviderMessage[] pro formato wire-level do Anthropic.
 * - system → extraído em campo separado
 * - role "tool" → vira role "user" com content array contendo tool_result block
 * - role "assistant" com toolCalls → content array com text + tool_use blocks
 * - tool_results consecutivos viram 1 user msg com content[] mergeado
 *   (Anthropic exige alternância user/assistant)
 */
function toAnthropicPayload(messages: ProviderMessage[]): {
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

    // User normal ou assistant text-only
    converted.push({
      role: m.role as "user" | "assistant",
      content: m.content,
    });
  }

  // Merge user msgs consecutivos (Anthropic exige roles alternados)
  const merged: AnthropicMessage[] = [];
  for (const m of converted) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role && m.role === "user") {
      // Garante que ambos viram arrays pra mergear
      const lastArr = Array.isArray(last.content)
        ? last.content
        : [{ type: "text" as const, text: last.content }];
      const curArr = Array.isArray(m.content)
        ? m.content
        : [{ type: "text" as const, text: m.content }];
      last.content = [...lastArr, ...curArr];
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
    max_tokens: req.maxTokens ?? 2000,
    messages,
    stream,
  };
  if (system) body.system = system;
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
