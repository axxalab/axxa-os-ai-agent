// src/usage/export.ts
// Exportadores do Usage report — Markdown + PDF.
//
// Markdown: gera string formatada, salva em axxa-ai/reports/usage-{YYYY-MM-DD}.md
// PDF: usa Electron BrowserWindow.printToPDF quando disponível (desktop),
//      cai pra window.print() (com CSS print-only) no resto.

import type { App } from "obsidian";
import { ensureFolder } from "../components/_shared/chatPersistence";
import { formatUsd } from "./pricing";
import {
  type UsageAggregate,
  type UsageBucket,
  sortBucketEntries,
} from "./aggregate";

/** Pasta default pra reports — fica fora do generationPath pra não poluir. */
const REPORTS_FOLDER = "axxa-ai/reports";

function tsFileName(): string {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "k";
  return String(n);
}

function periodLabel(agg: UsageAggregate, periodDays: number): string {
  if (periodDays > 0) return `últimos ${periodDays} dias`;
  if (agg.periodStart && agg.periodEnd) {
    if (agg.periodStart === agg.periodEnd) return agg.periodStart;
    return `${agg.periodStart} a ${agg.periodEnd}`;
  }
  return "todo o histórico";
}

function bucketCostCell(b: UsageBucket): string {
  const costStr = formatUsd(b.cost);
  return b.hasUnknownCost ? `${costStr}*` : costStr;
}

// ============================================================
// MARKDOWN export
// ============================================================

export function generateUsageMarkdown(
  agg: UsageAggregate,
  periodDays: number,
  chatsPath: string
): string {
  const generatedAt = new Date().toISOString();
  const lines: string[] = [];

  lines.push("---");
  lines.push(`generated: ${JSON.stringify(generatedAt)}`);
  lines.push(`period: ${JSON.stringify(periodLabel(agg, periodDays))}`);
  lines.push(`chats_path: ${JSON.stringify(chatsPath)}`);
  lines.push(`total_cost_usd: ${agg.total.cost.toFixed(4)}`);
  lines.push(`total_chats: ${agg.total.chats}`);
  lines.push(`total_tokens_in: ${agg.total.tokensIn}`);
  lines.push(`total_tokens_out: ${agg.total.tokensOut}`);
  lines.push(`has_unknown_pricing: ${agg.total.hasUnknownCost}`);
  lines.push("tags:");
  lines.push("  - axxa-usage-report");
  lines.push("---");
  lines.push("");

  lines.push(`# AXXA OS — Usage Report`);
  lines.push("");
  lines.push(`> Período: **${periodLabel(agg, periodDays)}** · gerado em ${generatedAt}`);
  lines.push("");

  // ===== Resumo =====
  lines.push(`## Resumo`);
  lines.push("");
  lines.push(`- **Gasto total estimado:** ${formatUsd(agg.total.cost)}${agg.total.hasUnknownCost ? " (algum modelo sem pricing — ver `*` abaixo)" : ""}`);
  lines.push(`- **Tokens consumidos:** ${formatNumber(agg.total.tokensIn)} in / ${formatNumber(agg.total.tokensOut)} out`);
  lines.push(`- **Conversas:** ${agg.total.chats}`);
  if (agg.periodStart && agg.periodEnd) {
    lines.push(`- **Janela:** ${agg.periodStart} → ${agg.periodEnd}`);
  }
  lines.push("");

  // ===== Por provider =====
  const providerRows = sortBucketEntries(agg.byProvider);
  if (providerRows.length > 0) {
    lines.push(`## Por provider`);
    lines.push("");
    lines.push(`| Provider | Conversas | Tokens in | Tokens out | Custo |`);
    lines.push(`| -------- | --------- | --------- | ---------- | ----- |`);
    for (const [name, b] of providerRows) {
      lines.push(`| ${name} | ${b.chats} | ${formatNumber(b.tokensIn)} | ${formatNumber(b.tokensOut)} | ${bucketCostCell(b)} |`);
    }
    lines.push("");
  }

  // ===== Por modelo (top 15) =====
  const modelRows = sortBucketEntries(agg.byModel).slice(0, 15);
  if (modelRows.length > 0) {
    lines.push(`## Por modelo (top 15)`);
    lines.push("");
    lines.push(`| Modelo | Conversas | Tokens in | Tokens out | Custo |`);
    lines.push(`| ------ | --------- | --------- | ---------- | ----- |`);
    for (const [name, b] of modelRows) {
      lines.push(`| \`${name}\` | ${b.chats} | ${formatNumber(b.tokensIn)} | ${formatNumber(b.tokensOut)} | ${bucketCostCell(b)} |`);
    }
    lines.push("");
  }

  // ===== Por modo =====
  const modeRows = sortBucketEntries(agg.byMode);
  if (modeRows.length > 0) {
    lines.push(`## Por modo`);
    lines.push("");
    lines.push(`| Modo | Conversas | Tokens in | Tokens out | Custo |`);
    lines.push(`| ---- | --------- | --------- | ---------- | ----- |`);
    for (const [name, b] of modeRows) {
      lines.push(`| ${name} | ${b.chats} | ${formatNumber(b.tokensIn)} | ${formatNumber(b.tokensOut)} | ${bucketCostCell(b)} |`);
    }
    lines.push("");
  }

  // ===== Top conversas =====
  const top = agg.chats.slice(0, 10);
  if (top.length > 0) {
    lines.push(`## Top 10 conversas (por custo)`);
    lines.push("");
    lines.push(`| Título | Modo | Modelo | Tokens (in/out) | Custo |`);
    lines.push(`| ------ | ---- | ------ | --------------- | ----- |`);
    for (const c of top) {
      const titleTruncated = c.title.length > 50 ? c.title.slice(0, 47) + "..." : c.title;
      const cost = c.cost == null ? "—" : formatUsd(c.cost);
      lines.push(`| ${titleTruncated} | ${c.mode} | \`${c.model}\` | ${formatNumber(c.tokensIn)} / ${formatNumber(c.tokensOut)} | ${cost} |`);
    }
    lines.push("");
  }

  if (agg.total.hasUnknownCost) {
    lines.push("");
    lines.push(`> \\* Custo estimado parcial — algum modelo não tem pricing configurado.`);
    lines.push(`> Edite \`src/usage/pricing.ts\` pra adicionar.`);
  }

  return lines.join("\n");
}

// ============================================================
// PDF / HTML export
// ============================================================

/**
 * Gera HTML stylized do report. Usado pelo printToPDF (Electron) ou
 * pra abrir numa nova janela com window.print().
 *
 * Usa CSS print-friendly: @page A4, fontes serif, cores acessíveis em B&W.
 */
export function generateUsageHtml(
  agg: UsageAggregate,
  periodDays: number,
  chatsPath: string
): string {
  const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

  const sectionTable = (
    title: string,
    rows: Array<[string, UsageBucket]>,
    headerName: string,
    limit?: number
  ): string => {
    const slice = limit ? rows.slice(0, limit) : rows;
    if (slice.length === 0) return "";
    const tbody = slice
      .map(
        ([name, b]) => `
        <tr>
          <td><code>${escapeHtml(name)}</code></td>
          <td class="num">${b.chats}</td>
          <td class="num">${formatNumber(b.tokensIn)}</td>
          <td class="num">${formatNumber(b.tokensOut)}</td>
          <td class="num cost">${b.hasUnknownCost ? formatUsd(b.cost) + "*" : formatUsd(b.cost)}</td>
        </tr>`
      )
      .join("");
    return `
    <section>
      <h2>${title}</h2>
      <table>
        <thead>
          <tr>
            <th>${headerName}</th>
            <th class="num">Conversas</th>
            <th class="num">Tokens in</th>
            <th class="num">Tokens out</th>
            <th class="num">Custo</th>
          </tr>
        </thead>
        <tbody>${tbody}</tbody>
      </table>
    </section>`;
  };

  const topChats = agg.chats.slice(0, 10);
  const topChatsTable =
    topChats.length === 0
      ? ""
      : `
    <section>
      <h2>Top 10 conversas (por custo)</h2>
      <table>
        <thead>
          <tr>
            <th>Título</th>
            <th>Modo</th>
            <th>Modelo</th>
            <th class="num">Tokens in</th>
            <th class="num">Tokens out</th>
            <th class="num">Custo</th>
          </tr>
        </thead>
        <tbody>
          ${topChats
            .map(
              (c) => `
            <tr>
              <td>${escapeHtml(c.title.length > 50 ? c.title.slice(0, 47) + "..." : c.title)}</td>
              <td>${escapeHtml(c.mode)}</td>
              <td><code>${escapeHtml(c.model)}</code></td>
              <td class="num">${formatNumber(c.tokensIn)}</td>
              <td class="num">${formatNumber(c.tokensOut)}</td>
              <td class="num cost">${c.cost == null ? "—" : formatUsd(c.cost)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </section>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>AXXA OS — Usage Report</title>
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      color: #1a1a1a;
      line-height: 1.5;
      max-width: 760px;
      margin: 0 auto;
      padding: 28px;
    }
    h1 { font-size: 28px; margin: 0 0 6px 0; }
    h2 { font-size: 18px; margin: 28px 0 10px 0; padding-bottom: 6px; border-bottom: 1px solid #ddd; }
    .meta { color: #555; font-size: 13px; margin-bottom: 24px; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .card {
      padding: 14px 16px;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      background: #fafafa;
    }
    .card-label { font-size: 11px; text-transform: uppercase; color: #777; letter-spacing: 0.5px; }
    .card-value { font-size: 22px; font-weight: 600; margin-top: 4px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      font-size: 12px;
    }
    th, td {
      padding: 8px 10px;
      border-bottom: 1px solid #eee;
      text-align: left;
    }
    th { background: #f5f5f5; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; color: #555; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    td.cost { font-weight: 600; }
    code { font-family: "SF Mono", Consolas, Monaco, monospace; font-size: 11px; background: #f0f0f0; padding: 1px 4px; border-radius: 3px; }
    .footer { margin-top: 32px; font-size: 11px; color: #888; text-align: center; }
    @media print { body { padding: 0; max-width: none; } }
  </style>
</head>
<body>
  <h1>AXXA OS — Usage Report</h1>
  <div class="meta">
    Período: <strong>${escapeHtml(periodLabel(agg, periodDays))}</strong> · gerado em ${generatedAt}
  </div>

  <div class="summary-grid">
    <div class="card">
      <div class="card-label">Gasto total</div>
      <div class="card-value">${formatUsd(agg.total.cost)}${agg.total.hasUnknownCost ? "*" : ""}</div>
    </div>
    <div class="card">
      <div class="card-label">Tokens in</div>
      <div class="card-value">${formatNumber(agg.total.tokensIn)}</div>
    </div>
    <div class="card">
      <div class="card-label">Tokens out</div>
      <div class="card-value">${formatNumber(agg.total.tokensOut)}</div>
    </div>
    <div class="card">
      <div class="card-label">Conversas</div>
      <div class="card-value">${agg.total.chats}</div>
    </div>
  </div>

  ${sectionTable("Por provider", sortBucketEntries(agg.byProvider), "Provider")}
  ${sectionTable("Por modelo (top 15)", sortBucketEntries(agg.byModel), "Modelo", 15)}
  ${sectionTable("Por modo", sortBucketEntries(agg.byMode), "Modo")}
  ${topChatsTable}

  ${
    agg.total.hasUnknownCost
      ? `<div class="footer">* Custo estimado parcial — algum modelo não tem pricing configurado.</div>`
      : ""
  }
  <div class="footer">AXXA OS — AI Agent · Plugin Obsidian · gerado por src/usage/export.ts</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================
// File save helpers
// ============================================================

export interface ExportResult {
  path: string;
  format: "md" | "html" | "pdf";
}

/** Salva o Markdown no vault em axxa-ai/reports/. */
export async function saveUsageMarkdown(
  app: App,
  agg: UsageAggregate,
  periodDays: number,
  chatsPath: string,
  basePath = REPORTS_FOLDER
): Promise<ExportResult> {
  const md = generateUsageMarkdown(agg, periodDays, chatsPath);
  await ensureFolder(app.vault.adapter, basePath);
  const path = `${basePath}/usage-${tsFileName()}.md`;
  await app.vault.adapter.write(path, md);
  return { path, format: "md" };
}

/**
 * Salva HTML no vault. Caller pode abrir manualmente no browser pra imprimir.
 * Fallback pro PDF nativo em mobile (onde printToPDF não roda).
 */
export async function saveUsageHtml(
  app: App,
  agg: UsageAggregate,
  periodDays: number,
  chatsPath: string,
  basePath = REPORTS_FOLDER
): Promise<ExportResult> {
  const html = generateUsageHtml(agg, periodDays, chatsPath);
  await ensureFolder(app.vault.adapter, basePath);
  const path = `${basePath}/usage-${tsFileName()}.html`;
  await app.vault.adapter.write(path, html);
  return { path, format: "html" };
}

/**
 * Abre uma nova window com o report HTML e dispara window.print().
 * Browser/Electron mostram o diálogo "salvar como PDF".
 */
export function printUsageReport(
  agg: UsageAggregate,
  periodDays: number,
  chatsPath: string
): void {
  const html = generateUsageHtml(agg, periodDays, chatsPath);
  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) {
    throw new Error(
      "Pop-up bloqueado. Permita pop-ups deste site pra exportar como PDF."
    );
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Espera o conteúdo renderizar antes de chamar print
  win.addEventListener("load", () => {
    win.focus();
    win.print();
  });
  // Fallback: se o load já disparou, força imediato
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
  }, 350);
}
