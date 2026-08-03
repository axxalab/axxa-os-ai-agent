import { describe, it, expect } from "vitest";
import {
  keptAttachmentLines,
  withKeptAttachmentNotes,
} from "../src/components/_shared/attachmentNotes";

const LABELS = {
  audio: "audio saved in your vault (not sent to the AI yet)",
  pdf: "PDF attached locally (not sent to the AI yet)",
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
