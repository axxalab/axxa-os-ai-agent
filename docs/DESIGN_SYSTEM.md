# AXXA — Design System

Documento vivo. A partir da gaveta lateral (v0.1.201–206) tudo que a gente
desenha vira regra aqui. **Só o tema (cores/tipografia do Obsidian) é herdado;
estrutura, espaçamento, interações e componentes são nossos.**

---

## 1. Convenção de tag no CSS (manutenção + limpeza)

Todo bloco de CSS **criado a partir de agora** recebe uma tag no comentário:

```css
/* [DS:<id>] descrição curta */
.minha-classe { ... }
```

- **Com `[DS:...]`** → código **mantido**, documentado aqui. Não remover sem
  atualizar este doc.
- **Sem tag** → candidato a **limpeza** (lixo/duplicata de versões antigas).

Pra varrer o que ainda é legado (sem tag), procure blocos `.axxa-*` em
`styles/main.css` que **não** têm `[DS:` perto. A limpeza acontece aos poucos —
não apagamos nada que não tenha certeza.

Index de tags ativas: `pill`, `badge`, `list-compact`, `seg-accent`, `density`,
`motion`. (cresce conforme criamos.)

---

## 2. Tokens

### [DS:density] — densidade global da UI (large / normal / compact)
**Regra:** o espaçamento do app inteiro é dirigido por tokens que reescalam em
3 modos. O usuário escolhe em **Settings → Aparência → Interface**; o valor vai
pra `settings.density` e vira o atributo `data-axxa-density` na `.axxa-root`.
**"normal" é o default** (mais respiro) — `compact` espreme, `large` solta.

```css
/* defaults = normal, na .axxa-root */
--axxa-list-row-py: 6px;     /* padding vertical da linha de lista densa  */
--axxa-list-row-radius: 9px; /* raio da linha de lista                    */
--axxa-pill-radius: 10px;    /* raio de pílulas/nav/realce                */
--axxa-seg-btn-py: 5px;      /* padding vertical do botão do segmented    */
--axxa-row-gap: 10px;        /* gap INTERNO da linha (ícone → texto)      */
--axxa-row-py: 9px;          /* padding vertical de linha confortável     */
--axxa-stack-gap: 2px;       /* gap ENTRE linhas empilhadas / divisórias  */
```

| token              | compact | normal | large |
|--------------------|:-------:|:------:|:-----:|
| `--axxa-list-row-py`     | 3px | 6px | 9px  |
| `--axxa-list-row-radius` | 7px | 9px | 12px |
| `--axxa-pill-radius`     | 8px | 10px| 12px |
| `--axxa-seg-btn-py`      | 3px | 5px | 8px  |
| `--axxa-row-gap`         | 8px | 10px| 12px |
| `--axxa-row-py`          | 6px | 9px | 12px |
| `--axxa-stack-gap`       | 1px | 2px | 4px  |

**Lei do DS:** nenhum componente novo hard-coda spacing/raio — consome estes
tokens (ex.: `padding: var(--axxa-row-py) 10px`). A gaveta lateral é a
referência: **todos** os componentes dela estão ligados — `-new`, `-nav`,
`-nav-item`, `-divider`, `-item` (recentes), `-seg`, `-foot`, `-account` usam
`--axxa-row-py` / `--axxa-row-gap` / `--axxa-stack-gap` / `--axxa-pill-radius` /
`--axxa-list-row-*` / `--axxa-seg-btn-py`. Trocar a densidade reescala a gaveta
inteira de uma vez.

⚠️ O `.axxa-seg-btn` leva `min-height:0 !important; height:auto !important` —
sem isso o `.mobile-tap` do Obsidian força 44px e o segmented fica gigante no
mobile (mesma armadilha do [DS:list-compact]).

### [DS:motion] — personalidade global das animações (soft / wave / intense / chaotic)
**Regra:** **toda animação nova** consome os tokens de motion em vez de
hard-codar duração/easing. O usuário escolhe o nível em **Settings → Aparência →
Interface**; vai pra `settings.motion` e vira `data-axxa-motion` na `.axxa-root`.
**"wave" é o default** — a mola-assinatura do app (a mesma do modal/effort:
`cubic-bezier(0.34,1.25,0.4,1)`).

```css
/* defaults = wave, na .axxa-root */
--axxa-motion-dur: 0.34s;                        /* duração base          */
--axxa-motion-ease: cubic-bezier(0.34,1.25,0.4,1); /* curva (overshoot)   */
--axxa-motion-amp: 1;                            /* amplitude (translate) */
--axxa-motion-pop: 0.92;                         /* escala inicial do pop */
```

| token | soft | wave | intense | chaotic |
|-------|:----:|:----:|:-------:|:-------:|
| `--axxa-motion-dur` | 0.2s | 0.34s | 0.44s | 0.6s |
| `--axxa-motion-amp` | 0.5 | 1 | 1.5 | 2.3 |
| `--axxa-motion-pop` | 0.97 | 0.92 | 0.85 | 0.74 |
| `--axxa-motion-ease` | ease-out | spring leve | overshoot | anticipa+bounce |

**Como consumir — SEMPRE em longhand.** ⚠️ `var()` dentro do *shorthand*
`transition`/`animation` pode invalidar a regra inteira (o `transition-property`
volta pra `all`, o `animation-name` pra `none`) → a animação simplesmente **não
roda** e o elemento "pula". Use as longhands:
```css
transition-property: transform, width;
transition-duration: var(--axxa-motion-dur);
transition-timing-function: var(--axxa-motion-ease);
/* e pra "pops": */
animation-name: meu-pop;
animation-duration: var(--axxa-motion-dur);
animation-timing-function: var(--axxa-motion-ease);
animation-fill-mode: both;
```
"Pops" (entrada) → keyframe que lê os tokens: `transform: translateY(calc(5px *
var(--axxa-motion-amp))) scale(var(--axxa-motion-pop))` (mesmo pop do card de
modelo). Custom properties funcionam DENTRO de `@keyframes` (resolvem no
elemento). Primeiro cliente: o segmented "label no ativo" da gaveta.

**Transição via inline-style em `useLayoutEffect` é frágil.** Um indicador
deslizante MEDIDO (posição setada inline dentro de `useLayoutEffect`) **não
dispara o `transition` CSS de forma confiável** em todo ambiente — o segmento da
gaveta ficava "pulando" sem mola mesmo com o CSS certo. Quando a animação é
dirigida por JS (inline-style medido), use a **Web Animations API**
(`el.animate([from,to], {duration, easing})`) lendo `dur/ease` dos tokens via
`getComputedStyle(root)`. WAAPI roda imperativo: ignora cascade, o timing de
re-render e o `prefers-reduced-motion` → a mola SEMPRE roda. (Transições por
toggle de CLASSE — ex.: a gaveta abrindo — continuam confiáveis no CSS puro.)

**Reduzir movimento:** `.axxa-root.axxa-reduce-motion` (toggle do user no mobile,
`settings.reducedMotionMobile`, aplicado via `Platform.isMobile`) **e** o
`@media (prefers-reduced-motion: reduce)` do SO neutralizam os tokens
(dur `0.01s`, amp `0`, pop `1`) → animações novas viram quase-instantâneas. Como
tudo lê os tokens, **uma** chave cobre o DS inteiro. Animações legadas (modal,
effort, etc) não estão tokenizadas — migram pra cá quando forem tocadas.

### [DS:pill] — superfície de hover/seleção (vidro fosco)
**Regra:** toda superfície selecionável (item de nav, item de lista, chip,
etc.) usa, no **hover** e no **selecionado**, uma **pílula com blur** — nunca
uma borda dura nem um retângulo opaco.

```css
--axxa-pill-radius: 10px;
--axxa-pill-bg: color-mix(in srgb, var(--text-normal) 7%, transparent);
--axxa-pill-bg-strong: color-mix(in srgb, var(--text-normal) 13%, transparent); /* selecionado */
--axxa-pill-blur: saturate(140%) blur(7px);
```

Utilitários: `.axxa-pill` (hover) e `.axxa-pill-strong` (selecionado). Fallback
sem `color-mix` cai pra `--background-modifier-hover`. O blur só fica visível
sobre fundo variado (modo preset/glass) — em fundo sólido vira um realce sutil
(degradação ok).

### [DS:list-compact] — lista densa
Lista de 1 linha por item (recentes, etc). O padding/raio da linha vêm dos
tokens de **[DS:density]** (`--axxa-list-row-py` / `--axxa-list-row-radius`),
então a altura segue a densidade escolhida (compact ≈ 20px, normal ≈ 26px).
Utilitário: `.axxa-list-compact-row`. Estrutura:
`[ícone do modelo 14px] título(cresce) [hora]`, `align-items: center`,
`line-height: 1.2`.

⚠️ **No mobile, sempre** `min-height: 0 !important; height: auto !important` nos
`<button>` de lista — o Obsidian força um alvo de toque de **44px** via
`.mobile-tap` que estoura a altura. Sem isso a linha fica gigante.

O ícone do modelo vem de `modelVendorLogoId(provider, model)` (logo do vendor;
fallback `message-square` pra chats sem provider — ex: estrangeiros).

---

## 3. Componentes

### Gaveta lateral (`.axxa-sidebar`)
Espelha a estrutura de um drawer minimalista; só o tema é nosso.

- **Scroll:** tudo (brand + new + nav + recentes) rola junto num
  `.axxa-sidebar-scroll`; **só o rodapé fica fixo**. Ao TROCAR de modo no filtro,
  a faixa "Recentes + segmented" (`.axxa-sidebar-recents-head`) rola pro topo do
  scroll (via `useEffect` no `modeFilter`, escopado ao scroll da gaveta) — a
  brand/nav somem por cima e a lista fica mais ampla. `.axxa-sidebar-list` tem
  `min-height:100%` pra **sempre** haver espaço da faixa chegar ao topo: o
  movimento é idêntico com 1 ou 10000 chats (não depende da quantidade).
- **Slide da lista:** ao trocar de modo, `.axxa-sidebar-list-items` remonta
  (`key={modeFilter}`) e "nasce" deslizando no MESMO sentido do switch
  (`--axxa-slide-dir` = ±1), com a mola de **[DS:motion]**. Vai junto com o
  movimento da pílula do segmento.
- **Filtro:** "Todos" é `iconOnly` (fica selecionado mas sem label, não cresce);
  um `dividerBefore` no Chat desenha o "|" que separa Todos dos 3 modos. O
  slide+morph da pílula é **WAAPI** (ver [DS:motion]), com **pop de escala
  0.94→1** (mola) na troca — igual à entrada do modal do card.
- **Efeito de modal no pill selecionado** (v0.1.217): o `.axxa-seg-ind` ativo
  reusa o visual do `.axxa-mc-modal` — **glow cônico girando na borda** (`::before`
  anel mascarado + `@property --axxa-glow`) + **shimmer** varrendo (`::after`).
  `overflow:hidden` contém o shimmer no formato da pílula. Gated por
  `prefers-reduced-motion` (igual ao modal).
- **Filtro sticky:** `.axxa-sidebar-recents-head` é `position:sticky; top:0` —
  com muito chat, ao rolar a lista o filtro gruda no topo (mesmo lugar do
  auto-scroll) e desce de volta ao subir. Em glass vira vidro fosco pra a lista
  passar por baixo limpa.
- **FAB "subir ao topo"** (`.axxa-sidebar-fab`): aparece quando o scroll passa de
  ~160px (hysteresis pra não piscar), some perto do topo; clique rola a gaveta
  pro topo. Accent, pop de entrada + squish ao apertar (`:active`), tudo via
  [DS:motion].
- **Vazio / fim:** lista vazia distingue "sem nenhuma conversa" (`emptyAll`) de
  "nada nesse filtro" (`emptyFilter`) — ícone `inbox` centrado no espaço livre.
  Com itens curtos, o void abaixo é pintado com um "fim da lista"
  (`.axxa-sidebar-end`, divisória faint + label) ancorado no fundo
  (`margin-top:auto`). **Cache ruim:** `safeChats` blinda `chats` não-array,
  filtra entradas falsy, título cai pra `untitled`, key cai pro índice.

- **Brand (topo):** lockup em coluna — nome `AXXA AI Agent` (1.35rem, 700) +
  versão `vX.Y.Z` (faint). Sem avatar/box/X (o scrim fecha).
- **Nova conversa:** mesma linha dos itens de nav (ícone + texto), em
  `--text-accent` **sempre** (`!important` no texto e no ícone — o `<button>`
  do Obsidian mobile força a cor padrão). Sem fundo/borda.
- **Nav:** linhas FLAT (`appearance:none` + `background:transparent !important`
  pra matar o fundo cinza padrão de `.theme-dark button`). Ativa = `[DS:pill]`
  forte. Item pago no free mostra cadeado.
- **Recentes:** label "Recentes" (16px/700) + **segmented control**
  (`SegmentedRow`, pílula deslizante animada, fino) filtrando por modo
  (Todos/Chat/Q&A/Agente). Chats de outro provedor (modo desconhecido) só
  aparecem em "Todos". Deletar via long-press/right-click (menu nativo).
  - **[DS:seg-accent]** — botão ATIVO em accent (pílula tingida + ícone
    `--text-accent`).
  - **Label no ativo** (`showActiveLabel`) — só o slot selecionado mostra o
    texto do modo e cresce (~2.4×); inativos ficam só ícone. O trilho **preenche
    a sidebar inteira** (X) — inativos dividem o resto. A **altura não muda** (o
    label é menor que o ícone). Como os slots deixam de ser iguais, o indicador
    é **medido em JS** (`offsetLeft/Width` do botão ativo, via `useLayoutEffect`
    + `ResizeObserver`) e posicionado inline — desliza E faz morph de largura. O
    slide e o "pop" do label herdam **[DS:motion]** (mola do app). Quem não passa
    a prop continua no modo slot-igual (StarterScreen etc).
  - **Haptics** — `hapticTick()` no `onSelect` (feedback ao trocar de modo).
- **Rodapé (conta):** avatar (iniciais) + **nome** + **[DS:badge]** + stats
  básicas (`N conversas · T tokens`) + engrenagem (Settings).

### [DS:badge] — emblema de plano
Pílula pequena ao lado do nome. Variantes:
- **Free** — neutro (`--text-normal` 12% / `--text-muted`).
- **Premium** — accent (`--interactive-accent` 22% / `--text-accent`).
- **Founder** — dourado (gradiente). Ligado por `settings.founder`.

Prioridade: Founder > Premium (tier pro) > Free.

---

## 4. Próximas telas
Ao redesenhar a próxima tela, reaproveitar `[DS:pill]` e `[DS:badge]`, e
registrar aqui qualquer token/componente novo (com a tag no CSS).
