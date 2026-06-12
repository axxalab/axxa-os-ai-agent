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

Index de tags ativas: `pill`, `badge`. (cresce conforme criamos.)

---

## 2. Tokens

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
Lista de 1 linha por item, bem justa (recentes, etc). Tokens:
```css
--axxa-list-row-py: 2px;     /* padding vertical da linha */
--axxa-list-row-radius: 7px;
```
Utilitário: `.axxa-list-compact-row` (flex baseline, título cresce + meta à
direita, `line-height: 1.25`). A altura da linha vem só do `--axxa-list-row-py`
+ line-height → dá pra apertar/soltar a lista inteira mexendo num token.

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
- **Recentes:** label "Recentes" + **segmented control** (`SegmentedRow`, pílula
  deslizante animada) filtrando por modo (Todos/Chat/Q&A/Agente) + lista PLANA
  (título 16px + hora). Deletar via long-press/right-click (menu nativo).
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
