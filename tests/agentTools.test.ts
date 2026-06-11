import { describe, it, expect } from "vitest";
import {
  toolVaultRead,
  toolVaultCreate,
  toolVaultEdit,
  toolVaultMove,
  toolVaultDelete,
} from "../src/agent/tools";

// As tools do agent MODIFICAM/APAGAM arquivos do vault — o sandboxing de path
// (anti traversal) é segurança crítica. Aqui um adapter em memória exercita o
// boundary real + os comportamentos das tools.

function makeApp() {
  const files = new Map<string, string>();
  const folders = new Set<string>([""]);
  const adapter = {
    async exists(p: string) {
      return files.has(p) || folders.has(p);
    },
    async read(p: string) {
      if (!files.has(p)) throw new Error("not found");
      return files.get(p)!;
    },
    async write(p: string, c: string) {
      files.set(p, c);
    },
    async stat(p: string) {
      if (files.has(p)) return { type: "file", size: files.get(p)!.length };
      if (folders.has(p)) return { type: "folder" };
      return null;
    },
    async list(folder: string) {
      const base = folder === "/" ? "" : folder;
      const f: string[] = [];
      const d: string[] = [];
      for (const k of files.keys()) {
        const dir = k.includes("/") ? k.slice(0, k.lastIndexOf("/")) : "";
        if (dir === base) f.push(k);
      }
      for (const k of folders) {
        if (!k) continue;
        const dir = k.includes("/") ? k.slice(0, k.lastIndexOf("/")) : "";
        if (dir === base) d.push(k);
      }
      return { files: f, folders: d };
    },
    async rename(from: string, to: string) {
      files.set(to, files.get(from)!);
      files.delete(from);
    },
    async remove(p: string) {
      files.delete(p);
    },
    async rmdir(p: string) {
      folders.delete(p);
    },
    async mkdir(p: string) {
      folders.add(p);
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { app: { vault: { adapter } } as any, files };
}

describe("path sandboxing (segurança — anti traversal)", () => {
  const malicious = [
    "../secret.md",
    "../../etc/passwd",
    "notes/../../escape.md",
    "C:\\Windows\\System32", // backslash → vira ":" depois do normalize
    "drive:/x",
    "a/" + "b/".repeat(40) + "deep.md", // > 32 níveis
    "",
  ];
  for (const p of malicious) {
    it(`recusa "${p.slice(0, 24)}"`, async () => {
      const { app, files } = makeApp();
      await expect(toolVaultRead(app, { path: p })).rejects.toThrow();
      // nunca deve ter escrito/criado nada
      expect(files.size).toBe(0);
    });
  }

  it("path normal é aceito (read de arquivo existente)", async () => {
    const { app } = makeApp();
    await toolVaultCreate(app, { path: "notes/ok.md", content: "hi" });
    expect(await toolVaultRead(app, { path: "notes/ok.md" })).toBe("hi");
  });
});

describe("toolVaultCreate", () => {
  it("cria + recusa sobrescrever existente", async () => {
    const { app } = makeApp();
    await toolVaultCreate(app, { path: "a.md", content: "1" });
    await expect(toolVaultCreate(app, { path: "a.md", content: "2" })).rejects.toThrow(
      /já existe/i
    );
  });
});

describe("toolVaultEdit", () => {
  it("substitui ocorrência única", async () => {
    const { app, files } = makeApp();
    await toolVaultCreate(app, { path: "a.md", content: "olá mundo" });
    await toolVaultEdit(app, { path: "a.md", oldStr: "mundo", newStr: "vault" });
    expect(files.get("a.md")).toBe("olá vault");
  });
  it("RECUSA quando a string aparece N vezes (ambíguo)", async () => {
    const { app } = makeApp();
    await toolVaultCreate(app, { path: "a.md", content: "x x x" });
    await expect(
      toolVaultEdit(app, { path: "a.md", oldStr: "x", newStr: "y" })
    ).rejects.toThrow(/aparece 3x|ambig/i);
  });
  it("erro quando a string não existe", async () => {
    const { app } = makeApp();
    await toolVaultCreate(app, { path: "a.md", content: "abc" });
    await expect(
      toolVaultEdit(app, { path: "a.md", oldStr: "zzz", newStr: "y" })
    ).rejects.toThrow(/não encontrada/i);
  });
});

describe("toolVaultMove / Delete", () => {
  it("move e recusa sobrescrever destino", async () => {
    const { app, files } = makeApp();
    await toolVaultCreate(app, { path: "a.md", content: "1" });
    await toolVaultMove(app, { from: "a.md", to: "b.md" });
    expect(files.has("a.md")).toBe(false);
    expect(files.get("b.md")).toBe("1");

    await toolVaultCreate(app, { path: "c.md", content: "2" });
    await expect(toolVaultMove(app, { from: "c.md", to: "b.md" })).rejects.toThrow(
      /já existe/i
    );
  });
  it("deleta arquivo existente; erro se não existe", async () => {
    const { app, files } = makeApp();
    await toolVaultCreate(app, { path: "a.md", content: "1" });
    await toolVaultDelete(app, { path: "a.md" });
    expect(files.has("a.md")).toBe(false);
    await expect(toolVaultDelete(app, { path: "nope.md" })).rejects.toThrow(
      /não existe/i
    );
  });
});
