import { describe, it, expect, vi, afterEach } from "vitest";
import { openaiProvider } from "../src/providers/openai";
import { geminiProvider } from "../src/providers/gemini";
import { anthropicProvider } from "../src/providers/anthropic";
import { openrouterProvider } from "../src/providers/openrouter";
import { ollamaProvider } from "../src/providers/ollama";
import { nimProvider } from "../src/providers/nim";
import { fakeStreamResponse, sse } from "./helpers/streamMock";
import { __setRequestUrl } from "./obsidian-stub";

// Dirige o streamChat REAL de cada provider com a rede mockada. Cobre o parser
// de verdade (buffer de linha, acumulação de delta, tool_calls, usage, [DONE]),
// não uma reimplementação.
//   - via fetch (SSE/NDJSON): openai / gemini / anthropic / openrouter / ollama
//   - via requestUrl do Obsidian (pseudo-stream): nim

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

  it("roteia reasoning/reasoning_content via onReasoning sem poluir o content — v0.1.193", async () => {
    mockFetch([
      sse({ choices: [{ delta: { reasoning: "pensando" } }] }),
      sse({ choices: [{ delta: { reasoning_content: " mais" } }] }),
      sse({ choices: [{ delta: { content: "Resposta" } }] }),
      "data: [DONE]\n\n",
    ]);
    const tokens: string[] = [];
    const reasoning: string[] = [];
    const res = await openaiProvider.streamChat(
      userReq("gpt-4o"),
      "key",
      (t) => tokens.push(t),
      undefined,
      undefined,
      (r) => reasoning.push(r)
    );
    expect(reasoning).toEqual(["pensando", " mais"]);
    expect(tokens).toEqual(["Resposta"]);
    expect(res.content).toBe("Resposta");
  });

  it("sem onReasoning: deltas de reasoning não quebram o stream nem entram no content", async () => {
    mockFetch([
      sse({ choices: [{ delta: { reasoning: "oculto" } }] }),
      sse({ choices: [{ delta: { content: "ok" } }] }),
      "data: [DONE]\n\n",
    ]);
    const res = await openaiProvider.streamChat(userReq("gpt-4o"), "key", () => {});
    expect(res.content).toBe("ok");
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

  it("thinking_delta roteia pro onReasoning sem entrar no content — v0.1.195", async () => {
    mockFetch([
      sse({ type: "message_start", message: { usage: { input_tokens: 4 } } }),
      sse({ type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "hmm" } }),
      sse({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Oi" } }),
      sse({ type: "message_delta", usage: { output_tokens: 2 } }),
      sse({ type: "message_stop" }),
    ]);
    const tokens: string[] = [];
    const reasoning: string[] = [];
    const res = await anthropicProvider.streamChat(
      userReq("claude-opus-4-8"),
      "key",
      (t) => tokens.push(t),
      undefined,
      undefined,
      (r) => reasoning.push(r)
    );
    expect(reasoning).toEqual(["hmm"]);
    expect(tokens).toEqual(["Oi"]);
    expect(res.content).toBe("Oi");
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

describe("openrouter streamChat — formato OpenAI-compat via fetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("acumula content + usage + [DONE]", async () => {
    mockFetch([
      sse({ choices: [{ delta: { content: "Hello" } }] }),
      sse({ choices: [{ delta: { content: " OR" } }], usage: { prompt_tokens: 4, completion_tokens: 2 } }),
      "data: [DONE]\n\n",
    ]);
    const tokens: string[] = [];
    let usage: unknown;
    const res = await openrouterProvider.streamChat(
      userReq("anthropic/claude-sonnet-4"),
      "key",
      (t) => tokens.push(t),
      (u) => (usage = u)
    );
    expect(res.content).toBe("Hello OR");
    expect(tokens).toEqual(["Hello", " OR"]);
    expect(usage).toEqual({ input: 4, output: 2 });
  });

  it("HTTP 401 → ProviderError invalid-key", async () => {
    mockFetch([], { status: 401, ok: false });
    await expect(
      openrouterProvider.streamChat(userReq("x"), "key", () => {})
    ).rejects.toMatchObject({ code: "invalid-key" });
  });
});

describe("ollama streamChat — NDJSON (uma linha JSON por chunk)", () => {
  afterEach(() => vi.unstubAllGlobals());

  const ndjson = (obj: unknown) => JSON.stringify(obj) + "\n";

  it("acumula content + usage no done:true", async () => {
    mockFetch([
      ndjson({ message: { content: "Oi" }, done: false }),
      ndjson({ message: { content: " mundo" }, done: false }),
      ndjson({ message: { content: "" }, done: true, prompt_eval_count: 5, eval_count: 2 }),
    ]);
    const tokens: string[] = [];
    let usage: unknown;
    const res = await ollamaProvider.streamChat(
      userReq("llama3.2"),
      "http://localhost:11434",
      (t) => tokens.push(t),
      (u) => (usage = u)
    );
    expect(res.content).toBe("Oi mundo");
    expect(tokens).toEqual(["Oi", " mundo"]);
    expect(usage).toEqual({ input: 5, output: 2 });
  });

  it("REGRESSÃO buffer: linha NDJSON partida entre dois reads é remontada", async () => {
    mockFetch([
      '{"message":{"content":"Re',
      'cursão"},"done":false}\n{"message":{"content":""},"done":true,"prompt_eval_count":1,"eval_count":1}\n',
    ]);
    const res = await ollamaProvider.streamChat(
      userReq("llama3.2"),
      "http://localhost:11434",
      () => {}
    );
    expect(res.content).toBe("Recursão");
  });

  it("tool_calls inteiros (args como objeto) viram toolCalls", async () => {
    mockFetch([
      ndjson({
        message: { content: "", tool_calls: [{ function: { name: "search", arguments: { q: "cats" } } }] },
        done: false,
      }),
      ndjson({ message: { content: "" }, done: true, prompt_eval_count: 1, eval_count: 1 }),
    ]);
    const res = await ollamaProvider.streamChat(
      userReq("llama3.2"),
      "http://localhost:11434",
      () => {}
    );
    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls![0]).toMatchObject({ name: "search", arguments: { q: "cats" } });
  });
});

describe("nim streamChat — pseudo-stream via requestUrl", () => {
  afterEach(() => __setRequestUrl(null));

  it("emite o content inteiro num token só + usage", async () => {
    __setRequestUrl(async () => ({
      status: 200,
      json: {
        choices: [{ message: { content: "resposta completa" } }],
        usage: { prompt_tokens: 8, completion_tokens: 3 },
      },
    }));
    const tokens: string[] = [];
    let usage: unknown;
    const res = await nimProvider.streamChat(
      userReq("meta/llama-3.1-8b-instruct"),
      "key",
      (t) => tokens.push(t),
      (u) => (usage = u)
    );
    expect(tokens).toEqual(["resposta completa"]);
    expect(res.content).toBe("resposta completa");
    expect(usage).toEqual({ input: 8, output: 3 });
  });

  it("signal já abortado → AbortError sem nem chamar requestUrl", async () => {
    const spy = vi.fn(async () => ({ status: 200, json: {} }));
    __setRequestUrl(spy);
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      nimProvider.streamChat(
        userReq("meta/llama-3.1-8b-instruct"),
        "key",
        () => {},
        undefined,
        ctrl.signal
      )
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("HTTP 401 → ProviderError invalid-key", async () => {
    __setRequestUrl(async () => ({ status: 401, json: {} }));
    await expect(
      nimProvider.streamChat(userReq("meta/llama-3.1-8b-instruct"), "key", () => {})
    ).rejects.toMatchObject({ code: "invalid-key" });
  });
});

describe("param policy aplicada no BODY real (regressão temperature)", () => {
  afterEach(() => vi.unstubAllGlobals());

  function captureBody(chunks: string[]) {
    const cap: { body?: Record<string, unknown> } = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        cap.body = JSON.parse(init.body);
        return fakeStreamResponse(chunks);
      })
    );
    return cap;
  }
  const reqT = (model: string, temperature: number) => ({
    model,
    messages: [{ role: "user" as const, content: "hi" }],
    temperature,
  });

  it("gpt-4o → temperature VAI no body", async () => {
    const cap = captureBody(["data: [DONE]\n\n"]);
    await openaiProvider.streamChat(reqT("gpt-4o", 0.3), "key", () => {});
    expect(cap.body?.temperature).toBe(0.3);
  });

  it("o3-mini (reasoning) → temperature OMITIDA do body (evita 400)", async () => {
    const cap = captureBody(["data: [DONE]\n\n"]);
    await openaiProvider.streamChat(reqT("o3-mini", 0.3), "key", () => {});
    expect(cap.body?.temperature).toBeUndefined();
  });

  it("Claude > 1 é clampado pra 1 no body", async () => {
    const cap = captureBody([
      sse({ type: "message_start", message: { usage: { input_tokens: 1 } } }),
      sse({ type: "message_stop" }),
    ]);
    await anthropicProvider.streamChat(reqT("claude-opus-4-8", 1.7), "key", () => {});
    expect(cap.body?.temperature).toBe(1);
  });
});
