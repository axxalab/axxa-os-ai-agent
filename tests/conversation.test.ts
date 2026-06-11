import { describe, it, expect } from "vitest";
import {
  buildChatSystemPrompt,
  buildAgentSystemPrompt,
  storeMessagesToProvider,
} from "../src/agent/conversation";

describe("buildChatSystemPrompt", () => {
  it("sem persona → usa o base", () => {
    expect(buildChatSystemPrompt({ base: "BASE" })).toBe("BASE");
  });
  it("persona SUBSTITUI o base", () => {
    expect(buildChatSystemPrompt({ persona: "PIRATA", base: "BASE" })).toBe("PIRATA");
  });
  it("vaultBlock não-vazio adiciona o sufixo + bloco", () => {
    const r = buildChatSystemPrompt({
      base: "BASE",
      vaultSuffix: "\n\nNOTAS:\n",
      vaultBlock: "trecho relevante",
    });
    expect(r).toBe("BASE\n\nNOTAS:\ntrecho relevante");
  });
  it("vaultBlock vazio NÃO adiciona o sufixo", () => {
    expect(
      buildChatSystemPrompt({ base: "BASE", vaultSuffix: "SUF", vaultBlock: "" })
    ).toBe("BASE");
  });
  it("noteBlock é anexado no fim", () => {
    expect(buildChatSystemPrompt({ base: "BASE", noteBlock: "\n\n[notas]" })).toBe(
      "BASE\n\n[notas]"
    );
  });
});

describe("buildAgentSystemPrompt", () => {
  it("sem persona → só o prompt do agent", () => {
    expect(buildAgentSystemPrompt(undefined, "AGENT")).toBe("AGENT");
    expect(buildAgentSystemPrompt("  ", "AGENT")).toBe("AGENT");
  });
  it("persona é PREPENDIDA (não substitui)", () => {
    expect(buildAgentSystemPrompt("PIRATA", "AGENT")).toBe("PIRATA\n\nAGENT");
  });
});

describe("storeMessagesToProvider", () => {
  const msgs = [
    { type: "user", content: "oi" },
    { type: "ai-comment", content: "pensando…" }, // descartado
    { type: "ai-response", content: "olá" },
    { type: "ai-response", content: "[Erro] x", isError: true }, // descartado
    { type: "user", content: "de novo" },
  ];

  it("filtra ai-comment e ai-response com erro; mapeia roles", () => {
    const out = storeMessagesToProvider(msgs);
    expect(out).toEqual([
      { role: "user", content: "oi" },
      { role: "assistant", content: "olá" },
      { role: "user", content: "de novo" },
    ]);
  });

  it("anexa attachments só na ÚLTIMA user-msg", () => {
    const att = [{ type: "image" as const, dataUrl: "data:..." }];
    const out = storeMessagesToProvider(msgs, att);
    expect(out[out.length - 1]).toMatchObject({
      role: "user",
      content: "de novo",
      attachments: att,
    });
    // a primeira user-msg NÃO recebe attachments
    expect(out[0]).not.toHaveProperty("attachments");
  });

  it("sem attachments → nenhuma msg ganha o campo", () => {
    const out = storeMessagesToProvider(msgs);
    expect(out.some((m) => "attachments" in m)).toBe(false);
  });

  it("CONTINUIDADE: ai-response com agentSteps vira assistant(tool_calls)+tool(result)+assistant(texto)", () => {
    const steps = [
      { id: "c1", name: "vault_create", arguments: { path: "a.md" }, result: "criado", ok: true },
      { id: "c2", name: "vault_search", arguments: { query: "x" }, result: "2 hits", ok: true },
    ];
    const out = storeMessagesToProvider([
      { type: "user", content: "cria a.md" },
      { type: "ai-response", content: "Feito!", agentSteps: steps },
    ]);
    expect(out).toEqual([
      { role: "user", content: "cria a.md" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          { id: "c1", name: "vault_create", arguments: { path: "a.md" } },
          { id: "c2", name: "vault_search", arguments: { query: "x" } },
        ],
      },
      { role: "tool", toolCallId: "c1", content: "criado" },
      { role: "tool", toolCallId: "c2", content: "2 hits" },
      { role: "assistant", content: "Feito!" },
    ]);
  });
});
