# final-v2 · v0.3.0 — recomeço VISUAL com tudo liberado

> **Data:** 2026-09-11 · **Branch:** `final-v2` → `main` · **Tag:** `0.3.0`
> Sucede o recomeço "chat-only" da `final` (0.2.0–0.2.37). Documento vivo.

## O que mudou

1. **CSS zerado.** `styles/main.css` saiu de ~8.4k linhas (DS completo: tokens,
   paridade Claude, densidade, motion, 16 backgrounds, bottom sheets, bolhas,
   composer pill…) para um **esqueleto funcional** de ~200 linhas comentadas.
   A UI roda crua sobre o tema nativo do Obsidian e vai ser reconstruída
   componente a componente.
2. **Tudo liberado.** `src/features.ts` com todas as flags `true`: chat,
   conversas, Vault Q&A, Agent, RAG, skills, geração de imagem, voz, projetos,
   mídia, estatísticas, usage, planos. Consequências no código:
   - as telas que o 0.2.0 tirou do render (Media / Statistics / Projects /
     Profile / Plans) voltaram ao `AxxaApp`;
   - RAG (índice, auto-reindex, embeddings) e skills (reload + watcher) voltam
     a carregar no `onload`;
   - abas **Agent** e **Usage** das Settings e os modos **Vault Q&A / Agent**
     da gaveta destravam sozinhos (leem as flags);
   - o preset de background volta a ser aplicado como classe `axxa-bg-<id>`;
   - `Profile` na nav deixou de cair no `default: true` do feature-lock.
3. **Só dois itens seguem travados**, porque **não têm handler** (clicar não
   faria nada): **"Add to home"** e **"Add to project"** no menu ⋮ do header —
   flags `homeShortcut` / `addToProject`. Quando ganharem comportamento, é
   virar a flag.

## O que ficou no CSS e por quê

| Bloco | Sem ele… |
|---|---|
| Host/raiz — altura 100%, coluna flex, scroll **interno** da conversa | o composer vai parar no fim da página e o auto-scroll do stream não acompanha |
| Clearance da navbar (mobile) / status bar (desktop) | o composer fica atrás da navbar / status bar |
| Fullscreen mobile + `axxa-keyboard-open` | o toggle "Fullscreen" do menu vira no-op |
| Gaveta fechada `display:none` / aberta como overlay | a lista de conversas aparece permanentemente no fim do painel |
| `.axxa-popover-menu` `position:fixed` + fundo do tema | o menu ⋮ (portalado pro `<body>`) some da tela |
| `.axxa-sr-only` | o texto da live region (a11y) fica visível |
| `.axxa-code-wrap` | a opção "Code wrap" vira no-op |
| Marcação de **estado** — negrito/sublinhado, `[on]`/`[off]`, ●/○ | toggles, abas, rádios e filtros custom não mostram on/off (foi P0 na auditoria) |

Zero cor, fonte, raio, sombra ou animação. Cada bloco tem o "por quê" no
próprio arquivo; quando um componente deixar de depender dele, apague.

## Opções que existem mas hoje não têm efeito visual

Settings → Appearance: **Background** (16 presets), **densidade**, **motion**
e **reduce motion**. Continuam salvando e aplicando classe/atributo na raiz
(`axxa-bg-*`, `data-axxa-density`, `data-axxa-motion`, `body.axxa-reduce-motion`)
— ganham efeito quando o CSS delas for reconstruído.

## Como evoluir (um componente por vez)

- Criar o bloco CSS do componente em `styles/main.css` com a tag `[DS:<id>]`
  (convenção de [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)), consumindo variáveis do
  tema do Obsidian.
- Quando o componente ganhar visual próprio de estado, remover a regra genérica
  correspondente da seção 7 do CSS.
- Referência do que existia: `git show 0.2.37:styles/main.css` (DS completo),
  [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [CLAUDE_PARITY_SPEC.md](CLAUDE_PARITY_SPEC.md).
- Preview fora do Obsidian: `npm run storybook` (renderiza os componentes reais
  com o `styles/main.css` atual).
