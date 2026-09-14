// tests/composerSize.test.ts
// O teto de altura do campo. A conta errada (40% de innerHeight) só aparece
// com o teclado aberto — que é justamente quando ninguém está olhando pro
// código. Aqui ela fica presa por número.

import { describe, it, expect } from "vitest";
import { composerMaxHeight, readKeyboardHeight } from "../src/ui/composerSize";

describe("composerMaxHeight", () => {
  it("sem teclado: 40% da tela", () => {
    expect(composerMaxHeight(812)).toBe(324);
  });

  it("com teclado: 40% do que SOBRA, não da tela inteira", () => {
    // 812 de tela, 320 de teclado → 492 visíveis → 196
    expect(composerMaxHeight(812, 320)).toBe(196);
    // e é bem menor que a conta antiga
    expect(composerMaxHeight(812, 320)).toBeLessThan(
      Math.round(812 * 0.4)
    );
  });

  it("o campo nunca passa de 40% do visível", () => {
    const visivel = 812 - 320;
    expect(composerMaxHeight(812, 320) / visivel).toBeLessThanOrEqual(0.4);
  });

  it("visualViewport menor que a conta do teclado manda", () => {
    // teclado não reportado (0), mas o viewport já encolheu
    expect(composerMaxHeight(812, 0, 400)).toBe(160);
  });

  it("usa o MENOR dos dois sinais", () => {
    expect(composerMaxHeight(812, 320, 600)).toBe(196);
    expect(composerMaxHeight(812, 100, 400)).toBe(160);
  });

  it("teclado maior que a tela não zera o campo", () => {
    expect(composerMaxHeight(500, 900)).toBe(200);
  });

  it("janela ainda sem layout cai no piso", () => {
    expect(composerMaxHeight(0)).toBe(72);
    expect(composerMaxHeight(0, 0, 0)).toBe(72);
  });

  it("tela minúscula ainda deixa o campo utilizável", () => {
    expect(composerMaxHeight(160, 0)).toBe(72);
  });
});

describe("readKeyboardHeight", () => {
  const docComVar = (valor: string): Document =>
    ({ documentElement: { style: { getPropertyValue: () => valor } } }) as unknown as Document;

  it("lê o px publicado pelo Obsidian", () => {
    expect(readKeyboardHeight(docComVar("320px"))).toBe(320);
  });

  it("teclado fechado (vazio ou 0) é zero", () => {
    expect(readKeyboardHeight(docComVar(""))).toBe(0);
    expect(readKeyboardHeight(docComVar("0px"))).toBe(0);
  });

  it("lixo não vira NaN", () => {
    expect(readKeyboardHeight(docComVar("auto"))).toBe(0);
  });
});
