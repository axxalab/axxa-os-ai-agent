import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("obsidian", () => import("./obsidian-stub"));

const {
  buildMultipartBody,
  audioMimeFor,
  extractTranscript,
  transcribeAudio,
  TRANSCRIBE_MAX_BYTES,
} = await import("../src/providers/transcribe");
const { __setRequestUrl } = await import("./obsidian-stub");
const { ProviderError } = await import("../src/providers/base");

const dec = new TextDecoder();
const bytes = (s: string) => new TextEncoder().encode(s);

afterEach(() => __setRequestUrl(null));

describe("buildMultipartBody — o corpo que o requestUrl envia", () => {
  it("campo de texto sai com o boundary e o content-disposition certos", () => {
    const { body, contentType } = buildMultipartBody(
      [{ name: "model", value: "whisper-1" }],
      "BOUND"
    );
    expect(contentType).toBe("multipart/form-data; boundary=BOUND");
    expect(dec.decode(body)).toBe(
      '--BOUND\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n--BOUND--\r\n'
    );
  });

  it("arquivo carrega filename + content-type e os bytes intactos", () => {
    const { body } = buildMultipartBody(
      [
        {
          name: "file",
          filename: "a.webm",
          contentType: "audio/webm",
          data: bytes("BINÁRIO"),
        },
      ],
      "B"
    );
    const out = dec.decode(body);
    expect(out).toContain('name="file"; filename="a.webm"');
    expect(out).toContain("Content-Type: audio/webm");
    expect(out).toContain("BINÁRIO");
    expect(out.endsWith("--B--\r\n")).toBe(true);
  });

  it("bytes binários crus (não-UTF8) atravessam sem corromper", () => {
    const raw = new Uint8Array([0x00, 0xff, 0x1a, 0x45, 0xdf, 0xa3]);
    const { body } = buildMultipartBody(
      [{ name: "file", filename: "a.webm", contentType: "audio/webm", data: raw }],
      "B"
    );
    const view = new Uint8Array(body);
    // Procura a sequência crua dentro do corpo montado.
    const idx = view.findIndex(
      (_, i) => raw.every((b, k) => view[i + k] === b)
    );
    expect(idx).toBeGreaterThan(0);
  });

  it("boundary default é único entre chamadas", () => {
    const a = buildMultipartBody([{ name: "x", value: "1" }]).contentType;
    const b = buildMultipartBody([{ name: "x", value: "1" }]).contentType;
    expect(a).not.toBe(b);
  });
});

describe("audioMimeFor", () => {
  it("mapeia as extensões que o gravador produz", () => {
    expect(audioMimeFor("axxa-ai/recordings/x.webm")).toBe("audio/webm");
    expect(audioMimeFor("x.m4a")).toBe("audio/mp4");
    expect(audioMimeFor("x.ogg")).toBe("audio/ogg");
    expect(audioMimeFor("x.mp3")).toBe("audio/mpeg");
    expect(audioMimeFor("x.wav")).toBe("audio/wav");
  });

  it("extensão desconhecida cai no webm (o default do MediaRecorder)", () => {
    expect(audioMimeFor("sem-extensao")).toBe("audio/webm");
  });
});

describe("extractTranscript", () => {
  it("lê o campo text do JSON", () => {
    expect(extractTranscript({ text: " oi mundo " })).toBe("oi mundo");
  });

  it("aceita resposta em texto puro (response_format=text)", () => {
    expect(extractTranscript(undefined, "oi mundo")).toBe("oi mundo");
  });

  it("não confunde um JSON cru com transcript", () => {
    expect(extractTranscript(undefined, '{"error":"x"}')).toBe("");
  });

  it("vazio é vazio", () => {
    expect(extractTranscript({ text: "   " }, "")).toBe("");
  });
});

describe("transcribeAudio — contrato de erro", () => {
  const base = {
    apiKey: "sk-test",
    model: "gpt-4o-mini-transcribe",
    data: bytes("audio"),
    filename: "a.webm",
  };

  it("sem key → no-key, sem tocar na rede", async () => {
    __setRequestUrl(async () => {
      throw new Error("não devia chamar");
    });
    await expect(transcribeAudio({ ...base, apiKey: "" })).rejects.toMatchObject({
      code: "no-key",
    });
  });

  it("arquivo acima do teto da API é barrado antes do upload", async () => {
    __setRequestUrl(async () => {
      throw new Error("não devia chamar");
    });
    await expect(
      transcribeAudio({
        ...base,
        data: new Uint8Array(TRANSCRIBE_MAX_BYTES + 1),
      })
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("401 vira invalid-key e 429 vira rate-limit", async () => {
    __setRequestUrl(async () => ({ status: 401, json: {}, text: "" }));
    await expect(transcribeAudio(base)).rejects.toMatchObject({
      code: "invalid-key",
    });
    __setRequestUrl(async () => ({ status: 429, json: {}, text: "" }));
    await expect(transcribeAudio(base)).rejects.toMatchObject({
      code: "rate-limit",
    });
  });

  it("200 devolve o transcript e manda o modelo escolhido no corpo", async () => {
    let sent: any = null;
    __setRequestUrl(async (opts: any) => {
      sent = opts;
      return { status: 200, json: { text: "bom dia" }, text: "" };
    });
    await expect(transcribeAudio(base)).resolves.toBe("bom dia");
    expect(sent.contentType).toContain("multipart/form-data; boundary=");
    expect(sent.headers.Authorization).toBe("Bearer sk-test");
    expect(dec.decode(sent.body)).toContain("gpt-4o-mini-transcribe");
  });

  it("language opcional só entra quando informado", async () => {
    let sent: any = null;
    __setRequestUrl(async (opts: any) => {
      sent = opts;
      return { status: 200, json: { text: "ok" }, text: "" };
    });
    await transcribeAudio(base);
    expect(dec.decode(sent.body)).not.toContain('name="language"');
    await transcribeAudio({ ...base, language: "pt" });
    expect(dec.decode(sent.body)).toContain('name="language"');
  });

  it("200 com corpo vazio não vira transcript fantasma", async () => {
    __setRequestUrl(async () => ({ status: 200, json: {}, text: "" }));
    await expect(transcribeAudio(base)).rejects.toBeInstanceOf(ProviderError);
  });
});
