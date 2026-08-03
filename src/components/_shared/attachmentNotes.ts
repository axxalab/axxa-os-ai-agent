// src/components/_shared/attachmentNotes.ts
// Rastro honesto dos anexos que a UI aceita mas o wire ainda NÃO envia ao
// modelo (áudio e PDF). Sem isto o chip some no envio e o usuário fica achando
// que a IA "ouviu"/"leu" o arquivo — o pior tipo de mentira silenciosa.
//
// A linha entra no corpo da mensagem do usuário (e portanto no .md salvo no
// vault), então o registro sobrevive ao reload da conversa. Áudio vira wikilink
// (o arquivo está no vault); PDF é escolhido do dispositivo e não tem caminho
// de vault, então fica só o nome.

/**
 * Teto de tamanho do PDF anexado. O limite de request é 32MB no Anthropic e
 * 50MB na OpenAI, e o base64 infla ~33% — 30MB de arquivo original é o maior
 * valor que cabe nos dois com folga pro resto do payload.
 */
export const PDF_MAX_BYTES = 30 * 1024 * 1024;

/**
 * Bytes aproximados de uma data URL base64 (4 chars ≈ 3 bytes, menos o padding).
 * Serve pro guard de tamanho — não precisa ser exato, precisa ser barato.
 */
export function approxBase64Bytes(dataUrl: string | undefined): number {
  if (!dataUrl) return 0;
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

/** Anexo pendente, no mínimo que estas notas precisam saber. */
export interface KeptAttachment {
  type: string;
  /** Caminho no vault (só áudio hoje). */
  path?: string;
  /** Nome exibido no chip. */
  name: string;
  /** O anexo FOI enviado ao modelo neste turno? (PDF, desde 0.1.248) */
  sent?: boolean;
}

export interface KeptAttachmentLabels {
  /** Ex.: "audio saved in your vault (not sent to the AI yet)". */
  audio: string;
  /** Ex.: "PDF attached locally (not sent to the AI yet)". */
  pdf: string;
  /** Ex.: "PDF sent to the model". Usado quando o modelo aceita PDF. */
  pdfSent?: string;
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
      // Enviado: a linha vira RECIBO (o .md guarda o que o modelo viu).
      // Não enviado: continua sendo o aviso honesto.
      const label = att.sent ? labels.pdfSent : labels.pdf;
      lines.push(label ? `> 📄 ${att.name} — ${label}` : `> 📄 ${att.name}`);
    }
  }
  return lines;
}

/** Junta o texto do usuário com as notas dos anexos não enviados. */
export function withKeptAttachmentNotes(text: string, lines: string[]): string {
  if (lines.length === 0) return text;
  return text ? `${text}\n\n${lines.join("\n")}` : lines.join("\n");
}
