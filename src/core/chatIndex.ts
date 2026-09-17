// src/core/chatIndex.ts
// A ASSINATURA do índice de conversas: "o disco ainda diz a mesma coisa que a
// tela está mostrando?".
//
// O app pinta na hora a partir de um índice gravado e, atrás disso, varre o
// disco pra ver se mudou alguma coisa. A comparação não é campo a campo: é
// esta string. O que ficar de fora dela vira uma diferença INVISÍVEL — a
// varredura acha tudo igual, joga o resultado novo fora, e o que está na tela
// nunca alcança o que está em disco.
//
// Foi exatamente o que aconteceu quando o cartão do Agent ganhou o preview da
// última fala: a assinatura não o mencionava, então um índice gravado por uma
// versão que não tinha o campo continuava "igual" pra sempre.

import type { ChatSummary } from "./chatPersistence";

/** Separador que não aparece em texto digitado (unit separator). */
const SEP = "\x1f";

/**
 * Tudo que a lista MOSTRA entra aqui — e só isso.
 *
 * Campo que aparece num cartão e falta nesta conta não atualiza sozinho; campo
 * que não aparece em lugar nenhum só faz a varredura reescrever o índice à toa.
 */
export function chatIndexSignature(arr: readonly ChatSummary[]): string {
  return (
    arr.length +
    ":" +
    arr
      .map((c) =>
        [
          c.id,
          c.date,
          c.title,
          c.messageCount,
          c.tokensIn,
          c.tokensOut,
          c.model,
          c.toolCount,
          c.starred,
          c.preview,
        ].join(SEP)
      )
      .join("|")
  );
}
