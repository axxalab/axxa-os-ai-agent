// src/providers/ollama.ts
// Provider Ollama — LLMs locais via servidor HTTP.
// Endpoint default: http://localhost:11434 (configurável em settings.ollamaEndpoint)
// Sem auth (local).
//
// Diferenças do OpenAI:
//   - Body: { model, messages, stream, tools?, options? }
//   - Resposta streaming: JSON delimitado por NEWLINE (não SSE com "data:")
//   - Cada linha: {"message": {"role":"assistant","content":"..."}, "done":false}
//   - Última linha: {"done":true, "prompt_eval_count":..., "eval_count":...}
//
// Tool calling (v0.1.33):
//   - Body envia `tools[]` mesmo formato OpenAI (sem `tool_choice` — Ollama ignora)
//   - Resposta: `message.tool_calls[]` no formato `{function: {name, arguments}}`
//   - Pegadinha: `arguments` no Ollama vem como OBJETO (não JSON string como OpenAI)
//   - Pegadinha: tool_calls do Ollama frequentemente vêm SEM `id` — geramos um
//   - Modelos com tool calling: llama3.1, llama3.2, qwen2.5, mistral-large, etc.
//   - Modelos antigos / pequenos ignoram silenciosamente o campo `tools`
//
// Como a key não é necessária, passamos vazia mesmo.

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
import { resolveTemperature, resolveMaxTokens } from "./paramPolicy";
import {
  toOpenAIMessages,
  ensureOkRequest,
  ensureOkStream,
} from "./_shared";

export class OllamaProvider implements Provider {
  id = "ollama";
  name = "Ollama";
  // Ollama ≥0.3 suporta tool calling em modelos compatíveis (llama3.1+,
  // qwen2.5+, mistral-large, etc). Modelos antigos ignoram silenciosamente.
  // O usuário precisa escolher um modelo que tenha tools no card do Ollama.
  supportsTools = true;

  /** Endpoint base que vem das settings (apiKey no nosso modelo, mas é URL). */
  private getEndpoint(apiKey: string): string {
    // No nosso modelo, apiKey carrega o endpoint do Ollama (settings.ollamaEndpoint)
    const url = (apiKey || "http://localhost:11434").trim().replace(/\/$/, "");
    return url;
  }

  async chat(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    const endpoint = this.getEndpoint(apiKey);

    // Body com OpenAI-compat messages — reusa o converter pra normalizar
    // assistant.tool_calls e tool results.
    const body: Record<string, unknown> = {
      model: req.model,
      messages: toOpenAIMessages(req.messages),
      stream: false,
      options: {
        num_predict: resolveMaxTokens("ollama", req.model, req.maxTokens ?? 2000),
        ...(() => {
          const t = resolveTemperature("ollama", req.model, req.temperature);
          return t !== undefined ? { temperature: t } : {};
        })(),
      },
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
      // Ollama NÃO usa tool_choice — qualquer valor é ignorado, então omitimos.
    }

    let res;
    try {
      res = await requestUrl({
        url: `${endpoint}/api/chat`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify(body),
        throw: false,
      });
    } catch (err) {
      throw new ProviderError(
        `Falha de conexão com Ollama em ${endpoint}. Confirme se o servidor está rodando.`,
        "network"
      );
    }

    ensureOkRequest(res, { label: "Ollama" });

    const message = res.json?.message;
    if (!message) {
      throw new ProviderError("Resposta vazia do Ollama.", "unknown");
    }

    // Parseia tool_calls — formato Ollama:
    //   { function: { name: string, arguments: object | string } }
    // Sem `id` na maioria dos casos — geramos um pra fechar o loop.
    let toolCalls: ProviderToolCall[] | undefined;
    if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      toolCalls = message.tool_calls.map(
        (tc: { id?: string; function: { name: string; arguments: unknown } }, idx: number) => {
          const raw = tc.function?.arguments;
          let parsedArgs: Record<string, unknown> = {};
          if (raw && typeof raw === "object") {
            // Ollama path: já vem como objeto
            parsedArgs = raw as Record<string, unknown>;
          } else if (typeof raw === "string") {
            // Compat path: alguns modelos via Ollama devolvem string JSON
            try {
              parsedArgs = JSON.parse(raw);
            } catch {
              parsedArgs = { _raw: raw };
            }
          }
          return {
            id: tc.id ?? `ollama_call_${Date.now()}_${idx}`,
            name: tc.function.name,
            arguments: parsedArgs,
          };
        }
      );
    }

    const content = typeof message.content === "string" ? message.content : "";
    if (!toolCalls && !content) {
      throw new ProviderError(
        "Resposta vazia do Ollama (sem texto nem tool_calls).",
        "unknown"
      );
    }

    const result: ProviderResponse = { content };
    if (toolCalls) result.toolCalls = toolCalls;
    // Usage tokens (vem no response não-streaming também)
    if (res.json?.prompt_eval_count !== undefined || res.json?.eval_count !== undefined) {
      result.usage = {
        input: res.json.prompt_eval_count ?? 0,
        output: res.json.eval_count ?? 0,
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
    const endpoint = this.getEndpoint(apiKey);

    const body: Record<string, unknown> = {
      model: req.model,
      messages: toOpenAIMessages(req.messages),
      stream: true,
      options: {
        num_predict: resolveMaxTokens("ollama", req.model, req.maxTokens ?? 2000),
        ...(() => {
          const t = resolveTemperature("ollama", req.model, req.temperature);
          return t !== undefined ? { temperature: t } : {};
        })(),
      },
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
    }

    let res: Response;
    try {
      res = await fetch(`${endpoint}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new ProviderError(
        `Falha de conexão com Ollama em ${endpoint}. Servidor rodando?`,
        "network"
      );
    }

    await ensureOkStream(res, { label: "Ollama" });
    if (!res.body) {
      throw new ProviderError("Stream vazio do Ollama.", "unknown");
    }

    // Parser NDJSON — cada linha é um JSON completo (não SSE)
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulatedText = "";
    let usage: { input: number; output: number } | undefined;
    const accumulatedToolCalls: ProviderToolCall[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed);
          const message = json?.message;
          const token = message?.content;
          if (typeof token === "string" && token.length > 0) {
            accumulatedText += token;
            onToken(token);
          }
          // Ollama emite tool_calls inteiros (não em deltas) — geralmente
          // numa linha só, próximo do final do stream.
          if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
            message.tool_calls.forEach(
              (tc: { id?: string; function: { name: string; arguments: unknown } }, idx: number) => {
                const raw = tc.function?.arguments;
                let parsedArgs: Record<string, unknown> = {};
                if (raw && typeof raw === "object") {
                  parsedArgs = raw as Record<string, unknown>;
                } else if (typeof raw === "string") {
                  try { parsedArgs = JSON.parse(raw); } catch { parsedArgs = { _raw: raw }; }
                }
                accumulatedToolCalls.push({
                  id: tc.id ?? `ollama_call_${Date.now()}_${accumulatedToolCalls.length + idx}`,
                  name: tc.function.name,
                  arguments: parsedArgs,
                });
              }
            );
          }
          if (json?.done === true) {
            usage = {
              input: json.prompt_eval_count ?? 0,
              output: json.eval_count ?? 0,
            };
            if (onUsage) onUsage(usage);
            const result: ProviderResponse = { content: accumulatedText };
            if (accumulatedToolCalls.length > 0) result.toolCalls = accumulatedToolCalls;
            if (usage) result.usage = usage;
            return result;
          }
        } catch {
          /* skip JSON inválido */
        }
      }
    }
    const result: ProviderResponse = { content: accumulatedText };
    if (accumulatedToolCalls.length > 0) result.toolCalls = accumulatedToolCalls;
    if (usage) result.usage = usage;
    return result;
  }

  /** Lista modelos instalados localmente via /api/tags */
  async listModels(apiKey: string): Promise<string[]> {
    const endpoint = this.getEndpoint(apiKey);
    let res;
    try {
      res = await requestUrl({
        url: `${endpoint}/api/tags`,
        method: "GET",
        throw: false,
      });
    } catch {
      throw new ProviderError(
        `Falha de conexão com Ollama em ${endpoint}.`,
        "network"
      );
    }
    if (res.status < 200 || res.status >= 300) {
      throw new ProviderError(`Ollama: HTTP ${res.status}`, "unknown");
    }
    const models: { name: string }[] = res.json?.models ?? [];
    return models.map((m) => m.name).sort();
  }
}

export const ollamaProvider = new OllamaProvider();
