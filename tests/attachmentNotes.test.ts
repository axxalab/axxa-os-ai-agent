import { describe, it, expect } from "vitest";
import {
  keptAttachmentLines,
  withKeptAttachmentNotes,
  approxBase64Bytes,
  PDF_MAX_BYTES,
} from "../src/components/_shared/attachmentNotes";

const LABELS = {
  audio: "audio saved in your vault (not sent to the AI yet)",
  pdf: "PDF attached locally (this model can't read PDFs)",
  pdfSent: "PDF sent to the model",
};

describe("attachmentNotes — rastro honesto dos anexos não enviados", () => {
  it("áudio com path vira wikilink com alias", () => {
    const [line] = keptAttachmentLines(
      [{ type: "audio", path: "Recordings/a.webm", name: "Audio 0:12" }],
      LABELS
    );
    expect(line).toBe(
      `> 🎙 [[Recordings/a.webm|Audio 0:12]] — ${LABELS.audio}`
    );
  });

  it("áudio sem path cai no nome (não gera wikilink quebrado)", () => {
    const [line] = keptAttachmentLines(
      [{ type: "audio", name: "Audio 0:03" }],
      LABELS
    );
    expect(line).toBe(`> 🎙 Audio 0:03 — ${LABELS.audio}`);
    expect(line).not.toContain("[[");
  });

  it("pdf entra pelo nome — não tem caminho de vault", () => {
    const [line] = keptAttachmentLines(
      [{ type: "pdf", name: "contrato.pdf" }],
      LABELS
    );
    expect(line).toBe(`> 📄 contrato.pdf — ${LABELS.pdf}`);
  });

  it("imagem e nota NÃO geram nota (essas de fato chegam ao modelo/contexto)", () => {
    expect(
      keptAttachmentLines(
        [
          { type: "image", name: "foto.png" },
          { type: "note", path: "Notas/x.md", name: "x" },
        ],
        LABELS
      )
    ).toEqual([]);
  });

  it("preserva a ordem dos anexos misturados", () => {
    const lines = keptAttachmentLines(
      [
        { type: "pdf", name: "a.pdf" },
        { type: "image", name: "i.png" },
        { type: "audio", path: "R/b.webm", name: "b" },
      ],
      LABELS
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("a.pdf");
    expect(lines[1]).toContain("b.webm");
  });

  it("áudio TRANSCRITO leva o texto dentro da citação (0.1.249)", () => {
    const [line] = keptAttachmentLines(
      [
        {
          type: "audio",
          path: "R/a.webm",
          name: "Audio 0:12",
          transcript: "comprar pão\ne ligar pro João",
        },
      ],
      { ...LABELS, audioTranscript: "transcript" }
    );
    expect(line).toBe(
      "> 🎙 [[R/a.webm|Audio 0:12]] — transcript:\n> comprar pão\n> e ligar pro João"
    );
    // O aviso de "não enviado" NÃO pode sobrar quando o áudio virou texto.
    expect(line).not.toContain("not sent");
  });

  it("transcript só de espaços cai no aviso honesto (não vira citação vazia)", () => {
    const [line] = keptAttachmentLines(
      [{ type: "audio", path: "R/a.webm", name: "Audio", transcript: "   " }],
      { ...LABELS, audioTranscript: "transcript" }
    );
    expect(line).toBe(`> 🎙 [[R/a.webm|Audio]] — ${LABELS.audio}`);
  });

  it("PDF ENVIADO vira recibo, não aviso (0.1.248)", () => {
    const [line] = keptAttachmentLines(
      [{ type: "pdf", name: "contrato.pdf", sent: true }],
      LABELS
    );
    expect(line).toBe(`> 📄 contrato.pdf — ${LABELS.pdfSent}`);
    expect(line).not.toContain("can't read");
  });

  it("PDF não enviado mantém o aviso honesto", () => {
    const [line] = keptAttachmentLines(
      [{ type: "pdf", name: "contrato.pdf", sent: false }],
      LABELS
    );
    expect(line).toBe(`> 📄 contrato.pdf — ${LABELS.pdf}`);
  });

  it("sem label de enviado, o recibo fica só com o nome (nunca 'undefined')", () => {
    const [line] = keptAttachmentLines(
      [{ type: "pdf", name: "contrato.pdf", sent: true }],
      { audio: LABELS.audio, pdf: LABELS.pdf }
    );
    expect(line).toBe("> 📄 contrato.pdf");
  });

  it("sem anexos rastreáveis o texto passa intacto", () => {
    expect(withKeptAttachmentNotes("oi", [])).toBe("oi");
  });

  it("com anexos, as notas entram depois do texto separadas por linha em branco", () => {
    expect(withKeptAttachmentNotes("oi", ["> 📄 a.pdf — x"])).toBe(
      "oi\n\n> 📄 a.pdf — x"
    );
  });

  it("texto vazio (envio só com anexo) não deixa quebra de linha órfã", () => {
    expect(withKeptAttachmentNotes("", ["> 📄 a.pdf — x"])).toBe(
      "> 📄 a.pdf — x"
    );
  });
});

describe("approxBase64Bytes — guard de tamanho do PDF", () => {
  it("estima o tamanho do arquivo a partir da data URL", () => {
    // "AAAA" = 3 bytes; o header da data URL não entra na conta.
    expect(approxBase64Bytes("data:application/pdf;base64,AAAA")).toBe(3);
    expect(approxBase64Bytes("data:application/pdf;base64,AAAA==")).toBe(2);
  });

  it("string vazia/ausente vale zero (nunca NaN)", () => {
    expect(approxBase64Bytes(undefined)).toBe(0);
    expect(approxBase64Bytes("")).toBe(0);
  });

  it("o teto cabe no limite de request dos providers (32MB Anthropic)", () => {
    expect(PDF_MAX_BYTES).toBeLessThan(32 * 1024 * 1024);
  });

  it("arquivo de 31MB é barrado pelo teto", () => {
    const b64 = "A".repeat(Math.ceil((31 * 1024 * 1024 * 4) / 3));
    expect(approxBase64Bytes(`data:application/pdf;base64,${b64}`)).toBeGreaterThan(
      PDF_MAX_BYTES
    );
  });
});
