// src/providers/index.ts
// Registry de todos os providers disponíveis.
// AxxaApp usa getProvider(settings.defaultProvider) pra escolher o provider ativo.

import type { Provider } from "./base";
import { openaiProvider } from "./openai";
import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import { openrouterProvider } from "./openrouter";
import { nimProvider } from "./nim";
import { ollamaProvider } from "./ollama";

export const providers: Record<string, Provider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  openrouter: openrouterProvider,
  nim: nimProvider,
  ollama: ollamaProvider,
};

export const providerIds = Object.keys(providers) as Array<keyof typeof providers>;

/**
 * Retorna o provider pelo id. Se o id for desconhecido (ex: settings corrompida),
 * cai pro OpenAI como default seguro.
 */
export function getProvider(id: string): Provider {
  return providers[id] ?? openaiProvider;
}

export {
  openaiProvider,
  anthropicProvider,
  geminiProvider,
  openrouterProvider,
  nimProvider,
  ollamaProvider,
};
