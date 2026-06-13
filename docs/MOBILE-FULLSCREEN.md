# Módulo: Fullscreen Mobile — estudo do DOM + arquitetura native-first

> Status: **estudo / design** (v0.1.233). NÃO implementado ainda — decisão em aberto.
> Pré-requisito que estava travando: "estudar o DOM do drawer". Este doc faz isso.

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
