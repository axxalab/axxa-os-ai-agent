import { describe, it, expect } from "vitest";
import {
  projectColor,
  makeProjectId,
  PROJECT_ICONS,
  PROJECT_COLORS,
} from "../src/projects";

describe("projectColor", () => {
  it('"default" → var CSS do texto normal', () => {
    expect(projectColor("default")).toBe("var(--text-normal)");
  });
  it("hex passa direto", () => {
    expect(projectColor("#e5484d")).toBe("#e5484d");
    expect(projectColor("#46a758")).toBe("#46a758");
  });
});

describe("makeProjectId", () => {
  it("formato proj-<8 alfanum>", () => {
    expect(makeProjectId()).toMatch(/^proj-[a-z0-9]{8}$/);
  });
  it("ids consecutivos diferem (colisão improvável)", () => {
    const ids = new Set(Array.from({ length: 200 }, () => makeProjectId()));
    expect(ids.size).toBe(200);
  });
});

describe("constantes do picker", () => {
  it("ícones: lista não-vazia e sem duplicatas", () => {
    expect(PROJECT_ICONS.length).toBeGreaterThan(10);
    expect(new Set(PROJECT_ICONS).size).toBe(PROJECT_ICONS.length);
  });
  it("cores: 'default' é a primeira + sem duplicatas", () => {
    expect(PROJECT_COLORS[0]).toBe("default");
    expect(new Set(PROJECT_COLORS).size).toBe(PROJECT_COLORS.length);
    // as demais são hex
    for (const c of PROJECT_COLORS.slice(1)) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
