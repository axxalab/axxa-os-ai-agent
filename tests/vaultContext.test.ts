import { describe, it, expect } from "vitest";
import { vaultAtivo, vaultDefault } from "../src/core/vaultContext";

describe("vaultDefault", () => {
  it("Vault Q&A e Agent nascem ligados", () => {
    // Um responde COM as notas; o outro trabalha DENTRO delas e evita refazer
    // o que já está escrito.
    expect(vaultDefault("vault-qa")).toBe(true);
    expect(vaultDefault("agent")).toBe(true);
  });

  it("Chat nasce desligado", () => {
    // "Só você e o modelo" é a promessa dele — uma busca silenciosa no vault
    // quebraria essa promessa sem avisar.
    expect(vaultDefault("chat")).toBe(false);
  });

  it("modo desconhecido não liga sozinho", () => {
    // Conversa gravada por outra versão: ligar por conta própria mandaria
    // trechos das notas pra um modo que este código não sabe o que faz.
    expect(vaultDefault("research")).toBe(false);
    expect(vaultDefault("")).toBe(false);
  });
});

describe("vaultAtivo", () => {
  it("sem escolha, vale o padrão do modo", () => {
    expect(vaultAtivo("chat", null)).toBe(false);
    expect(vaultAtivo("agent", null)).toBe(true);
  });

  it("a escolha da pessoa vence o padrão, nos dois sentidos", () => {
    expect(vaultAtivo("chat", true)).toBe(true);
    expect(vaultAtivo("agent", false)).toBe(false);
  });

  it("desligar NÃO é o mesmo que nunca ter mexido", () => {
    // É por isso que a escolha é `boolean | null`: com um `false` de nascença,
    // trocar de Chat pra Vault Q&A não conseguiria ligar sozinho.
    expect(vaultAtivo("vault-qa", null)).toBe(true);
    expect(vaultAtivo("vault-qa", false)).toBe(false);
  });
});
