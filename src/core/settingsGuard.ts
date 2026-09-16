// src/core/settingsGuard.ts
// A decisão que impede uma LEITURA falha de virar uma perda permanente.
//
// `loadData()` do Obsidian devolve null em dois casos que não têm nada a ver
// um com o outro: "primeira instalação" e "o arquivo está lá e não deu pra
// ler" (JSON quebrado, escrita interrompida). Tratar os dois igual é o que
// transforma um erro de leitura num apagamento: o plugin assume os padrões, a
// pessoa mexe em qualquer coisa, o save roda, e o padrão de fábrica cobre
// chaves, modelos, providers e projetos.
//
// As conversas sobrevivem a isso — são .md no vault. As configurações não têm
// de onde voltar.

/**
 * A leitura das settings parece QUEBRADA (e não "ainda não existe")?
 *
 * `tamanhoBruto` é o tamanho do conteúdo do arquivo já aparado: 2 é o `{}` de
 * um arquivo legitimamente vazio, e abaixo disso não há nada a perder.
 */
export function settingsReadLooksBroken(p: {
  /** Quantas chaves o `loadData()` devolveu. */
  chavesLidas: number;
  /** O arquivo existe no disco? */
  arquivoExiste: boolean;
  /** Tamanho do conteúdo cru, aparado. */
  tamanhoBruto: number;
}): boolean {
  if (p.chavesLidas > 0) return false;
  if (!p.arquivoExiste) return false;
  return p.tamanhoBruto > 2;
}
