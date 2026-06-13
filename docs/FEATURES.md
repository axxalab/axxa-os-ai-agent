# AXXA OS — AI Agent · Mapa de Features & Diferenciais

> Auditoria completa do produto (v0.1.226, jun/2026). Gerada por varredura do
> código-fonte inteiro. **Números:** 6 providers · 54 releases · 335 testes ·
> ~45 componentes de UI · 10 ferramentas de agente · 2 idiomas (pt-br/en-us).

---

## ⭐ Os 12 diferenciais (vs. plugins de IA típicos do Obsidian)

1. **Agente com diff-approval e níveis de permissão** — o agente lê/edita o
   vault com preview visual de diff antes de aplicar, 3 níveis de permissão
   (ask/vault/yolo — delete SEMPRE confirma), detecção de loop e **continuidade:
   os passos do agente são persistidos no .md e sobrevivem ao reload.**
2. **RAG local de verdade** — índice vetorial no próprio vault, **busca híbrida
   (semântica + keyword com fusão RRF + boost de grafo por co-citação)**,
   quantização configurável (float32→int8 + Matryoshka, 8× menos memória),
   índices separados desktop/mobile, shards streamados com gate de 16MB no
   mobile (anti-OOM).
3. **6 providers, um só app** — OpenAI, Anthropic, Gemini, OpenRouter, NVIDIA
   NIM e Ollama (local). SSE real em todos no desktop (NIM via Node `https`
   furando CORS — pseudo-stream só no mobile). Tool calling normalizado nos 6.
4. **Catálogo de modelos vivo** — capabilities (vision/tools/stream/free/gen)
   por modelo com **overlay do catálogo OpenRouter** (auto-fetch): o gating de
   Agent/vision fica mais preciso conforme o uso. Curadoria por provider com
   filtros, fetch da API, badges e preços.
5. **ModelArena** — seletor de modelo estilo "character select" de luta: arena
   temática por provider, ficha de status com 6 barras (Coding/Thinking/Tooling/
   Research/Speed/Vision) curadas de benchmarks reais, ranking "hot", famílias
   com identidade visual (Opus, GPT-5, Mythos…), roster em 3 tiers (Hall of
   Fame/Creators/Soldiers), SCAN de modelos novos.
6. **Sistema de Effort** — 5 níveis (🐢→🚀) que controlam TUDO num knob só:
   max_tokens, temperatura, turnos do agente, top-K do RAG, tool retry,
   paralelismo, reserva de contexto — cada nível 100% editável em Settings.
   Slider tátil estilo One UI com scrim.
7. **Transparência de custo total** — tracking local de tokens/custo por chat,
   dashboard de Usage (breakdown por provider/modelo/modo/dia, heatmap 30d, top
   chats), **cross-check de saldo real via APIs de billing** (OpenAI admin,
   Anthropic admin, OpenRouter), calculadora do free tier da OpenAI
   (data-sharing), export PDF/Markdown.
8. **Voice mode imersivo** — tela de conversa por voz hands-free (STT→envia→
   pensa→fala→repete) com orb animado por estado, escolha de voz do sistema,
   velocidade 0.5–2x; read-aloud por mensagem; hold-mic que grava no vault.
9. **Local-first & seguro** — chats são .md no vault (formato aberto), API keys
   no SecretStorage (nunca no data.json), zero telemetria, agente confinado ao
   vault com anti path-traversal, **modal de segurança de links** (mostra a URL
   real antes de abrir).
10. **Design System próprio com leis** — densidade global (compact/normal/
    large), 4 personalidades de motion (soft/wave/intense/chaotic) com
    reduce-motion 100% controlado pelo usuário, 16 backgrounds (8 estáticos +
    8 vivos), tudo tokenizado e documentado (docs/DESIGN_SYSTEM.md).
11. **Skills como notas .md** — biblioteca de prompts reutilizáveis vivendo no
    vault (frontmatter + template), disparadas por `/comando` no composer.
12. **Robustez de params silenciosa** — paramPolicy central que evita 400s:
    reasoning models sem temperature, Claude 0..1, tetos de output por
    modelo/host (NIM 4k), retry sem stream_options; muro de billing do Gemini
    com erro acionável.

---

## 🗺️ Mapa completo por camada

### 1. Modos de conversa
| Modo | O que faz |
|---|---|
| **Chat** | Conversa multimodal direta com o modelo |
| **Vault Q&A** | Pergunta sobre suas notas — RAG injeta top-K chunks com fontes |
| **Agent** | O modelo executa ferramentas no vault (ler/criar/editar/mover/deletar/buscar/gerar imagem) |

### 2. Chat & mensagens
- Streaming token-a-token com caret animado; markdown nativo do Obsidian
  (callouts, mermaid, wikilinks internos, syntax highlight) + botão copiar em
  code blocks.
- **Painel de reasoning** colapsável (auto-expande enquanto pensa) — DeepSeek
  R1, Claude extended thinking, o-series.
- **Ledger de passos do agente** (tool calls com status ✓/✗ e argumentos).
- Variantes de resposta (navega entre gerações), continuar resposta truncada,
  regenerar, editar mensagem do user (replay), reactions 👍/👎 persistidas.
- Ações por mensagem: copiar, **salvar como nota**, ler em voz alta, deletar.
- Separadores de dia, scroll sticky-bottom + FAB "voltar pro fim", menu de
  contexto nativo (long-press mobile com haptics).
- Erros com ação (retry / abrir Settings / ativar billing) por código.
- Busca na conversa (modal quick-switcher com highlight).

### 3. Composer & entrada
- Editor multi-linha com autocomplete de **wikilinks** (`[[`) e **skills** (`/`).
- Anexos: imagem (paste/vault/câmera), nota (fuzzy picker), PDF, áudio —
  com chips de preview e remoção inline.
- **Câmera in-app** (preview, flip, flash) com fallback pro picker nativo.
- **Hold-to-record**: grava áudio e salva no vault (`axxa-ai/recordings/`).
- Status line configurável: modelo · effort · contexto · tokens in/out · TPS.
- PlusModal (bottom sheet estilo Claude iOS): anexos, effort, **estilo de
  resposta** (normal/conciso/explicativo/formal/amigável), gerar imagem, skills.
- Atalhos: Ctrl+Enter envia, Shift+Enter quebra linha.

### 4. Geração de mídia
- **Imagem**: DALL·E/gpt-image (OpenAI), Nano Banana + Imagen (Gemini, com
  img2img/edição), Stable Diffusion/FLUX (NIM) — modal com modelo/tamanho,
  salva em `axxa-ai/generation/images/`.
- **Áudio (TTS)**: tts-1/hd, gpt-4o-mini-tts.
- O agente também gera imagem via tool (`generate_image`).
- **MediaScreen**: galeria de imagens/áudio/vídeo do vault (filtro AXXA-only).

### 5. Seleção de modelo
- **ModelPicker**: card do modelo + tabs por categoria (estilo gaveta) + aba
  Favoritos + lista; favoritar com bookmark.
- **ModelArena**: ver diferencial #5 — navegação entre providers `< >`, dupla
  ID visual (host + vendor do modelo), animação sai/entra, stats de game.
- Card de info com pills de capability, specs (contexto, preço/1M, modalidades)
  e "Fetch info" (enriquecimento via OpenRouter).
- **Session lock**: trocou de modelo após a 1ª mensagem → nova conversa
  (consistência de contexto).
- Checker de compatibilidade: avisa modo+modelo incompatível e sugere troca.

### 6. RAG / Vault Q&A (motor)
- Indexação incremental (SHA-1 por chunk), reindex automático em background nos
  eventos do vault, barra de progresso com abort.
- Embeddings: OpenAI, Gemini, OpenRouter (incl. **multimodal grátis** da
  NVIDIA), NIM — com descoberta de modelos de embedding via API.
- Imagens indexáveis (entrada multimodal no índice).
- Citações com fonte (path + trecho) nas respostas.

### 7. Agente (motor)
- 10 tools: search (híbrida), list, read, create, edit, move, delete,
  create_folder, generate_image (+ confirmação modal com diff e "Approve All").
- Turnos máximos por effort (5–200), retry de tool, execução paralela
  configurável, detecção de loop por janela.
- Segurança: caminho normalizado, anti-traversal, profundidade máx 32,
  delete sempre confirmado.

### 8. Conversas & organização
- Persistência em .md aberto (frontmatter com id/título/data/provider/modelo/
  effort/tokens) — **portável e versionável**; chats "estrangeiros" tolerados.
- Sidebar minimalista: 3 módulos de nova conversa (Chat/Q&A/Agente), nav com
  gating, recents com filtro por modo (segmented com glow), sticky, FAB topo,
  rodapé com badge (Free/Premium/Founder) + stats.
- ConversationsList: busca, sort (data/título/mensagens/tokens), filtro por
  modo, agrupamento por dia, chips configuráveis.
- **Projects**: agrupa chats + notas-fonte pinadas (estilo ChatGPT iOS), com
  editor de ícone/cor.
- Renomear (inline no header ou modal), deletar pra lixeira (recuperável),
  copiar conversa inteira como markdown.
- **Personas** por chat (system prompt custom) + prompt de sistema global.

### 9. Telas & navegação
- StarterScreen (home): saudação viva por hora + stat de hoje, retomar último
  chat, prompt starters por modo, galeria Inspire-se, setup de nova conversa,
  recentes, status RAG/providers, caminho grátis destacado no onboarding.
- NewChatScreen (base limpa por modo), VoiceScreen, SkillsScreen, InspireScreen,
  MediaScreen, StatisticsScreen, ProfileScreen, PlansScreen, ProjectsScreen,
  OnboardingScreen, LockedScreen (upsell).
- Header: avatar (abre gaveta), título editável, model switcher, busca, voz,
  novo chat, menu (copiar/persona/settings), fullscreen mobile.

### 10. Settings (6 top-tabs)
- **Providers**: 6 sub-tabs com keys (+ admin keys p/ billing), curadoria de
  modelos ativos (filtros por capability, fetch, add manual, default ★).
- **Setup**: pastas (chats/skills/gravações/geração) com autocomplete; RAG
  (provider/modelo de embedding com badges e preços, quantização com preview,
  rebuild com progresso, toggle de shards).
- **Appearance**: Fundo (16 presets) · Chips (composer + listas) · Interface
  (densidade, motion, reduce-motion global e mobile, code wrap).
- **Effort**: editor completo dos 5 níveis (9 params cada + reset).
- **Usage**: dashboard de custo completo (ver diferencial #7).
- **Outros**: idioma, agente (permissões/diff), override de plano (admin).

### 11. Monetização (scaffold pronto)
- Free vs Pro com gating central (`entitlements.ts`); telas pagas: Media,
  Statistics. License key `AXXA-PRO-XXXX-XXXX` (validação real = próximo passo),
  PlansScreen com comparativo, badge Founder, override de teste pra dev.

### 12. Plataforma & qualidade
- **Mobile-first real**: testado em Android (WebView quirks documentados:
  mobile-tap 44px, .theme-dark button, CORS), haptics, fullscreen, navbar
  clearance, câmera/voz com fallback.
- i18n completo pt-BR/en-US (tipado — chave faltando = erro de build).
- 335 testes (vitest) cobrindo persistência, providers/stream, RAG/shards,
  effort, entitlements, auditoria de capabilities.
- Release pipeline por tag no GitHub Actions; DS documentado e tagueado
  (`[DS:*]`) pra manutenção.

---

## 📌 Onde isso posiciona o produto

Plugins de IA típicos do Obsidian (Copilot, Text Generator, BMO, Smart
Connections) entregam *chat + um provider + talvez RAG simples*. O AXXA OS
cobre as **5 apostas** (citações com fonte, agente com diff-approval,
onboarding grátis, skills .md, local-first) **mais** a camada de produto
(usage/billing real, effort, voice, projects, monetização) **mais** uma
identidade visual própria (DS, arena, motion). O diferencial não é uma feature
— é o conjunto operando como um OS de IA dentro do vault.
