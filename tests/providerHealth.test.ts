import { describe, it, expect } from "vitest";
import {
  providerBlockedReason,
  providerHealth,
  providerUsable,
} from "../src/core/providersMeta";
import type AxxaPlugin from "../src/main";

/** Plugin mínimo: só o que providersMeta lê. */
function fake(settings: Record<string, unknown>): AxxaPlugin {
  return { settings } as unknown as AxxaPlugin;
}

describe("providerHealth", () => {
  it("sem credencial é off", () => {
    expect(providerHealth(fake({}), "openai")).toBe("off");
    expect(providerHealth(fake({ openaiApiKey: "   " }), "openai")).toBe("off");
  });

  it("com credencial e sem teste é unknown", () => {
    expect(providerHealth(fake({ openaiApiKey: "sk-1" }), "openai")).toBe(
      "unknown"
    );
  });

  it("o último teste manda quando existe", () => {
    const ok = fake({
      openaiApiKey: "sk-1",
      providerStatus: { openai: { ok: true, at: 1 } },
    });
    const bad = fake({
      openaiApiKey: "sk-1",
      providerStatus: { openai: { ok: false, at: 1 } },
    });
    expect(providerHealth(ok, "openai")).toBe("ok");
    expect(providerHealth(bad, "openai")).toBe("fail");
  });

  it("teste gravado não ressuscita provider sem credencial", () => {
    const p = fake({ providerStatus: { openai: { ok: true, at: 1 } } });
    expect(providerHealth(p, "openai")).toBe("off");
  });

  it("ollama se identifica pelo endpoint, não por key", () => {
    expect(providerHealth(fake({ ollamaEndpoint: "" }), "ollama")).toBe("off");
    expect(
      providerHealth(fake({ ollamaEndpoint: "http://localhost:11434" }), "ollama")
    ).toBe("unknown");
  });
});

describe("providerUsable", () => {
  it("libera o que funciona e o que ainda não foi testado", () => {
    expect(providerUsable(fake({ anthropicApiKey: "k" }), "anthropic")).toBe(
      true
    );
    expect(
      providerUsable(
        fake({
          anthropicApiKey: "k",
          providerStatus: { anthropic: { ok: true, at: 1 } },
        }),
        "anthropic"
      )
    ).toBe(true);
  });

  it("bloqueia sem credencial e reprovado no teste", () => {
    expect(providerUsable(fake({}), "anthropic")).toBe(false);
    expect(
      providerUsable(
        fake({
          anthropicApiKey: "k",
          providerStatus: { anthropic: { ok: false, at: 1 } },
        }),
        "anthropic"
      )
    ).toBe(false);
  });

  it("bloqueado sempre tem motivo; liberado nunca tem", () => {
    expect(providerBlockedReason(fake({}), "gemini")).toMatch(/credential/i);
    expect(
      providerBlockedReason(
        fake({
          geminiApiKey: "k",
          providerStatus: { gemini: { ok: false, at: 1 } },
        }),
        "gemini"
      )
    ).toMatch(/test failed/i);
    expect(providerBlockedReason(fake({ geminiApiKey: "k" }), "gemini")).toBeNull();
  });
});
