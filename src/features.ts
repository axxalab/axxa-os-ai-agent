// src/features.ts
// Fonte ÚNICA da verdade do que está ATIVO no app (branch `final`).
//
// Recomeço: a casca é chat-only. Todo o resto do código continua no repo
// (dormente, tree-shaken do bundle), e o front mostra as opções inativas
// TRAVADAS (não-clicáveis, com cadeado). Reativar uma feature =
//   1. virar a flag aqui pra `true`
//   2. reconectar o wiring dela (onload + casca)
//   3. o settings/nav correspondente destrava sozinho (lê estas flags)
//
// Compile-time (const) de propósito: simples, previsível, tree-shakeável.

export const FEATURES = {
  // Ativos no recomeço
  chat: true,
  conversations: true, // histórico de conversas

  // Dormentes — reativar aos poucos
  vaultQa: false,
  agent: false,
  imageGen: false,
  voice: false,
  projects: false,
  skills: false,
  // Atalho da conversa na "home" (item "Add to home" do menu ⋮). No Claude
  // mobile isso cria atalho na home do ANDROID — não existe equivalente no
  // Obsidian, então a semântica aqui ainda está por definir (pin na tela de
  // nova conversa? bookmark do Obsidian?). Travado até decidir.
  homeShortcut: false,
  rag: false,
  media: false,
  statistics: false,
  usage: false,
  plans: false,
} as const;

export type FeatureKey = keyof typeof FEATURES;

/** A feature está ativa? Consumido pelo shell e pelo settings pra decidir
 *  ativo vs travado. */
export function isEnabled(key: FeatureKey): boolean {
  return FEATURES[key];
}
