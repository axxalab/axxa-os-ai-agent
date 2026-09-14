// tests/confirmPreview.test.ts
// O modal de aprovação decide COMO mostrar o conteúdo antes de gravar: nota
// vira markdown formatado, arquivo de código vira bloco colorido, e o que não
// dá pra reconhecer continua texto cru. Essas três decisões são lógica pura —
// e é o tipo de coisa que quebra calada (uma extensão a mais, um `.md` dentro
// do nome da pasta) sem ninguém ver no aparelho.

import { describe, it, expect } from "vitest";
import {
  previewFor,
  fence,
  closeOpenFence,
} from "../src/agent/ConfirmationModal";

describe("previewFor", () => {
  it("nota do vault vira markdown", () => {
    expect(previewFor("PROJECTS/CREATIVE SYSTEMS.md")).toEqual({
      kind: "markdown",
    });
    expect(previewFor("Inbox/ideia.markdown")).toEqual({ kind: "markdown" });
  });

  it("caminho sem extensão também é nota — é o caso comum aqui", () => {
    expect(previewFor("Inbox/sem extensao")).toEqual({ kind: "markdown" });
    expect(previewFor("")).toEqual({ kind: "markdown" });
  });

  it("arquivo de código vira bloco com a linguagem do Prism", () => {
    expect(previewFor("axxa-ai/review.ts")).toEqual({
      kind: "code",
      lang: "typescript",
    });
    expect(previewFor("a/b/config.YAML")).toEqual({ kind: "code", lang: "yaml" });
    expect(previewFor("scripts/build.mjs")).toEqual({
      kind: "code",
      lang: "javascript",
    });
  });

  it("extensão desconhecida continua texto cru — melhor que colorir errado", () => {
    expect(previewFor("Inbox/dump.txt")).toEqual({ kind: "plain" });
    expect(previewFor("assets/foto.heic")).toEqual({ kind: "plain" });
  });

  it("ponto na PASTA não vira extensão do arquivo", () => {
    expect(previewFor("NUTRITION 1.0/plano")).toEqual({ kind: "markdown" });
    expect(previewFor("NUTRITION 1.0/plano.ts")).toEqual({
      kind: "code",
      lang: "typescript",
    });
  });

  it("arquivo oculto sem extensão (.gitignore) não vira 'gitignore'", () => {
    expect(previewFor(".gitignore")).toEqual({ kind: "markdown" });
  });
});

describe("fence", () => {
  it("abre e fecha com a linguagem", () => {
    expect(fence("const a = 1;", "typescript")).toBe(
      "```typescript\nconst a = 1;\n```"
    );
  });

  it("cresce pra passar de uma cerca de DENTRO do conteúdo", () => {
    const out = fence("antes\n```\ninterno\n```\ndepois", "markdown");
    expect(out.startsWith("````markdown\n")).toBe(true);
    expect(out.endsWith("\n````")).toBe(true);
    // o conteúdo sai inteiro, não cortado na cerca interna
    expect(out).toContain("interno");
    expect(out).toContain("depois");
  });

  it("conta a MAIOR sequência de crases, não a primeira", () => {
    const out = fence("a ````` b", "text");
    expect(out.startsWith("``````text\n")).toBe(true);
  });
});

describe("closeOpenFence", () => {
  it("não mexe no markdown equilibrado", () => {
    const md = "# t\n\n```ts\nconst a = 1;\n```\n";
    expect(closeOpenFence(md)).toBe(md);
  });

  it("fecha a cerca que o truncamento deixou aberta", () => {
    const md = "# t\n\n```ts\nconst a = 1;";
    expect(closeOpenFence(md)).toBe(md + "\n```");
  });

  it("fecha com a MESMA marca (til continua til)", () => {
    const md = "~~~python\nprint(1)";
    expect(closeOpenFence(md)).toBe(md + "\n~~~");
  });

  it("cerca dentro de citação/indentação de 4 não conta como cerca", () => {
    const md = "texto\n\n    ```nao-e-cerca\n\ntexto";
    expect(closeOpenFence(md)).toBe(md);
  });
});
