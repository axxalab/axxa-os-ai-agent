# Base CRUD · v0.4.0 — o app zerado para o redesign

> **Data:** 2026-09-11 · **Branch:** `final` (→ `main`) · **Tag:** `0.4.0`
> A interface (casca) foi apagada por inteiro; o **motor** ficou. Este doc é o
> mapa do que existe e de como uma casca nova conversa com ele.

## O que foi apagado

- Toda a UI antiga: `src/components/**` (chat, composer, layout, screens,
  settings de 3.5k linhas, sheets, modais de UI), `src/views/**` (AxxaApp de
  2.4k linhas, hooks de geração/projetos, fullscreen), `ImageGenModal`,
  `entitlements` (planos Free/Pro), `features` (flags), Storybook, ícones e
  logos gerados, CSS do design system (já zerado no 0.3.0).
- Settings de UI (background, densidade, motion, chips, voz, fullscreen,
  planos, billing/admin keys…). O `data.json` antigo continua carregando —
  campos desconhecidos são ignorados.
- Docs da UI antiga foram para `docs/archive/` (auditorias, DS, paridade
  Claude, telas). Tudo continua no git: `git show 0.3.0:<caminho>`.

## O que ficou (motor)

| Módulo | Papel |
|---|---|
| `src/providers/**` | 6 providers (OpenAI, Anthropic, Gemini, OpenRouter, NVIDIA NIM, Ollama) com stream, tool calling, capabilities, param policy, pricing/"hot" |
| `src/rag/**` | índice vetorial local, embeddings (4 provedores), busca híbrida (semântica + keyword + grafo), shards, quantização |
| `src/agent/**` | tools do vault (search/list/read/create/edit/move/delete/folder), permissões (ask/vault/yolo), loop detection, **`ConfirmationModal`** nativo com diff |
| `src/core/chatPersistence.ts` | CRUD dos chats como `.md` (frontmatter + `## You` / `## Assistant`) |
| `src/core/chatEngine.ts` | um turno de chat / Vault Q&A (busca → stream → erros) |
| `src/core/agentTurn.ts` | o loop do agente (stream → tool calls → confirmação → retry) |
| `src/core/session.ts` | **`ChatSession`** — o controller que a UI consome (abaixo) |
| `src/core/effort.ts` · `contextWindows.ts` · `helpers.ts` · `vaultSearch.ts` · `attachmentNotes.ts` · `providersMeta.ts` | effort (5 níveis), janelas de contexto, erros amigáveis, keyword search, anexos, lista de providers |
| `src/store/chat.ts` | store zustand: mensagens, streaming, lock de sessão, tokens |
| `src/skills/skills.ts` · `src/projects.ts` | skills como notas `.md`; projetos (chats + notas-fonte) |
| `src/usage/**` · `src/generation/save.ts` · `src/providers/transcribe.ts` | custo/billing, salvar mídia gerada, transcrição — **sem UI hoje**, prontos para religar |
| `src/main.ts` | plugin: settings (enxutas), SecretStorage das chaves, cache de summaries de chat, índice RAG no load, auto-reindex, watcher de skills |
| `src/i18n/en-us.ts` | strings (o motor usa `ai`, `agent`, `vault`, `systemPrompt`, `chat`, `conversations`; o resto é legado da UI antiga — pode ser podado) |

## A casca crua (`src/ui/`)

Componentes nativos do Obsidian + React/Preact mínimo, **zero CSS** além do
esqueleto de layout em `styles/main.css`.

- `AxxaView.tsx` — a ItemView; cria uma `ChatSession` por view.
- `App.tsx` — nav (Chats / Projects / Skills / Settings).
- `ChatView.tsx` — lista de chats (abrir / renomear / apagar), mensagens,
  composer com modo · provider · modelo · effort (travam após a 1ª mensagem).
- `ProjectsView.tsx` — CRUD de projetos, fontes, chats do projeto.
- `SkillsView.tsx` — CRUD de skills; "Use" injeta o corpo no composer.
- `SettingsTab.ts` — chave + modelo por provider, defaults, pastas, RAG
  (modelo de embedding + **Index vault**), permissões do agente.
- `modals.ts` — `PromptModal`, `ConfirmModal`, `NotePickerModal`,
  `openPluginSettings`.
- `Markdown.tsx` — `MarkdownRenderer` nativo (texto puro enquanto streama).

## Como uma UI nova fala com o motor

```ts
const session = new ChatSession(plugin);       // uma por view; session.dispose() ao fechar
session.config                                  // { provider, model, mode, effort, locked }
session.setProvider(id) / setModel(m) / setMode("chat"|"vault-qa"|"agent") / setEffort(l)
session.modelOptions(providerId)                // opções do seletor
await session.send(text)                        // 1ª msg cria id/título e trava a sessão
session.stop()                                  // aborta o stream / o turno do agente
session.newChat(mode?)                          // destrava
await session.newChatInProject(project)         // fontes viram contexto no 1º envio
await session.load(summary) / delete(summary) / rename(summary, title)
await session.updateProjects(prev => next)      // CRUD de projetos
session.onChange(cb)                            // seleção/lock mudou

useChatStore((s) => s.messages)                 // mensagens (React) — ou
useChatStore.getState() / .subscribe()          // sem React
plugin.chatSummaries · plugin.onChatsChange(cb) · plugin.loadChatSummaries()
plugin.skills · plugin.reloadSkills() · plugin.seedExampleSkills()
```

O auto-save é da sessão (debounced a cada mudança nas mensagens; abrir um chat
não regrava; fechar a view flusha). Erros (`isError`) não persistem.

## O que NÃO está exposto nesta base (motor pronto, sem UI)

Geração de imagem (`generate_image` do agente responde "indisponível"),
anexos de imagem/PDF/áudio, voz/TTS, transcrição, dashboard de uso/custo,
export de relatórios, variantes/regenerar/continuar/editar mensagem, persona
por chat, favoritos, busca in-chat, planos.

## Build / testes / release

`npm ci --legacy-peer-deps` · `npm test` · `npm run build` · bump em
`manifest.json` + `package.json` + `versions.json` · tag sem `v` → Action
publica a Release.
