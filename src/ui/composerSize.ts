// src/ui/composerSize.ts
// Quanto o campo de texto pode crescer.
//
// A conta antiga era `innerHeight * 0.4`, e ela ignora o teclado: no Obsidian
// mobile `innerHeight` (e o `vh` do CSS) continua sendo a tela INTEIRA quando o
// teclado abre — é exatamente por isso que o nosso CSS desconta
// `--keyboard-height` de `100vh`. Com o teclado aberto sobra pouco mais da
// metade da tela, e 40% do total vira ~2/3 do que dá pra ver: o campo engolia a
// conversa.
//
// Aqui o teto é 40% do que DÁ PRA VER, com dois sinais somados porque nenhum
// deles é confiável sozinho: `--keyboard-height`, que o Obsidian publica no
// <html>, e o visualViewport, que encolhe no WebView.

/** Fração da área visível que o campo pode ocupar. */
const FRACAO = 0.4;

/** Piso: mesmo em tela minúscula o campo tem que caber umas três linhas. */
const MINIMO = 72;

/**
 * Teto de altura do textarea, em px.
 *
 * @param alturaJanela  window.innerHeight (inclui a área do teclado)
 * @param alturaTeclado --keyboard-height publicado pelo Obsidian (0 = fechado)
 * @param alturaViewport visualViewport.height, quando existir
 */
export function composerMaxHeight(
  alturaJanela: number,
  alturaTeclado = 0,
  alturaViewport?: number
): number {
  const candidatos = [alturaJanela - alturaTeclado];
  if (alturaViewport && alturaViewport > 0) candidatos.push(alturaViewport);
  const visivel = Math.min(...candidatos.filter((n) => n > 0));
  // Nenhum sinal utilizável (janela ainda sem layout, teclado maior que a
  // tela): cai pra janela inteira, e o piso segura o resto.
  const base = Number.isFinite(visivel) && visivel > 0 ? visivel : alturaJanela;
  // Arredonda pra BAIXO: teto é teto — 40% não pode virar 40,04%.
  return Math.max(MINIMO, Math.floor(base * FRACAO));
}

/** Lê `--keyboard-height` do <html> (o Obsidian publica inline no mobile). */
export function readKeyboardHeight(doc: Document): number {
  const bruto = doc.documentElement.style.getPropertyValue("--keyboard-height");
  const n = parseFloat(bruto);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
