import { describe, it, expect, vi } from "vitest";
import {
  plainForSpeech,
  claimSpeaker,
  releaseSpeaker,
} from "../src/components/_shared/speech";

// plainForSpeech é puro (não toca window) — limpa markdown antes do TTS ler.
describe("plainForSpeech", () => {
  it("remove blocos de código inteiros", () => {
    expect(plainForSpeech("antes\n```js\ncode()\n```\ndepois")).not.toContain("code()");
  });
  it("desembrulha inline code, bold/italic e links", () => {
    expect(plainForSpeech("use `foo` e **bar** e [texto](http://x)")).toBe(
      "use foo e bar e texto"
    );
  });
  it("remove imagens markdown", () => {
    const out = plainForSpeech("veja ![alt](http://img.png) aqui");
    expect(out).not.toContain("img.png");
    expect(out).not.toContain("alt");
    expect(out).toContain("veja");
    expect(out).toContain("aqui");
  });
  it("colapsa parágrafos em pausa de frase", () => {
    expect(plainForSpeech("linha1\n\nlinha2")).toBe("linha1. linha2");
  });
  it("string vazia → vazio", () => {
    expect(plainForSpeech("   ")).toBe("");
  });
});

// Exclusividade de fala: novo falante reseta o anterior (cuja fala foi cortada
// pelo cancel() global do speechSynthesis). v0.1.195
describe("claimSpeaker / releaseSpeaker", () => {
  it("um novo claim reseta o falante anterior", () => {
    const resetA = vi.fn();
    const resetB = vi.fn();
    claimSpeaker(resetA);
    expect(resetA).not.toHaveBeenCalled();
    claimSpeaker(resetB); // B assume → A é resetado
    expect(resetA).toHaveBeenCalledTimes(1);
    expect(resetB).not.toHaveBeenCalled();
    releaseSpeaker(resetB);
  });
  it("release só limpa se ainda for o dono atual", () => {
    const resetA = vi.fn();
    const resetB = vi.fn();
    claimSpeaker(resetA);
    releaseSpeaker(resetB); // B não é o dono → no-op
    claimSpeaker(resetB); // como A ainda era dono, A é resetado
    expect(resetA).toHaveBeenCalledTimes(1);
    releaseSpeaker(resetB);
  });
});
