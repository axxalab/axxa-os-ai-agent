import { describe, it, expect } from "vitest";
import {
  renderChatMarkdown,
  parseChatMarkdown,
  type ChatData,
} from "../src/components/_shared/chatPersistence";

// Round-trip do .md de chat: render → parse tem que devolver o MESMO chat.
// É o teste de INTEGRIDADE DE DADOS — se quebrar, o user perde conversa.
// Invariante: vale pra conteúdo já trimado (o render trima) e sem linhas que
// colidam com os headings de seção (`## You` / `## Assistant`).

const baseChat: ChatData = {
  id: "abc123",
  title: "Conversa de teste",
  date: "2026-06-10T12:00:00.000Z",
  mode: "chat",
  provider: "anthropic",
  model: "claude-fable-5",
  effort: "high",
  tokensIn: 1234,
  tokensOut: 567,
  persona: "Você é um pirata.",
  messages: [
    { type: "user", content: "Explica recursão", timestamp: 1_700_000_000_000 },
    {
      type: "ai-response",
      content: "Recursão é quando...\n\n```js\nfunction f() { return f(); }\n```\n\n---\n\nfim",
      timestamp: 1_700_000_001_000,
      reaction: "like",
    },
  ],
};

describe("chat persistence round-trip", () => {
  it("preserva todos os campos do chat (com code block, --- e reação)", () => {
    const restored = parseChatMarkdown(renderChatMarkdown(baseChat));
    expect(restored).toEqual(baseChat);
  });

  it("preserva persona ausente como undefined (não vira string vazia)", () => {
    const noPersona: ChatData = { ...baseChat, persona: undefined };
    const restored = parseChatMarkdown(renderChatMarkdown(noPersona));
    expect(restored.persona).toBeUndefined();
  });

  it("mensagem sem reaction não ganha o campo no parse", () => {
    const restored = parseChatMarkdown(renderChatMarkdown(baseChat));
    expect("reaction" in restored.messages[0]).toBe(false);
    expect(restored.messages[1].reaction).toBe("like");
  });

  it("title/date com caracteres especiais sobrevivem ao YAML", () => {
    const tricky: ChatData = {
      ...baseChat,
      title: 'Chat: "aspas", dois-pontos & vírgula',
      messages: [{ type: "user", content: "oi", timestamp: 1 }],
    };
    const restored = parseChatMarkdown(renderChatMarkdown(tricky));
    expect(restored.title).toBe(tricky.title);
  });

  it("tokens e timestamps voltam como número", () => {
    const restored = parseChatMarkdown(renderChatMarkdown(baseChat));
    expect(restored.tokensIn).toBe(1234);
    expect(restored.tokensOut).toBe(567);
    expect(restored.messages[0].timestamp).toBe(1_700_000_000_000);
  });

  it("chat sem mensagens não explode", () => {
    const empty: ChatData = { ...baseChat, messages: [] };
    const restored = parseChatMarkdown(renderChatMarkdown(empty));
    expect(restored.messages).toEqual([]);
    expect(restored.id).toBe("abc123");
  });

  it("frontmatter inválido lança erro claro", () => {
    expect(() => parseChatMarkdown("sem frontmatter aqui")).toThrow();
  });

  // Audit do ecossistema de providers: model ids variam muito (slash, colon,
  // :free, datado). Tudo tem que sobreviver ao YAML do frontmatter.
  it.each([
    ["openai", "gpt-4o"],
    ["anthropic", "claude-fable-5"],
    ["openrouter", "anthropic/claude-3.5-sonnet"],
    ["openrouter", "meta-llama/llama-3.1-8b-instruct:free"],
    ["nim", "nvidia/llama-3.3-nemotron-super-49b-v1.5"],
    ["gemini", "gemini-2.5-flash-image"],
    ["ollama", "qwen2.5:14b"],
  ])("preserva provider=%s model=%s no round-trip", (provider, model) => {
    const chat: ChatData = { ...baseChat, provider, model };
    const r = parseChatMarkdown(renderChatMarkdown(chat));
    expect(r.provider).toBe(provider);
    expect(r.model).toBe(model);
  });
});
