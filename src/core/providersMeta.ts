// src/components/_shared/providersMeta.ts
// Metadados de UI dos providers (nome + logo) e o check de "configurado".
// Extraído da StarterScreen (removida na limpeza pós-ds-1.0) — a NewChatScreen
// e futuros consumidores importam daqui.

import type AxxaPlugin from "../main";

export const PROVIDERS = [
  { id: "openai", name: "OpenAI", icon: "logo-openai" },
  { id: "anthropic", name: "Anthropic", icon: "logo-anthropic" },
  { id: "gemini", name: "Gemini", icon: "logo-gemini" },
  { id: "openrouter", name: "OpenRouter", icon: "logo-openrouter" },
  { id: "nim", name: "Nvidia NIM", icon: "logo-nvidia" },
  { id: "ollama", name: "Ollama", icon: "logo-ollama" },
];

/**
 * Saúde do provider — o que o bolinha mostra em todo trilho:
 *   off      sem credencial. Não dá pra usar, ponto.
 *   fail     a credencial foi testada e o provider recusou.
 *   ok       testada e respondeu.
 *   unknown  tem credencial, nunca testou nesta instalação.
 * "unknown" é utilizável de propósito: obrigar um teste antes do primeiro uso
 * seria uma catraca, e a chave recém-colada quase sempre está certa.
 */
export type ProviderHealth = "off" | "unknown" | "ok" | "fail";

export function providerHealth(
  plugin: AxxaPlugin,
  id: string
): ProviderHealth {
  if (!providerConfigured(plugin, id)) return "off";
  const st = plugin.settings.providerStatus?.[id];
  if (!st) return "unknown";
  return st.ok ? "ok" : "fail";
}

/** Dá pra escolher este provider no chat? Só o que sabidamente não funciona
 *  fica de fora — sem credencial, ou reprovado no último teste. */
export function providerUsable(plugin: AxxaPlugin, id: string): boolean {
  const h = providerHealth(plugin, id);
  return h === "ok" || h === "unknown";
}

/** Por que este provider está bloqueado — vai no title do item desabilitado. */
export function providerBlockedReason(
  plugin: AxxaPlugin,
  id: string
): string | null {
  switch (providerHealth(plugin, id)) {
    case "off":
      return "No credential yet — add one in Settings › Providers.";
    case "fail":
      return "Last connection test failed — check the key in Settings › Providers.";
    default:
      return null;
  }
}

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
