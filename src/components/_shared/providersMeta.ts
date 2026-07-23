// src/components/_shared/providersMeta.ts
// Metadados de UI dos providers (nome + logo) e o check de "configurado".
// Extraído da StarterScreen (removida na limpeza pós-ds-1.0) — a NewChatScreen
// e futuros consumidores importam daqui.

import type AxxaPlugin from "../../main";

export const PROVIDERS = [
  { id: "openai", name: "OpenAI", icon: "logo-openai" },
  { id: "anthropic", name: "Anthropic", icon: "logo-anthropic" },
  { id: "gemini", name: "Gemini", icon: "logo-gemini" },
  { id: "openrouter", name: "OpenRouter", icon: "logo-openrouter" },
  { id: "nim", name: "Nvidia NIM", icon: "logo-nvidia" },
  { id: "ollama", name: "Ollama", icon: "logo-ollama" },
];

/** Provider tem credencial configurada? (ollama não tem key — checa endpoint) */
export function providerConfigured(plugin: AxxaPlugin, id: string): boolean {
  const s = plugin.settings;
  switch (id) {
    case "anthropic": return !!s.anthropicApiKey?.trim();
    case "gemini": return !!s.geminiApiKey?.trim();
    case "openrouter": return !!s.openrouterApiKey?.trim();
    case "nim": return !!s.nimApiKey?.trim();
    case "ollama": return !!s.ollamaEndpoint?.trim();
    default: return !!s.openaiApiKey?.trim();
  }
}
