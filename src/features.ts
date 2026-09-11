// src/features.ts
// Fonte ÚNICA da verdade do que está ATIVO no app.
//
// v0.3.0 (branch `final-v2`): TUDO liberado. O recomeço agora é VISUAL — o CSS
// foi zerado (styles/main.css) e a UI roda crua sobre o tema do Obsidian; as
// features voltam todas de uma vez e o visual evolui componente a componente.
// As flags continuam existindo (compile-time, tree-shakeáveis) pra poder
// adormecer algo de novo com um toggle só — o shell, o settings e o onload
// leem daqui. Ver docs/FINAL_V2.md.

export const FEATURES = {
  chat: true,
  conversations: true, // histórico de conversas
  vaultQa: true,
  agent: true,
  imageGen: true,
  voice: true,
  projects: true,
  skills: true,
  rag: true,
  media: true,
  statistics: true,
  usage: true,
  plans: true,
  // Itens do menu ⋮ que ainda NÃO têm handler (clicar não faria nada):
  // "Add to home" — no Claude mobile cria atalho na home do Android; não há
  // equivalente no Obsidian, semântica por definir. "Add to project" — os
  // Projetos funcionam pela tela Projects; o atalho do menu falta ligar.
  // Ficam travados (cadeado) até existirem de verdade.
  homeShortcut: false,
  addToProject: false,
} as const;

export type FeatureKey = keyof typeof FEATURES;

/** A feature está ativa? Consumido pelo shell e pelo settings pra decidir
 *  ativo vs travado. */
export function isEnabled(key: FeatureKey): boolean {
  return FEATURES[key];
}
