// src/ui/pasteAttachment.ts
// Colar um bloco grande no composer.
//
// Colar 5 mil caracteres esticava o campo até o teto e enterrava a conversa —
// e ninguém relê um log de erro dentro de um campo de texto de celular. Acima
// de um limite o conteúdo vira ANEXO: o modelo recebe igual, e a tela continua
// mostrando a conversa.

import type { NoteAttachment } from "../providers/base";

/** Acima disso, colar vira anexo. Abaixo, entra como texto mesmo. */
export const PASTE_LIMIT = 1200;

export function pasteIsBig(texto: string, limite = PASTE_LIMIT): boolean {
  return texto.length > limite;
}

/** "5.2k" / "840" — tamanho legível pro rótulo do chip. */
export function humanSize(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : k.toFixed(1)}k`;
}

/**
 * O texto colado como anexo. Vai como NoteAttachment porque é exatamente isso
 * que o motor já sabe fazer com um bloco de texto: inlina como contexto no
 * prompt. O "caminho" é o rótulo que aparece pro modelo e no chip.
 */
export function pastedNote(texto: string): NoteAttachment {
  return {
    type: "note",
    path: `Pasted text (${humanSize(texto.length)})`,
    content: texto,
  };
}
