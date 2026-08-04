import { describe, it, expect } from "vitest";
import {
  PROTOCOL_VERSION,
  isTerminal,
  newUlid,
  inboxPath,
  cancelPath,
  outboxResponsePath,
  approvalAnswerPath,
  runtimeStatePath,
  serializeInboxRequest,
  parseInboxRequest,
  parseOutboxResponse,
  coerceStatus,
  bodyDelta,
  serializeApprovalAnswer,
  parseRuntimeState,
  isRuntimeOnline,
  type InboxRequest,
} from "../src/providers/remoteAgentProtocol";

describe("isTerminal", () => {
  it("done/failed/cancelled são terminais; o resto não", () => {
    expect(isTerminal("done")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("queued")).toBe(false);
    expect(isTerminal("running")).toBe(false);
    expect(isTerminal("awaiting_approval")).toBe(false);
  });
});

describe("newUlid", () => {
  it("tem 26 chars e só usa o alfabeto Crockford", () => {
    const id = newUlid(1_700_000_000_000, () => 0.5);
    expect(id).toHaveLength(26);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("é determinístico com now/rand injetados", () => {
    const a = newUlid(1_700_000_000_000, () => 0.42);
    const b = newUlid(1_700_000_000_000, () => 0.42);
    expect(a).toBe(b);
  });

  it("ordena por tempo (prefixo de 10 chars cresce com now)", () => {
    const earlier = newUlid(1_700_000_000_000, () => 0);
    const later = newUlid(1_700_000_001_000, () => 0);
    expect(later.slice(0, 10) > earlier.slice(0, 10)).toBe(true);
  });
});

describe("paths", () => {
  it("montam sob a raiz configurável", () => {
    expect(inboxPath("_agent", "ID")).toBe("_agent/inbox/ID.md");
    expect(cancelPath("_agent", "ID")).toBe("_agent/inbox/ID.cancel.md");
    expect(outboxResponsePath("_agent", "ID")).toBe("_agent/outbox/ID/response.md");
    expect(approvalAnswerPath("_agent", "ID", 2)).toBe("_agent/approvals/ID-2.answer.md");
    expect(runtimeStatePath("vault/_agent")).toBe("vault/_agent/state/runtime.md");
  });
});

describe("inbox request round-trip", () => {
  const req: InboxRequest = {
    id: "01J9Z8K3QZ8N7Q9X2C4V6B8M0A",
    ts: "2026-08-04T14:03:11.234Z",
    mode: "agent",
    model: "claude-code",
    device: "mobile",
    prompt: "Resuma as notas da semana.\n\nSegunda linha.",
  };

  it("serializa com frontmatter + corpo e faz round-trip", () => {
    const md = serializeInboxRequest(req);
    expect(md).toContain(`protocol: ${PROTOCOL_VERSION}`);
    expect(md).toContain("mode: agent");
    const parsed = parseInboxRequest(md);
    expect(parsed).toEqual(req);
  });

  it("preserva corpo multi-linha", () => {
    const parsed = parseInboxRequest(serializeInboxRequest(req));
    expect(parsed.prompt).toBe("Resuma as notas da semana.\n\nSegunda linha.");
  });
});

describe("parseOutboxResponse", () => {
  it("extrai status, corpo, usage e error", () => {
    const md = [
      "---",
      "protocol: 1",
      "id: ABC",
      "status: done",
      "usage: { input: 1240, output: 320 }",
      'error: ""',
      "---",
      "Resposta final do agente.",
    ].join("\n");
    const r = parseOutboxResponse(md);
    expect(r.status).toBe("done");
    expect(r.body).toBe("Resposta final do agente.");
    expect(r.usage).toEqual({ input: 1240, output: 320 });
    expect(r.error).toBeUndefined();
  });

  it("status inválido/ausente cai em running", () => {
    expect(coerceStatus(undefined)).toBe("running");
    expect(coerceStatus("bogus")).toBe("running");
    expect(parseOutboxResponse("sem frontmatter, só corpo").status).toBe("running");
  });

  it("status=failed carrega a mensagem de erro", () => {
    const md = ["---", "status: failed", 'error: "runtime offline"', "---", ""].join("\n");
    const r = parseOutboxResponse(md);
    expect(r.status).toBe("failed");
    expect(r.error).toBe("runtime offline");
  });

  it("tolera CRLF", () => {
    const md = ["---", "status: running", "---", "parcial"].join("\r\n");
    expect(parseOutboxResponse(md).status).toBe("running");
    expect(parseOutboxResponse(md).body).toBe("parcial");
  });
});

describe("bodyDelta (streaming append-only)", () => {
  it("retorna só o sufixo quando cresce", () => {
    expect(bodyDelta("Olá", "Olá mundo")).toEqual({ delta: " mundo", reset: false });
  });
  it("vazio quando igual", () => {
    expect(bodyDelta("Olá", "Olá")).toEqual({ delta: "", reset: false });
  });
  it("sinaliza reset quando diverge", () => {
    expect(bodyDelta("Olá mundo", "Outro texto")).toEqual({
      delta: "Outro texto",
      reset: true,
    });
  });
  it("do zero emite tudo", () => {
    expect(bodyDelta("", "primeiro token")).toEqual({
      delta: "primeiro token",
      reset: false,
    });
  });
});

describe("serializeApprovalAnswer", () => {
  it("gera allow/deny com id e seq", () => {
    const md = serializeApprovalAnswer("ABC", 1, "allow");
    expect(md).toContain("id: ABC");
    expect(md).toContain("seq: 1");
    expect(md).toContain("decision: allow");
  });
});

describe("runtime heartbeat", () => {
  it("parseia online/version/queue/ts", () => {
    const md = [
      "---",
      "online: true",
      "version: 0.1.0",
      "queue: 3",
      "ts: 2026-08-04T14:03:05.000Z",
      "---",
      "",
    ].join("\n");
    const s = parseRuntimeState(md);
    expect(s).toEqual({
      online: true,
      version: "0.1.0",
      queue: 3,
      ts: "2026-08-04T14:03:05.000Z",
    });
  });

  it("online só com flag true E heartbeat fresco", () => {
    const now = Date.parse("2026-08-04T14:04:00.000Z");
    const fresh = { online: true, queue: 0, ts: "2026-08-04T14:03:30.000Z" };
    const stale = { online: true, queue: 0, ts: "2026-08-04T14:00:00.000Z" };
    expect(isRuntimeOnline(fresh, now)).toBe(true); // 30 s atrás
    expect(isRuntimeOnline(stale, now)).toBe(false); // 4 min atrás > 90 s
    expect(isRuntimeOnline({ online: false, queue: 0, ts: fresh.ts }, now)).toBe(false);
    expect(isRuntimeOnline(null, now)).toBe(false);
  });
});
