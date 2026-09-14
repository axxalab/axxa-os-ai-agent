// tests/notePicker.test.ts
// Achar a nota certa num vault grande. O ranking é a diferença entre "anexar
// FRAMEWORKS.md" e "rolar uma lista de 400 arquivos" — e o parser do `[[`
// decide quando a lista abre e quando ela some.

import { describe, it, expect } from "vitest";
import { rankNotes, wikilinkQuery, type NoteLike } from "../src/ui/notePicker";

const n = (path: string, mtime = 0): NoteLike => ({
  path,
  basename: (path.split("/").pop() ?? "").replace(/\.md$/, ""),
  mtime,
});

const vault: NoteLike[] = [
  n("Notas/2024/framing-de-produto/rascunho.md", 10),
  n("PROJECTS/FRAMEWORKS.md", 5),
  n("DAILY/2026-09-14.md", 99),
  n("PROJECTS/Frameworks antigos.md", 7),
  n("Inbox/framework.md", 1),
];

describe("rankNotes", () => {
  it("busca vazia traz as mais recentes primeiro", () => {
    expect(rankNotes(vault, "").map((x) => x.basename)).toEqual([
      "2026-09-14",
      "rascunho",
      "Frameworks antigos",
      "FRAMEWORKS",
      "framework",
    ]);
  });

  it("nome exato ganha de tudo", () => {
    expect(rankNotes(vault, "framework")[0].path).toBe("Inbox/framework.md");
  });

  it("começo do nome ganha de 'está no caminho'", () => {
    const ordem = rankNotes(vault, "fram").map((x) => x.path);
    expect(ordem.indexOf("PROJECTS/FRAMEWORKS.md")).toBeLessThan(
      ordem.indexOf("Notas/2024/framing-de-produto/rascunho.md")
    );
  });

  it("acha pelo caminho quando o nome não casa", () => {
    expect(rankNotes(vault, "daily").map((x) => x.basename)).toEqual([
      "2026-09-14",
    ]);
  });

  it("não inventa resultado pra busca sem correspondência", () => {
    expect(rankNotes(vault, "zzz")).toEqual([]);
  });

  it("respeita o limite", () => {
    expect(rankNotes(vault, "", 2)).toHaveLength(2);
  });

  it("é insensível a maiúscula", () => {
    expect(rankNotes(vault, "FRAMEWORKS")[0].basename).toBe("FRAMEWORKS");
  });
});

describe("wikilinkQuery", () => {
  it("abre quando tem [[ antes do cursor", () => {
    expect(wikilinkQuery("olha a [[fram", 13)).toEqual({
      start: 7,
      query: "fram",
    });
  });

  it("logo depois de [[ a busca é vazia (lista tudo)", () => {
    expect(wikilinkQuery("olha a [[", 9)).toEqual({ start: 7, query: "" });
  });

  it("fecha depois do ]]", () => {
    expect(wikilinkQuery("olha a [[nota]] e mais", 22)).toBeNull();
  });

  it("quebra de linha cancela", () => {
    expect(wikilinkQuery("olha a [[\nnova linha", 20)).toBeNull();
  });

  it("sem [[ não abre", () => {
    expect(wikilinkQuery("texto normal", 12)).toBeNull();
  });

  it("usa o [[ MAIS RECENTE antes do cursor", () => {
    expect(wikilinkQuery("[[a]] depois [[b", 16)).toEqual({
      start: 13,
      query: "b",
    });
  });

  it("ignora o que vem DEPOIS do cursor", () => {
    expect(wikilinkQuery("[[fra]] resto", 5)).toEqual({
      start: 0,
      query: "fra",
    });
  });
});

describe("wikilinkQuery — limite de tamanho", () => {
  it("um [[ esquecido lá atrás não mantém a lista aberta pra sempre", () => {
    const texto = "[[" + "x".repeat(81);
    expect(wikilinkQuery(texto, texto.length)).toBeNull();
  });

  it("busca longa mas plausível ainda abre", () => {
    const texto = "[[" + "x".repeat(40);
    expect(wikilinkQuery(texto, texto.length)?.query).toHaveLength(40);
  });
});
