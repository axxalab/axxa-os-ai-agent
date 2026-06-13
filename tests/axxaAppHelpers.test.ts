import { describe, it, expect } from "vitest";
import {
  makeId,
  agentActivitySpec,
  summarizeToolResult,
  placeholderForMode,
  describeProviderError,
  providerNeedsKey,
} from "../src/views/axxaApp.helpers";
import { ProviderError } from "../src/providers/base";
import { getTranslations } from "../src/i18n";

// Helpers puros extraídos do AxxaApp (v0.1.234). Antes não tinham cobertura —
// a extração pro próprio módulo é o que tornou possível testá-los.

describe("makeId", () => {
  it("retorna string não-vazia e única entre chamadas", () => {
    const a = makeId();
    const b = makeId();
    expect(typeof a).toBe("string");
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});

describe("agentActivitySpec", () => {
  it("mapeia uma tool conhecida (vault_read) com ícones + textos", () => {
    const s = agentActivitySpec("vault_read", { path: "notas/foo.md" });
    expect(s.iconPending).toBe("eye");
    expect(s.iconDone).toBe("file-check-2");
    expect(s.pendingText).toBe("Lendo notas/foo.md");
    expect(s.doneText).toBe("Leu notas/foo.md");
  });

  it("tool desconhecida cai no default genérico", () => {
    const s = agentActivitySpec("mystery_tool", {});
    expect(s.iconPending).toBe("wrench");
    expect(s.pendingText).toBe("Executando mystery_tool");
    expect(s.doneText).toBe("mystery_tool concluído");
  });

  it("encurta path longo mantendo o final (basename visível)", () => {
    const long = "a/".repeat(40) + "alvo.md";
    const s = agentActivitySpec("vault_read", { path: long });
    expect(s.pendingText.startsWith("Lendo …")).toBe(true);
    expect(s.pendingText.endsWith("alvo.md")).toBe(true);
  });

  it("vault_move usa origem → destino, ambos encurtados", () => {
    const s = agentActivitySpec("vault_move", { path: "a.md", to: "b.md" });
    expect(s.pendingText).toBe("Movendo a.md → b.md");
    expect(s.doneText).toBe("Moveu a.md → b.md");
  });
});

describe("summarizeToolResult", () => {
  it("vault_list extrai a contagem (plural)", () => {
    expect(summarizeToolResult("vault_list", "Conteúdo de X (8 itens):")).toBe("8 items");
  });
  it("vault_list singular (a regex casa 'itens', a saída é que singulariza)", () => {
    expect(summarizeToolResult("vault_list", "Conteúdo de X (1 itens):")).toBe("1 item");
  });
  it("vault_read mostra k chars acima de 1000", () => {
    expect(summarizeToolResult("vault_read", "x".repeat(1200))).toBe("1.2k chars");
    expect(summarizeToolResult("vault_read", "x".repeat(42))).toBe("42 chars");
  });
  it("vault_edit puxa o delta com sinal", () => {
    expect(summarizeToolResult("vault_edit", "ok (+12 chars)")).toBe("+12 chars");
    expect(summarizeToolResult("vault_edit", "ok (-5 chars)")).toBe("-5 chars");
  });
  it("resultado vazio ou tool sem regra → string vazia", () => {
    expect(summarizeToolResult("vault_read", "")).toBe("");
    expect(summarizeToolResult("vault_delete", "deletado")).toBe("");
  });
});

describe("placeholderForMode", () => {
  const dict = {
    placeholderChat: "chat",
    placeholderVaultQa: "qa",
    placeholderAgent: "agent",
    placeholderCoder: "coder",
  };
  it("mapeia cada modo", () => {
    expect(placeholderForMode("vault-qa", dict)).toBe("qa");
    expect(placeholderForMode("agent", dict)).toBe("agent");
    expect(placeholderForMode("coder", dict)).toBe("coder");
  });
  it("modo desconhecido cai no chat", () => {
    expect(placeholderForMode("whatever", dict)).toBe("chat");
  });
});

describe("describeProviderError", () => {
  const t = getTranslations("pt-br");
  it("mapeia cada code de ProviderError pro texto+code certos", () => {
    expect(describeProviderError(new ProviderError("x", "no-key"), t, "OpenAI")).toEqual({
      message: t.ai.err.noKey("OpenAI"),
      code: "no-key",
    });
    expect(describeProviderError(new ProviderError("x", "invalid-key"), t, "OpenAI").code).toBe(
      "invalid-key"
    );
    expect(describeProviderError(new ProviderError("x", "rate-limit"), t, "OpenAI").code).toBe(
      "rate-limit"
    );
    expect(describeProviderError(new ProviderError("x", "network"), t, "OpenAI").code).toBe(
      "network"
    );
    expect(describeProviderError(new ProviderError("x", "billing"), t, "OpenAI").code).toBe(
      "billing"
    );
  });
  it("code 'unknown' preserva a mensagem detalhada do provider", () => {
    const r = describeProviderError(new ProviderError("detalhe real", "unknown"), t, "OpenAI");
    expect(r.code).toBe("unknown");
    expect(r.message).toBe("detalhe real");
  });
  it("Error genérico e não-erro caem em unknown", () => {
    expect(describeProviderError(new Error("boom"), t, "X").code).toBe("unknown");
    expect(describeProviderError("string solta", t, "X").code).toBe("unknown");
  });
});

describe("providerNeedsKey", () => {
  it("ollama dispensa key; o resto exige", () => {
    expect(providerNeedsKey("ollama")).toBe(false);
    expect(providerNeedsKey("openai")).toBe(true);
    expect(providerNeedsKey("anthropic")).toBe(true);
  });
});
