#!/usr/bin/env node
// server/watcher.mjs
// Runtime do Remote Agent (Metade B) — a ponte entre o vault e o Claude Code.
// Observa `_agent/inbox/`, roda `claude -p` no diretório do vault e escreve a
// resposta em `_agent/outbox/`. Só Node built-in (roda no Termux com `pkg install
// nodejs`). Sem sync: aponta direto pros arquivos do vault (shared storage/root).
// Protocolo: docs/AGENT_PROTOCOL.md
//
// Uso:  node watcher.mjs "/caminho/do/Vault"
// Env:  AXXA_AGENT_ROOT (default "_agent") · AXXA_CLAUDE_BIN (default "claude")
//       AXXA_CLAUDE_ARGS (extra p/ claude, ex "--permission-mode acceptEdits")
//       AXXA_POLL_MS (default 1500) · AXXA_FLUSH_MS (default 700)

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const VAULT = process.argv[2] || process.env.AXXA_VAULT;
const ROOT = process.env.AXXA_AGENT_ROOT || "_agent";
const CLAUDE = process.env.AXXA_CLAUDE_BIN || "claude";
const EXTRA_ARGS = (process.env.AXXA_CLAUDE_ARGS || "").split(" ").filter(Boolean);
const POLL_MS = Number(process.env.AXXA_POLL_MS || 1500);
const FLUSH_MS = Number(process.env.AXXA_FLUSH_MS || 700);
const PROTOCOL = 1;
const VERSION = "0.1.0";

if (!VAULT) {
  console.error("uso: node watcher.mjs <caminho-do-vault>");
  process.exit(1);
}

const agentDir = join(VAULT, ROOT);
const inboxDir = join(agentDir, "inbox");
const outboxDir = join(agentDir, "outbox");
const stateDir = join(agentDir, "state");

/** id -> { child, cancelled, out } */
const active = new Map();
/** ids já vistos (em andamento ou concluídos) pra não reprocessar. */
const seen = new Set();

// ---------- frontmatter mínimo (espelha src/providers/remoteAgentProtocol.ts) ----------
function splitFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: md };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    if (!k) continue;
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    fm[k] = v;
  }
  return { fm, body: m[2] };
}

async function ensureDir(d) {
  await mkdir(d, { recursive: true });
}

async function writeResponse(id, status, body, error) {
  await ensureDir(join(outboxDir, id));
  const fm = ["---", `protocol: ${PROTOCOL}`, `id: ${id}`, `status: ${status}`];
  if (error) fm.push(`error: ${JSON.stringify(error)}`);
  fm.push("---");
  await writeFile(join(outboxDir, id, "response.md"), fm.join("\n") + "\n" + (body || ""), "utf8");
}

async function heartbeat() {
  try {
    await ensureDir(stateDir);
    const md = [
      "---",
      `protocol: ${PROTOCOL}`,
      "online: true",
      `version: ${VERSION}`,
      `queue: ${active.size}`,
      `ts: ${new Date().toISOString()}`,
      "---",
      "",
    ].join("\n");
    await writeFile(join(stateDir, "runtime.md"), md, "utf8");
  } catch {
    // best-effort
  }
}

async function offlineHeartbeat() {
  try {
    const md = ["---", `protocol: ${PROTOCOL}`, "online: false", `ts: ${new Date().toISOString()}`, "---", ""].join("\n");
    await writeFile(join(stateDir, "runtime.md"), md, "utf8");
  } catch {
    /* ignore */
  }
}

function handleRequest(id, md) {
  const { body } = splitFrontmatter(md);
  const prompt = body.trim();
  if (!prompt) return; // inbox ainda a meio de escrita / vazio — próximo tick pega

  const rec = { child: null, cancelled: false, out: "" };
  active.set(id, rec);
  console.log(`[axxa] ▶ ${id} — rodando claude`);

  void writeResponse(id, "running", "");

  // claude -p lê o prompt do stdin (evita limite de argv em conversas longas) e
  // opera no cwd = vault (pra ele ler/editar as notas de verdade).
  const child = spawn(CLAUDE, [...EXTRA_ARGS, "-p"], { cwd: VAULT, env: process.env });
  rec.child = child;

  let flushTimer = null;
  const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void writeResponse(id, "running", rec.out);
    }, FLUSH_MS);
  };

  child.stdout.on("data", (chunk) => {
    rec.out += chunk.toString();
    scheduleFlush();
  });
  let errTail = "";
  child.stderr.on("data", (chunk) => {
    errTail = (errTail + chunk.toString()).slice(-500);
  });
  child.on("error", (err) => {
    active.delete(id);
    void writeResponse(id, "failed", rec.out, `não consegui rodar "${CLAUDE}": ${err.message}`);
  });
  child.on("close", (code) => {
    if (flushTimer) clearTimeout(flushTimer);
    active.delete(id);
    if (rec.cancelled) {
      console.log(`[axxa] ✖ ${id} — cancelado`);
      void writeResponse(id, "cancelled", rec.out);
    } else if (code === 0) {
      console.log(`[axxa] ✔ ${id} — done`);
      void writeResponse(id, "done", rec.out);
    } else {
      console.log(`[axxa] ✖ ${id} — claude código ${code}`);
      void writeResponse(id, "failed", rec.out, `claude saiu com código ${code}. ${errTail}`.trim());
    }
  });

  try {
    child.stdin.write(prompt);
    child.stdin.end();
  } catch {
    /* stdin pode fechar cedo em erro — o close handler cobre */
  }
}

async function tick() {
  let files;
  try {
    files = await readdir(inboxDir);
  } catch {
    return; // inbox ainda não existe
  }
  // Cancelamentos primeiro.
  for (const f of files) {
    if (!f.endsWith(".cancel.md")) continue;
    const id = f.slice(0, -".cancel.md".length);
    const rec = active.get(id);
    if (rec && !rec.cancelled) {
      rec.cancelled = true;
      rec.child?.kill();
    }
  }
  // Novos requests.
  for (const f of files) {
    if (!f.endsWith(".md") || f.endsWith(".cancel.md")) continue;
    const id = f.slice(0, -3);
    if (seen.has(id)) continue;
    seen.add(id);
    try {
      const md = await readFile(join(inboxDir, f), "utf8");
      handleRequest(id, md);
    } catch (err) {
      console.error(`[axxa] falha lendo ${f}:`, err.message);
    }
  }
}

async function main() {
  await ensureDir(inboxDir);
  await ensureDir(outboxDir);
  await ensureDir(stateDir);
  await heartbeat();
  console.log(`[axxa] runtime online — observando ${inboxDir}`);
  console.log(`[axxa] claude: ${[CLAUDE, ...EXTRA_ARGS, "-p"].join(" ")}  (cwd=${VAULT})`);

  const loop = setInterval(() => {
    void tick();
    void heartbeat();
  }, POLL_MS);

  const shutdown = async () => {
    clearInterval(loop);
    for (const rec of active.values()) rec.child?.kill();
    await offlineHeartbeat();
    console.log("\n[axxa] runtime offline.");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main();
