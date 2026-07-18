# AXXA OS — Revisão de UX pré-publicação (v0.1.236)

Revisão feita com o **storybook do projeto** (`npm run storybook`, novo em
`storybook/`), que renderiza os componentes reais do plugin fora do Obsidian:
16 stories × temas dark/light × viewport mobile (390×844) e desktop (900px),
com dados mock. Screenshots capturados via Chromium headless, zero erros de
console em todas as combinações.

> **Caveat do harness:** o storybook usa um shim do módulo `obsidian`
> (ícones Lucide, markdown naive, variáveis de tema aproximadas). Achados
> marcados com ⚠️ podem se comportar diferente dentro do Obsidian real —
> confirmar lá antes de agir.

---

## Veredito geral

A base visual está **forte**: o design system (tokens de densidade, pills,
segmented) dá consistência real, o dark theme é bem resolvido, os empty
states existem e têm copy boa, e o fluxo de erro de API key tem CTA claro
("Open Settings" / "Try again"). O que falta pra publicar não é redesign —
é **polish de consistência + 3 blockers pontuais** listados abaixo.

---

## P0 — Blockers antes de submeter

### 1. Chave de licença de TESTE exposta na tela Plans
A tela Plans mostra literalmente: *"Paste your license to unlock Pro.
(test: AXXA-PRO-TEST-2026)"*. Qualquer usuário desbloqueia Pro de graça, e
num review da comunidade isso passa impressão de produto inacabado.
**Fix:** remover a chave do copy (e idealmente invalidar essa chave no
`entitlements.ts`).

### 2. Glyph "thinking" preto no tema escuro
`.axxa-glyph-spark` (styles/main.css:579) não define `fill` — o SVG cai no
default **preto**. No onboarding (hero) o spark aparece preto sobre fundo
escuro; o mesmo glyph é usado como caret de streaming e ícone de thinking.
**Fix:** `fill: currentColor` (ou o accent) em `.axxa-glyph-spark`.
*(Não é artefato do shim: a regra simplesmente não existe no CSS.)*

### 3. Screenshots da submissão não existem
`docs/screenshots/` só tem o README com o checklist; a tabela do README.md
segue comentada. Pro diretório da comunidade, screenshot é o primeiro (às
vezes único) contato do usuário com o plugin.
**Fix:** capturar os 7 shots do checklist. O storybook já cobre rascunhos de
`starter`/`sidebar-nav`/`mobile-drawer`; os de vault real (Q&A com citações,
agent diff, usage heatmap) precisam do Obsidian.

---

## P1 — Consistência que o reviewer/usuário nota

### 4. IDs crus de modelo vazando na UI
"claude-haiku-4-5-20251001" aparece por extenso na lista de conversas e no
Top Models das Statistics. Existe `prettyModelName` — não está sendo usado
nesses pontos. Além de feio, estoura truncamento no mobile.
**Fix:** aplicar `prettyModelName` em `ConversationsList` chips e
`StatisticsScreen` top models.

### 5. Sugestões com 3 linguagens visuais diferentes por modo
Na NewChatScreen: modo **chat** = linhas de texto sem container; **Vault
Q&A** = chips arredondados; **agent** = cards grandes. São 3 padrões pro
mesmo conceito ("prompt starter"), e no agent o 3º card corta no meio
("List to-…") sem affordance de scroll horizontal.
**Fix:** escolher UM padrão (os chips do Q&A são o melhor equilíbrio) ou,
se a diferença é intencional, garantir que nada corte sem indicar scroll.

### 6. Segmented de provider sem estado selecionado visível
Na NewChatScreen o provider ativo só é comunicado pelo microtexto
"PROVIDER · OpenAI" acima; as pills OpenAI/Anthropic parecem idênticas.
⚠️ *No harness o realce accent pode ter se perdido — confirmar no Obsidian;
se lá também estiver sutil, reforçar o estado ativo (fundo accent ou borda).*

### 7. Datas com formatos misturados na lista de conversas
O mesmo item mostra "2d" (relativo) no chip enquanto o cabeçalho do grupo
diz "JUL 16" (absoluto); itens com 7+ dias trocam pra "Jul 11" no chip.
**Fix:** chip sempre relativo (o grupo já dá o absoluto), ou vice-versa.

### 8. Precisão monetária inconsistente nas Statistics
"$0.481", "$0.212", "$0.040" e "$0.0010" convivem na mesma tela (3 casas vs
4). **Fix:** padronizar `formatUsd` (ex.: sempre 2 algarismos
significativos, "< $0.01" pra micro-valores).

### 9. Badge "PRO" em TODA resposta da IA
Cada bolha de resposta carrega um pill "PRO" permanente na barra de ações
(Messages.tsx:443). Upsell repetido em cada mensagem vira ruído visual e
compete com as ações reais (copiar/regen/like).
**Fix:** mover o upsell pra um ponto único (Profile/Plans, ou só na feature
bloqueada quando o usuário tocar nela).

### 10. Largura de linha ilimitada no desktop
Com o painel a 900px, o texto da IA ocupa a largura inteira (~130+
caracteres por linha) — leitura cansativa. **Fix:** `max-width` de ~70–80ch
no corpo da mensagem (o Composer já é centrado; alinhar com ele).

---

## P2 — Polish e acessibilidade

### 11. Filtros icon-only sem rótulo/estado
Os 4 filtros de modo (Recents da sidebar e topo da ConversationsList) são
ícone puro; o estado ativo é sutil e não há `aria-pressed`/tooltip
consistente. Primeiro uso exige adivinhar o que cada ícone filtra.

### 12. Alvos de toque abaixo de 44px
Ações da mensagem (copiar/salvar/TTS/regen/like) têm ~24–28px no mobile.
Recomendação Apple/Android: ≥44px de área de toque (padding resolve sem
mudar o visual).

### 13. Composer muda de anatomia entre modos
Chat = pill simples sem status; agent/Q&A = card com chips de
modelo/effort. O usuário perde a referência de "qual modelo está ativo" no
modo chat (só vê no header). Considerar chips de status em todos os modos
(a preferência `composerChips` já existe).

### 14. Densidade não afeta a tela de conversa
Trocar compact/normal/large não muda nada no chat (screenshots idênticos
byte a byte) — os tokens de densidade regem listas/pills, mas bolhas,
espaçamento de mensagens e composer não escutam. Se densidade é um seletor
global de Settings, o chat (tela nº 1 do produto) deveria responder.

### 15. Bolha de erro depende de `content` preenchido
Com `content` vazio + `errorCode` setado, a bolha renderiza vazia (só o
ícone ⚠ e os CTAs). ⚠️ *No fluxo real o AxxaApp sempre preenche via
`describeProviderError`, mas vale um fallback por `errorCode` dentro do
próprio `ErrorMessage` como cinto de segurança.*

### 16. Contraste dos metadados
Timestamps ("05:29 PM"), sub-labels e chips usam `--text-faint` sobre
fundo escuro — no shim ficou ~#666 sobre #1e1e1e (≈3:1, abaixo de WCAG AA
para texto pequeno). ⚠️ *Depende do tema real do usuário; vale conferir com
o default theme do Obsidian.*

---

## Débito que afeta a publicação (não-visual)

- **StarterScreen.tsx é código morto em ~grande parte** (1.473 linhas): o
  dashboard (ModelInfoCard, ActivityChart, StatusCards, EffortSlider…) não
  é mais montado pelo AxxaApp — a tela vazia hoje é a NewChatScreen. Só
  `PROVIDERS`/`providerConfigured` são importados de fora. Limpar reduz
  bundle e evita perguntas no review da comunidade.
- **`fundingUrl`** opcional segue pendente no manifest (checklist do
  SUBMISSION.md).
- Duplicata suspeita de seletor: segundo bloco `.axxa-typing-caret`
  (styles/main.css:~2536) define `align-items`/`padding-top` — parece que o
  seletor deveria ser outro (hero do onboarding?). Conferir.

## O que já está bom (não mexer)

- Empty states com copy útil (Projects, Media) e CTA no lugar certo.
- Onboarding: hierarquia clara, 5 bullets com ícone, disclosure de
  privacidade ("key no OS keychain") no lugar certo, CTA único.
- Fluxo de erro com "Open Settings" + "Try again" — padrão correto.
- Dark/light: nenhuma quebra estrutural entre temas nas 16 telas.
- Sidebar: hierarquia New chat/Q&A/Agent em accent + navegação secundária
  neutra funciona bem.

---

## Como reproduzir

```bash
npm run storybook          # sobe em http://localhost:6006
npm run storybook:build    # só builda storybook/dist/
```

Controles no topo: tema (dark/light), densidade (compact/normal/large) e
viewport (mobile 390×844 / desktop 900). As stories cobrem: chat ativo,
chat com erro, NewChat ×3 modos, sidebar, conversas, composer idle/
streaming, model sheet, onboarding, statistics, profile, plans, locked e
projects.
