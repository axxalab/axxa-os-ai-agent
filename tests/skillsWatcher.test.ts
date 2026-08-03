import { describe, it, expect, vi } from "vitest";

// O módulo importa "obsidian" (normalizePath) — resolve pro stub dos testes.
vi.mock("obsidian", () => import("./obsidian-stub"));

const { isSkillFilePath, skillsFolderPrefix } = await import(
  "../src/skills/skills"
);

// SKL-03: o watcher do vault só pode recarregar as skills quando o .md mexido
// está DENTRO da pasta configurada — senão qualquer edição no vault dispara
// uma releitura da pasta inteira.

describe("isSkillFilePath — gate do hot reload das skills", () => {
  const FOLDER = "axxa-ai/skills";

  it("aceita .md dentro da pasta (inclusive em subpasta)", () => {
    expect(isSkillFilePath("axxa-ai/skills/Resumo.md", FOLDER)).toBe(true);
    expect(isSkillFilePath("axxa-ai/skills/pt/Resumo.md", FOLDER)).toBe(true);
  });

  it("recusa nota fora da pasta", () => {
    expect(isSkillFilePath("Notas/Resumo.md", FOLDER)).toBe(false);
    expect(isSkillFilePath("axxa-ai/chats/2026-08-03.md", FOLDER)).toBe(false);
  });

  it("recusa arquivo que não é .md (anexo, índice, gravação)", () => {
    expect(isSkillFilePath("axxa-ai/skills/logo.png", FOLDER)).toBe(false);
    expect(isSkillFilePath("axxa-ai/skills/index.json", FOLDER)).toBe(false);
  });

  it("recusa pasta vizinha com o mesmo prefixo de nome", () => {
    expect(isSkillFilePath("axxa-ai/skills-old/Resumo.md", FOLDER)).toBe(false);
  });

  it("extensão maiúscula ainda conta como skill", () => {
    expect(isSkillFilePath("axxa-ai/skills/Resumo.MD", FOLDER)).toBe(true);
  });

  it("path vazio nunca dispara reload", () => {
    expect(isSkillFilePath("", FOLDER)).toBe(false);
  });

  it("pasta customizada (com barra sobrando) é normalizada", () => {
    expect(isSkillFilePath("Minhas Skills/a.md", "Minhas Skills/")).toBe(true);
    expect(skillsFolderPrefix("Minhas Skills/")).toBe("Minhas Skills/");
  });

  it("pasta vazia cai no default do produto", () => {
    expect(skillsFolderPrefix("")).toBe("axxa-ai/skills/");
    expect(isSkillFilePath("axxa-ai/skills/a.md", "")).toBe(true);
  });
});
