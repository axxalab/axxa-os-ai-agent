# Remote Agent — runtime no Termux (Android, acesso direto ao vault)

O runtime é a **Metade B** do Remote Agent: um watcher que liga o `_agent/inbox/`
do vault ao `claude -p` e escreve a resposta no `_agent/outbox/`. Este guia é o
caminho **phone-only, offline** — o Termux lê os arquivos do vault direto (sem sync,
sem server). Contrato: [../docs/AGENT_PROTOCOL.md](../docs/AGENT_PROTOCOL.md).

```
Obsidian + AXXA ──escreve──► _agent/inbox/ ──► watcher.mjs ──► claude -p
      ▲                                                             │
      └──────────────── _agent/outbox/ ◄───────────────────────────┘
        (tudo no MESMO aparelho, mesmos arquivos)
```

## Pré-requisitos

1. **Vault acessível pelo Termux.** O vault do Obsidian precisa estar numa pasta
   que o Termux lê — *shared storage* (`/sdcard/...`) ou aparelho *rooted*. Se o
   vault estiver no storage privado do Obsidian (`Android/data/md.obsidian/...`),
   o Termux não alcança sem root — nesse caso use o caminho via LiveSync.
2. **Claude Code funcionando no Termux**, logado na sua assinatura Max
   (`claude -p "oi"` deve responder texto).

## Passo a passo

```bash
# 1. Node + storage no Termux
pkg update && pkg install nodejs
termux-setup-storage            # concede acesso ao /sdcard → ~/storage/shared

# 2. Descubra o caminho do vault (procure a pasta .obsidian)
ls ~/storage/shared             # ou: find /sdcard -maxdepth 3 -name ".obsidian" 2>/dev/null

# 3. Pegue o watcher (copie o arquivo ou clone o repo)
#    Ele é só Node built-in — nenhuma dependência a instalar.

# 4. Rode o watcher apontando pro vault (mantém a tela/CPU acordada)
termux-wake-lock
node server/watcher.mjs "/sdcard/Documents/MeuVault"
```

Você deve ver `[axxa] runtime online — observando .../_agent/inbox`.

## Testando o loop

1. No AXXA (mobile), selecione o provider **Remote Agent** (modelo `claude-code`).
2. Envie uma mensagem. O plugin cria `_agent/inbox/<id>.md`.
3. O watcher pega, roda `claude -p`, e a resposta **aparece streamando** no chat.

## Deixar o agente EDITAR o vault

Por padrão o `claude -p` roda em modo seguro (responde/ler). Pra ele criar/editar
notas sem prompt interativo, passe a permissão via env:

```bash
# aceita edições de arquivo automaticamente
AXXA_CLAUDE_ARGS="--permission-mode acceptEdits" node server/watcher.mjs "/sdcard/.../MeuVault"
```

> ⚠️ Isso deixa o agente escrever no vault sem confirmar. A aprovação visual por
> device (cards de diff no chat) é a Slice 3 — até lá, use `acceptEdits` só se
> confia na tarefa, e conte com o histórico do LiveSync como rede de segurança.

## Variáveis de ambiente

| Var | Default | O quê |
|---|---|---|
| `AXXA_AGENT_ROOT` | `_agent` | pasta do protocolo dentro do vault |
| `AXXA_CLAUDE_BIN` | `claude` | binário/alias do Claude Code |
| `AXXA_CLAUDE_ARGS` | *(vazio)* | args extra (ex: `--permission-mode acceptEdits`) |
| `AXXA_POLL_MS` | `1500` | intervalo de varredura do inbox |
| `AXXA_FLUSH_MS` | `700` | throttle de escrita incremental (streaming) |

## Mantendo vivo (Android mata background)

- `termux-wake-lock` antes de rodar (segura CPU). `termux-wake-unlock` pra soltar.
- Rodada on-demand é ok: abra o Termux, `node server/watcher.mjs ...` quando quiser
  processar a fila. Requests ficam no inbox esperando (fila assíncrona).
- Pra sempre-ligado de verdade, o caminho é um PC/VPS com o vault via LiveSync
  (mesma `watcher.mjs`, só muda o caminho e o sync) — fase seguinte.

## Higiene

- Exclua `_agent/` da indexação RAG do AXXA e, se quiser, do graph/busca do
  Obsidian (é fila de protocolo, não nota).
- Limpe `_agent/outbox/` e `_agent/inbox/` antigos de tempos em tempos (retenção
  fica configurável numa fase futura).

## Limitações desta fatia (MVP)

- Sem `usage`/custo no response (modo texto do `claude -p`); vem com `stream-json`.
- Sem aprovação visual de destrutivas (Slice 3) — por ora é `acceptEdits` no
  runtime ou modo só-leitura.
- 1 processo por request; concorrência/fila avançada é fase seguinte.
