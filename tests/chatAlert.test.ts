import { describe, it, expect } from "vitest";
import { ALERT_LABEL, alertCount, chatAlert } from "../src/ui/chatAlert";

describe("chatAlert", () => {
  const nada = { esperando: false, rodando: false, naoLida: false };

  it("conversa quieta não mostra nada", () => {
    expect(chatAlert(nada)).toBeNull();
  });

  it("cada estado sozinho", () => {
    expect(chatAlert({ ...nada, rodando: true })).toBe("running");
    expect(chatAlert({ ...nada, naoLida: true })).toBe("unread");
    expect(chatAlert({ ...nada, esperando: true })).toBe("waiting");
  });

  it("quem está esperando VOCÊ fala mais alto", () => {
    // Não é gosto: uma conversa parada num pedido de aprovação é a única que
    // não anda sozinha. As outras duas andam.
    expect(chatAlert({ esperando: true, rodando: true, naoLida: true })).toBe(
      "waiting"
    );
    expect(chatAlert({ esperando: true, rodando: true, naoLida: false })).toBe(
      "waiting"
    );
  });

  it("respondendo ganha de não lida", () => {
    // Se está respondendo AGORA, "New reply" seria notícia velha.
    expect(chatAlert({ esperando: false, rodando: true, naoLida: true })).toBe(
      "running"
    );
  });

  it("todo estado tem uma frase", () => {
    for (const k of ["waiting", "running", "unread"] as const) {
      expect(ALERT_LABEL[k].length).toBeGreaterThan(0);
    }
  });
});

describe("alertCount", () => {
  const chats = [
    { id: "a", mode: "agent" },
    { id: "b", mode: "agent" },
    { id: "c", mode: "chat" },
    { id: "d", mode: "agent" },
  ];

  it("conta as não lidas daquele módulo, e só daquele", () => {
    const n = alertCount(chats, "agent", {
      esperando: null,
      naoLidas: new Set(["a", "d", "c"]),
    });
    expect(n).toBe(2);
    expect(
      alertCount(chats, "chat", { esperando: null, naoLidas: new Set(["c"]) })
    ).toBe(1);
  });

  it("a que espera aprovação também conta", () => {
    expect(
      alertCount(chats, "agent", { esperando: "b", naoLidas: new Set() })
    ).toBe(1);
  });

  it("não conta duas vezes a mesma conversa", () => {
    expect(
      alertCount(chats, "agent", { esperando: "a", naoLidas: new Set(["a"]) })
    ).toBe(1);
  });

  it("quem está só RESPONDENDO não entra na conta", () => {
    // O número no menu é um chamado. Uma conversa trabalhando não está
    // chamando ninguém — marcar por causa dela é convidar pra ver uma coisa
    // que ainda não aconteceu.
    expect(
      alertCount(chats, "agent", { esperando: null, naoLidas: new Set() })
    ).toBe(0);
  });

  it("módulo sem nada devolve zero, não undefined", () => {
    expect(
      alertCount([], "agent", { esperando: null, naoLidas: new Set(["a"]) })
    ).toBe(0);
  });
});
