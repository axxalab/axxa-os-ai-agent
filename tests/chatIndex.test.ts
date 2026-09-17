import { describe, it, expect } from "vitest";
import { chatIndexSignature } from "../src/core/chatIndex";
import type { ChatSummary } from "../src/core/chatPersistence";

const chat = (over: Partial<ChatSummary> = {}): ChatSummary => ({
  id: "a",
  title: "t",
  date: "2026-09-16T10:00:00.000Z",
  mode: "agent",
  provider: "openai",
  model: "gpt-5",
  effort: "",
  tokensIn: 0,
  tokensOut: 0,
  messageCount: 2,
  toolCount: 3,
  filePath: "p",
  starred: false,
  preview: "moveu 18 notas",
  ...over,
});

describe("chatIndexSignature", () => {
  it("lista igual, assinatura igual", () => {
    expect(chatIndexSignature([chat()])).toBe(chatIndexSignature([chat()]));
  });

  it("tudo que o cartão mostra muda a assinatura", () => {
    const base = chatIndexSignature([chat()]);
    const mudancas: Array<Partial<ChatSummary>> = [
      { title: "outro" },
      { date: "2026-09-17T10:00:00.000Z" },
      { model: "gpt-5-mini" },
      { messageCount: 3 },
      { tokensIn: 10 },
      { tokensOut: 10 },
      { toolCount: 4 },
      { starred: true },
      // O que quebrou de verdade: o preview do cartão do Agent não estava aqui,
      // então um índice gravado sem ele era "igual" ao disco pra sempre e a
      // linha nunca aparecia.
      { preview: "outra coisa" },
    ];
    for (const m of mudancas) {
      expect(chatIndexSignature([chat(m)])).not.toBe(base);
    }
  });

  it("índice antigo (sem o campo) não passa por igual ao novo", () => {
    const antigo = { ...chat(), preview: undefined } as unknown as ChatSummary;
    expect(chatIndexSignature([antigo])).not.toBe(chatIndexSignature([chat()]));
  });

  it("quantidade diferente muda a assinatura", () => {
    expect(chatIndexSignature([chat(), chat({ id: "b" })])).not.toBe(
      chatIndexSignature([chat()])
    );
  });

  it("lista vazia tem assinatura própria", () => {
    expect(chatIndexSignature([])).toBe("0:");
  });
});
