// storybook/build.mjs
// Build + serve do storybook. `node storybook/build.mjs` builda uma vez;
// `node storybook/build.mjs serve [porta]` sobe um servidor com watch.
// Bundle usa os MESMOS aliases preact do plugin + o shim de "obsidian".

import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import process from "process";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "storybook", "dist");
const serve = process.argv[2] === "serve";
const port = Number(process.argv[3] ?? 6006);

fs.mkdirSync(dist, { recursive: true });
fs.copyFileSync(path.join(root, "storybook", "index.html"), path.join(dist, "index.html"));
fs.copyFileSync(path.join(root, "storybook", "theme.css"), path.join(dist, "theme.css"));
fs.copyFileSync(path.join(root, "styles", "main.css"), path.join(dist, "plugin.css"));

const ctx = await esbuild.context({
  entryPoints: [path.join(root, "storybook", "main.tsx")],
  bundle: true,
  format: "iife",
  target: "es2020",
  sourcemap: "inline",
  logLevel: "info",
  alias: {
    react: "preact/compat",
    "react-dom": "preact/compat",
    "react-dom/client": path.join(root, "src", "shims", "reactDomClient.ts"),
    "react/jsx-runtime": "preact/jsx-runtime",
    obsidian: path.join(root, "storybook", "obsidian-shim.ts"),
  },
  outfile: path.join(dist, "main.js"),
});

if (serve) {
  await ctx.watch();
  const served = await ctx.serve({ servedir: dist, port });
  console.log(`storybook em http://${served.host ?? "localhost"}:${served.port ?? port}`);
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
