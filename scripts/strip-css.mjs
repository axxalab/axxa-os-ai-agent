// scripts/strip-css.mjs
// Strip "tema" do CSS, mantendo só o FUNCIONAL (layout/estrutura). Gera um
// scaffold mobile-first pra re-tematizar por cima. Determinístico, cobre as 873
// classes de uma vez. Roda: node scripts/strip-css.mjs
//
// Mantém: selectors, layout (display/flex/grid/position/size/margin/padding/gap/
//   overflow/z-index/inset), border (width/style/radius), opacity, transform,
//   transition, font-*, cursor, custom props (--*), @media/@supports.
// Remove: color/background*/box-shadow/text-shadow/filter/backdrop-filter/
//   animation*/fill/stroke*/mask*/*-color/blend, @keyframes, comentários, e
//   regras que ficaram vazias.

import fs from "fs";

const SRC = "styles/main.css";
const css = fs.readFileSync(SRC, "utf8");
const before = css.split("\n").length;

// 1) remove comentários /* ... */
let s = css.replace(/\/\*[\s\S]*?\*\//g, "");

// 2) parser char-a-char, ciente de strings e parênteses (data-URIs, content,
//    url(), gradientes com ; dentro não quebram a contagem de blocos).
let i = 0;
function parseBlock() {
  const nodes = [];
  let buf = "";
  let quote = null; // ', " ou null
  let paren = 0;
  while (i < s.length) {
    const c = s[i];
    if (quote) {
      buf += c;
      if (c === quote && s[i - 1] !== "\\") quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; buf += c; i++; continue; }
    if (c === "(") { paren++; buf += c; i++; continue; }
    if (c === ")") { if (paren) paren--; buf += c; i++; continue; }
    if (paren > 0) { buf += c; i++; continue; }
    if (c === "}") { i++; break; }
    if (c === "{") {
      i++;
      const prelude = buf.trim();
      buf = "";
      const body = parseBlock();
      nodes.push({ type: "block", prelude, body });
    } else if (c === ";") {
      i++;
      const decl = buf.trim();
      buf = "";
      if (decl) nodes.push({ type: "decl", text: decl });
    } else {
      buf += c;
      i++;
    }
  }
  const tail = buf.trim();
  if (tail) nodes.push({ type: "decl", text: tail });
  return nodes;
}
const root = parseBlock();

// 3) transform — remove decoração
const DROP = new Set([
  "color", "background", "box-shadow", "-webkit-box-shadow", "text-shadow",
  "filter", "-webkit-filter", "backdrop-filter", "-webkit-backdrop-filter",
  "fill", "mask", "-webkit-mask", "border-color", "outline-color",
  "-webkit-text-fill-color", "mix-blend-mode", "background-blend-mode",
]);
const DROP_PREFIX = [
  "background-", "animation", "-webkit-animation", "stroke", "mask-",
  "-webkit-mask-", "border-top-color", "border-right-color",
  "border-bottom-color", "border-left-color", "border-block-color",
  "border-inline-color",
];
let dropped = 0;
function isDecorative(text) {
  const prop = text.split(":")[0].trim().toLowerCase();
  if (prop.startsWith("--")) return false; // custom props ficam (tokens)
  if (DROP.has(prop)) return true;
  return DROP_PREFIX.some((p) => prop === p || prop.startsWith(p));
}
function transform(nodes) {
  // Se a regra TINHA animação (de entrada), o `opacity: 0` dela era o start-state
  // que a animação ia revelar. Como a animação some, esse opacity:0 órfão deixaria
  // o elemento INVISÍVEL — então dropamos também. Hidden-toggles legítimos (sem
  // animação na mesma regra) ficam intactos. v0.1.234
  const hadAnimation = nodes.some(
    (n) => n.type === "decl" && /^(-webkit-)?animation\b/i.test(n.text)
  );
  const out = [];
  for (const n of nodes) {
    if (n.type === "decl") {
      if (isDecorative(n.text)) { dropped++; continue; }
      if (hadAnimation && /^opacity\s*:\s*0$/i.test(n.text.trim())) { dropped++; continue; }
      out.push(n);
    } else {
      const p = n.prelude.toLowerCase();
      if (p.startsWith("@keyframes") || p.startsWith("@-webkit-keyframes")) continue;
      const body = transform(n.body);
      const hasContent = body.some(
        (x) => x.type === "decl" || (x.type === "block" && x.body.length)
      );
      if (!hasContent) continue; // regra ficou vazia → some
      out.push({ ...n, body });
    }
  }
  return out;
}
const stripped = transform(root);

// 4) serialize
function serialize(nodes, indent = "") {
  let o = "";
  for (const n of nodes) {
    if (n.type === "decl") o += `${indent}${n.text};\n`;
    else {
      o += `${indent}${n.prelude} {\n`;
      o += serialize(n.body, indent + "  ");
      o += `${indent}}\n`;
    }
  }
  return o;
}
let out = serialize(stripped).replace(/\n{3,}/g, "\n\n");
const header =
  "/* AXXA OS — scaffold FUNCIONAL (tema removido p/ re-tematizar por cima).\n" +
  "   Gerado por scripts/strip-css.mjs. Mantém layout/estrutura; remove cor,\n" +
  "   background, sombra, glass, animação. Re-rodar: node scripts/strip-css.mjs */\n\n";
out = header + out;

// brace balance sanity
const opens = (out.match(/{/g) || []).length;
const closes = (out.match(/}/g) || []).length;

fs.writeFileSync(SRC, out);
const after = out.split("\n").length;
console.log(`[strip-css] linhas ${before} → ${after} (-${before - after})`);
console.log(`[strip-css] declarações decorativas removidas: ${dropped}`);
console.log(`[strip-css] braces: ${opens} { / ${closes} } ${opens === closes ? "OK" : "DESBALANCEADO!"}`);
