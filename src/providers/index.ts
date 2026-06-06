// src/providers/index.ts
// Registry de todos os providers disponíveis.
// AxxaApp usa getProvider(settings.defaultProvider) pra escolher o provider ativo.
// Quando adicionarmos OpenRouter e Ollama, é só registrar aqui.

import type { Provider } from "./base";
import { openaiProvider } from "./openai";
import { anthropicProvider } from "./anthropic";

export const providers: Record<string, Provider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
};

export const providerIds = Object.keys(providers) as Array<keyof typeof providers>;

/**
 * Retorna o provider pelo id. Se o id for desconhecido (ex: settings corrompida),
 * cai pro OpenAI como default seguro.
 */
export function getProvider(id: string): Provider {
  return providers[id] ?? openaiProvider;
}

export { openaiProvider, anthropicProvider };
