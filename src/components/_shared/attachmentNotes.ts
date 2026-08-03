// src/components/_shared/attachmentNotes.ts
// Rastro honesto dos anexos que a UI aceita mas o wire ainda NÃO envia ao
// modelo (áudio e PDF). Sem isto o chip some no envio e o usuário fica achando
// que a IA "ouviu"/"leu" o arquivo — o pior tipo de mentira silenciosa.
//
// A linha entra no corpo da mensagem do usuário (e portanto no .md salvo no
// vault), então o registro sobrevive ao reload da conversa. Áudio vira wikilink
// (o arquivo está no vault); PDF é escolhido do dispositivo e não tem caminho
// de vault, então fica só o nome.

/** Anexo pendente, no mínimo que estas notas precisam saber. */
export interface KeptAttachment {
  type: string;
  /** Caminho no vault (só áudio hoje). */
  path?: string;
  /** Nome exibido no chip. */
  name: string;
}

export interface KeptAttachmentLabels {
  /** Ex.: "audio saved in your vault (not sent to the AI yet)". */
  audio: string;
  /** Ex.: "PDF attached locally (not sent to the AI yet)". */
  pdf: string;
}

/**
 * Linhas de citação (blockquote) para os anexos não enviados ao modelo.
 * Devolve [] quando não há nenhum — o chamador não deve alterar o texto nesse caso.
 */
export function keptAttachmentLines(
  attachments: readonly KeptAttachment[],
  labels: KeptAttachmentLabels
): string[] {
  const lines: string[] = [];
  for (const att of attachments) {
    if (att.type === "audio") {
      const link = att.path ? `[[${att.path}|${att.name}]]` : att.name;
      lines.push(`> 🎙 ${link} — ${labels.audio}`);
    } else if (att.type === "pdf") {
      lines.push(`> 📄 ${att.name} — ${labels.pdf}`);
    }
  }
  return lines;
}

/** Junta o texto do usuário com as notas dos anexos não enviados. */
export function withKeptAttachmentNotes(text: string, lines: string[]): string {
  if (lines.length === 0) return text;
  return text ? `${text}\n\n${lines.join("\n")}` : lines.join("\n");
}
