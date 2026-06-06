// src/providers/openai.ts
// Provider OpenAI — chamada não-streaming à /v1/chat/completions.
// Usa requestUrl do Obsidian (não fetch) pra evitar problemas de CORS
// — Obsidian roteia via Electron net no desktop e nativo HTTP no mobile.

import { requestUrl } from "obsidian";
import { Provider, ProviderError, ProviderRequest, ProviderResponse } from "./base";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

export class OpenAIProvider implements Provider {
  id = "openai";
  name = "OpenAI";

  async chat(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    if (!apiKey || !apiKey.trim()) {
      throw new ProviderError(
        "API key da OpenAI não configurada. Vá em Settings → AXXA OS para colar sua chave.",
        "no-key"
      );
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
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          max_tokens: req.maxTokens ?? 2000,
        }),
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

    const content = res.json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.length) {
      throw new ProviderError("Resposta vazia da OpenAI.", "unknown");
    }

    return { content };
  }
}

export const openaiProvider = new OpenAIProvider();
