import { describe, it, expect } from "vitest";
import {
  buildChatSystemPrompt,
  buildAgentSystemPrompt,
  storeMessagesToProvider,
  flattenAgentResponse,
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
  it("styleInstruction entra após o head (antes do vault) — v0.1.189", () => {
    expect(
      buildChatSystemPrompt({ base: "BASE", styleInstruction: "Seja conciso." })
    ).toBe("BASE\n\nSeja conciso.");
  });
  it("styleInstruction vazio/espacos não muda nada", () => {
    expect(buildChatSystemPrompt({ base: "BASE", styleInstruction: "   " })).toBe(
      "BASE"
    );
  });
  it("ordem completa: persona + style + vault + notes", () => {
    const r = buildChatSystemPrompt({
      persona: "P",
      base: "BASE",
      styleInstruction: "S",
      vaultSuffix: "\n\nV:\n",
      vaultBlock: "ctx",
      noteBlock: "\n\nN",
    });
    expect(r).toBe("P\n\nS\n\nV:\nctx\n\nN");
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

  const stepsFixture = [
    { id: "c1", name: "vault_create", arguments: { path: "a.md" }, result: "criado", ok: true },
    { id: "c2", name: "vault_search", arguments: { query: "x" }, result: "2 hits", ok: true },
  ];

  it("AGENT (toolMode=true): agentSteps vira assistant(tool_calls)+tool(result)+assistant(texto)", () => {
    const out = storeMessagesToProvider(
      [
        { type: "user", content: "cria a.md" },
        { type: "ai-response", content: "Feito!", agentSteps: stepsFixture },
      ],
      undefined,
      true
    );
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

  it("CHAT (toolMode=false, default): agentSteps ACHATA num assistant de texto — SEM tool_calls/tool", () => {
    const out = storeMessagesToProvider([
      { type: "user", content: "cria a.md" },
      { type: "ai-response", content: "Feito!", agentSteps: stepsFixture },
    ]);
    // Nenhuma msg role:"tool" e nenhum toolCalls — portável em todo provider.
    expect(out.some((m) => m.role === "tool")).toBe(false);
    expect(out.some((m) => "toolCalls" in m)).toBe(false);
    expect(out[0]).toEqual({ role: "user", content: "cria a.md" });
    // A resposta vira UM assistant cujo texto preserva a memória das ações.
    expect(out).toHaveLength(2);
    expect(out[1].role).toBe("assistant");
    expect(out[1].content).toContain("Feito!");
    expect(out[1].content).toContain("memória do agente");
    expect(out[1].content).toContain("vault_create(a.md)");
    expect(out[1].content).toContain("vault_search(x)");
  });
});

describe("flattenAgentResponse", () => {
  it("inclui o texto final + uma linha por ação com status", () => {
    const r = flattenAgentResponse("Pronto.", [
      { id: "1", name: "vault_read", arguments: { path: "n.md" }, result: "conteúdo", ok: true },
      { id: "2", name: "vault_delete", arguments: { path: "x.md" }, result: "boom", ok: false },
    ]);
    expect(r.startsWith("Pronto.")).toBe(true);
    expect(r).toContain("1. vault_read(n.md) → ok — conteúdo");
    expect(r).toContain("2. vault_delete(x.md) → ERRO — boom");
  });

  it("sem texto final → só o bloco de memória", () => {
    const r = flattenAgentResponse("", [
      { id: "1", name: "vault_list", arguments: { folder: "f" }, result: "3 itens", ok: true },
    ]);
    expect(r.startsWith("〔memória do agente")).toBe(true);
    expect(r).toContain("vault_list(f) → ok — 3 itens");
  });

  it("trunca args e results longos inline (sem quebrar linha)", () => {
    const longArg = "p/".padEnd(200, "a");
    const longRes = "r".padEnd(500, "z");
    const r = flattenAgentResponse("ok", [
      { id: "1", name: "vault_read", arguments: { path: longArg }, result: longRes, ok: true },
    ]);
    expect(r).toContain("…");
    // a linha da ação não contém newline interno além do separador do bloco
    const actionLine = r.split("\n").find((l) => l.startsWith("1."))!;
    expect(actionLine.length).toBeLessThan(280);
  });
});
