// scripts/collect-hot.mjs
// Coleta DADO REAL de popularidade de modelos → gera src/providers/hotData.generated.ts.
//
// Fontes:
//   - OPEN models: HuggingFace Hub API (downloads + trendingScore) — público,
//     estável, sem key. https://huggingface.co/api/models?author=<org>
//   - CLOSED models (gpt/claude/gemini/…): baseline curado — não existe API
//     pública de uso pra eles. São poucos e estáveis (flagships).
//
// DESENHADO PRA AUTOMAÇÃO SEMANAL (toda quinta): idempotente — mesmo dado de
// entrada → arquivo de saída IDÊNTICO → sem diff → sem commit. Sem timestamp no
// arquivo de propósito (o histórico do git é o registro). O agente roda:
//   node scripts/collect-hot.mjs
//   git diff --quiet src/providers/hotData.generated.ts || git commit -am "chore(data): weekly hot ranking update"

import { writeFileSync } from "node:fs";

const OUT = "src/providers/hotData.generated.ts";

// Famílias OPEN rastreadas no HF (org → padrão de id no nosso sistema).
const HF_FAMILIES = [
  { pattern: "(llama|meta-)", org: "meta-llama" },
  { pattern: "qwen", org: "Qwen" },
  { pattern: "deepseek", org: "deepseek-ai" },
  { pattern: "(mistral|mixtral|codestral|pixtral|ministral)", org: "mistralai" },
  { pattern: "gemma", org: "google" },
  { pattern: "flux", org: "black-forest-labs" },
  { pattern: "(stable-?diffusion|sdxl)", org: "stabilityai" },
];

// Famílias CLOSED — score curado (sem API pública de uso). Editar quando a
// linha de frente mudar (ex: nova família flagship).
const CLOSED = [
  { pattern: "claude-(fable|opus|sonnet)", score: 0.96 },
  { pattern: "(^|/)gpt-5", score: 0.95 },
  { pattern: "gemini-(3|2\\.5-(pro|flash))", score: 0.9 },
  { pattern: "(^|/)gpt-4o", score: 0.9 },
  { pattern: "(^|/)o[34](\\b|-)", score: 0.8 },
  { pattern: "claude-haiku", score: 0.72 },
  { pattern: "(^|/)o1(\\b|-)", score: 0.65 },
  { pattern: "(dall-e|gpt-image|nano-?banana|imagen)", score: 0.6 },
  { pattern: "gemini-(1\\.5|2\\.0)", score: 0.5 },
  { pattern: "claude-3", score: 0.5 },
];

const round2 = (n) => Math.round(n * 100) / 100;

async function hfPopularity(org) {
  const url = `https://huggingface.co/api/models?author=${org}&sort=downloads&limit=20`;
  const res = await fetch(url, { headers: { "User-Agent": "axxa-collect-hot" } });
  if (!res.ok) throw new Error(`HF ${org}: HTTP ${res.status}`);
  const arr = await res.json();
  let downloads = 0;
  let trending = 0;
  for (const m of arr) {
    downloads += m.downloads ?? 0;
    trending += m.trendingScore ?? 0;
  }
  return { downloads, trending };
}

function writeOut(entries) {
  const lines = entries
    .map((e) => `  [${JSON.stringify(e.pattern)}, ${e.score}],`)
    .join("\n");
  const out = `// src/providers/hotData.generated.ts
// AUTO-GERADO por scripts/collect-hot.mjs — NÃO editar à mão.
// Popularidade ("hot") por padrão de id de modelo (0..1).
//   OPEN  = HuggingFace (downloads + trending, dado REAL)
//   CLOSED = baseline curado (gpt/claude/gemini não têm API pública de uso)
// Atualiza semanal: \`node scripts/collect-hot.mjs\` + commit se houver diff.

/** [padrão (string de RegExp), score 0..1]. O dataCollect pega o MAIOR score
 *  entre todos os padrões que casam o id do modelo. */
export const HOT_DATA: [string, number][] = [
${lines}
];
`;
  writeFileSync(OUT, out);
  console.log(`OK ${OUT} — ${entries.length} padroes`);
}

async function main() {
  const open = [];
  for (const fam of HF_FAMILIES) {
    try {
      const pop = await hfPopularity(fam.org);
      open.push({ pattern: fam.pattern, ...pop });
      console.log(`  ${fam.org}: ${pop.downloads} downloads, trending ${pop.trending}`);
    } catch (e) {
      console.error(`! ${fam.org}: ${e.message} — pulando`);
    }
  }

  // Normaliza downloads em escala LOG (variam ordens de grandeza) + trending.
  const logs = open.map((o) => Math.log10((o.downloads || 0) + 10));
  const maxLog = Math.max(...logs, 1);
  const minLog = Math.min(...logs, 0);
  const maxTrend = Math.max(...open.map((o) => o.trending || 0), 1);
  const openScored = open.map((o, i) => {
    const dl = (logs[i] - minLog) / (maxLog - minLog || 1);
    const tr = (o.trending || 0) / maxTrend;
    const raw = dl * 0.75 + tr * 0.25;
    // Open vai de ~0.4 a ~0.85 (closed flagships lideram acima disso).
    return { pattern: o.pattern, score: round2(0.4 + raw * 0.45) };
  });

  const merged = [...CLOSED, ...openScored].sort(
    (a, b) => b.score - a.score || a.pattern.localeCompare(b.pattern)
  );
  writeOut(merged);
}

main().catch((e) => {
  console.error("collect-hot falhou:", e);
  process.exit(1);
});
