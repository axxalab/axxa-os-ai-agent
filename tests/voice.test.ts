import { describe, it, expect } from "vitest";
import { extensionFor, formatDuration } from "../src/ui/useVoice";

describe("formatDuration", () => {
  it("mm:ss com o segundo sempre em dois dígitos", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(3)).toBe("0:03");
    expect(formatDuration(59)).toBe("0:59");
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(75)).toBe("1:15");
    expect(formatDuration(620)).toBe("10:20");
  });

  it("trunca a fração — o relógio da gravação chega quebrado", () => {
    expect(formatDuration(3.99)).toBe("0:03");
    expect(formatDuration(59.5)).toBe("0:59");
  });

  it("nunca mostra tempo negativo", () => {
    expect(formatDuration(-5)).toBe("0:00");
  });
});

describe("extensionFor", () => {
  it("acompanha o contêiner que o aparelho escolheu", () => {
    // É por esta extensão que o motor monta o content-type do multipart, e é
    // por ela que a API sniffa o formato — errar aqui é 400 na transcrição.
    expect(extensionFor("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionFor("audio/mp4")).toBe("mp4");
    expect(extensionFor("audio/ogg;codecs=opus")).toBe("ogg");
    expect(extensionFor("audio/wav")).toBe("wav");
  });

  it("desconhecido cai em webm, que é o que o Chromium grava", () => {
    expect(extensionFor("")).toBe("webm");
    expect(extensionFor("audio/x-qualquer-coisa")).toBe("webm");
  });
});
