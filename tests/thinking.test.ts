// tests/thinking.test.ts
// A linha de espera: o relógio e o rodízio de verbos. São as duas coisas que
// o usuário lê enquanto não tem resposta — e as duas que quebram calado (um
// verbo repetido pra sempre, um relógio que mostra "-1s").

import { describe, it, expect } from "vitest";
import {
  THINKING_VERBS,
  VERB_MS,
  verbAt,
  elapsedLabel,
} from "../src/ui/Thinking";

describe("verbAt", () => {
  it("começa no primeiro verbo", () => {
    expect(verbAt(0)).toBe(THINKING_VERBS[0]);
    expect(verbAt(VERB_MS - 1)).toBe(THINKING_VERBS[0]);
  });

  it("troca de verbo a cada fatia", () => {
    expect(verbAt(VERB_MS)).toBe(THINKING_VERBS[1]);
    expect(verbAt(VERB_MS * 2)).toBe(THINKING_VERBS[2]);
  });

  it("dá a volta quando acaba a lista, sem quebrar", () => {
    const n = THINKING_VERBS.length;
    expect(verbAt(VERB_MS * n)).toBe(THINKING_VERBS[0]);
    expect(verbAt(VERB_MS * (n + 3))).toBe(THINKING_VERBS[3]);
  });

  it("tempo negativo (relógio torto) não estoura", () => {
    expect(verbAt(-5000)).toBe(THINKING_VERBS[0]);
  });

  it("são vários verbos DIFERENTES", () => {
    expect(THINKING_VERBS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(THINKING_VERBS).size).toBe(THINKING_VERBS.length);
  });
});

describe("elapsedLabel", () => {
  it("segundos enquanto cabem", () => {
    expect(elapsedLabel(0)).toBe("0s");
    expect(elapsedLabel(7_400)).toBe("7s");
    expect(elapsedLabel(59_900)).toBe("59s");
  });

  it("vira minuto com os segundos em duas casas", () => {
    expect(elapsedLabel(60_000)).toBe("1m 00s");
    expect(elapsedLabel(72_000)).toBe("1m 12s");
    expect(elapsedLabel(605_000)).toBe("10m 05s");
  });

  it("nunca mostra negativo", () => {
    expect(elapsedLabel(-3000)).toBe("0s");
  });
});
