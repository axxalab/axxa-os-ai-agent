import { describe, it, expect, vi, afterEach } from "vitest";
import {
  plainForSpeech,
  claimSpeaker,
  releaseSpeaker,
  listVoices,
  cancelSpeech,
  speak,
  isSpeechRecognitionAvailable,
  startDictation,
} from "../src/components/_shared/speech";

// plainForSpeech é puro (não toca window) — limpa markdown antes do TTS ler.
describe("plainForSpeech", () => {
  it("remove blocos de código inteiros (com linguagem)", () => {
    const out = plainForSpeech("antes\n```js\ncode()\nmore()\n```\ndepois");
    expect(out).not.toContain("code()");
    expect(out).not.toContain("more()");
    expect(out).toContain("antes");
    expect(out).toContain("depois");
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
  it("tira marcadores de heading / blockquote / lista / tabela", () => {
    const out = plainForSpeech("# Título\n> citação\n| a | b |");
    expect(out).not.toMatch(/[#>|]/);
    expect(out).toContain("Título");
  });
  it("colapsa parágrafos múltiplos em pausa de frase", () => {
    expect(plainForSpeech("linha1\n\n\nlinha2")).toBe("linha1. linha2");
  });
  it("texto já limpo passa inalterado", () => {
    expect(plainForSpeech("Olá, tudo bem?")).toBe("Olá, tudo bem?");
  });
  it("string vazia / só espaços → vazio", () => {
    expect(plainForSpeech("   ")).toBe("");
    expect(plainForSpeech("")).toBe("");
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
    claimSpeaker(resetB);
    expect(resetA).toHaveBeenCalledTimes(1);
    expect(resetB).not.toHaveBeenCalled();
    releaseSpeaker(resetB);
  });
  it("claim do MESMO ref duas vezes não auto-reseta", () => {
    const resetA = vi.fn();
    claimSpeaker(resetA);
    claimSpeaker(resetA); // mesmo dono → não chama o próprio reset
    expect(resetA).not.toHaveBeenCalled();
    releaseSpeaker(resetA);
  });
  it("cadeia A→B→A reseta o anterior em cada troca", () => {
    const a = vi.fn();
    const b = vi.fn();
    claimSpeaker(a);
    claimSpeaker(b); // reseta a
    claimSpeaker(a); // reseta b
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    releaseSpeaker(a);
  });
  it("release de quem NÃO é o dono é no-op", () => {
    const a = vi.fn();
    const b = vi.fn();
    claimSpeaker(a);
    releaseSpeaker(b); // b nunca foi dono
    claimSpeaker(b); // a ainda era dono → a é resetado
    expect(a).toHaveBeenCalledTimes(1);
    releaseSpeaker(b);
  });
});

// Degradação graciosa — ambiente SEM speechSynthesis / SpeechRecognition
// (ex: Electron sem backend, WebView mobile). v0.1.196
describe("graceful degradation (sem Web Speech)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("listVoices() → [] quando não há speechSynthesis", () => {
    vi.stubGlobal("window", {});
    expect(listVoices()).toEqual([]);
  });
  it("cancelSpeech() não lança quando não há speechSynthesis", () => {
    vi.stubGlobal("window", {});
    expect(() => cancelSpeech()).not.toThrow();
  });
  it("speak() devolve false + chama onError quando não há TTS", () => {
    vi.stubGlobal("window", {});
    const onError = vi.fn();
    expect(speak("oi", { onError })).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
  });
  it("isSpeechRecognitionAvailable() false sem ctor; startDictation → null", () => {
    vi.stubGlobal("window", {});
    expect(isSpeechRecognitionAvailable()).toBe(false);
    expect(
      startDictation("pt-BR", { onFinal: () => {} })
    ).toBeNull();
  });
  it("detecta webkitSpeechRecognition quando presente", () => {
    vi.stubGlobal("window", { webkitSpeechRecognition: function () {} });
    expect(isSpeechRecognitionAvailable()).toBe(true);
  });
});

// Caminho feliz do TTS — speechSynthesis + utterance mockados.
describe("speak() — caminho com TTS disponível", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("aplica voz/rate, cancela o anterior e fala", () => {
    const speakSpy = vi.fn();
    const cancelSpy = vi.fn();
    const voice = { voiceURI: "v1", name: "Ara", lang: "pt-BR" };
    vi.stubGlobal("window", {
      speechSynthesis: {
        speak: speakSpy,
        cancel: cancelSpy,
        getVoices: () => [voice],
      },
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        rate = 1;
        voice: unknown = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(t: string) {
          this.text = t;
        }
      }
    );
    const ok = speak("olá", { voiceURI: "v1", rate: 3 }); // rate clampa pra 2
    expect(ok).toBe(true);
    expect(cancelSpy).toHaveBeenCalled();
    expect(speakSpy).toHaveBeenCalledTimes(1);
    const utter = speakSpy.mock.calls[0][0];
    expect(utter.text).toBe("olá");
    expect(utter.rate).toBe(2); // clamp 0.5..2
    expect(utter.voice).toBe(voice);
  });
});
