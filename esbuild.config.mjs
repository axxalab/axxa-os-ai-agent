import esbuild from "esbuild";
import process from "process";
import fs from "fs";
import path from "path";
import builtins from "builtin-modules";

const prod = process.argv[2] === "production";

// Garante que /output existe e copia os assets estáticos (manifest + css)
// para lá. Esses 3 arquivos juntos (main.js + manifest.json + styles.css)
// são o "pacote" que o Obsidian precisa pra carregar o plugin.
function syncAssets() {
  fs.mkdirSync("output", { recursive: true });
  fs.copyFileSync("manifest.json", path.join("output", "manifest.json"));
  fs.copyFileSync(path.join("styles", "main.css"), path.join("output", "styles.css"));
}

const copyAssetsPlugin = {
  name: "axxa-copy-assets",
  setup(build) {
    build.onStart(() => {
      syncAssets();
    });
    build.onEnd((result) => {
      if (result.errors.length === 0) {
        // Re-sincroniza após cada rebuild (watch mode pega mudanças em manifest/styles)
        syncAssets();
      }
    });
  },
};

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "output/main.js",
  plugins: [copyAssetsPlugin],
});

if (prod) {
  await context.rebuild();
  await context.dispose();
  process.exit(0);
} else {
  await context.watch();
}
