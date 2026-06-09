// scripts/genLogos.mjs
// Gera src/components/_shared/brandLogos.ts a partir de assets/svg/*.svg.
// Cada SVG é normalizado pro espaço 0 0 100 100 (convenção do addIcon do
// Obsidian) via translate+scale, preservando cores próprias (logos coloridos)
// ou currentColor (logos mono). Rode: `node scripts/genLogos.mjs`.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC = "assets/svg";
const OUT = "src/components/_shared/brandLogos.ts";
const r = (n) => Math.round(n * 1e4) / 1e4;

const files = readdirSync(SRC)
  .filter((f) => f.toLowerCase().endsWith(".svg"))
  .sort();

const entries = [];
for (const f of files) {
  const raw = readFileSync(join(SRC, f), "utf8");

  const vbMatch = raw.match(/viewBox\s*=\s*"([^"]+)"/i);
  let [minX, minY, w, h] = vbMatch
    ? vbMatch[1].trim().split(/[\s,]+/).map(Number)
    : [0, 0, 24, 24];
  if (!w || !h || Number.isNaN(w) || Number.isNaN(h)) {
    [minX, minY, w, h] = [0, 0, 24, 24];
  }

  const scale = 100 / Math.max(w, h);
  const tx = (100 - w * scale) / 2 - minX * scale;
  const ty = (100 - h * scale) / 2 - minY * scale;

  let inner = raw
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // Escapa pro template string TS.
  inner = inner
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");

  const id =
    "logo-" +
    f
      .replace(/\.svg$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const wrapped = `<g transform="translate(${r(tx)} ${r(ty)}) scale(${r(
    scale
  )})">${inner}</g>`;

  entries.push({ id, wrapped });
}

const body = entries
  .map((e) => `  "${e.id}": \`${e.wrapped}\`,`)
  .join("\n");

const out = `// src/components/_shared/brandLogos.ts
// AUTO-GERADO por scripts/genLogos.mjs — NÃO editar à mão.
// Regenera com: node scripts/genLogos.mjs (fonte: assets/svg/*.svg)
//
// Logos de marca (providers + modelos) normalizados pro espaço 0 0 100 100.
// Coloridos preservam suas cores; mono herdam currentColor do tema.
// Uso: <Icon name="logo-openai" /> (via addIcon + setIcon).

import { addIcon } from "obsidian";

export const BRAND_LOGOS: Record<string, string> = {
${body}
};

/** Registra todos os logos no Obsidian. Chamar UMA vez no onload. */
export function registerBrandLogos(): void {
  for (const [id, svg] of Object.entries(BRAND_LOGOS)) {
    addIcon(id, svg);
  }
}
`;

writeFileSync(OUT, out, "utf8");
console.log(`[genLogos] ${entries.length} logos -> ${OUT}`);
console.log(entries.map((e) => "  " + e.id).join("\n"));
