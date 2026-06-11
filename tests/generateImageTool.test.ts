import { describe, it, expect } from "vitest";
import { TOOL_DEFINITIONS, getToolDefinition } from "../src/agent/toolSchemas";

// A tool generate_image (v0.1.167) deixa o agente pedir imagem inline sem trocar
// de modelo. É NÃO-destrutiva (o ImageGenModal é a confirmação) e tem prompt obrig.
describe("generate_image tool", () => {
  it("está registrada em TOOL_DEFINITIONS", () => {
    expect(TOOL_DEFINITIONS.some((t) => t.name === "generate_image")).toBe(true);
  });

  it("é não-destrutiva e não-irreversível (confirmação é o modal de imagem)", () => {
    const def = getToolDefinition("generate_image");
    expect(def).toBeTruthy();
    expect(def!.destructive).toBe(false);
    expect(def!.irreversible).toBeFalsy();
  });

  it("exige o param prompt", () => {
    const def = getToolDefinition("generate_image")!;
    const params = def.parameters as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(params.properties.prompt).toBeTruthy();
    expect(params.required).toContain("prompt");
  });
});
