// src/core/vaultPaths.ts
// Onde o app guarda o que ele cria — e o que fica ESCONDIDO do vault.
//
// O Obsidian ignora qualquer pasta que comece com ponto: ela não entra no
// índice, não aparece no explorador, não entra na busca nem no grafo. É
// exatamente o que se quer pro que é dado do app — as conversas estavam
// poluindo a busca de quem só queria achar uma nota.
//
// Mas "invisível pro índice" corta os dois lados, e é por isso que NEM TUDO
// vai junto:
//
//   • conversas e índice do RAG → escondem. Quem lê são o app e o motor, os
//     dois por `adapter`, que enxerga pasta oculta.
//   • skills → NÃO. Skill é uma nota que a PESSOA escreve; escondida, ela não
//     abre no Obsidian pra ser editada.
//   • mídia gerada e relatórios → NÃO. Escondidos, não dá pra `![[embutir]]`
//     nem abrir: o Obsidian não resolve link pra fora do índice.

/** A pasta oculta do app. */
export const AXXA_HIDDEN = ".axxa";

/** Uma pasta que muda de lugar, e de onde ela vinha. */
export interface HiddenMove {
  /** Onde ficava (o default antigo). */
  legado: string;
  /** Onde passa a ficar. */
  novo: string;
}

/**
 * O que migra. Só o que é DADO DO APP: o resto continua visível de propósito
 * (ver o cabeçalho).
 */
export const HIDDEN_MOVES: HiddenMove[] = [
  { legado: "axxa-ai/chats", novo: `${AXXA_HIDDEN}/chats` },
  { legado: "axxa-ai/index", novo: `${AXXA_HIDDEN}/index` },
];

/** Está numa pasta que o Obsidian ignora? */
export function isHiddenPath(path: string): boolean {
  return path.split("/").some((parte) => parte.startsWith("."));
}

/**
 * Esta pasta deve ser movida agora?
 *
 * Três "nãos" que valem mais que o sim:
 *  • o caminho foi MUDADO pela pessoa (não é o default antigo) — mexer nele
 *    seria desfazer uma escolha dela;
 *  • a origem não existe — não há o que mover;
 *  • o destino já existe — a migração já rodou, ou há coisa lá. Mover por
 *    cima podia sobrescrever conversa.
 */
export function shouldMigrate(p: {
  caminhoAtual: string;
  legado: string;
  novo: string;
  origemExiste: boolean;
  destinoExiste: boolean;
}): boolean {
  if (p.caminhoAtual !== p.legado) return false;
  if (!p.origemExiste) return false;
  if (p.destinoExiste) return false;
  return true;
}
