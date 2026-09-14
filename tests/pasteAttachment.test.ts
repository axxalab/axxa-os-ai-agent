// tests/pasteAttachment.test.ts
// Colar grande vira anexo. O limite e o rótulo são o que o usuário vê — e o
// rótulo também é o que o modelo lê no prompt.

import { describe, it, expect } from "vitest";
import {
  PASTE_LIMIT,
  pasteIsBig,
  humanSize,
  pastedNote,
} from "../src/ui/pasteAttachment";

describe("pasteIsBig", () => {
  it("parágrafo normal continua texto", () => {
    expect(pasteIsBig("a".repeat(300))).toBe(false);
  });

  it("exatamente no limite ainda é texto", () => {
    expect(pasteIsBig("a".repeat(PASTE_LIMIT))).toBe(false);
  });

  it("um caractere acima vira anexo", () => {
    expect(pasteIsBig("a".repeat(PASTE_LIMIT + 1))).toBe(true);
  });

  it("colar vazio nunca vira anexo", () => {
    expect(pasteIsBig("")).toBe(false);
  });
});

describe("humanSize", () => {
  it("abaixo de mil mostra o número", () => {
    expect(humanSize(840)).toBe("840");
  });
  it("milhares com uma casa", () => {
    expect(humanSize(5200)).toBe("5.2k");
  });
  it("dezenas de milhares sem casa decimal", () => {
    expect(humanSize(42000)).toBe("42k");
  });
});

describe("pastedNote", () => {
  it("guarda o texto inteiro e rotula com o tamanho", () => {
    const texto = "x".repeat(5200);
    const att = pastedNote(texto);
    expect(att.type).toBe("note");
    expect(att.content).toBe(texto);
    expect(att.path).toBe("Pasted text (5.2k)");
  });
});
