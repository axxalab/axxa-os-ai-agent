import { describe, it, expect } from "vitest";
import { mapHttpError, buildChatBody } from "../src/providers/_shared";

// Núcleo compartilhado dos providers (extraído na v0.1.156). O parser SSE e o
// ensureOk* já são exercidos pelos testes de stream; aqui foco em mapHttpError
// e buildChatBody (que aplica a paramPolicy).

const userReq = (extra: Record<string, unknown> = {}) => ({
  model: "gpt-4o",
  messages: [{ role: "user" as const, content: "hi" }],
  ...extra,
});

describe("mapHttpError", () => {
  it("status OK (2xx) → null", () => {
    expect(mapHttpError(200, {}, { label: "X" })).toBeNull();
  });
  it("401 → invalid-key", () => {
    expect(mapHttpError(401, {}, { label: "X" })?.code).toBe("invalid-key");
  });
  it("403 vira invalid-key só quando declarado em authStatuses", () => {
    expect(mapHttpError(403, {}, { label: "X" })?.code).toBe("unknown");
    expect(
      mapHttpError(403, {}, { label: "X", authStatuses: [401, 403] })?.code
    ).toBe("invalid-key");
  });
  it("429 → rate-limit", () => {
    expect(mapHttpError(429, {}, { label: "X" })?.code).toBe("rate-limit");
  });
  it("outro erro → unknown com o detalhe da API", () => {
    const err = mapHttpError(500, { error: { message: "boom" } }, { label: "NIM" });
    expect(err?.code).toBe("unknown");
    expect(err?.message).toContain("boom");
  });
});

describe("buildChatBody", () => {
  it("usa o campo de max tokens pedido + clampa", () => {
    const b = buildChatBody(userReq({ maxTokens: 999999 }), {
      provider: "openai",
      maxTokensField: "max_completion_tokens",
    });
    expect(b.max_completion_tokens).toBe(16384); // teto gpt-4o
    expect(b.max_tokens).toBeUndefined();
  });

  it("aplica a paramPolicy na temperatura (gpt-4o passa, o3 omite)", () => {
    expect(
      buildChatBody(userReq({ temperature: 0.3 }), { provider: "openai" }).temperature
    ).toBe(0.3);
    expect(
      buildChatBody(
        { model: "o3-mini", messages: [{ role: "user", content: "hi" }], temperature: 0.3 },
        { provider: "openai" }
      ).temperature
    ).toBeUndefined();
  });

  it("stream + includeUsage setam stream_options", () => {
    const b = buildChatBody(userReq(), {
      provider: "openai",
      stream: true,
      includeUsage: true,
    });
    expect(b.stream).toBe(true);
    expect(b.stream_options).toEqual({ include_usage: true });
  });

  it("tools viram formato function + tool_choice auto", () => {
    const b = buildChatBody(
      userReq({ tools: [{ name: "f", description: "d", parameters: {} }] }),
      { provider: "openai" }
    );
    expect(Array.isArray(b.tools)).toBe(true);
    expect(b.tool_choice).toBe("auto");
  });
});
