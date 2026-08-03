# Módulo: Fullscreen Mobile — estudo do DOM + arquitetura native-first

> Status: **implementado** (v0.1.242) — Fases 2 e 3 atrás do toggle
> `mobileFullscreen`, exposto no menu "…" do header (só mobile, default OFF).
> Motor: `AxxaView.applyFullscreen()`; CSS no bloco `[DS:fullscreen]`.
> **Pendente:** validação no device (checklist da seção "O que PRECISA de
> validação") — em especial o selector da `.mobile-navbar` da Fase 3.
> O estudo do DOM abaixo segue valendo como fundamentação.

## Por que esse módulo existe

Na captura do New Chat (mobile), antes da 1ª mensagem aparecem **3 barras empilhadas**:
OS status bar → chrome do Obsidian → header do AXXA. Em mobile, vertical é o recurso
mais escasso. A pergunta: quanto dá pra recuperar **sem virar hack** (que o reviewer do
Obsidian implica e que já foi removido 2× — v0.1.72 e v0.1.127)?

## O DOM mobile do Obsidian (confirmado pelo nosso próprio CSS)

A view do AXXA (`data-type="axxa-os-ai-agent"`) vive **dentro do drawer direito**.
Pilha de cima pra baixo, com os selectors que o `styles/main.css` **já referencia em
produção** (logo, confirmados — não chutados):

| # | Camada | Selector / var | Altura | Veredito |
|---|--------|----------------|--------|----------|
| 1 | OS status bar | `--safe-area-inset-top` | ~44px | **FIXO** (do SO, intocável) |
| 2 | Header do drawer | `.workspace-drawer-header` (+ `.workspace-drawer-tab-options`) | ~48px | **RECUPERA ✓** (com ressalva) |
| 3 | Header do AXXA | nosso (`.axxa-header`) | ~40px | **ENXUGAR** (100% nosso) |
| 4 | Conteúdo | `.axxa-root` | resto | o que queremos **crescer** |
| 5 | Composer do AXXA | nosso | ~58px | **ENXUGAR** (100% nosso) |
| 6 | Navbar global | `.mobile-navbar` · `var(--navbar-height)` | ~50px | **RECUPERA ⚠** (arriscado) |
| 7 | OS gesture bar | `--safe-area-inset-bottom` | ~20px | **FIXO** |

Chain de containers entre o drawer e a nossa raiz (todos no nosso CSS):
`.workspace-drawer` → `.workspace-drawer-active-tab-container` →
`.workspace-drawer-active-tab-content` → `.workspace-tab-container` →
`.workspace-leaf` → `.workspace-leaf-content[data-type="axxa-os-ai-agent"]` →
`.view-content` → `.axxa-root`.

### A matemática do espaço
- **Chrome nativo recuperável: ~98px** (drawer-header ~48 + navbar ~50).
- **Header + composer do AXXA: nossos** — encolhem com **zero risco de review**.
- Conclusão: o maior ganho seguro NÃO é mexer no Obsidian — é enxugar o que é nosso.
  O fullscreen "de verdade" (esconder navbar) recupera só os ~50px finais, e é o pedaço
  mais arriscado.

## A base que JÁ existe e funciona (não reinventar)

`src/views/AxxaView.tsx` já tem o mecanismo native-first **certo**, usado pra esconder o
header do drawer **quando o teclado abre**:

- `MutationObserver` no atributo `style` do `<html>`, observando a var
  `--keyboard-height` que o Obsidian seta (técnica do plugin Copilot).
- Quando teclado aberto **E** a view é a aba ativa do drawer
  (`.workspace-drawer-active-tab-content`), faz `drawer.classList.toggle("axxa-keyboard-open", true)`.
- CSS reage: `.workspace-drawer.axxa-keyboard-open .workspace-drawer-header { display:none }`
  (`main.css:104`).
- Teardown remove a classe (não vaza pra outras views).

**Isso já resolve o caso mais importante** (digitando = quando o espaço mais importa),
do jeito limpo. O fullscreen permanente é a extensão desse mesmo padrão.

## Arquitetura proposta (3 fases, risco crescente)

Reusa **exatamente** o toggle de classe do `AxxaView` — zero API nova, zero `!important`
novo (a classe no ancestral já dá especificidade).

### Fase 1 — Compact mode (nosso, risco ZERO, review-safe)
Não toca em NADA do Obsidian. Encolhe o que é nosso:
- Header do AXXA auto-colapsa no scroll pra baixo (padrão de app nativo), reaparece no
  scroll pra cima.
- Estende o `hide-no-teclado` pra também compactar header/composer do AXXA.
- Densidade `compact` automática no mobile como default.

### Fase 2 — Esconder o drawer-header (seguro COM escape hatch)
O `.workspace-drawer-header` é **redundante** quando o AXXA está ativo: nós já temos
header + navegação próprios. Esconder é seguro **se e somente se**:
- O Header do AXXA mostra um botão **"sair da tela cheia"** sempre visível
  (chaves i18n `exitFullscreen` já existem em `pt-br.ts`/`en-us.ts:198`).
- A classe é removida no `onClose` (já é o padrão do keyboard observer).
- O gesto de swipe-pra-fechar o drawer **não** pode ser bloqueado (só `display:none` no
  header, nunca no layer de gesto).

```css
/* opt-in, escopo na classe do drawer → sem guerra de !important */
.workspace-drawer.axxa-fullscreen .workspace-drawer-header { display: none; }
/* compensa o safe-area que o header cobria */
.workspace-drawer.axxa-fullscreen .axxa-root { padding-top: var(--safe-area-inset-top, 0px); }
```

### Fase 3 — Esconder a navbar (opt-in, DEFAULT OFF, testar no device)
O pedaço arriscado. `.mobile-navbar` é a **navegação global** do Obsidian. Escondê-la
pode **prender** o usuário se ele não souber o gesto de voltar. Regras:
- **Default OFF.** Só liga via toggle explícito (`settings.mobileFullscreen`, que já existe).
- Escape hatch garantido (botão "sair" do AXXA + o gesto de swipe).
- Só com `Platform.isMobile`.

```css
.workspace-drawer.axxa-fullscreen.axxa-fullscreen-navbar ~ .mobile-navbar { display: none; }
/* (selector exato depende de onde a navbar fica na árvore — VALIDAR no device) */
```

### O toggle (extensão do AxxaView, ~15 linhas)
```ts
// em AxxaView, espelhando setupMobileKeyboardObserver:
private applyFullscreen() {
  if (!Platform.isMobile) return;
  const drawer = this.containerEl.closest(".workspace-drawer");
  const active = !!this.containerEl.closest(".workspace-drawer-active-tab-content");
  const on = active && !!this.plugin.settings.mobileFullscreen;
  drawer?.classList.toggle("axxa-fullscreen", on);
}
// chamar no onOpen, no onSettingsChange e no update() do keyboard observer;
// remover a classe no teardown/onClose (igual axxa-keyboard-open).
```

## Garantias "nunca prender o usuário" (inegociáveis)
1. Botão "sair da tela cheia" **sempre** visível no Header do AXXA quando fullscreen on.
2. Classe removida no `onClose` (auto-reset ao fechar a view).
3. Gesto de swipe-fechar-drawer **nunca** bloqueado.
4. Default OFF — opt-in consciente.

## O que PRECISA de validação no device (não dá pra testar daqui)
- [ ] Nome exato do selector do header em versões recentes do Obsidian
      (`.workspace-drawer-header` vs `.workspace-drawer-active-tab-header`).
- [ ] Esconder o header quebra o swipe-pra-fechar? (provavelmente não, mas confirmar)
- [ ] Onde a `.mobile-navbar` fica na árvore relativo ao drawer (pro selector da Fase 3).
- [ ] Safe-area: com header escondido, o conteúdo encosta no relógio do OS? (o
      `padding-top: safe-area-inset-top` cobre, mas confirmar em iOS com notch).
- [ ] iOS (WKWebView) vs Android — navbar e gestos diferem.

## Recomendação
Fazer a **Fase 1 agora** (risco zero, ganho real, review-safe) e deixar Fases 2–3 atrás
do toggle `mobileFullscreen` pra validar no device. Assim o default continua native-clean
(o que protege a submissão) e o power-user que quer o máximo opta conscientemente.


---

## v0.1.250 — edge-to-edge + escopo do drawer direito

Feedback do device (print do usuário): o modo tela cheia ainda deixava **duas
faixas** — uma no topo (área da status bar) e outra na base (acima da barra de
gestos) — e o modo precisava valer **só** para o drawer direito.

### As faixas: quem as pintava
- **Topo**: `padding-top: var(--safe-area-inset-top)` morava no `.axxa-root`.
  Padding pinta com o fundo do PRÓPRIO elemento, então a faixa saía com a cor
  do canvas (secondary no dark) e a header (primary) começava abaixo dela —
  duas cores, uma barra visível.
- **Base**: `padding-bottom: safe-area + navbar-clearance` na `.view-content`.
  No fullscreen não há navbar, mas a reserva continuava lá e a área ficava
  fora da pintura do `.axxa-root`.

### O que passou a valer
1. O inset de cima entrou POR DENTRO da `.axxa-header`
   (`padding-top: calc(12px + max(env(), var()))`) — a superfície da header vai
   até y=0, sob o relógio/notch, sem faixa intermediária.
2. `padding-bottom: 0` na `.view-content` do fullscreen; quem respeita a barra
   de gestos agora é o composer (`bottom: calc(18px + inset)`), então o canvas
   pinta até a última linha de píxel.
3. Toda a cadeia do drawer (drawer → tab-container → tab-content →
   leaf-content → view-content) passou a pintar o mesmo canvas do app, pra não
   sobrar preto da leaf nativa em canto nenhum nem durante o transform.

### O escopo
- `isRightDrawer()`: `mod-left` explícito nunca liga o modo. Sem marca de lado
  não travamos (a AXXA só monta no drawer direito).
- `body.axxa-fullscreen` (a classe que esconde a navbar GLOBAL) agora exige que
  a gaveta da AXXA esteja **visível na tela**: abrir o drawer esquerdo ou
  fechar o nosso no swipe devolve a navbar na hora. A checagem é geométrica
  (`isDrawerOnScreen`, testada) porque nome de classe de estado do drawer muda
  entre versões — e falha pro lado seguro (na dúvida, considera visível, então
  o modo continua funcionando).
- Um `MutationObserver` nos atributos das gavetas (mesma técnica do keyboard
  observer) reavalia depois da animação, além dos eventos
  layout-change/resize/active-leaf-change.

Validado num harness que reproduz a árvore do drawer mobile com o chrome
nativo pintado de cores berrantes: header em y=0 com `padding-top` 56px
(12 + 44 de inset), `view-content` sem padding-bottom, composer a 42px
(18 + 24 de inset) da borda, chrome nativo `display:none` e todas as
superfícies no mesmo canvas. Com as classes removidas, o modo normal volta
exatamente ao que era (header 12px, reserva de 28px na base, chrome visível).

### v0.1.251 — o sheet do Vault Q&A no fullscreen

Mesma classe de bug, outro caminho: o sheet do Q&A encosta na base por design e
resolvia o inset só com `env(safe-area-inset-bottom)` — que no WebView Android
costuma ser 0. Fora do fullscreen a reserva da navbar escondia o problema; sem
navbar, o conteúdo do sheet cairia embaixo da barra de gestos. Agora ele também
considera a var do Obsidian (`max(env(), var())`), então o sheet continua colado
na borda (edge-to-edge) com o conteúdo acima dos gestos: no harness, card
terminando em y=915 (base da tela) com `padding-bottom` de 34px (10 + 24).

### v0.1.252 — correção: o inset estava sendo contado DUAS vezes

Print do device depois do 0.1.250/0.1.251 mostrou o que o harness não podia
mostrar: **o container do drawer já começa abaixo da status bar e termina acima
da barra de gestos** — o Obsidian aplica o safe-area na própria árvore. Somar
`safe-area-inset-*` por dentro da nossa header e do composer contava o mesmo
espaço duas vezes:

- **Topo**: a superfície preta da header subia até o topo do container (certo),
  mas avatar/título/botões desciam ~40px, sobrando espaço morto acima deles.
- **Base**: o composer ganhava `18px + inset`, reabrindo parte da faixa que
  este modo veio eliminar.

Correção: no fullscreen a header mantém o padding normal (12px) e o composer o
respiro normal (18px). O override do sheet do Q&A (0.1.251) saiu pelo mesmo
motivo. **Quem garante que nada fica sob os system bars é o container do
Obsidian**; a nós cabe só não reservar o espaço de novo — e não pintar faixa
alguma, que era o bug original.

Regra pra quem mexer aqui depois: antes de somar `env(safe-area-*)` ou
`var(--safe-area-*)` dentro do fullscreen, confira se o container já não fez
isso. Neste modo, quase sempre já fez.

### v0.1.254 — o teclado voltou a empurrar o composer

Regressão introduzida pelo próprio fullscreen: ao fixar a altura do drawer em
`100dvh`, a caixa do app deixou de encolher quando o teclado abre. O composer
de **chat** e **agent** é `absolute` dentro da `.axxa-root`, então ele só sobe
se a caixa encolher — e o Obsidian mobile NÃO encolhe a viewport: publica
`--keyboard-height` no `<html>` e deixa o teclado por cima. Resultado: campo
atrás do teclado nos dois modos. O Vault Q&A escapava por ser `fixed` e já
consumir a var.

Correção: a altura do drawer no fullscreen passou a ser
`calc(100dvh - var(--keyboard-height, 0px))`. Canvas e composer sobem juntos, e
as últimas mensagens deixam de ficar escondidas. A mudança fica na altura que
JÁ é nossa — a cadeia do modo normal não é tocada.

E o sheet do Vault Q&A voltou a encostar na borda: no fullscreen ele usava
`max(--keyboard-height, --axxa-status-bar-clearance)`, mas não existe navbar
pra compensar ali — e a var guarda a ÚLTIMA altura medida da navbar, então o
sheet ficava boiando acima do fim da tela. Agora, no fullscreen, só o teclado
entra na conta (`left/right: 0` explícitos junto). O clearance também passou a
ser remedido quando um setting muda, porque ligar/desligar o fullscreen
esconde/mostra a navbar e a medida ficava velha.

Medido no harness (viewport 412×915, teclado 320): chat/agent com o composer
terminando em 577 (18px acima do teclado, que começa em 595), Q&A colado em
595, e com o teclado fechado Q&A em 915 (borda real) ocupando 0→412.
