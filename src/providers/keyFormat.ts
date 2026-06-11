// src/providers/keyFormat.ts
// Reconhece o FORMATO da API key colada — chave de PROJETO (faz chat) vs ADMIN
// key (faz billing/custos, mas NÃO chat). Um campo só nos settings: o plugin
// detecta e propaga pra cada componente que precisa. v0.1.170
//
// Prefixos (jun/2026):
//   OpenAI:    projeto = sk-… (sk-proj-…) · admin = sk-admin-…
//   Anthropic: projeto = sk-ant-… (sk-ant-api…) · admin = sk-ant-admin…
//   OpenRouter: sk-or-…

export type KeyKind = "empty" | "normal" | "admin" | "unknown";

export function detectKeyKind(provider: string, key: string): KeyKind {
  const k = (key || "").trim();
  if (!k) return "empty";
  switch (provider) {
    case "openai":
      if (k.startsWith("sk-admin-")) return "admin";
      if (k.startsWith("sk-")) return "normal";
      return "unknown";
    case "anthropic":
      if (k.startsWith("sk-ant-admin")) return "admin";
      if (k.startsWith("sk-ant-")) return "normal";
      return "unknown";
    case "openrouter":
      return k.startsWith("sk-or-") ? "normal" : "unknown";
    default:
      return "unknown";
  }
}

/** O provider tem distinção projeto/admin? (só OpenAI e Anthropic). */
export function providerHasAdminTier(provider: string): boolean {
  return provider === "openai" || provider === "anthropic";
}
