// src/providers/remoteAgentProtocol.ts
// Núcleo PURO do protocolo `_agent/` (Remote Agent). Sem dependência do Obsidian —
// só string in / string out — pra ser 100% testável no vitest. O provider
// (remoteAgent.ts) faz o IO no vault; aqui mora só o contrato.
// Spec: docs/AGENT_PROTOCOL.md

/** Versão do protocolo. Request com versão diferente → runtime marca failed. */
export const PROTOCOL_VERSION = 1;

/** Estados possíveis de uma tarefa (frontmatter `status` no response.md). */
export type RemoteStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "done"
  | "failed"
  | "cancelled";

/** Estados terminais — o client para de observar quando chega num destes. */
export const TERMINAL_STATUSES: readonly RemoteStatus[] = [
  "done",
  "failed",
  "cancelled",
] as const;

const VALID_STATUSES: readonly RemoteStatus[] = [
  "queued",
  "running",
  "awaiting_approval",
  ...TERMINAL_STATUSES,
];

/** True se o status é terminal (tarefa encerrada). */
export function isTerminal(status: RemoteStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

// ============================================================
// ULID — id ordenável por tempo (26 chars, Crockford base32).
// now/rand injetáveis pra determinismo nos testes.
// ============================================================
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // sem I, L, O, U

/** Gera um ULID. `now` = epoch ms; `rand` = fn 0..1 (default Math.random). */
export function newUlid(now: number = Date.now(), rand: () => number = Math.random): string {
  let time = Math.floor(now);
  // 48 bits de tempo → 10 chars base32 (10 * 5 = 50 bits, sobra zero à esquerda).
  let timeChars = "";
  for (let i = 0; i < 10; i++) {
    timeChars = CROCKFORD[time % 32] + timeChars;
    time = Math.floor(time / 32);
  }
  // 80 bits de aleatoriedade → 16 chars base32.
  let randChars = "";
  for (let i = 0; i < 16; i++) {
    randChars += CROCKFORD[Math.floor(rand() * 32) % 32];
  }
  return timeChars + randChars;
}

// ============================================================
// Paths — funções puras (raiz configurável, default "_agent").
// ============================================================
export function inboxPath(root: string, id: string): string {
  return `${root}/inbox/${id}.md`;
}
export function cancelPath(root: string, id: string): string {
  return `${root}/inbox/${id}.cancel.md`;
}
export function outboxDir(root: string, id: string): string {
  return `${root}/outbox/${id}`;
}
export function outboxResponsePath(root: string, id: string): string {
  return `${root}/outbox/${id}/response.md`;
}
export function approvalAnswerPath(root: string, id: string, seq: number): string {
  return `${root}/approvals/${id}-${seq}.answer.md`;
}
export function runtimeStatePath(root: string): string {
  return `${root}/state/runtime.md`;
}

// ============================================================
// Frontmatter mínimo — valores como string crua (coerção nos parsers típicos).
// Formato controlado por nós (flat scalars), então não precisa de YAML completo.
// ============================================================
function splitFrontmatter(md: string): { fm: Record<string, string>; body: string } {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: md };
  const fm: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;
    let val = line.slice(idx + 1).trim();
    // Tira aspas envolventes (simples ou duplas).
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    fm[key] = val;
  }
  return { fm, body: m[2] };
}

function escapeFmValue(v: string): string {
  // Frontmatter nosso é flat; envolve em aspas se tiver `:` ou quebrar linha.
  return /[:#\r\n]/.test(v) ? JSON.stringify(v) : v;
}

// ============================================================
// inbox/<id>.md — request (client → runtime)
// ============================================================
export interface InboxRequest {
  id: string;
  ts: string; // ISO
  mode: string; // chat | vault-qa | agent
  model: string;
  device: string; // mobile | desktop
  prompt: string; // corpo
}

export function serializeInboxRequest(req: InboxRequest): string {
  return (
    "---\n" +
    `protocol: ${PROTOCOL_VERSION}\n` +
    `id: ${req.id}\n` +
    `ts: ${req.ts}\n` +
    `mode: ${req.mode}\n` +
    `model: ${escapeFmValue(req.model)}\n` +
    `device: ${req.device}\n` +
    "---\n" +
    req.prompt
  );
}

export function parseInboxRequest(md: string): InboxRequest {
  const { fm, body } = splitFrontmatter(md);
  return {
    id: fm.id ?? "",
    ts: fm.ts ?? "",
    mode: fm.mode ?? "chat",
    model: fm.model ?? "",
    device: fm.device ?? "",
    prompt: body,
  };
}

// ============================================================
// outbox/<id>/response.md — resposta (runtime → client)
// ============================================================
export interface OutboxResponse {
  status: RemoteStatus;
  body: string;
  usage?: { input: number; output: number };
  error?: string;
}

function parseUsage(raw?: string): { input: number; output: number } | undefined {
  if (!raw) return undefined;
  const input = raw.match(/input\s*:?\s*(\d+)/);
  const output = raw.match(/output\s*:?\s*(\d+)/);
  if (!input && !output) return undefined;
  return {
    input: input ? Number(input[1]) : 0,
    output: output ? Number(output[1]) : 0,
  };
}

/** Coage uma string de status pra RemoteStatus válido (default "running"). */
export function coerceStatus(raw?: string): RemoteStatus {
  const s = (raw ?? "").trim() as RemoteStatus;
  return VALID_STATUSES.includes(s) ? s : "running";
}

export function parseOutboxResponse(md: string): OutboxResponse {
  const { fm, body } = splitFrontmatter(md);
  const error = fm.error ?? "";
  return {
    status: coerceStatus(fm.status),
    body,
    usage: parseUsage(fm.usage),
    error: error || undefined,
  };
}

// ============================================================
// Streaming — diff do corpo já emitido pro corpo novo.
// Corpo é append-only; se divergir (reescrita inesperada), sinaliza reset.
// ============================================================
export function bodyDelta(
  prev: string,
  next: string
): { delta: string; reset: boolean } {
  if (next === prev) return { delta: "", reset: false };
  if (next.startsWith(prev)) return { delta: next.slice(prev.length), reset: false };
  return { delta: next, reset: true };
}

// ============================================================
// approvals/<id>-<n>.answer.md — resposta de aprovação (client → runtime)
// ============================================================
export function serializeApprovalAnswer(
  id: string,
  seq: number,
  decision: "allow" | "deny"
): string {
  return (
    "---\n" +
    `protocol: ${PROTOCOL_VERSION}\n` +
    `id: ${id}\n` +
    `seq: ${seq}\n` +
    `decision: ${decision}\n` +
    "---\n"
  );
}

// ============================================================
// state/runtime.md — heartbeat (runtime → client)
// ============================================================
export interface RuntimeState {
  online: boolean;
  version?: string;
  queue: number;
  ts?: string;
}

export function parseRuntimeState(md: string): RuntimeState {
  const { fm } = splitFrontmatter(md);
  return {
    online: fm.online === "true",
    version: fm.version || undefined,
    queue: Number(fm.queue) || 0,
    ts: fm.ts || undefined,
  };
}

/**
 * Runtime está "online de verdade"? Precisa de `online: true` E heartbeat recente
 * (dentro de staleMs, default 90 s) — senão consideramos offline (processo morto
 * sem atualizar o flag). `now` injetável pra teste.
 */
export function isRuntimeOnline(
  state: RuntimeState | null,
  now: number = Date.now(),
  staleMs = 90_000
): boolean {
  if (!state || !state.online || !state.ts) return false;
  const ts = Date.parse(state.ts);
  if (Number.isNaN(ts)) return false;
  return now - ts <= staleMs;
}
