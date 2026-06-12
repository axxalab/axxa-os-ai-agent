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

Index de tags ativas: `pill`, `badge`, `list-compact`, `seg-accent`, `density`.
(cresce conforme criamos.)

---

## 2. Tokens

### [DS:density] — densidade global da UI (large / normal / compact)
**Regra:** o espaçamento do app inteiro é dirigido por tokens que reescalam em
3 modos. O usuário escolhe em **Settings → Aparência → Interface**; o valor vai
pra `settings.density` e vira o atributo `data-axxa-density` na `.axxa-root`.
**"normal" é o default** (mais respiro) — `compact` espreme, `large` solta.

```css
/* defaults = normal, na .axxa-root */
--axxa-list-row-py: 6px;     /* padding vertical da linha de lista       */
--axxa-list-row-radius: 9px; /* raio da linha de lista                    */
--axxa-pill-radius: 10px;    /* raio de pílulas/nav/realce                */
--axxa-seg-btn-py: 5px;      /* padding vertical do botão do segmented    */
--axxa-row-gap: 10px;        /* respiro entre blocos                      */
```

| token              | compact | normal | large |
|--------------------|:-------:|:------:|:-----:|
| `--axxa-list-row-py`     | 3px | 6px | 9px  |
| `--axxa-list-row-radius` | 7px | 9px | 12px |
| `--axxa-pill-radius`     | 8px | 10px| 12px |
| `--axxa-seg-btn-py`      | 3px | 5px | 8px  |
| `--axxa-row-gap`         | 8px | 10px| 12px |

Quem quiser participar da densidade só consome os tokens (ex.: `padding:
var(--axxa-list-row-py) 10px`) em vez de hard-codar px. Já consomem:
`.axxa-sidebar-item`, `.axxa-sidebar-nav-item` (raio), `.axxa-sidebar-seg
.axxa-seg-btn` (padding).

⚠️ O `.axxa-seg-btn` leva `min-height:0 !important; height:auto !important` —
sem isso o `.mobile-tap` do Obsidian força 44px e o segmented fica gigante no
mobile (mesma armadilha do [DS:list-compact]).

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
