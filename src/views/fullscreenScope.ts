// src/views/fullscreenScope.ts
// Regras PURAS de escopo do fullscreen mobile (v0.1.250). Ficam fora do
// AxxaView de propósito: são a decisão de "onde o modo vale" e de "quando a
// navbar global some" — as duas coisas que, erradas, deixam o Obsidian sem
// chrome. Puras = testáveis sem DOM nem árvore React.

/**
 * O drawer que hospeda a AXXA é o DIREITO? O Obsidian marca as gavetas com
 * `mod-right`/`mod-left`. Se nenhuma das duas existir (versão que renomeou as
 * classes), NÃO travamos o modo — a AXXA só é montada no drawer direito —, mas
 * um `mod-left` explícito é sempre um "não".
 */
export function isRightDrawer(drawer: Element | null): boolean {
  if (!drawer) return false;
  if (drawer.classList.contains("mod-left")) return false;
  return true;
}

/** Retângulo mínimo (subset do DOMRect) pra decidir visibilidade do drawer. */
export interface DrawerRect {
  width: number;
  height: number;
  left: number;
  right: number;
}

/**
 * O retângulo do drawer ocupa a tela? Metade da largura dentro da viewport
 * conta como "aberto"; no meio da animação de sair, já não conta.
 *
 * Pergunta geométrica de propósito: nome de classe de ESTADO do drawer muda
 * entre versões do Obsidian, "o retângulo intersecta a viewport" não.
 */
export function isDrawerOnScreen(
  r: DrawerRect,
  viewportWidth: number
): boolean {
  if (r.width <= 0 || r.height <= 0) return false;
  const visibleWidth = Math.min(r.right, viewportWidth) - Math.max(r.left, 0);
  return visibleWidth >= r.width / 2;
}
