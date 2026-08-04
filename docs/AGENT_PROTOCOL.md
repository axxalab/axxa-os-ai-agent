# Protocolo `_agent/` — contrato do Remote Agent (v1)

> **Status:** v1 (MVP) · **protocol:** `1` · Implementado pela Metade A (plugin,
> `src/providers/remoteAgent.ts` + `remoteAgentProtocol.ts`). A Metade B (runtime
> `server/`) implementa o outro lado. Ver [AGENT_CLOUD_PLAN.md](AGENT_CLOUD_PLAN.md).

O plugin (client) e o runtime (Claude Code headless) se comunicam **só por arquivos
dentro do vault**, replicados pelo LiveSync. Nenhum HTTP/TCP direto — é o que faz
funcionar no mobile, atrás de NAT, e sobreviver ao runtime offline (fila assíncrona).

## Regras invariантes

1. **Append-only, 1 arquivo por evento** (AD-3). Um arquivo de request **nunca** é
   editado depois de criado. Respostas crescem por append no corpo. Isso elimina
   conflitos de merge do LiveSync (dois lados nunca escrevem o mesmo arquivo).
2. **Client escreve `inbox/`, `approvals/*.answer.md` e `inbox/*.cancel.md`.**
   **Runtime escreve `outbox/`, `approvals/*` (o pedido) e `state/`.** Cada lado é
   dono exclusivo dos seus paths.
3. **`protocol: 1`** em todo request. Runtime que não suporta a versão marca
   `status: failed` com erro legível.
4. Todo arquivo é **Markdown legível** (frontmatter YAML + corpo) — o usuário audita
   o histórico no próprio Obsidian.

## Layout

```
_agent/                       # raiz configurável (setting remoteAgentPath, default "_agent")
  inbox/
    <id>.md                   # request (client → runtime)
    <id>.cancel.md            # pedido de cancelamento (client → runtime)
  outbox/
    <id>/
      response.md             # resposta (runtime → client), corpo append-only
      events.md               # log de tool calls/progresso (opcional MVP)
  approvals/
    <id>-<n>.md               # pedido de aprovação c/ diff (runtime → client)
    <id>-<n>.answer.md        # allow|deny (client → runtime)
  state/
    runtime.md                # heartbeat (runtime → client)
```

`<id>` é um **ULID** (26 chars, Crockford base32, ordenável por tempo).

## Máquina de estados

```
queued ──► running ──► awaiting_approval ──► done
                 │            │                └─► failed
                 └────────────┴──────────────────► cancelled
```

Estados terminais: **`done`**, **`failed`**, **`cancelled`**. O client considera a
tarefa encerrada e para de observar quando `status` é terminal.

## `inbox/<id>.md` — request (client → runtime)

```markdown
---
protocol: 1
id: 01J9Z8K3QZ8N7Q9X2C4V6B8M0A
ts: 2026-08-04T14:03:11.234Z
mode: agent            # chat | vault-qa | agent
model: claude-code     # tier lógico; runtime mapeia p/ `claude -p --model`
device: mobile         # mobile | desktop (telemetria/UX)
---
<prompt do usuário — inclui o histórico serializado quando aplicável>
```

## `inbox/<id>.cancel.md` — cancelamento (client → runtime)

Corpo vazio; a existência do arquivo sinaliza cancelar `<id>`. O runtime, ao detectar,
encerra a execução e marca `outbox/<id>/response.md` com `status: cancelled`.

## `outbox/<id>/response.md` — resposta (runtime → client)

Frontmatter reescrito a cada atualização de status (é o **único** arquivo cujo
frontmatter muda; o corpo só cresce por append). O client faz *diff* pelo tamanho já
lido e emite o sufixo novo como delta de streaming.

```markdown
---
protocol: 1
id: 01J9Z8K3QZ8N7Q9X2C4V6B8M0A
status: running        # queued | running | awaiting_approval | done | failed | cancelled
usage: { input: 1240, output: 320 }   # opcional; presente ao finalizar
error: ""              # preenchido quando status=failed (mensagem legível)
---
<texto da resposta, crescendo por append em blocos>
```

## `approvals/<id>-<n>.md` — pedido de aprovação (runtime → client)

Toda ação destrutiva (edit/move/delete) pausa a tarefa (`status: awaiting_approval`)
e gera um pedido numerado com o diff proposto.

```markdown
---
protocol: 1
id: 01J9Z8K3QZ8N7Q9X2C4V6B8M0A
seq: 1
action: edit           # edit | move | delete | create
path: Notas/Alvo.md
---
```diff
- linha antiga
+ linha nova
```
```

O client responde criando **`approvals/<id>-1.answer.md`**:

```markdown
---
protocol: 1
id: 01J9Z8K3QZ8N7Q9X2C4V6B8M0A
seq: 1
decision: allow        # allow | deny
---
```

**Fail-safe (AD-5):** sem `answer.md`, a ação destrutiva **não** executa. Timeout no
runtime → tarefa fica pausada, nunca auto-allow.

## `state/runtime.md` — heartbeat (runtime → client)

Atualizado periodicamente (≤ 60 s). O client considera **online** se `ts` é recente
(dentro de `staleMs`, default 90 s) e `online: true`.

```markdown
---
protocol: 1
online: true
version: 0.1.0
queue: 0               # tarefas na fila
ts: 2026-08-04T14:03:05.000Z
---
```

## Higiene (Story 1.2)

- A pasta `_agent/` deve ser excluída da indexação RAG e escondível do graph/busca
  (documentar no setup). Retenção configurável de requests antigos (default 30 dias).
