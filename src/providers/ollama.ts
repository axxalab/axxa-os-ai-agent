// src/providers/ollama.ts
// Provider Ollama — LLMs locais via servidor HTTP.
// Endpoint default: http://localhost:11434 (configurável em settings.ollamaEndpoint)
// Sem auth (local).
//
// Diferenças do OpenAI:
//   - Body: { model, messages, stream, options? }
//   - Resposta streaming: JSON delimitado por NEWLINE (não SSE com "data:")
//   - Cada linha: {"message": {"role":"assistant","content":"..."}, "done":false}
//   - Última linha: {"done":true, "prompt_eval_count":..., "eval_count":...}
//
// Como a key não é necessária, passamos vazia mesmo.

import { requestUrl } from "obsidian";
import { Provider, ProviderError, ProviderRequest, ProviderResponse, TokenHandler, UsageHandler } from "./base";

export class OllamaProvider implements Provider {
  id = "ollama";
  name = "Ollama";

  /** Endpoint base que vem das settings (apiKey no nosso modelo, mas é URL). */
  private getEndpoint(apiKey: string): string {
    // No nosso modelo, apiKey carrega o endpoint do Ollama (settings.ollamaEndpoint)
    const url = (apiKey || "http://localhost:11434").trim().replace(/\/$/, "");
    return url;
  }

  async chat(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    const endpoint = this.getEndpoint(apiKey);
    let res;
    try {
      res = await requestUrl({
        url: `${endpoint}/api/chat`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          stream: false,
          options: {
            num_predict: req.maxTokens ?? 2000,
          },
        }),
        throw: false,
      });
    } catch (err) {
      throw new ProviderError(
        `Falha de conexão com Ollama em ${endpoint}. Confirme se o servidor está rodando.`,
        "network"
      );
    }

    if (res.status < 200 || res.status >= 300) {
      throw new ProviderError(`Ollama: HTTP ${res.status}`, "unknown");
    }
    const content = res.json?.message?.content;
    if (typeof content !== "string" || !content.length) {
      throw new ProviderError("Resposta vazia do Ollama.", "unknown");
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
    const endpoint = this.getEndpoint(apiKey);

    let res: Response;
    try {
      res = await fetch(`${endpoint}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          stream: true,
          options: {
            num_predict: req.maxTokens ?? 2000,
          },
        }),
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new ProviderError(
        `Falha de conexão com Ollama em ${endpoint}. Servidor rodando?`,
        "network"
      );
    }

    if (!res.ok) {
      throw new ProviderError(`Ollama: HTTP ${res.status}`, "unknown");
    }
    if (!res.body) {
      throw new ProviderError("Stream vazio do Ollama.", "unknown");
    }

    // Parser NDJSON — cada linha é um JSON completo (não SSE)
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
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed);
          const token = json?.message?.content;
          if (typeof token === "string" && token.length > 0) {
            onToken(token);
          }
          if (json?.done === true) {
            if (onUsage) {
              onUsage({
                input: json.prompt_eval_count ?? 0,
                output: json.eval_count ?? 0,
              });
            }
            return;
          }
        } catch {
          /* skip JSON inválido */
        }
      }
    }
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
