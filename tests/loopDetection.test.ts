import { describe, it, expect } from "vitest";
import {
  makeCallSignature,
  isLooping,
  trimSignatures,
} from "../src/agent/loopDetection";

describe("makeCallSignature", () => {
  it("mesma tool+args → mesma assinatura", () => {
    const a = makeCallSignature("vault_read", { path: "a.md" });
    const b = makeCallSignature("vault_read", { path: "a.md" });
    expect(a).toBe(b);
  });
  it("args diferentes → assinaturas diferentes", () => {
    expect(makeCallSignature("vault_read", { path: "a.md" })).not.toBe(
      makeCallSignature("vault_read", { path: "b.md" })
    );
  });
});

describe("isLooping", () => {
  const sig = (n: string) => makeCallSignature("t", { x: n });
  it("últimas N idênticas → loop", () => {
    expect(isLooping([sig("a"), sig("a"), sig("a")], 3)).toBe(true);
  });
  it("última diferente quebra o loop", () => {
    expect(isLooping([sig("a"), sig("a"), sig("b")], 3)).toBe(false);
  });
  it("histórico menor que a janela → não é loop ainda", () => {
    expect(isLooping([sig("a"), sig("a")], 3)).toBe(false);
  });
  it("janela 0/negativa desliga a detecção", () => {
    expect(isLooping([sig("a"), sig("a"), sig("a")], 0)).toBe(false);
  });
  it("olha só as ÚLTIMAS N (chamadas antigas diferentes não importam)", () => {
    expect(isLooping([sig("x"), sig("y"), sig("a"), sig("a")], 2)).toBe(true);
  });
});

describe("trimSignatures", () => {
  it("mantém só as últimas N entradas", () => {
    const arr = ["1", "2", "3", "4", "5"];
    trimSignatures(arr, 3);
    expect(arr).toEqual(["3", "4", "5"]);
  });
  it("não mexe se já está no tamanho", () => {
    const arr = ["1", "2"];
    trimSignatures(arr, 5);
    expect(arr).toEqual(["1", "2"]);
  });
});
