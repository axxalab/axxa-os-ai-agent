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
  ReasoningHandler,
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
    const DEFAULT = "http://localhost:11434";
    const url = (apiKey || DEFAULT).trim().replace(/\/$/, "");
    // v0.1.228: valida o endpoint configurado — URL malformada ou esquema
    // não-HTTP cai pro default localhost em vez de produzir erros confusos.
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        console.warn(`[Ollama] Endpoint com esquema inválido (${parsed.protocol}), usando ${DEFAULT}.`);
        return DEFAULT;
      }
    } catch {
      console.warn(`[Ollama] Endpoint inválido ("${url}"), usando ${DEFAULT}.`);
      return DEFAULT;
    }
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
      toolCalls = message.tool_calls
        .map(
          (tc: { id?: string; function?: { name?: string; arguments?: unknown } }, idx: number) => {
            // v0.1.228: sem name não há tool call válido — descarta (espelha o
            // `if (!acc.name) continue` do finalizeOpenAIResponse).
            const fn = tc.function;
            if (!fn?.name) return null;
            const raw = fn.arguments;
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
              name: fn.name,
              arguments: parsedArgs,
            };
          }
        )
        .filter((tc: ProviderToolCall | null): tc is ProviderToolCall => tc !== null);
      if (toolCalls && toolCalls.length === 0) toolCalls = undefined;
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
    signal?: AbortSignal,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _onReasoning?: ReasoningHandler
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
    // v0.1.228: Ollama emite o bloco INTEIRO de tool_calls (não deltas) e pode
    // reenviar o array em mais de uma linha — guardamos só o último recebido em
    // vez de concatenar, evitando tool calls duplicados.
    let lastToolCalls: ProviderToolCall[] = [];

    // v0.1.228: try/finally garante liberar o reader em erro/abort (o read()
    // já rejeita com AbortError quando o signal aborta, via fetch).
    try {
      while (true) {
        // v0.1.228: aborta cedo se o signal já disparou (read() também rejeita,
        // mas isto encurta o ciclo entre chunks).
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let json: { message?: { content?: unknown; tool_calls?: unknown }; done?: boolean; error?: unknown; prompt_eval_count?: number; eval_count?: number };
          try {
            json = JSON.parse(trimmed);
          } catch {
            // v0.1.228: linha provavelmente truncada — o buffer já guarda o
            // resto (último split vira o novo buffer), então ignoramos.
            continue;
          }
          // v0.1.228: Ollama sinaliza erros de runtime com um campo `error` na
          // própria linha do stream — propaga em vez de engolir silenciosamente.
          if (typeof json.error === "string" && json.error) {
            throw new ProviderError(`Ollama: ${json.error}`, "unknown");
          }
          const message = json?.message;
          const token = message?.content;
          if (typeof token === "string" && token.length > 0) {
            accumulatedText += token;
            onToken(token);
          }
          // Ollama emite tool_calls inteiros (não em deltas) — geralmente
          // numa linha só, próximo do final do stream. Se reenviar, o array
          // novo SUBSTITUI o anterior (não acumula).
          if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
            const parsed = message.tool_calls
              .map(
                (tc: { id?: string; function?: { name?: string; arguments?: unknown } }, idx: number) => {
                  // v0.1.228: sem name não há tool call válido — descarta.
                  const fn = tc.function;
                  if (!fn?.name) return null;
                  const raw = fn.arguments;
                  let parsedArgs: Record<string, unknown> = {};
                  if (raw && typeof raw === "object") {
                    parsedArgs = raw as Record<string, unknown>;
                  } else if (typeof raw === "string") {
                    try { parsedArgs = JSON.parse(raw); } catch { parsedArgs = { _raw: raw }; }
                  }
                  return {
                    id: tc.id ?? `ollama_call_${Date.now()}_${idx}`,
                    name: fn.name,
                    arguments: parsedArgs,
                  };
                }
              )
              .filter((tc: ProviderToolCall | null): tc is ProviderToolCall => tc !== null);
            if (parsed.length > 0) lastToolCalls = parsed;
          }
          if (json?.done === true) {
            usage = {
              input: json.prompt_eval_count ?? 0,
              output: json.eval_count ?? 0,
            };
            if (onUsage) onUsage(usage);
            const result: ProviderResponse = { content: accumulatedText };
            if (lastToolCalls.length > 0) result.toolCalls = lastToolCalls;
            if (usage) result.usage = usage;
            return result;
          }
        }
      }
    } finally {
      try { reader.releaseLock(); } catch { /* já liberado */ }
    }
    const result: ProviderResponse = { content: accumulatedText };
    if (lastToolCalls.length > 0) result.toolCalls = lastToolCalls;
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
