import { describe, it, expect } from "vitest";
import { previewFromMarkdown } from "../src/core/chatPreview";

/** Um arquivo de conversa como o `renderBody` grava. */
const arquivo = (corpo: string) =>
  `---\nid: x\ntitle: T\n---\n\n# T\n\n${corpo}`;

describe("previewFromMarkdown", () => {
  it("mostra a ÚLTIMA fala, não a primeira", () => {
    const md = arquivo(
      "## You\n\nprimeira\n\n## Assistant\n\nsegunda\n\n## You\n\nterceira\n"
    );
    expect(previewFromMarkdown(md)).toBe("terceira");
  });

  it("os comentários do formato não vazam pro cartão", () => {
    // A meta e os passos do agente são base64 — apareceriam como uma parede
    // de caracteres exatamente onde deveria estar a última frase.
    const md = arquivo(
      "## Assistant\n\n<!-- axxa: ts=1 -->\nmovi 3 notas\n\n<!-- axxa-steps: eyJhIjoxfQ== -->\n"
    );
    expect(previewFromMarkdown(md)).toBe("movi 3 notas");
  });

  it("vira UMA linha — o cartão tem duas e elas são do CSS", () => {
    const md = arquivo("## Assistant\n\nlinha um\nlinha dois\n\nlinha três\n");
    expect(previewFromMarkdown(md)).toBe("linha um linha dois linha três");
  });

  it("marcas de markdown saem; o texto fica", () => {
    const md = arquivo(
      "## Assistant\n\n## Plano\n\n- primeiro\n- segundo\n\n```ts\nconst a = 1;\n```\n"
    );
    expect(previewFromMarkdown(md)).toBe("Plano primeiro segundo const a = 1;");
  });

  it("link mostra o texto, imagem não mostra nada", () => {
    const md = arquivo("## Assistant\n\nveja [o plano](x.md) ![](y.png)\n");
    expect(previewFromMarkdown(md)).toBe("veja o plano");
  });

  it("última fala vazia? pega a anterior que tenha texto", () => {
    // Acontece o tempo todo: a mensagem do assistente ainda está chegando e o
    // arquivo já tem a seção dela, vazia.
    const md = arquifoVazio();
    expect(previewFromMarkdown(md)).toBe("pergunta");
  });

  it("conversa sem nenhuma fala devolve vazio", () => {
    expect(previewFromMarkdown(arquifoSoCabecalho())).toBe("");
    expect(previewFromMarkdown("")).toBe("");
  });
});

function arquifoVazio() {
  return arquivo("## You\n\npergunta\n\n## Assistant\n\n<!-- axxa: ts=2 -->\n");
}

function arquifoSoCabecalho() {
  return arquivo("");
}
