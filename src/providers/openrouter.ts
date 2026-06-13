// src/providers/openrouter.ts
// Provider OpenRouter — proxy multi-modelo OpenAI-compatible.
// Endpoint: https://openrouter.ai/api/v1/chat/completions
// Auth: Bearer (igual OpenAI)
// Modelos: prefixados por provider — ex: "anthropic/claude-3.5-sonnet", "openai/gpt-4o"
// Streaming SSE no mesmo formato da OpenAI.
//
// Headers extras opcionais (boa prática do OpenRouter):
//   HTTP-Referer: identifica seu site/app
//   X-Title:      nome legível

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
import { isEmbeddingModelId } from "../rag/types";
import {
  buildChatBody,
  ensureOkStream,
  ensureOkRequest,
  parseOpenAIChatMessage,
  usageFrom,
  parseOpenAICompatSSE,
  streamFallbackToChat,
} from "./_shared";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";

// OpenRouter usa esses headers só pra ATRIBUIÇÃO (aparece no dashboard/ranking
// deles) — não é telemetria nossa. Referer = URL pública real do plugin.
const APP_HEADERS = {
  "HTTP-Referer": "https://github.com/axxalab/axxa-os-ai-agent",
  "X-Title": "AXXA OS - AI Agent",
};

export class OpenRouterProvider implements Provider {
  id = "openrouter";
  name = "OpenRouter";
  // OpenRouter é OpenAI-compatible. Tool calling FUNCIONA pra modelos que
  // suportam (Claude, GPT-4o, Gemini, Llama 3.1+, etc). Modelos antigos
  // ignoram tools silenciosamente — agent vai falhar com erro do LLM.
  supportsTools = true;

  async chat(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError("API key OpenRouter não configurada.", "no-key");
    }

    const body = buildChatBody(req, { provider: "openrouter" });

    let res;
    try {
      res = await requestUrl({
        url: OPENROUTER_ENDPOINT,
        method: "POST",
        contentType: "application/json",
        headers: { Authorization: `Bearer ${apiKey.trim()}`, ...APP_HEADERS },
        body: JSON.stringify(body),
        throw: false,
      });
    } catch {
      throw new ProviderError("Falha de conexão.", "network");
    }
    ensureOkRequest(res, { label: "OpenRouter" });

    const message = res.json?.choices?.[0]?.message;
    if (!message) throw new ProviderError("Resposta vazia.", "unknown");
    const { content, toolCalls, reasoning } = parseOpenAIChatMessage(message);
    if (!toolCalls && !content) {
      throw new ProviderError("Resposta vazia da OpenRouter (sem texto nem tool_calls).", "unknown");
    }
    // v0.1.228: propaga reasoning (DeepSeek R1 & afins expõem reasoning_content
    // em non-stream); antes era descartado aqui.
    return { content, toolCalls, usage: usageFrom(res.json), reasoning };
  }

  async streamChat(
    req: ProviderRequest,
    apiKey: string,
    onToken: TokenHandler,
    onUsage?: UsageHandler,
    signal?: AbortSignal,
    onReasoning?: (delta: string) => void
  ): Promise<ProviderResponse> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError("API key OpenRouter não configurada.", "no-key");
    }

    const body = buildChatBody(req, {
      provider: "openrouter",
      stream: true,
      includeUsage: true,
    });

    let res: Response;
    try {
      res = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
          ...APP_HEADERS,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      // Falha de CONEXÃO do fetch SSE (típico: CORS no WebView mobile) → cai pro
      // chat() via requestUrl (fura CORS) e emite tudo de uma vez. v0.1.232
      return streamFallbackToChat(
        () => this.chat(req, apiKey),
        onToken,
        onUsage,
        onReasoning
      );
    }
    await ensureOkStream(res, { label: "OpenRouter" });
    if (!res.body) throw new ProviderError("Stream vazio.", "unknown");

    return parseOpenAICompatSSE(res.body, onToken, onUsage, "openrouter_call", onReasoning);
  }

  /** Lista modelos modernos do OpenRouter (sem free/auto/etc) */
  async listModels(apiKey: string): Promise<string[]> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError("API key OpenRouter não configurada.", "no-key");
    }
    const res = await requestUrl({
      url: OPENROUTER_MODELS_ENDPOINT,
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        ...APP_HEADERS,
      },
      throw: false,
    });
    if (res.status === 401) {
      throw new ProviderError("API key OpenRouter inválida.", "invalid-key");
    }
    if (res.status < 200 || res.status >= 300) {
      throw new ProviderError(`OpenRouter: HTTP ${res.status}`, "unknown");
    }
    // v0.1.228: guarda contra catálogo malformado — `data` que não é array, ou
    // entradas sem `id` string, fariam o filtro chamar startsWith em undefined.
    const data = Array.isArray(res.json?.data) ? res.json.data : [];
    const all: string[] = data
      .filter((m: unknown): m is { id: string } => typeof (m as { id?: unknown })?.id === "string")
      .map((m: { id: string }) => m.id);
    return all.filter(isRelevantOpenRouterModel).sort();
  }

  /** Modelos de EMBEDDING do catálogo (pro RAG). Mantém os :free (o embedding
   *  multimodal da NVIDIA no OpenRouter é :free). Graceful: [] em erro/no-key. */
  async listEmbeddingModels(apiKey: string): Promise<string[]> {
    if (!apiKey || !apiKey.trim()) return [];
    try {
      const res = await requestUrl({
        url: OPENROUTER_MODELS_ENDPOINT,
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey.trim()}`, ...APP_HEADERS },
        throw: false,
      });
      if (res.status < 200 || res.status >= 300) return [];
      const all: string[] = (res.json?.data ?? []).map((m: { id: string }) => m.id);
      return all.filter(isEmbeddingModelId).sort();
    } catch {
      return [];
    }
  }
}

/**
 * Filtro do catálogo OpenRouter (auditoria v0.1.225).
 * O antigo `!id.includes("auto")` excluía QUALQUER modelo com "auto" no nome
 * (falso-positivo), e `!id.includes(":free")` escondia TODAS as variantes
 * grátis — justamente as do onboarding sem cartão. Agora:
 *   - exclui só os pseudo-modelos do roteador ("openrouter/auto", etc);
 *   - exclui embeddings (vão pro listEmbeddingModels);
 *   - MANTÉM ":free" (capabilities marcam free via overlay).
 */
export function isRelevantOpenRouterModel(id: string): boolean {
  if (id.startsWith("openrouter/")) return false; // auto-router etc
  if (isEmbeddingModelId(id)) return false;
  return true;
}

export const openrouterProvider = new OpenRouterProvider();
