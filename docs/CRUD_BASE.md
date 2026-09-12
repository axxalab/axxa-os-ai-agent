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

## A casca (`src/ui/`)

React/Preact mínimo sobre componentes nativos do Obsidian. O CSS em
`styles/main.css` tira **todas** as cores das variáveis do tema do usuário —
só os tokens de forma (espaço, raio, alvo de toque) são nossos.

**Canvas** (`--axxa-canvas`, no `body`): primary no claro, **secondary no
escuro** — mapeamento da casca 0.2.37. Não é estética: `--background-secondary`
é a mesma cor que o Obsidian usa na gaveta do mobile
(`--mobile-sidebar-background`), então painel e gaveta ficam idênticos e
nenhuma sobra aparece (a reserva da navbar, os cantos arredondados da gaveta, a
área do safe-area). Com o canvas em primary, cada fresta dessas virava uma
emenda visível e uma release de remendo. `--axxa-raised` é a outra das duas
superfícies (o passo de contraste): balão do usuário, trilho do segmented,
item ativo, sheets.

**Redesign, camada 1 (tela inicial do chat + menu lateral):**

- `AxxaView.tsx` — a ItemView; cria uma `ChatSession` por view.
- `App.tsx` — uma tela por vez (Chats / Projects / Skills) + o `Drawer`.
- `Drawer.tsx` — **o menu lateral**: nova conversa, navegação, Settings e o
  histórico de chats (abrir · renomear · apagar, busca a partir de 8 chats).
  Scrim + slide, fecha no Esc / no scrim / ao navegar.
- `StarterScreen.tsx` — **a tela inicial de cada chat**: segmented control de
  modo (Chat / Vault Q&A / Agent) no topo, saudação, aviso de key faltando e
  as skills do usuário.
- `ChatView.tsx` — topbar (menu · título · nova conversa), timeline e
  composer. O composer é **um bloco só**: campo em cima, barra de controles
  embaixo (pills à esquerda, enviar à direita), sem régua separando. Provider
  e modelo ficam nos pills e **somem quando a sessão trava** (aparecem na
  topbar); o effort continua livre. O modo se escolhe na StarterScreen —
  depois do 1º envio ele não muda mais.
- `AxxaView.tsx` também hospeda o que mexe em ancestrais (só classes, nunca
  API interna): **observer do teclado** (o Obsidian publica `--keyboard-height`
  inline no `<html>`; um MutationObserver no atributo `style` marca
  `.axxa-keyboard-open` na gaveta e no body) e o **fullscreen mobile**
  (`.axxa-fullscreen`, opt-in em `settings.mobileFullscreen`, toggle no menu
  lateral). Ambos portados da casca 0.2.x, onde já rodaram no aparelho.

  O desconto do teclado no fullscreen sai de `--axxa-kb`, MEDIDO pela AxxaView
  (quanto de `100dvh` está fora da área visível), com `--keyboard-height` só de
  fallback: onde a var do app não é publicada o desconto virava zero, e onde a
  WebView encolhe sozinha ela faria descontar duas vezes.

  **Regra da altura da gaveta** (0.1.254 e 0.1.255, em
  `docs/archive/MOBILE-FULLSCREEN.md`): quando o teclado abre, o **próprio
  Obsidian** encolhe a gaveta até o topo do teclado. Então o plugin **não
  define altura de gaveta** — exceto no fullscreen, que impõe largura própria
  e por isso precisa impor altura também; lá, e só lá, ela desconta
  `--keyboard-height`. O observer do teclado só alterna classes (chrome da
  gaveta, pintura do body): não toca em geometria.
- `fullscreenScope.ts` — regras PURAS de escopo do fullscreen (`isRightDrawer`,
  `isDrawerOnScreen`), testadas em `tests/fullscreenScope.test.ts`. Ficam fora
  da view de propósito: erradas, deixam o Obsidian sem chrome.

  O CSS do fullscreen tem quatro peças que só juntas funcionam (aprendidas no
  aparelho, 0.1.243→0.1.252 — a fonte é `git show 0.2.37:styles/main.css`, NÃO
  a 0.3.0, que zerou o CSS):
  1. a gaveta vai a **100vw** e a cadeia de containers junto, com a altura em
     `calc(100dvh - var(--keyboard-height))` — a gaveta direita é parcial,
     esconder o chrome não basta; e como a altura passa a ser nossa, o
     desconto do teclado devolve o encolhimento que era do app;
  2. a cadeia inteira pinta o **mesmo canvas**, senão sobra faixa preta da
     leaf nativa nos cantos e durante o transform;
  3. `.view-content` zera padding/margin — sem navbar não há o que reservar;
  4. **não somar safe-area** por dentro da topbar nem do composer: o
     container do drawer já começa abaixo da status bar e termina acima da
     barra de gestos (era o bug 0.1.252).

  E fora do fullscreen: `.view-content` leva `z-index: 10` pra ficar na
  frente da leaf nativa de baixo — senão o composer aparece atrás do editor —,
  **pinta o canvas do app** (padding pinta com o fundo do próprio elemento: sem
  isso a reserva da navbar sai com o cinza da GAVETA e vira uma barra visível)
  e **zera essa reserva com o teclado aberto** (a gaveta já subiu, a navbar
  ficou atrás do teclado — reservar de novo é faixa morta).
- `layoutReport.ts` — **Inspector**: o comando "Copy mobile layout report"
  copia os números do layout NO APARELHO (viewport, visualViewport,
  `--keyboard-height`, `env(safe-area-*)`, classes e geometria da gaveta, quem
  pinta cada superfície). Teclado e tela cheia dependem de coisas que só o
  aparelho sabe — sem o relatório, cada ajuste vira uma release de palpite.
- `Icon.tsx` — ícone Lucide via `setIcon` nativo.
- `Sheet.tsx` — **bottom sheet** do composer (provider · modelo · effort):
  puxador, X à esquerda com título centralizado, cartões agrupados com linhas
  título + legenda, a ativa em accent com check. `SheetGroup` / `SheetRow` /
  `SheetLabel` são as peças.
- `menu.ts` — `openActions` sobre o `Menu` do Obsidian, só pras AÇÕES do
  histórico (o ⋯ de um chat).
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

## Ver a casca sem abrir o Obsidian

```
npm run preview      # http://127.0.0.1:8777/?s=empty
```

Renderiza os componentes reais de `src/ui` com um stub da API do Obsidian **e
o `app.css` de verdade**, extraído do `obsidian.asar` instalado na máquina
(fica em `scripts/preview/.out/`, fora do git). Isso importa: o `app.css`
estiliza `button`, `textarea` e `input` com seletores de especificidade 0,1,1
(`button:not(.clickable-icon)`) que **ganham** de uma classe nossa sozinha —
um preview com tema "aproximado" mostra a UI bonita e o app mostra outra
coisa. Por isso todo seletor de `styles/main.css` vem prefixado com
`.axxa-root` e existe um bloco de reset no topo do arquivo.

Cenários: `?s=empty|thread`, `&theme=light|dark`, `&device=mobile|desktop`,
`&kb=300` (simula o teclado com a mesma `--keyboard-height` do app) e `&fs=1`
(fullscreen). O harness monta a mesma árvore do mobile — gaveta direita
`position: fixed`, header da gaveta, view-header e navbar — e aplica as mesmas
classes que a `AxxaView` põe nos ancestrais.

## Build / testes / release

`npm ci --legacy-peer-deps` · `npm test` · `npm run build` · bump em
`manifest.json` + `package.json` + `versions.json` · tag sem `v` → Action
publica a Release.
