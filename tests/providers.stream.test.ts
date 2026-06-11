import { describe, it, expect, vi, afterEach } from "vitest";
import { openaiProvider } from "../src/providers/openai";
import { geminiProvider } from "../src/providers/gemini";
import { anthropicProvider } from "../src/providers/anthropic";
import { fakeStreamResponse, sse } from "./helpers/streamMock";

// Dirige o streamChat REAL de cada provider com fetch mockado. Cobre o parser
// de verdade (buffer de linha, acumulação de delta, tool_calls, usage, [DONE]),
// não uma reimplementação. fetch-based: openai / gemini / anthropic.
//
// NÃO coberto aqui (requestUrl do Obsidian, follow-up): openrouter / nim / ollama.

const userReq = (model: string) => ({
  model,
  messages: [{ role: "user" as const, content: "hi" }],
});

function mockFetch(chunks: string[], init?: { status?: number; ok?: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => fakeStreamResponse(chunks, init))
  );
}

describe("openai streamChat — parser SSE real", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("acumula deltas de content em ordem + usage + encerra no [DONE]", async () => {
    mockFetch([
      sse({ choices: [{ delta: { content: "Hello" } }] }),
      sse({ choices: [{ delta: { content: ", world" } }] }),
      sse({ choices: [{ delta: {} }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
      "data: [DONE]\n\n",
    ]);
    const tokens: string[] = [];
    let usage: unknown;
    const res = await openaiProvider.streamChat(
      userReq("gpt-4o"),
      "key",
      (t) => tokens.push(t),
      (u) => (usage = u)
    );
    expect(tokens).toEqual(["Hello", ", world"]);
    expect(res.content).toBe("Hello, world");
    expect(usage).toEqual({ input: 10, output: 5 });
    expect(res.usage).toEqual({ input: 10, output: 5 });
  });

  it("REGRESSÃO buffer: evento JSON partido entre dois reads é remontado", async () => {
    mockFetch([
      'data: {"choices":[{"delta":{"content":"Hel',
      'lo"}}]}\n\ndata: [DONE]\n\n',
    ]);
    const tokens: string[] = [];
    const res = await openaiProvider.streamChat(userReq("gpt-4o"), "key", (t) =>
      tokens.push(t)
    );
    expect(res.content).toBe("Hello");
    expect(tokens).toEqual(["Hello"]);
  });

  it("monta tool_calls de deltas indexados (args concatenados + JSON parseado)", async () => {
    mockFetch([
      sse({
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, id: "call_1", function: { name: "get_weather", arguments: '{"ci' } },
              ],
            },
          },
        ],
      }),
      sse({
        choices: [
          { delta: { tool_calls: [{ index: 0, function: { arguments: 'ty":"SP"}' } }] } },
        ],
      }),
      "data: [DONE]\n\n",
    ]);
    const res = await openaiProvider.streamChat(userReq("gpt-4o"), "key", () => {});
    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls![0]).toMatchObject({
      id: "call_1",
      name: "get_weather",
      arguments: { city: "SP" },
    });
  });

  it("ignora chunk com JSON inválido sem abortar o stream", async () => {
    mockFetch([
      "data: isso-nao-e-json\n\n",
      sse({ choices: [{ delta: { content: "ok" } }] }),
      "data: [DONE]\n\n",
    ]);
    const res = await openaiProvider.streamChat(userReq("gpt-4o"), "key", () => {});
    expect(res.content).toBe("ok");
  });

  it("HTTP 401 → ProviderError code invalid-key", async () => {
    mockFetch([], { status: 401, ok: false });
    await expect(
      openaiProvider.streamChat(userReq("gpt-4o"), "key", () => {})
    ).rejects.toMatchObject({ code: "invalid-key" });
  });

  it("sem API key → ProviderError code no-key (nem faz fetch)", async () => {
    await expect(
      openaiProvider.streamChat(userReq("gpt-4o"), "   ", () => {})
    ).rejects.toMatchObject({ code: "no-key" });
  });
});

describe("gemini streamChat — formato OpenAI-compat", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("acumula content + usage + [DONE]", async () => {
    mockFetch([
      sse({ choices: [{ delta: { content: "Oi" } }] }),
      sse({ choices: [{ delta: { content: " mundo" } }], usage: { prompt_tokens: 3, completion_tokens: 2 } }),
      "data: [DONE]\n\n",
    ]);
    const tokens: string[] = [];
    let usage: unknown;
    const res = await geminiProvider.streamChat(
      userReq("gemini-2.5-flash"),
      "key",
      (t) => tokens.push(t),
      (u) => (usage = u)
    );
    expect(res.content).toBe("Oi mundo");
    expect(tokens).toEqual(["Oi", " mundo"]);
    expect(usage).toEqual({ input: 3, output: 2 });
  });
});

describe("anthropic streamChat — eventos tipados", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("text_delta acumula + usage (message_start/delta) + message_stop finaliza", async () => {
    mockFetch([
      sse({ type: "message_start", message: { usage: { input_tokens: 12 } } }),
      sse({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hi" } }),
      sse({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: " there" } }),
      sse({ type: "message_delta", usage: { output_tokens: 7 } }),
      sse({ type: "message_stop" }),
    ]);
    const tokens: string[] = [];
    let usage: unknown;
    const res = await anthropicProvider.streamChat(
      userReq("claude-opus-4-8"),
      "key",
      (t) => tokens.push(t),
      (u) => (usage = u)
    );
    expect(tokens).toEqual(["Hi", " there"]);
    expect(res.content).toBe("Hi there");
    expect(usage).toEqual({ input: 12, output: 7 });
  });

  it("tool_use: content_block_start + input_json_delta concatenado → toolCall parseado", async () => {
    mockFetch([
      sse({ type: "message_start", message: { usage: { input_tokens: 5 } } }),
      sse({
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "toolu_1", name: "search" },
      }),
      sse({ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"q":' } }),
      sse({ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '"cats"}' } }),
      sse({ type: "message_delta", usage: { output_tokens: 3 } }),
      sse({ type: "message_stop" }),
    ]);
    const res = await anthropicProvider.streamChat(
      userReq("claude-opus-4-8"),
      "key",
      () => {}
    );
    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls![0]).toMatchObject({
      id: "toolu_1",
      name: "search",
      arguments: { q: "cats" },
    });
  });

  it("evento type:error no stream → ProviderError", async () => {
    mockFetch([
      sse({ type: "message_start", message: { usage: { input_tokens: 1 } } }),
      sse({ type: "error", error: { message: "overloaded" } }),
    ]);
    await expect(
      anthropicProvider.streamChat(userReq("claude-opus-4-8"), "key", () => {})
    ).rejects.toMatchObject({ name: "ProviderError" });
  });
});
