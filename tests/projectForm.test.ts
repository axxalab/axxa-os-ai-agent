import { describe, it, expect } from "vitest";
import {
  PROJECT_COLORS,
  PROJECT_DRAFT_VAZIO,
  PROJECT_ICONS,
  projectColor,
  projectProblema,
  type Project,
} from "../src/projects";

const proj = (over: Partial<Project> = {}): Project => ({
  id: "p1",
  name: "Thesis",
  icon: PROJECT_ICONS[0],
  color: PROJECT_COLORS[0],
  sources: [],
  chatIds: [],
  createdAt: new Date().toISOString(),
  ...over,
});

describe("projectProblema", () => {
  it("com nome, está pronto", () => {
    expect(projectProblema({ ...PROJECT_DRAFT_VAZIO, name: "Thesis" }, [])).toBeNull();
  });

  it("sem nome, não dá", () => {
    expect(projectProblema({ ...PROJECT_DRAFT_VAZIO, name: "   " }, [])).toMatch(
      /name/i
    );
  });

  it("nome repetido é erro de gente, e por isso é erro", () => {
    // Dois "Thesis" na lista e não há como saber em qual deles está a nota
    // pinada ontem.
    const d = { ...PROJECT_DRAFT_VAZIO, name: " thesis " };
    expect(projectProblema(d, [proj()])).toMatch(/already/i);
  });

  it("editando, o projeto não colide consigo mesmo", () => {
    const d = { ...PROJECT_DRAFT_VAZIO, name: "Thesis" };
    expect(projectProblema(d, [proj()], "p1")).toBeNull();
  });
});

describe("projectColor", () => {
  it('"default" segue o tema; o resto é a cor escolhida', () => {
    expect(projectColor("default")).toBe("var(--text-normal)");
    expect(projectColor("#46a758")).toBe("#46a758");
  });
});

describe("o rascunho vazio", () => {
  it("nasce com um ícone e uma cor que existem na grade", () => {
    // Sem isso a folha abriria sem nada marcado, e a primeira escolha da
    // pessoa seria desfazer um estado que ninguém escolheu.
    expect(PROJECT_ICONS).toContain(PROJECT_DRAFT_VAZIO.icon);
    expect(PROJECT_COLORS).toContain(PROJECT_DRAFT_VAZIO.color);
  });
});
