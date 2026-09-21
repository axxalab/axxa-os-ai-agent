import { describe, it, expect } from "vitest";
import {
  SKILL_DRAFT_VAZIO,
  skillFileName,
  skillMarkdown,
  skillProblema,
  type SkillDraft,
} from "../src/skills/skillFile";

const draft = (over: Partial<SkillDraft> = {}): SkillDraft => ({
  ...SKILL_DRAFT_VAZIO,
  name: "Weekly review",
  body: "Go through this week's notes.",
  ...over,
});

describe("skillFileName", () => {
  it("usa o nome como nome de arquivo", () => {
    expect(skillFileName("Weekly review")).toBe("Weekly review.md");
  });

  it("troca o que o Obsidian não aceita em vez de recusar", () => {
    // O nome é do usuário, o arquivo é nosso: ele digita "Resumo: TL;DR" e nós
    // damos um jeito no `:` — mandar digitar de novo seria cobrar dele uma
    // regra do sistema de arquivos.
    expect(skillFileName("Resumo: TL;DR")).toBe("Resumo- TL;DR.md");
    expect(skillFileName("a/b*c?d")).toBe("a-b-c-d.md");
  });

  it("não deixa o arquivo terminar em ponto nem espaço", () => {
    // No Windows os dois somem sozinhos, e o arquivo criado deixa de ser o
    // arquivo procurado.
    expect(skillFileName("Rascunho...")).toBe("Rascunho.md");
    expect(skillFileName("  espaço  ")).toBe("espaço.md");
  });

  it("nome que vira nada ainda dá um arquivo", () => {
    expect(skillFileName("///")).toBe("Skill.md");
    expect(skillFileName("")).toBe("Skill.md");
  });
});

describe("skillMarkdown", () => {
  it("escreve frontmatter e corpo", () => {
    const md = skillMarkdown(draft({ description: "d", icon: "list" }));
    expect(md.startsWith("---\n")).toBe(true);
    expect(md).toContain('name: "Weekly review"');
    expect(md).toContain('description: "d"');
    expect(md).toContain('icon: "list"');
    expect(md.trimEnd().endsWith("Go through this week's notes.")).toBe(true);
  });

  it("sempre entre aspas — dois-pontos no nome quebraria o YAML", () => {
    const md = skillMarkdown(draft({ name: "Resumo: TL;DR" }));
    expect(md).toContain('name: "Resumo: TL;DR"');
  });

  it("aspas e contrabarra no nome saem escapadas", () => {
    const md = skillMarkdown(draft({ name: 'O "bom" \\ ruim' }));
    expect(md).toContain('name: "O \\"bom\\" \\\\ ruim"');
  });

  it("sem modo, a linha nem existe", () => {
    // `mode: ""` faria o acionamento tentar trocar pra um modo que não existe.
    expect(skillMarkdown(draft({ mode: "" }))).not.toContain("mode:");
    expect(skillMarkdown(draft({ mode: "agent" }))).toContain('mode: "agent"');
  });
});

describe("skillProblema", () => {
  it("pronto é null", () => {
    expect(skillProblema(draft(), [])).toBeNull();
  });

  it("cobra o nome e cobra o prompt", () => {
    expect(skillProblema(draft({ name: "  " }), [])).toMatch(/name/i);
    // Sem corpo o parser descarta a nota: o skill seria criado e sumiria da
    // lista no mesmo segundo.
    expect(skillProblema(draft({ body: "" }), [])).toMatch(/prompt/i);
  });

  it("não pisa num skill que já existe", () => {
    const existentes = ["axxa-ai/skills/Weekly review.md"];
    expect(skillProblema(draft(), existentes)).toMatch(/already/i);
    // Editando aquele mesmo, o nome dele não é conflito.
    expect(skillProblema(draft(), existentes, existentes[0])).toBeNull();
  });

  it("colisão ignora maiúsculas — o disco também ignora", () => {
    expect(
      skillProblema(draft({ name: "WEEKLY REVIEW" }), [
        "axxa-ai/skills/Weekly review.md",
      ])
    ).toMatch(/already/i);
  });
});
