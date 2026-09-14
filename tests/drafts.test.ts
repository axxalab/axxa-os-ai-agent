// tests/drafts.test.ts
// O rascunho é do CHAT, não da tela. Três regras que já custaram texto
// digitado: ele não pode vazar de uma conversa pra outra, não pode sumir
// quando a tela é desmontada (por isso vive no store), e não pode deixar
// entrada vazia acumulando pra sempre.

import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore, NEW_CHAT_DRAFT } from "../src/store/chat";

const st = () => useChatStore.getState();

describe("rascunhos", () => {
  beforeEach(() => {
    useChatStore.setState({ drafts: {} });
  });

  it("cada conversa tem o seu", () => {
    st().setDraft("chat-a", "texto da A");
    st().setDraft("chat-b", "texto da B");
    expect(st().drafts["chat-a"]).toBe("texto da A");
    expect(st().drafts["chat-b"]).toBe("texto da B");
  });

  it("a conversa nova tem a sua própria chave", () => {
    st().setDraft(NEW_CHAT_DRAFT, "ainda não enviei");
    st().setDraft("chat-a", "outra coisa");
    expect(st().drafts[NEW_CHAT_DRAFT]).toBe("ainda não enviei");
  });

  it("vazio APAGA a entrada em vez de guardar string vazia", () => {
    st().setDraft("chat-a", "algo");
    st().setDraft("chat-a", "");
    expect("chat-a" in st().drafts).toBe(false);
  });

  it("limpar uma conversa não toca nas outras", () => {
    st().setDraft("chat-a", "A");
    st().setDraft("chat-b", "B");
    st().setDraft("chat-a", "");
    expect(st().drafts).toEqual({ "chat-b": "B" });
  });

  it("escrever o mesmo texto não cria objeto novo (não re-renderiza à toa)", () => {
    st().setDraft("chat-a", "igual");
    const antes = st().drafts;
    st().setDraft("chat-a", "igual");
    expect(st().drafts).toBe(antes);
  });

  it("newChat não apaga rascunho nenhum — o texto é anterior à conversa", () => {
    st().setDraft(NEW_CHAT_DRAFT, "estava escrevendo");
    st().newChat();
    expect(st().drafts[NEW_CHAT_DRAFT]).toBe("estava escrevendo");
  });
});

describe("fila de mensagens", () => {
  beforeEach(() => {
    useChatStore.setState({ queued: [] });
  });

  it("enfileirar duas vezes guarda as DUAS, em ordem", () => {
    st().pushQueued("primeira");
    st().pushQueued("segunda");
    expect(st().queued).toEqual(["primeira", "segunda"]);
  });

  it("cancelar tira só aquela", () => {
    st().pushQueued("a");
    st().pushQueued("b");
    st().removeQueued(0);
    expect(st().queued).toEqual(["b"]);
  });

  it("parar limpa tudo", () => {
    st().pushQueued("a");
    st().pushQueued("b");
    st().clearQueued();
    expect(st().queued).toEqual([]);
  });

  it("conversa nova começa sem fila", () => {
    st().pushQueued("sobra?");
    st().newChat();
    expect(st().queued).toEqual([]);
  });
});
