// src/ui/notePicker.ts
// Achar uma nota do vault pra anexar à conversa — pelo `+` do composer ou
// digitando `[[`.
//
// A ordem importa mais do que parece num vault grande: quem digita "fram"
// quer FRAMEWORKS.md, não "Notas/2024/framing-de-produto/rascunho.md" só
// porque apareceu primeiro na lista do vault. Por isso o ranking é por onde o
// texto casou (nome exato > começo do nome > dentro do nome > caminho) e,
// empatando, pela nota mexida mais recentemente.

import type { App } from "obsidian";

export interface NoteLike {
  path: string;
  basename: string;
  /** Última modificação (ms). Desempata o ranking. */
  mtime: number;
}

/** Quanto pior, mais alto. Ordena crescente. */
function posicao(nota: NoteLike, busca: string): number {
  const nome = nota.basename.toLowerCase();
  const caminho = nota.path.toLowerCase();
  if (nome === busca) return 0;
  if (nome.startsWith(busca)) return 1;
  if (nome.includes(busca)) return 2;
  if (caminho.includes(busca)) return 3;
  return 4;
}

/** Ordena e corta a lista de notas pra uma busca. Busca vazia = mais recentes. */
export function rankNotes(
  notas: readonly NoteLike[],
  busca: string,
  limite = 30
): NoteLike[] {
  const q = busca.trim().toLowerCase();
  const candidatas = q
    ? notas.filter((n) => posicao(n, q) < 4)
    : notas.slice();
  candidatas.sort((a, b) => {
    if (q) {
      const d = posicao(a, q) - posicao(b, q);
      if (d !== 0) return d;
    }
    return b.mtime - a.mtime;
  });
  return candidatas.slice(0, limite);
}

/** As notas do vault no formato do ranking. */
export function vaultNotes(app: App): NoteLike[] {
  return app.vault.getMarkdownFiles().map((f) => ({
    path: f.path,
    basename: f.basename,
    mtime: f.stat?.mtime ?? 0,
  }));
}

/** Lê a nota pra virar anexo. Devolve null se sumiu no meio do caminho. */
export async function readNote(
  app: App,
  path: string
): Promise<{ path: string; content: string } | null> {
  const file = app.vault.getAbstractFileByPath(path);
  // `instanceof TFile` não vale aqui: o que importa é dar pra ler.
  if (!file || !("stat" in file)) return null;
  try {
    const content = await app.vault.cachedRead(file as never);
    return { path, content };
  } catch {
    return null;
  }
}

/** O `[[` aberto ANTES do cursor, se houver — devolve a busca já digitada.
 *  Fecha (devolve null) se o link já foi fechado com `]]` ou se quebrou linha,
 *  que é quando a pessoa claramente desistiu. */
export function wikilinkQuery(
  texto: string,
  cursor: number
): { start: number; query: string } | null {
  const antes = texto.slice(0, cursor);
  const abre = antes.lastIndexOf("[[");
  if (abre === -1) return null;
  const meio = antes.slice(abre + 2);
  if (meio.includes("]]") || meio.includes("\n")) return null;
  // Um `[[` esquecido lá atrás não pode manter a lista aberta pelo resto do
  // texto: acima disso ninguém está mais buscando nota.
  if (meio.length > 80) return null;
  return { start: abre, query: meio };
}
