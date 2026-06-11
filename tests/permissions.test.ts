import { describe, it, expect } from "vitest";
import { decideToolGate } from "../src/agent/permissions";
import type { ToolDefinition, PermissionLevel } from "../src/agent/types";

// decideToolGate é o "portão" que decide se uma tool roda direto ou abre o modal
// de confirmação. Segurança: bug aqui = ação destrutiva sem perguntar.

const tool = (destructive: boolean, irreversible = false): ToolDefinition =>
  ({
    name: "x",
    description: "",
    parameters: {},
    destructive,
    irreversible,
  } as ToolDefinition);

const gate = (
  t: ToolDefinition,
  level: PermissionLevel,
  diffApproval: boolean,
  approveAll: boolean
) => decideToolGate(t, level, { diffApproval, approveAll });

describe("decideToolGate", () => {
  it("não-destrutivo (read/list) → sempre auto", () => {
    expect(gate(tool(false), "ask", true, false)).toBe("auto");
    expect(gate(tool(false), "yolo", false, false)).toBe("auto");
  });

  it("destrutivo em 'ask' → confirm", () => {
    expect(gate(tool(true), "ask", false, false)).toBe("confirm");
  });

  it("destrutivo em 'yolo' (sem diff) → auto", () => {
    expect(gate(tool(true), "yolo", false, false)).toBe("auto");
  });

  it("diff-approval ON força confirm mesmo em yolo", () => {
    expect(gate(tool(true), "yolo", true, false)).toBe("confirm");
  });

  it("'aprovar todas' pula o diff (em ação reversível)", () => {
    expect(gate(tool(true), "yolo", true, true)).toBe("auto");
  });

  it("SEGURANÇA: irreversível (delete) SEMPRE confirma — nem 'aprovar todas' pula", () => {
    expect(gate(tool(true, true), "yolo", true, true)).toBe("confirm");
    expect(gate(tool(true, true), "yolo", false, false)).toBe("confirm");
    expect(gate(tool(true, true), "ask", false, true)).toBe("confirm");
  });
});
