# Claude Parity — Spec de Paridade Visual

> **Objetivo:** cada modo do AXXA fica visualmente indistinguível da superfície
> equivalente da Anthropic — elementos, subelementos e **estados**.
> **Status:** Fase 0 (fundação de tokens) implementada · Documento-contrato vivo.

| Modo AXXA | Referência visual | Superfície |
|-----------|-------------------|-----------|
| **Chat** | App do Claude (mobile/desktop) | Conversa: bolhas, composer, greeting serif |
| **Vault Q&A** | **Cowork** | Tarefas: cards de progresso, steps, artefatos |
| **Agent** | **Claude Code** | Execução: tool calls, diffs, aprovações, mono |

---

## 1. Metodologia "pixel perfect"

Paridade real é um processo iterativo com referência ao lado:

1. **Fundação por conhecimento** (esta fase): tokens + componentes construídos a
   partir da linguagem visual documentada do Claude (paleta ivory/terracotta,
   serif no display, composer-pill, glifos do Code).
2. **Calibração com referência**: screenshots reais dos apps (owner cola no
   chat, ou conecta o MCP do Mobbin/Figma) → diff visual componente a
   componente → ajuste fino de px/cor/curva.
3. **Registro**: cada componente calibrado ganha ✅ no inventário (seções 4–6).

**Regra:** nenhum componente é declarado "pixel perfect" sem passar pela etapa 2.

### Riscos assumidos (owner ciente)

- **Fontes proprietárias não são redistribuíveis** (Styrene, Tiempos/Copernicus
  da Anthropic). Usamos *stacks métricas próximas* (seção 3.2). Se o usuário
  tiver as fontes instaladas no SO, elas entram na frente da stack.
- **Trade dress:** clonar 1:1 a UI de outro produto num plugin publicado na
  loja da comunidade pode gerar atrito (revisão do Obsidian/Anthropic). Decisão
  do owner: seguir mesmo assim. Mitigação possível no futuro: tratar como
  "skin Claude" opcional.

---

## 2. Arquitetura no código

- **Camada de tokens `[DS:claude]`** em `styles/main.css`: todas as cores,
  tipos, raios e glifos da paridade viven em `--axxa-cl-*` na `.axxa-root`
  (light) com override em `.theme-dark`. **Nenhum componente da paridade
  hard-coda cor/fonte/raio — só consome `--axxa-cl-*`.**
- Os tokens **não** herdam do tema do Obsidian (exceção à regra antiga do DS —
  registrada no `DESIGN_SYSTEM.md`): paridade exige paleta própria.
- Densidade/motion existentes (`[DS:density]`, `[DS:motion]`) continuam valendo
  para spacing dinâmico e animações.
- Aplicação é **progressiva por componente** (nunca um "big bang" de CSS):
  cada PR converte um componente do inventário e marca o checklist.

---

## 3. Tokens da fundação (resumo — fonte da verdade é o CSS)

### 3.1 Paleta

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--axxa-cl-bg` | `#FAF9F5` | `#262624` | canvas da conversa |
| `--axxa-cl-surface` | `#FFFFFF` | `#30302E` | cards, sheets, composer |
| `--axxa-cl-surface-2` | `#F0EEE6` | `#3A3A38` | bolha do usuário, chips, hover |
| `--axxa-cl-sidebar` | `#F0EEE6` | `#1F1E1D` | gaveta/sidebar |
| `--axxa-cl-border` | `rgba(20,20,19,.09)` | `rgba(255,255,255,.09)` | bordas 1px |
| `--axxa-cl-ink` | `#141413` | `#EEEDE9` | texto primário |
| `--axxa-cl-ink-2` | `#6B6A66` | `#B3B1AC` | secundário |
| `--axxa-cl-ink-3` | `#91908C` | `#83817C` | muted/placeholder |
| `--axxa-cl-accent` | `#C96442` | `#D97757` | CTA, send, glifo ⏺, progress |
| `--axxa-cl-accent-hover` | `#B0553A` | `#E08B6D` | hover/pressed |
| `--axxa-cl-success` | `#2E7D4F` | `#4CAF77` | done, diff add |
| `--axxa-cl-danger` | `#C23A3A` | `#E5645A` | erro, deny, diff del |
| `--axxa-cl-warn` | `#B0802B` | `#D9A94C` | pendências, awaiting |
| `--axxa-cl-diff-add-bg` | `rgba(46,160,67,.14)` | `rgba(63,185,80,.16)` | linha + |
| `--axxa-cl-diff-del-bg` | `rgba(248,81,73,.13)` | `rgba(248,81,73,.16)` | linha − |

### 3.2 Tipografia

| Token | Stack | Uso |
|---|---|---|
| `--axxa-cl-font-display` | `"Copernicus","Tiempos Text",Georgia,"Iowan Old Style",serif` | greeting, títulos de tela |
| `--axxa-cl-font-ui` | `"Styrene B",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif` | corpo, UI |
| `--axxa-cl-font-mono` | `ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace` | Agent/Code, código |
| `--axxa-cl-fs-body` / `-lh` | `15px` / `1.65` | mensagens |
| `--axxa-cl-fs-caption` | `12px` | timestamps, metadados |
| `--axxa-cl-fs-greeting` | `clamp(24px, 6vw, 30px)` | greeting serif |

### 3.3 Formas & métricas

| Token | Valor | Uso |
|---|---|---|
| `--axxa-cl-radius-bubble` | `18px` | bolha do usuário |
| `--axxa-cl-radius-card` | `12px` | cards (tool, task, artefato) |
| `--axxa-cl-radius-composer` | `26px` | composer pill |
| `--axxa-cl-radius-full` | `999px` | chips, botões circulares |
| `--axxa-cl-send-size` | `34px` | botão send circular |
| `--axxa-cl-content-max` | `48rem` | largura máx. da conversa (desktop) |

---

## 4. Inventário — modo **Chat** (= app do Claude)

Estados globais por elemento: `default · hover · pressed · focus · disabled · streaming · erro`.

| # | Elemento | Subelementos | Estados-chave | Calibrado |
|---|----------|--------------|---------------|:---------:|
| C1 | Greeting (tela vazia) | saudação serif, sugestões em chips | default, com/sem nome | ☐ |
| C2 | Mensagem do usuário | bolha `surface-2` radius 18, canto inferior-direito reto; anexos; timestamp | default, editando, com imagem | ☐ |
| C3 | Mensagem do assistente | **sem bolha** (texto direto no canvas), markdown, citações | streaming (cursor), done, erro, parada | ☐ |
| C4 | Indicador "pensando" | glifo pulsante accent + label serif itálico | thinking, ferramentas em uso | ☐ |
| C5 | Barra de ações da msg | copiar, retry, thumbs, TTS — ícones ghost 16px | hover-reveal (desktop), sempre-visível (mobile) | ☐ |
| C6 | Composer | pill radius 26, borda 1px, `+` à esquerda, seletor de modelo inline, send circular accent (seta ↑), mic | vazio, digitando, enviável, gravando, streaming (send→stop quadrado) | ☐ |
| C7 | Blocos markdown | code block (mono, header com lang+copy), tabelas, listas, blockquote | default, copy-feedback | ☐ |
| C8 | Artefato/preview card | card radius 12, ícone, título, subtítulo | default, aberto | ☐ |
| C9 | Header da conversa | título centrado, ações à direita | default, menu aberto | ☐ |
| C10 | Scroll-to-bottom | botão circular flutuante ↓ | visível/oculto | ☐ |

## 5. Inventário — modo **Vault Q&A** (= Cowork)

| # | Elemento | Subelementos | Estados-chave | Calibrado |
|---|----------|--------------|---------------|:---------:|
| Q1 | Card de tarefa | título, status-pill, barra de progresso accent | queued, working (shimmer), done, failed | ☐ |
| Q2 | Lista de steps | check ✓ verde, spinner no ativo, pendentes muted | done/active/pending/skipped | ☐ |
| Q3 | Card de artefato/fonte | ícone de arquivo, nome, path muted; clique abre nota | default, hover, novo (badge) | ☐ |
| Q4 | Citações no texto | wikilink-chip `surface-2` radius full | default, hover | ☐ |
| Q5 | Painel "trabalhando" | header com status + tempo decorrido, atividade recente colapsável | working, idle, done | ☐ |
| Q6 | Resumo final | bloco com resultado + grid de fontes usadas | default | ☐ |

## 6. Inventário — modo **Agent** (= Claude Code)

| # | Elemento | Subelementos | Estados-chave | Calibrado |
|---|----------|--------------|---------------|:---------:|
| A1 | Linha de tool call | glifo `⏺` accent + nome da tool + args resumidos (mono) | running (spinner), ok, erro | ☐ |
| A2 | Output da tool | `⎿` + bloco colapsado "… +N linhas", expande | colapsado, expandido, erro (vermelho) | ☐ |
| A3 | Diff de edição | linhas +/− com `diff-add/del-bg`, header com path | proposto, aplicado, rejeitado | ☐ |
| A4 | Card de permissão | pergunta, preview da ação, botões **Allow/Deny** | pendente (warn), allowed, denied, timeout | ☐ |
| A5 | Spinner de atividade | glifo animado (`✻ ✳ ✶`) + verbo ("Thinking…", "Editing…") + contador | por-fase | ☐ |
| A6 | Todo list do agente | checklist ▢/☑ mono | pending/in-progress/done | ☐ |
| A7 | Barra de contexto/custo | tokens usados, modelo, custo estimado (discreto, muted) | default, alerta (perto do limite) | ☐ |
| A8 | Bloco de resposta final | separado visualmente do log de execução | default | ☐ |

---

## 7. Fases de implementação

| Fase | Escopo | Sai quando |
|------|--------|-----------|
| **P0 — Fundação** ✅ | Tokens `[DS:claude]` no CSS + este spec | tokens no repo |
| **P1 — Chat** | C1–C10 consumindo tokens | inventário C todo ☐→calibração |
| **P2 — Agent** | A1–A8 (maior gap visual hoje) | idem |
| **P3 — Q&A/Cowork** | Q1–Q6 | idem |
| **P4 — Calibração pixel-perfect** | diff contra screenshots reais, modo a modo | todos ✅ |

Ordem P1→P2→P3 definida por impacto: Chat é a superfície mais usada; Agent é
onde a paridade com Code agrega mais valor percebido.
