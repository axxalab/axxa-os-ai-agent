import esbuild from "esbuild";
import process from "process";
import fs from "fs";
import path from "path";
import builtins from "builtin-modules";
import { report } from "./scripts/size-report.mjs";

const prod = process.argv[2] === "production";

// Copia manifest + CSS pro output/. Em prod o CSS é MINIFICADO (o que vai pro
// Obsidian é espremido; a fonte styles/main.css segue legível do nosso lado).
// main.js + manifest.json + styles.css = o pacote que o Obsidian carrega.
async function syncAssets() {
  fs.mkdirSync("output", { recursive: true });
  fs.copyFileSync("manifest.json", path.join("output", "manifest.json"));
  const css = fs.readFileSync(path.join("styles", "main.css"), "utf8");
  const outCss = prod
    ? (await esbuild.transform(css, { loader: "css", minify: true })).code
    : css;
  fs.writeFileSync(path.join("output", "styles.css"), outCss);
}

const copyAssetsPlugin = {
  name: "axxa-copy-assets",
  setup(build) {
    build.onStart(async () => {
      await syncAssets();
    });
    build.onEnd(async (result) => {
      if (result.errors.length === 0) await syncAssets();
    });
  },
};

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  // Frente 1 (base 1.0): troca React+ReactDOM por Preact/compat SÓ no bundle que
  // vai pro Obsidian. Types e testes (vitest) seguem no React real — o alias é só
  // do esbuild. ~40KB gz a menos. APIs usadas (createPortal/useId/useLayoutEffect)
  // são cobertas pelo compat.
  alias: {
    react: "preact/compat",
    "react-dom": "preact/compat",
    // createRoot do React 18 não existe no preact/compat → shim sobre render().
    "react-dom/client": path.resolve("src/shims/reactDomClient.ts"),
    "react/jsx-runtime": "preact/jsx-runtime",
  },
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
  minify: prod,
  // Output espremido: sem console/debugger nem comentário legal no que vai pro
  // Obsidian (menor + mais difícil de copiar). A fonte mantém os logs.
  drop: prod ? ["console", "debugger"] : [],
  legalComments: "none",
  outfile: "output/main.js",
  plugins: [copyAssetsPlugin],
});

if (prod) {
  await context.rebuild();
  await context.dispose();
  report();
  process.exit(0);
} else {
  await context.watch();
}
