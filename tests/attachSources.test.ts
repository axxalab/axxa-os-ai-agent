// tests/attachSources.test.ts
// As decisões das fontes do "+": o que conta como artefato, o que sobra de uma
// página web e o que fazer com um endereço digitado torto.

import { describe, it, expect } from "vitest";
import {
  rankArtifacts,
  htmlToText,
  htmlTitle,
  normalizeUrl,
  linkNote,
  isImageExt,
  attachmentLabel,
  attachmentThumb,
  noteKind,
  artifactIcon,
  GENERATION_DIR,
  type ArtifactLike,
} from "../src/ui/attachSources";

const f = (path: string, mtime: number): ArtifactLike => {
  const nome = path.split("/").pop() ?? "";
  const ponto = nome.lastIndexOf(".");
  return {
    path,
    basename: nome.slice(0, ponto),
    extension: nome.slice(ponto + 1),
    mtime,
  };
};

const vault: ArtifactLike[] = [
  f(`${GENERATION_DIR}/images/1700-gato.png`, 10),
  f(`${GENERATION_DIR}/images/1700-gato.md`, 11), // sidecar de metadata
  f(`${GENERATION_DIR}/audio/1800-fala.mp3`, 50),
  f(`${GENERATION_DIR}/video/1900-clipe.mp4`, 30),
  f("PROJECTS/FRAMEWORKS.md", 99),
  f("assets/foto-que-eu-tirei.png", 98),
];

describe("rankArtifacts", () => {
  it("é só o que o plugin gerou — foto solta do vault não entra", () => {
    expect(rankArtifacts(vault).map((x) => x.basename)).toEqual([
      "1800-fala",
      "1900-clipe",
      "1700-gato",
    ]);
  });

  it("o sidecar .md não aparece (é metadata, não artefato)", () => {
    expect(rankArtifacts(vault).some((x) => x.extension === "md")).toBe(false);
  });

  it("mais recente primeiro", () => {
    expect(rankArtifacts(vault)[0].mtime).toBe(50);
  });

  it("respeita o limite", () => {
    expect(rankArtifacts(vault, 2)).toHaveLength(2);
  });
});

describe("isImageExt", () => {
  it("reconhece imagem (e não confunde com áudio)", () => {
    expect(isImageExt("PNG")).toBe(true);
    expect(isImageExt("webp")).toBe(true);
    expect(isImageExt("mp3")).toBe(false);
  });
});

describe("htmlToText", () => {
  it("joga fora script e style", () => {
    const t = htmlToText(
      "<style>p{color:red}</style><p>oi</p><script>alert(1)</script>"
    );
    expect(t).toBe("oi");
    expect(t).not.toContain("alert");
  });

  it("vira texto com quebras onde o bloco fecha", () => {
    expect(htmlToText("<h1>Título</h1><p>um</p><p>dois</p>")).toBe(
      "Título\num\ndois"
    );
  });

  it("desfaz as entidades comuns", () => {
    expect(htmlToText("<p>a &amp; b &lt;c&gt; &quot;d&quot;</p>")).toBe(
      'a & b <c> "d"'
    );
  });

  it("corta o que é grande demais e avisa", () => {
    const t = htmlToText("<p>" + "x".repeat(30000) + "</p>", 100);
    expect(t.endsWith("[…]")).toBe(true);
    expect(t.length).toBeLessThan(200);
  });
});

describe("htmlTitle", () => {
  it("pega o title", () => {
    expect(htmlTitle("<html><title> Minha  página </title>")).toBe(
      "Minha página"
    );
  });
  it("sem title devolve null", () => {
    expect(htmlTitle("<html><body>nada</body>")).toBeNull();
  });
});

describe("normalizeUrl", () => {
  it("completa o https que ninguém digita", () => {
    expect(normalizeUrl("obsidian.md")).toBe("https://obsidian.md/");
  });
  it("mantém o que já veio completo", () => {
    expect(normalizeUrl("http://x.com/a?b=1")).toBe("http://x.com/a?b=1");
  });
  it("texto que não é endereço não vira link", () => {
    expect(normalizeUrl("resume essa nota")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });
});

describe("linkNote", () => {
  it("guarda a fonte no topo, pra resposta poder citar", () => {
    const att = linkNote("https://x.com", "Título", "corpo");
    expect(att.type).toBe("note");
    expect(att.path).toBe("Título — https://x.com");
    expect(att.content.startsWith("Fonte: https://x.com")).toBe(true);
    expect(att.content).toContain("corpo");
  });

  it("sem título o rótulo é o endereço", () => {
    expect(linkNote("https://x.com", null, "c").path).toBe("https://x.com");
  });
});

// O rótulo do chip: o que aparece é o título ou o host — nunca o último
// pedaço do caminho da URL (isso virava "spaced" numa página de wikipedia).
describe("attachmentLabel", () => {
  it("link com título mostra o título", () => {
    expect(attachmentLabel(linkNote("https://x.com/a/b", "Spaced repetition", "c"))).toBe(
      "Spaced repetition"
    );
  });

  it("link sem título mostra o host", () => {
    expect(attachmentLabel(linkNote("https://wikipedia.org/spaced", null, "c"))).toBe(
      "wikipedia.org"
    );
  });

  it("nota do vault continua pelo nome do arquivo", () => {
    expect(
      attachmentLabel({ type: "note", path: "PROJECTS/FRAMEWORKS.md", content: "" })
    ).toBe("FRAMEWORKS.md");
  });

  it("imagem mostra o nome do arquivo", () => {
    expect(
      attachmentLabel({ type: "image", dataUrl: "data:,", name: "print.png" })
    ).toBe("print.png");
  });
});

describe("artifactIcon", () => {
  it("cada mídia com o seu", () => {
    expect(artifactIcon("png")).toBe("image");
    expect(artifactIcon("mp4")).toBe("file-video");
    expect(artifactIcon("mp3")).toBe("file-audio");
  });
});

describe("attachmentThumb", () => {
  it("imagem mostra a MINIATURA de verdade", () => {
    expect(
      attachmentThumb({ type: "image", dataUrl: "data:image/png;base64,AA" })
    ).toEqual({ kind: "image", url: "data:image/png;base64,AA" });
  });

  it("link, texto colado e nota do vault têm emojis DIFERENTES", () => {
    const link = attachmentThumb(linkNote("https://x.com", "T", "c"));
    const colado = attachmentThumb({
      type: "note",
      path: "Pasted text (5.2k)",
      content: "x",
    });
    const nota = attachmentThumb({
      type: "note",
      path: "PROJECTS/FRAMEWORKS.md",
      content: "x",
    });
    expect([link, colado, nota].map((t) => t.kind)).toEqual([
      "emoji",
      "emoji",
      "emoji",
    ]);
    const chars = [link, colado, nota].map((t) =>
      t.kind === "emoji" ? t.char : ""
    );
    expect(new Set(chars).size).toBe(3);
  });

  it("PDF e áudio têm o seu", () => {
    expect(attachmentThumb({ type: "pdf", name: "a.pdf" })).toEqual({
      kind: "emoji",
      char: "📕",
    });
    expect(attachmentThumb({ type: "audio", path: "a.webm" })).toEqual({
      kind: "emoji",
      char: "🎙️",
    });
  });
});

describe("noteKind", () => {
  it("separa link, colado e nota", () => {
    expect(noteKind("Título — https://x.com")).toBe("link");
    expect(noteKind("https://x.com")).toBe("link");
    expect(noteKind("Pasted text (5.2k)")).toBe("pasted");
    expect(noteKind("PROJECTS/FRAMEWORKS.md")).toBe("vault");
  });
});
