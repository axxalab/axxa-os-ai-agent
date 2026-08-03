import { describe, it, expect, vi } from "vitest";

vi.mock("obsidian", () => import("./obsidian-stub"));

const {
  parseDataUrl,
  pdfFileData,
  hasPdfAttachment,
  toOpenAIMessages,
} = await import("../src/providers/_shared");
const { toAnthropicPayload } = await import("../src/providers/anthropic");
const { applyPdfPlugin } = await import("../src/providers/openrouter");
const { supportsPdf, getModelCapabilities } = await import(
  "../src/providers/modelCapabilities"
);

const B64 = "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2c+Pgo=";
const PDF_URL = `data:application/pdf;base64,${B64}`;

// `dataUrl: null` = anexo ilegível (o default só vale quando o arg é omitido;
// um `undefined` explícito cairia no default e mataria justamente esse caso).
const userWithPdf = (name = "contrato.pdf", dataUrl: string | null = PDF_URL) => [
  {
    role: "user" as const,
    content: "resume esse pdf",
    attachments: [{ type: "pdf" as const, name, dataUrl: dataUrl ?? undefined }],
  },
];

// ────────────────────────────── data URLs ──────────────────────────────

describe("parseDataUrl / pdfFileData", () => {
  it("parseia mime + base64 de uma data URL", () => {
    expect(parseDataUrl(PDF_URL)).toEqual({
      mediaType: "application/pdf",
      base64: B64,
    });
  });

  it("recusa URL externa, string vazia e data URL sem base64", () => {
    expect(parseDataUrl("https://x.com/a.pdf")).toBeNull();
    expect(parseDataUrl("")).toBeNull();
    expect(parseDataUrl(undefined)).toBeNull();
    expect(parseDataUrl("data:application/pdf,texto")).toBeNull();
  });

  it("pdfFileData normaliza o prefixo e aceita base64 cru", () => {
    expect(pdfFileData(PDF_URL)).toBe(PDF_URL);
    expect(pdfFileData(B64)).toBe(PDF_URL);
  });

  it("pdfFileData recusa data URL que não é PDF (imagem não vira arquivo)", () => {
    expect(pdfFileData("data:image/png;base64,AAAA")).toBeNull();
    expect(pdfFileData("data:text/plain;base64,AAAA")).toBeNull();
  });

  it("octet-stream (WebView Android no .pdf) é re-rotulado, não descartado", () => {
    expect(pdfFileData(`data:application/octet-stream;base64,${B64}`)).toBe(PDF_URL);
  });

  it("hasPdfAttachment ignora anexo com dataUrl inutilizável", () => {
    expect(hasPdfAttachment(userWithPdf())).toBe(true);
    expect(hasPdfAttachment(userWithPdf("a.pdf", null))).toBe(false);
    expect(
      hasPdfAttachment([{ role: "user", content: "oi" }])
    ).toBe(false);
  });
});

// ────────────────────────── capability derivada ──────────────────────────

describe("supportsPdf — quem realmente recebe o anexo", () => {
  const vision = { vision: true };
  const noVision = { vision: false };

  it("Claude 3.5+ aceita; Claude 3 original / 2 / instant não", () => {
    expect(supportsPdf("anthropic", "claude-opus-5", noVision)).toBe(true);
    expect(supportsPdf("anthropic", "claude-3-5-sonnet-20241022", noVision)).toBe(true);
    expect(supportsPdf("anthropic", "claude-3-7-sonnet", noVision)).toBe(true);
    expect(supportsPdf("anthropic", "claude-3-opus-20240229", noVision)).toBe(false);
    expect(supportsPdf("anthropic", "claude-3-haiku-20240307", noVision)).toBe(false);
    expect(supportsPdf("anthropic", "claude-2.1", noVision)).toBe(false);
  });

  it("OpenAI segue a visão (gpt-4o em diante)", () => {
    expect(supportsPdf("openai", "gpt-4o", vision)).toBe(true);
    expect(supportsPdf("openai", "o1-mini", noVision)).toBe(false);
  });

  it("OpenRouter aceita qualquer modelo de chat (file-parser cobre o resto)", () => {
    expect(supportsPdf("openrouter", "meta-llama/llama-3.1-8b", noVision)).toBe(true);
  });

  it("providers cujo transporte não carrega arquivo ficam de fora", () => {
    expect(supportsPdf("gemini", "gemini-2.5-pro", vision)).toBe(false);
    expect(supportsPdf("nim", "meta/llama-3.1-70b", vision)).toBe(false);
    expect(supportsPdf("ollama", "llama3.2", vision)).toBe(false);
  });

  it("modelo de geração nunca recebe PDF de entrada", () => {
    expect(supportsPdf("openai", "gpt-image-1", { vision: true, imageGen: true })).toBe(false);
  });

  it("getModelCapabilities expõe o flag derivado", () => {
    expect(getModelCapabilities("anthropic", "claude-opus-5").pdf).toBe(true);
    expect(getModelCapabilities("gemini", "gemini-2.5-pro").pdf).toBe(false);
  });
});

// ─────────────────────────────── wire ───────────────────────────────

describe("Anthropic — bloco document", () => {
  it("PDF vira document base64 ANTES do texto", () => {
    const { messages } = toAnthropicPayload(userWithPdf());
    const blocks = messages[0].content as Array<Record<string, any>>;
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks[0]).toEqual({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: B64 },
      title: "contrato.pdf",
    });
    expect(blocks[1]).toEqual({ type: "text", text: "resume esse pdf" });
  });

  it("anexo ilegível é pulado e a mensagem continua indo como texto", () => {
    const { messages } = toAnthropicPayload(userWithPdf("a.pdf", "https://x/a.pdf"));
    expect(messages[0].content).toBe("resume esse pdf");
  });
});

describe("OpenAI-compat — content part file", () => {
  it("PDF vira part file com data URL, depois do texto", () => {
    const [msg] = toOpenAIMessages(userWithPdf()) as Array<Record<string, any>>;
    expect(msg.content).toEqual([
      { type: "text", text: "resume esse pdf" },
      { type: "file", file: { filename: "contrato.pdf", file_data: PDF_URL } },
    ]);
  });

  it("sem anexo utilizável a mensagem volta a ser string simples", () => {
    const [msg] = toOpenAIMessages(
      userWithPdf("a.pdf", null)
    ) as Array<Record<string, any>>;
    expect(msg.content).toBe("resume esse pdf");
  });

  it("imagem + PDF na mesma mensagem: os dois vão", () => {
    const [msg] = toOpenAIMessages([
      {
        role: "user",
        content: "olha",
        attachments: [
          { type: "image", dataUrl: "data:image/png;base64,AAAA" },
          { type: "pdf", name: "a.pdf", dataUrl: PDF_URL },
        ],
      },
    ]) as Array<Record<string, any>>;
    const types = (msg.content as Array<{ type: string }>).map((p) => p.type);
    expect(types).toEqual(["text", "image_url", "file"]);
  });
});

describe("OpenRouter — plugin file-parser", () => {
  const req = (model: string) => ({ model, messages: userWithPdf() });

  it("não mexe no body quando não há PDF", () => {
    const body = applyPdfPlugin({}, {
      model: "openai/gpt-4o",
      messages: [{ role: "user", content: "oi" }],
    } as any);
    expect(body.plugins).toBeUndefined();
  });

  it("modelo com visão usa engine native", () => {
    const body = applyPdfPlugin({}, req("openai/gpt-4o") as any);
    expect(body.plugins).toEqual([
      { id: "file-parser", pdf: { engine: "native" } },
    ]);
  });

  it("modelo sem visão usa o engine GRÁTIS — nunca o default pago", () => {
    const body = applyPdfPlugin({}, req("meta-llama/llama-3.1-8b-instruct") as any);
    expect(body.plugins).toEqual([
      { id: "file-parser", pdf: { engine: "cloudflare-ai" } },
    ]);
    expect(JSON.stringify(body)).not.toContain("mistral-ocr");
  });
});
