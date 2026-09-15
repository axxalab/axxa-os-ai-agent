import { describe, it, expect } from "vitest";
import {
  MAX_SEGMENT_MS,
  MIN_SEGMENT_MS,
  SILENCE_MS,
  bestAudioMime,
  joinTranscripts,
  shouldRotate,
} from "../src/ui/voiceSegments";

describe("shouldRotate", () => {
  it("não corta no meio da frase", () => {
    // Falando (silêncio 0), mesmo passado o mínimo: cortar aqui parte palavra.
    expect(
      shouldRotate({ duracaoMs: MIN_SEGMENT_MS + 5000, silencioMs: 0 })
    ).toBe(false);
  });

  it("não corta numa pausa curta demais — respiro não é fim de frase", () => {
    expect(
      shouldRotate({ duracaoMs: MIN_SEGMENT_MS + 1000, silencioMs: SILENCE_MS - 1 })
    ).toBe(false);
  });

  it("corta na pausa depois do mínimo", () => {
    expect(
      shouldRotate({ duracaoMs: MIN_SEGMENT_MS, silencioMs: SILENCE_MS })
    ).toBe(true);
  });

  it("segura o corte enquanto o segmento é curto, mesmo em silêncio", () => {
    // Senão um "alô" seguido de pausa vira uma chamada de rede por palavra.
    expect(
      shouldRotate({ duracaoMs: MIN_SEGMENT_MS - 1, silencioMs: 5000 })
    ).toBe(false);
  });

  it("no teto corta mesmo sem pausa nenhuma", () => {
    expect(shouldRotate({ duracaoMs: MAX_SEGMENT_MS, silencioMs: 0 })).toBe(true);
  });

  it("sem medidor de nível (silêncio sempre 0) só o teto corta", () => {
    expect(shouldRotate({ duracaoMs: MAX_SEGMENT_MS - 1, silencioMs: 0 })).toBe(
      false
    );
    expect(shouldRotate({ duracaoMs: MAX_SEGMENT_MS + 1, silencioMs: 0 })).toBe(
      true
    );
  });
});

describe("joinTranscripts", () => {
  it("junta os finais em ordem e põe o parcial no fim", () => {
    expect(joinTranscripts(["oi bom dia", "tudo bem"], "eu queria")).toBe(
      "oi bom dia tudo bem eu queria"
    );
  });

  it("sem parcial devolve só os finais", () => {
    expect(joinTranscripts(["oi", "tchau"])).toBe("oi tchau");
  });

  it("pula o segmento que ainda está voando em vez de travar o resto", () => {
    // O buraco chega em ~1s e o texto se corrige no lugar; segurar tudo faria
    // a tela parar justamente enquanto a pessoa fala.
    expect(joinTranscripts(["um", undefined, "três"], "quatro")).toBe(
      "um três quatro"
    );
  });

  it("some com espaço duplicado e sobra de borda", () => {
    expect(joinTranscripts(["  um  ", "", "  dois "], "  três ")).toBe(
      "um dois três"
    );
  });

  it("nada gravado é string vazia, não 'undefined'", () => {
    expect(joinTranscripts([], "")).toBe("");
    expect(joinTranscripts([undefined, undefined])).toBe("");
  });
});

describe("bestAudioMime", () => {
  it("prefere opus — é o mais leve, e leve é rápido", () => {
    expect(bestAudioMime(() => true)).toBe("audio/webm;codecs=opus");
  });

  it("cai pro que o aparelho aceita", () => {
    expect(bestAudioMime((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(bestAudioMime((t) => t.startsWith("audio/ogg"))).toBe(
      "audio/ogg;codecs=opus"
    );
  });

  it("aparelho que não aceita nenhum deixa o recorder escolher", () => {
    expect(bestAudioMime(() => false)).toBeUndefined();
  });
});
