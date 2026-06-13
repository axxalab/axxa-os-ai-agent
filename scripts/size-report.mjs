// scripts/size-report.mjs
// Régua de tamanho do plugin (Frente 0 do plano 1.0). Mede o que REALMENTE vai
// pro Obsidian (output/) em gzip + LOC da fonte. Roda no fim do build prod e
// avulso: `npm run size`. Tetos = warn (não quebram o build) até a gente firmar.

import fs from "fs";
import zlib from "zlib";
import path from "path";

const OUT = "output";
// Tetos em KB gzip — disciplina de tamanho. Ajustar conforme o plano avança.
const BUDGET = { "main.js": 260, "styles.css": 45 };

const kb = (n) => (n / 1024).toFixed(1);
const gz = (buf) => zlib.gzipSync(buf).length;

function locOf(dir, exts) {
  let n = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) n += locOf(p, exts);
    else if (exts.some((x) => e.name.endsWith(x)))
      n += fs.readFileSync(p, "utf8").split("\n").length;
  }
  return n;
}

export function report() {
  console.log("\n— AXXA · régua de tamanho (output instalado) —");
  let over = false;
  for (const f of ["main.js", "styles.css"]) {
    const p = path.join(OUT, f);
    if (!fs.existsSync(p)) continue;
    const buf = fs.readFileSync(p);
    const g = gz(buf);
    const teto = BUDGET[f];
    const flag = teto && g / 1024 > teto ? "  ⚠ ACIMA DO TETO" : "";
    if (flag) over = true;
    console.log(
      `  ${f.padEnd(11)} ${kb(buf.length).padStart(7)} KB raw  ${kb(g).padStart(6)} KB gz  (teto ${teto}KB)${flag}`
    );
  }
  const tsLoc = locOf("src", [".ts", ".tsx"]);
  const cssLoc = fs.existsSync("styles/main.css")
    ? fs.readFileSync("styles/main.css", "utf8").split("\n").length
    : 0;
  console.log(`  fonte (nosso lado): ${tsLoc} LOC TS · ${cssLoc} linhas CSS\n`);
  return !over;
}

const isDirect = process.argv[1] && process.argv[1].endsWith("size-report.mjs");
if (isDirect) report();
