# AXXA OS — Design System

> Decisões visuais, tokens e regras de composição.
> Atualizado em 07/06/2026 (v0.1.24).

---

## Filosofia

**AXXA OS parece feature nativa do Obsidian.** Não disputa atenção com a interface do app — herda da paleta, fontes e densidade do tema ativo. O usuário deveria conseguir confundir o plugin com algo da casa.

Três pilares:
1. **Tema-agnóstico** — qualquer cor que dependa do "look" do app vem de uma CSS variable do Obsidian. Nada hardcoded de tema.
2. **Mobile-first** — touch targets ≥44px, gestos antes de hover, sem dependência de mouse.
3. **Densidade ChatGPT** — bubbles com respiro, status info compacto, animações curtas (0.15-0.2s).

---

## Tokens — usar CSS vars do Obsidian

Cores, fontes, sombras, radius e espaçamentos vêm do tema ativo. **Nunca** hardcode.

### Cores

| Token | Quando usar |
|---|---|
| `--background-primary` | Fundo principal da view |
| `--background-secondary` | Cards, botões, recent chats |
| `--background-modifier-hover` | Estado hover, pill backgrounds, day separator |
| `--background-modifier-border` | Bordas de inputs, separadores |
| `--background-modifier-form-field` | Inputs, composer pill, dropdown |
| `--text-normal` | Texto principal |
| `--text-muted` | Texto secundário, labels, ícones inativos |
| `--text-faint` | Hints, timestamps, placeholders |
| `--text-accent` | Estado ativo, links |
| `--text-on-accent` | Texto sobre `--interactive-accent` (bubble user, botão send) |
| `--interactive-accent` | Botão send, bubble user, indicador ativo |
| `--interactive-accent-hover` | Hover do interactive-accent |

### Paleta de acentos (chips do status line)

Esses 6 são literais — fazem parte da identidade do AXXA. Fallback embutido com CSS var pra usuários poderem customizar.

| Token | Hex | Onde |
|---|---|---|
| `--color-purple, #a370f7` | 🟣 | Chip do model |
| `--color-orange, #ec7b3e` | 🟠 | Chip de effort |
| `--color-cyan, #4cc9f0` | 🟦 | Chip de context (gauge) |
| `--color-blue, #4361ee` | 🔵 | Chip de tokens in (↓) |
| `--color-green, #06d6a0` | 🟢 | Chip de tokens out (↑) |
| `--color-pink, #f472b6` | 🩷 | Chip de mode (vault/agent/coder) |

### Tipografia

| Token | Onde |
|---|---|
| `--font-interface` | Header, labels, botões |
| `--font-text` | Mensagens, composer (textarea) |
| `--font-monospace` | Code blocks, model names, modelos ativos |
| `--font-ui-medium` | Texto padrão (16-15px no Obsidian) |
| `--font-ui-small` | Subtítulos, descrições |
| `--font-ui-smaller` | Status chips, timestamps, hints |

### Tamanhos de ícones

| Contexto | Tamanho |
|---|---|
| Header (gear, new chat) | 18px (default via `.axxa-icon`) |
| Footer buttons (msg actions) | 16px |
| AI comment bubble (sparkles) | 14px |
| Composer "+" | 20px |
| Composer send/mic | 22px |
| Status chips | 11px |
| Code copy button | 14px |

---

## Regras de radius

**Decisão definitiva:** só 2 valores possíveis.

| Valor | Onde |
|---|---|
| **18px** | Bubble do usuário (suave, conversa) |
| **999px** (pill/circle) | Botões, badges, chips, pills, inputs do composer, swatches |

Por que? Bubble com 18px lembra mensagem natural (igual iMessage/WhatsApp). Botões/chips com 999px ficam "pill puro" — eternamente arredondados, sem dependência da altura. **Nenhum valor intermediário** (12px, 14px, 8px) é permitido a não ser code blocks e dropdowns nativos do Obsidian.

---

## Tipos de mensagem (chat)

4 variantes — cada uma com layout específico:

| Variante | Alinhamento | Visual | Quando |
|---|---|---|---|
| `user` | Direita | Bubble com `--interactive-accent` + texto on-accent | Toda input do usuário |
| `ai-response` | Esquerda | Markdown renderizado + footer (copy/regen/like/dislike) | Resposta padrão da IA |
| `ai-comment` | Esquerda | Bubble cinza menor + ícone `sparkles` animado | Status (vault search, "Pensando...") |
| `ai-options` | Esquerda | Botões pill empilhados (estilo AskUserQuestion) | Quando IA precisa input estruturado |

**Streaming:** durante o stream do ai-response, o footer fica escondido (`streamingMessageId` controla). Aparece quando termina.

---

## Componentes-chave

### Composer

- **Pill flexbox**: `[+] [CodeMirror editor]` + `[send/mic/stop]` externo
- Pill com `border-radius: 999px`, fundo `--background-modifier-form-field`
- Editor expande até `max-height: 200px` com overflow auto (textarea auto-expand de graça via CodeMirror)
- Botão send vira:
  - **`arrow-up`** quando tem texto
  - **`mic`** quando vazio (hold-to-record)
  - **`square`** durante streaming (vermelho invertido pra "parar")
  - **`mic` pulsante vermelho** durante gravação
- Status row abaixo: 6-7 chips coloridos com micro-ícones Lucide (11×11px)

### PlusModal

Bottom sheet estilo ChatGPT mobile. Sobe do rodapé com `animation: axxa-plus-slide 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)`. Seções:
- **Anexar arquivo** (placeholder pra Módulo 5 — PDF/Imagem/Nota)
- **Effort** (5 níveis: Low/Med/High/xHigh/Max)
- **(Futuro)**: screenshot, voice note longa, system prompt override

### StarterScreen

Aparece quando chat tá vazio. Stack vertical:
1. Título + subtítulo
2. Mode selector (Chat / Vault Q&A)
3. Provider buttons (4 chips pill)
4. Model select (dropdown nativo Obsidian)
5. Effort row (5 pill buttons)
6. Recent chats list (até 8, clique recarrega)

### Settings tab

5 sub-tabs single-level: **OpenAI** · **Anthropic** · **OpenRouter** · **Ollama** · **Outros**. Provider padrão sempre visível ACIMA das tabs como setting global. Bolinha de cor `--interactive-accent` no tab que matchea o padrão.

Cada provider tem: API Key + Modelo padrão + Modelos ativos (lista curada).

---

## Animações

| Animação | Duração | Easing | Onde |
|---|---|---|---|
| Hover/transition genérico | 0.15s | ease | Botões, chips, hovers |
| PlusModal slide-up | 0.22s | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Bottom sheet abrindo |
| PlusModal overlay fade | 0.18s | ease | Dim background |
| Sparkles pulse (ai-comment) | 1.4s | ease-in-out infinite | Ícone do "Pensando..." |
| Recording pulse (botão mic) | 0.9s | ease-in-out infinite | Botão vermelho durante gravação |
| Recording dot pulse | 0.9s | ease-in-out infinite | Bolinha no indicator de gravação |
| Status dot pulse (header) | 1.2s | ease-in-out infinite | Indicador de conexão ativa |

---

## Backgrounds (Sprint D)

6 presets aplicados via `axxa-bg-<id>` na `.axxa-root`:
- `none` — default (var(--background-primary))
- `sunset` — laranja → rosa
- `ocean` — cyan → azul
- `forest` — verde → teal
- `violet` — roxo → magenta
- `mono` — cinza neutro

Cada preset tem variante `body.theme-dark` com opacidade mais alta — adapta automaticamente ao tema do user.

---

## Mobile

- **Touch targets ≥44px** sempre (botão send, mic, plus, footer buttons)
- **Long-press 500ms** abre menu de mensagens (`useMessageContextMenu`) + vibração háptica `navigator.vibrate(30)`
- **Cancel critério**: dedo move >10px OU touchend antes do timer
- **Mobile keyboard handler estilo Copilot**: `MutationObserver` no `<html>` lendo `--keyboard-height`, toggle de `.axxa-keyboard-open` no drawer
- **Code block copy button**: sempre semi-visível (`opacity: 0.6`) em mobile — não tem hover

---

## i18n

Strings vêm de `src/i18n/pt-br.ts` (source of truth) ou `src/i18n/en-us.ts` (mirror tipado). Em componentes React: `const t = useT();`. Em código TS puro: `getTranslations(plugin.settings.language)`.

Strings com placeholder são funções tipadas: `t.vault.searching(topK, effort)` em vez de template manual.

---

## Convenções de naming

- **Classes CSS**: `axxa-` prefix sempre, kebab-case (ex: `.axxa-composer-pill`, `.axxa-recording-indicator`)
- **Estados**: sufixo descritivo (ex: `.axxa-tab-active`, `.axxa-effort-active`, `.axxa-composer-recording`)
- **Modifiers**: usar `.axxa-classe-soon` pra "em breve", `.axxa-classe-default` pra indicador

---

## O que NÃO fazer

- ❌ Hardcoded de cor (`#fff`, `#000`) fora dos 6 chips de paleta
- ❌ `border-radius` diferente de 18px ou 999px (exceto code blocks/dropdowns Obsidian)
- ❌ `font-family` literal — sempre `var(--font-*)`
- ❌ `font-size` numérico exceto pra micro-elementos (chips 11px, timestamps 10px)
- ❌ Hover sem fallback de touch (`@media (hover: hover)` quando o estilo é decorativo)
- ❌ `position: fixed` (quebra dentro de leaf do Obsidian) — use `position: absolute` com pai relativo

---

*Mantenha esse doc atualizado a cada sprint. Se uma decisão mudar, registre o "por quê" aqui antes de mudar o código.*
