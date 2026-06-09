# AXXA OS — Action Plan
## Plano de Ação Modular · Revisão Contínua

> **Status:** 🟡 Em andamento — Módulos 0–4 ✅, 6.1+6.2 ✅ Agent 6-provider, 6.4 ✅ RAG multimodal, Sprints J/K.1/K.2/K.3 ✅, **K.4 ✅** (image gen + Usage tab), **L ✅** (deep polish mobile + fullscreen saga), **M ✅** (Effort Engine + fullscreen v2) · próximo: **Sprint N — Validação & Estabilização → Coder Mode (6.3) → caminho do Alpha** (ver seção 🎯 PRÓXIMOS PASSOS)  
> **Versão:** 1.6 · plugin em **v0.1.79 (6 providers · 3 modos com streaming · multimodal · geração de imagem funcional · aba Usage com custos em USD · Effort Engine configurável por nível · fullscreen mobile + chrome polish do OS · wikilink/áudio entram como anexo · erro não polui contexto · Coder/Study mock · agent busca o RAG · índice Obsidian-native)**  
> **Última revisão:** 09/06/2026 (pós-v0.1.74)  
> **Regra de ouro:** Cada módulo só avança quando o anterior está ✅

---

## Como usar este documento

Este arquivo vive na raiz do projeto e é atualizado a cada sprint.
Antes de cada sessão de vibe coding, revise o módulo atual.
Após cada sessão, marque o que foi concluído e atualize o status.

**Legenda de status:**
- ⬜ Não iniciado
- 🟡 Em andamento  
- ✅ Concluído
- 🔴 Bloqueado
- ⏭️ Adiado para fase posterior

---

## MÓDULO 0 — Setup e Infraestrutura ✅
> Pré-requisito para tudo. Não avance sem este módulo completo.
> **Concluído em 05/06/2026** — plugin rodando no Obsidian com Hello World.

### 0.1 Ambiente de desenvolvimento
- ✅ Claude Pro assinado
- ✅ GitHub conectado
- ✅ Pasta do projeto definida dentro do Vault Obsidian
- ✅ Node.js LTS instalado (v24.14.0)
- ⬜ VS Code instalado com extensões TypeScript
- ⬜ Obsidian em modo dev (Community Plugins ativo, Safe Mode OFF)

### 0.2 Repositório
- ✅ Repositório `axxa-os-ai-agent` criado no GitHub (`axxalab/axxa-os-ai-agent`)
- ✅ Template oficial `obsidianmd/obsidian-sample-plugin` — estrutura criada via prompt mestre (configs equivalentes ao template)
- ✅ `manifest.json` atualizado com dados do AXXA OS
- ✅ `AGENTS.md` criado na raiz (instruções para AI agents)
- ✅ `README.md` inicial commitado

### 0.3 Estrutura de pastas
- ✅ `/src` estruturado conforme arquitetura definida (views, components, etc.)
- ✅ `/output` criado para builds de teste (gerado pelo esbuild)
- ✅ `.gitignore` configurado (node_modules, output, .env, .axxa.local.json)
- ✅ `package.json` com scripts: `dev`, `build`, `deploy:output`

### 0.4 Primeiro build
- ✅ `npm install` executado sem erros (28 packages, 11s)
- ✅ `npm run build` testado — gera `/output/main.js` (1MB), `manifest.json` (0.34KB), `styles.css` (0.8KB)
- 🟡 `npm run dev` (watch mode) — config pronta, testar localmente
- ✅ Plugin aparecendo na lista do Obsidian
- ✅ **🎯 MARCO:** Plugin ativável no Obsidian — sidebar direita abre (confirmado pelo dev em 05/06/2026)

---

## MÓDULO 1 — Chat Mode MVP
> Objetivo: Mandar uma mensagem e receber resposta. Nada mais.

### 1.1 View e estrutura React
- ✅ `AxxaView.tsx` — ItemView registrado no Obsidian (sidebar direita) — feito no Módulo 0
- ✅ `AxxaApp.tsx` — React root montado dentro da view
- ✅ Layout base: header + chat area + composer
- ✅ Funciona no mobile (drawer lateral) — confirmado pelo dev (prints v0.1.7+)

### 1.2 Composer básico
- ✅ Campo de texto funcional (CodeMirror nativo Obsidian — `@codemirror/view` + `@codemirror/state`)
- ✅ Enter envia (desktop), Shift+Enter quebra linha — no mobile, Enter sempre quebra linha
- ✅ Botão de enviar (com ícone `send` do Lucide via `setIcon`)

### 1.3 Provider OpenAI
- ✅ `providers/base.ts` — interface comum (Provider, ProviderMessage, ProviderRequest, ProviderResponse, ProviderError)
- ✅ `providers/openai.ts` — chamada básica à `/v1/chat/completions` via `requestUrl` (sem CORS issues)
- ✅ API key configurável nas Settings (campo password + autocomplete off)
- ✅ Modelo configurável nas Settings (default `gpt-4o`)
- ✅ Resposta aparecendo na tela (sem streaming ainda — vem no 1.4)
- ✅ Tratamento de erro: `ProviderError` com códigos (no-key, invalid-key, rate-limit, network, unknown) + mensagens PT-BR

### 1.4 Streaming
- ✅ SSE implementado para OpenAI (fetch + ReadableStream, parser `data:` linha a linha)
- ✅ Texto aparecendo token a token (store.appendToMessage + auto-scroll a cada update)
- ✅ Indicador de loading ("Pensando..." com sparkles animado via ai-comment)
- ✅ Botão stop durante geração (icone `square`, fundo inverso, `AbortController.abort()`)

### 1.5 Mensagens básicas
- ✅ Bubble de usuário (direita) — radius 18px, accent color
- ✅ Bubble do AI (esquerda) — sem moldura (resposta), bubble pequena (comment)
- ✅ Timestamp em cada mensagem (formato HH:mm, abaixo da mensagem)
- ✅ Day separator automático ("Hoje" / "Ontem" / "12 de junho")
- ✅ **Bonus:** Markdown render nas respostas da IA (MarkdownRenderer nativo do Obsidian — code blocks, listas, headers, links, callouts, syntax highlight)

### 1.6 Build de teste
- ✅ `npm run build` gera arquivos na pasta `/output` (com minify, 156KB)
- ⬜ Plugin testado no Obsidian desktop
- ✅ Plugin testado no Obsidian mobile (Android — dev confirmou via prints v0.1.7+)
- ✅ **🎯 MARCO:** Chat com OpenAI funcionando end-to-end (streaming + stop + markdown + timestamps + scroll stick)

> **Módulo 1 ✅ Concluído em 06/06/2026** — MVP do chat completo: OpenAI streaming, markdown render, composer CodeMirror, mobile keyboard handling estilo Copilot, scroll sticky-bottom estilo ChatGPT.

---

## MÓDULO 2 — Multi-Provider + Settings
> Objetivo: Todos os 4 providers do alpha funcionando

### 2.1 Session Modal
- ✅ Starter screen embedded antes do primeiro chat (não modal, mas tela cheia)
- ✅ Seleção de: Provider, Modelo, Effort (Modo virá com mais modos no futuro)
- ✅ Configuração trava ao iniciar a sessão (`sessionProvider`, `sessionModel` no store)
- ✅ Indicador visual do estado travado (ícone `lock` no chip do model)

### 2.2 Providers adicionais
- ✅ `providers/anthropic.ts` — Claude models (chat + streamChat via fetch SSE; x-api-key + anthropic-version + anthropic-dangerous-direct-browser-access)
- ✅ `providers/openrouter.ts` — proxy multi-model (OpenAI-compatible; bearer auth + HTTP-Referer + X-Title; listModels filtra free/auto)
- ✅ `providers/ollama.ts` — local LLM (NDJSON streaming via /api/chat, listModels via /api/tags, sem auth) — **tool calling habilitado em v0.1.33**
- ✅ `providers/gemini.ts` — **Google Gemini via endpoint OpenAI-compat** (`https://generativelanguage.googleapis.com/v1beta/openai/`). Auth `Authorization: Bearer ${key}`. Reusa `toOpenAIMessages()`. Tool calling ✅. Modelos: gemini-2.5-pro/flash/flash-lite, gemini-3.5-flash, gemini-3.1-flash-lite. listModels via `/openai/models`. **v0.1.33**.
- ✅ `providers/nim.ts` — **Nvidia NIM hosted** (`https://integrate.api.nvidia.com/v1/chat/completions`). 100% OpenAI-compat. Auth `Authorization: Bearer nvapi-...`. Tool calling ✅ pra modelos compatíveis. listModels via `/v1/models` com filtro de prefixos. **v0.1.33**.
- ✅ `providers/base.ts` — interface comum (chat + streamChat obrigatórios)
- ✅ `providers/index.ts` — registry + getProvider(id) com **6 providers registrados** (v0.1.33)

### 2.3 Obsidian Settings Tab
- ✅ `AxxaSettingsTab.ts` registrado no Obsidian (**6 sub-tabs em v0.1.33: OpenAI/Anthropic/Gemini/OpenRouter/NIM/Ollama + Outros**)
- ✅ Provider padrão sempre visível acima das tabs + bolinha colorida no tab do padrão
- ✅ Seção API Keys (OpenAI ✅, Anthropic ✅, Gemini ✅, OpenRouter ✅, NIM ✅) + botão "↻ Buscar modelos" via API
- ✅ **Campos novos nas Settings** (v0.1.33): `geminiApiKey`, `geminiModel`, `nimApiKey`, `nimModel`. Defaults: `gemini-2.5-flash` e `nvidia/llama-3.3-nemotron-super-49b-v1.5`.
- ✅ Ollama endpoint configurável + listModels via `/api/tags`
- ✅ Defaults: provider (dropdown 6 opções em v0.1.33), model (por provider), effort (placeholder via PlusModal), mode (via StarterScreen)
- ✅ **Dropdown defaultProvider** (v0.1.33): expandido de 4 pra 6 opções.
- ✅ Vault paths (chatsPath, skillsPath na tab Outros)
- ✅ **Modelos ativos por provider** — curadoria de qual modelo aparece no seletor da StarterScreen. Pills removíveis + input manual (suporta legacy) + "Buscar API" com checkboxes (v0.1.19)
- ✅ **Seed do `activeModels`** (v0.1.33): listas iniciais de `gemini` e `nim` no DEFAULT_SETTINGS. Loader já faz merge per-provider (não pisa em settings existentes).
- ⬜ Seção Appearance (background, balloon style) — Módulo 3

### 2.4 Effort Selector
- ✅ 5 níveis: Low / Med / High / xHigh / Max (definidos em `_shared/effort.ts`)
- ✅ Mapeamento para max_tokens (500/2000/4000/8000/16000) — temperatura per-provider vem depois
- ✅ Visível no Status Line do composer (icon `zap` + cor laranja)
- ✅ Selector via PlusModal (bottom sheet estilo ChatGPT — abre no "+" da pill)

### 2.5 Status Line
- ✅ Indicador de conexão (anteriormente dot pulse no header; agora ícone `lock` no chip do model quando session travada)
- ✅ Provider + Model ativos (chip cpu/lock + cor purple no composer info)
- ✅ Modo atual (chip 🩷 `library` + "vault" quando mode != chat)
- ✅ Context window usado / total (chip cyan `gauge` — usa `lastPromptTokens` do store)
- ✅ Tokens consumidos na sessão (chips blue ↓ in, green ↑ out, muted ∑ total — parseado de usage da API)

### 2.6 Build de teste
- ✅ Providers testados com chaves reais (OpenAI confirmado; Anthropic/OpenRouter/Ollama fechados pelo dev em 07/06/2026)
- ✅ Settings persistidas após reabrir o Obsidian (`plugin.saveData()` no `saveSettings()`)
- ✅ **🎯 MARCO:** 4 providers funcionando com effort selector

> **Módulo 2 ✅ Concluído em 07/06/2026** — 4 providers operacionais, Settings tabbed (Providers/Outros) persistido, Status Line com chips coloridos, Effort selector via PlusModal, Session lock após primeira msg. (3.x Appearance → adiado pra Módulo 3.5 conforme já planejado.)

---

## MÓDULO 3 — UI de Produção
> Objetivo: Visual que vai viralizar. Parece feature nativa do Obsidian.

### 3.1 Design System ✅
- ✅ CSS variables baseadas no tema Obsidian ativo (todas as cores via `var(--*)`)
- ✅ Paleta de cores própria não conflitante (6 chips coloridos com fallback hex)
- ✅ Tipografia definida (`--font-interface`, `--font-text`, `--font-monospace`)
- ✅ Dark/light mode automático (CSS vars + `body.theme-dark` quando necessário)
- ✅ **`DESIGN-SYSTEM.md` na raiz** documenta tokens, regras de radius, animações, mobile, e o que NÃO fazer (v0.1.24)

### 3.2 Composer completo (estilo ChatGPT) ✅
- ✅ Textarea auto-expande com o conteúdo (CodeMirror nativo já faz, maxHeight 200px)
- ✅ Botão 📎 attach (placeholder visual no PlusModal: PDF / Imagem / Nota com "em breve" badge — funcional no Módulo 5; v0.1.21)
- ✅ **Botão 🎤 audio recorder (hold-to-record)** — MediaRecorder API, salva `.webm` em `axxa-ai/recordings/`, insere wikilink no composer com duração no alias, indicator vermelho pulsante + timer (v0.1.24)
- ✅ Botão ▶ send / ⬛ stop durante geração (`arrow-up` / `square` com cor invertida)
- ✅ Placeholder dinâmico por modo (chat / vault-qa / agent / coder via Compartment do CodeMirror — v0.1.18)

### 3.3 Mensagens avançadas
- ✅ Markdown renderizado no output do AI (feito no 1.5 via `MarkdownRenderer.render` do Obsidian)
- ✅ Code blocks com syntax highlighting (via Obsidian MarkdownRenderer — vem nativo)
- ✅ Botão "copiar" em code blocks (pós-processamento DOM no Markdown.tsx, hover desktop / semi-visível mobile — v0.1.18)
- ✅ **Context menu (right-click desktop + long-press 500ms mobile)** via Menu nativo do Obsidian — UserBubble: Copiar/Deletar; AIResponse: Copiar/Regenerar/Deletar (vermelho em destrutivo via `setWarning`) — v0.1.20
- ✅ **Feedback háptico** (`navigator.vibrate(30)`) quando long-press dispara — v0.1.23
- 🟡 Footer buttons básicos: copy ✅, **regen ✅ (funcional: rewind até user msg, re-streamReply)**, like/dislike 🟡 (toggle local sem persistência), ... 🟡 (placeholder)

### 3.4 Mobile ✅
- ✅ Drawer lateral responsivo (validado em mobile pelo dev em prints v0.1.7+)
- ✅ Toda interação testada com toque (long-press 500ms + vibração háptica + back-to-bottom flutuante)
- ✅ Teclado virtual não quebra o layout (handler estilo Copilot — `--keyboard-height` + `.axxa-keyboard-open`)
- ✅ Scroll funcional no histórico (sticky-bottom inteligente estilo ChatGPT)

### 3.5 Backgrounds e temas ✅
- ✅ **Background configurável** — 6 presets (None / Sunset / Ocean / Forest / Violet / Mono) via Settings → Outros → Aparência (v0.1.23)
- ✅ Cada preset com variante light/dark via `body.theme-dark` — funciona em qualquer tema Obsidian
- ✅ Compatibilidade verificada com tema default Obsidian (gradient overlay layered sobre `var(--background-primary)`)
- ✅ Grid de swatches com preview real do gradient — clica e troca, igual ChatGPT themes
- 🟡 Compat formal com tema Minimal — testar manualmente (CSS usa só vars padrão, deve funcionar out-of-the-box)

### 3.6 Build de teste
- ⬜ Screenshots tiradas para uso no lançamento
- ⬜ Demo video de 60 segundos gravado
- ⬜ **🎯 MARCO:** UI pronta para screenshots públicas

---

## MÓDULO 4 — Persistência e Vault Q&A
> Objetivo: Chats salvos. Primeira integração real com o Vault.

### 4.1 Estrutura de pastas no Vault
- ✅ `axxa-ai/` criada automaticamente no primeiro save (`ensureFolder` recursivo) — visível no vault explorer
- ✅ Subpasta `chats/chat/` criada (futuras: `skills/`, `logs/`, `index/`)
- ✅ Path configurável nas Settings → Outros (`chatsPath`, default `axxa-ai/chats` — mudou de `.axxa/chats` em v0.1.16)

### 4.2 Chats como Markdown
- ✅ Cada conversa salva como `.md` em `axxa-ai/chats/chat/[uuid].md`
- ✅ Frontmatter completo: id, title, date, mode, provider, model, effort, tokens_in, tokens_out, message_count, tags
- ✅ Body Markdown legível: `# Title` + alternância `## You` / `## Assistant`
- ✅ Auto-save debounced 500ms a cada update de messages
- ✅ Last Chats view (lista no starter screen) — clique reidrata mensagens + session lock

### 4.3 Vault Q&A básico (context stuffing)
- ✅ Modo Vault Q&A ativo no starter screen (seletor "Chat" / "Vault Q&A")
- ✅ Notas relevantes injetadas no contexto (busca keyword-based: título=5pts, conteúdo=1pt/ocorrência)
- ✅ Indicador visual: ai-comment "X notas encontradas como contexto" antes do streaming
- ✅ Chip "vault" no status do composer quando modo ativo
- ✅ **Escalonamento por effort** (v0.1.21): low=3×300 / med=5×500 / high=7×800 / xhigh=9×1200 / max=12×2000 — comment mostra topK + effort durante busca

### 4.4 Multilanguage ✅
- ✅ PT-BR como padrão (`src/i18n/pt-br.ts` — source of truth, type inferido daqui)
- ✅ EN-US disponível (`src/i18n/en-us.ts` — mirror tipado de PT-BR)
- ✅ Strings externalizadas: composer, menu, header, starter, modes, plus, vault, ai, systemPrompt, settings
- ⬜ Detecção automática pelo locale do sistema (manual switch via Settings → Outros por enquanto)
- ✅ **Bonus:** UI atualiza ao vivo quando user troca idioma (`plugin.onSettingsChange` → React re-render)

### 4.5 Build de teste
- ⬜ Chats verificados no Vault após uso
- ⬜ Frontmatter correto em todos os formatos
- ⬜ **🎯 MARCO:** Alpha funcional — pronto para beta testers

---

## MÓDULO 5 — Alpha Público
> Objetivo: Plugin no Community Plugins. Primeiros usuários reais.

### 5.1 Qualidade e estabilidade
- ⬜ 20 beta testers recrutados (via X/Twitter)
- ⬜ Todos os bugs críticos resolvidos
- ⬜ Sem uso de `eval()`, `innerHTML` direto, ou APIs proibidas
- ⬜ Plugin review checklist do Obsidian verificado

### 5.2 Documentação
- ⬜ `README.md` completo com screenshots
- ⬜ Seção de instalação
- ⬜ Seção de configuração (API keys)
- ⬜ FAQ básico

### 5.3 Assets de lançamento
- ⬜ Demo video 60 segundos (mobile + desktop)
- ⬜ 4–6 screenshots em alta qualidade
- ⬜ Landing page AXXA OS no ar (Vercel, gratuito)
- ⬜ Waitlist ativa antes do launch

### 5.4 Submission
- ⬜ GitHub Release criado com tag de versão (ex: `0.1.0`)
- ⬜ `main.js`, `manifest.json`, `styles.css` no release
- ⬜ Pull request aberto em `obsidianmd/obsidian-releases`
- ⬜ **🎯 MARCO:** Plugin submetido ao Community Plugins

### 5.5 Launch Day
- ⬜ Posts simultâneos: X + LinkedIn + Reddit + Discord Obsidian
- ⬜ Email para waitlist
- ⬜ Post no Indie Hackers (Milestones)
- ⬜ Resposta a todos os comentários nas primeiras 24h

---

## MÓDULO 6 — Agent + Coder Mode ⏭️ v0.2
> Ativar após estabilidade do alpha e primeiros 200 usuários

### 6.1 Sistema de permissões ✅ MVP (v0.1.28)
- ✅ `evaluatePermission()` no src/agent/permissions.ts implementa lógica decisória
- ✅ 3 níveis via Settings → Outros (dropdown): **Ask** (confirma destrutivas) / **Vault** (só delete) / **YOLO** (zero exceto delete)
- ✅ **Modal de confirmação** (`ConfirmationModal.ts`) com argumentos formatados + botão vermelho `.mod-warning` pra delete
- ✅ **Delete SEMPRE confirma** independente do nível (`tool.irreversible` flag)
- ⬜ Log em `.axxa/logs/agent.md` — adiar pra v0.1.29 (só console.log por enquanto)

### 6.2 Agent Mode ✅ Multi-provider (v0.1.28 + v0.1.32 + v0.1.33)
- ✅ Modo "Agent" na StarterScreen (3º opção ao lado de Chat / Vault Q&A) com ícone bot
- ✅ **Tool calling providers (6 de 6)**: OpenAI ✅ function calling, **Anthropic ✅ tool use** (v0.1.32), **OpenRouter ✅** (OpenAI-compat, v0.1.32), **Gemini ✅** (OpenAI-compat, v0.1.33), **Nvidia NIM ✅** (v0.1.33), **Ollama ✅** (v0.1.33 — exige modelo compatível como llama3.1+/qwen2.5+/mistral-large)
- ✅ **Tool calling Gemini** (v0.1.33) — via OpenAI-compat endpoint do Google, `supportsTools=true`. Funciona em gemini-2.5-pro / 2.5-flash / 3.5-flash. Reusa formato OpenAI `tools[]` + `tool_choice:"auto"`.
- ✅ **Tool calling Nvidia NIM** (v0.1.33) — via endpoint nativo OpenAI-compat. Funciona em Nemotron Super/Ultra, Llama 3.3+, Qwen3+, DeepSeek v4. Modelos pequenos ignoram silenciosamente — aviso no `nimIntro` do i18n.
- ✅ **Tool calling Ollama** (v0.1.33) — reusa `toOpenAIMessages()`, envia `tools[]` (sem `tool_choice`, ignorado pelo Ollama), parseia `tool_calls` aceitando `arguments` como objeto OU string, gera `id` quando ausente.
- ✅ **7 tools** implementadas em `src/agent/tools.ts`:
  - `vault_list` — lista pasta
  - `vault_read` — lê arquivo (cap 200KB)
  - `vault_create` — cria arquivo (cria pastas pai)
  - `vault_edit` — find/replace literal (única ocorrência exigida)
  - `vault_move` — rename/move (não sobrescreve)
  - `vault_delete` — delete arquivo OU pasta vazia
  - `vault_create_folder` — cria pasta
- ✅ **Path safety**: normalização, anti `..`, anti `:`, max 32 níveis
- ✅ **Tool loop** no AxxaApp: chat → tool_calls → permissão → executa → tool result → continua. Max 10 turns (anti loop infinito)
- ✅ **UI feedback**: cada tool call vira ai-comment com ícone (`📄 Criando: foo.md`, `✏️ Editando`, `🗑️ Deletando`)
- ⬜ Operações semânticas ("mova todas notas sobre X") — emerge naturalmente da combinação `vault_list` + `vault_read` + `vault_move` (LLM decide encadeamento)
- 🟡 Suporte de tool calling: **OpenAI ✅** function calling. Anthropic tool use vem em v0.1.29

### 6.3 Coder Mode
- ⬜ Detecta automaticamente arquivos de código
- ⬜ Diff preview antes de aplicar edição
- ⬜ Syntax highlighting no output
- ⬜ Suporte a: .ts, .js, .py, .css, .json, .md com código

### 6.4 Vault Q&A com RAG real ✅ Multimodal (v0.1.25 + v0.1.27)
- 🟡 LanceDB integrado localmente → adiado pra v0.2.x. MVP usa **cosine similarity em memória + JSON persistido** no vault (suporta ~10k chunks, fast enough)
- ✅ **Indexação incremental** — hash SHA-1 por arquivo, só re-embeda o que mudou. Botão "Indexar vault" + "Reindexar (do zero)" + "Limpar índice"
- ✅ **Embeddings via OpenAI** — text-embedding-3-small (1536d, $0.02/M) e text-embedding-3-large (3072d, $0.13/M). Batch de 16 chunks por API call
- ✅ **Embeddings multimodal via OpenRouter** — `nvidia/llama-nemotron-embed-vl-1b-v2:free` (2048d, **FREE**). Texto + imagem (png/jpg/jpeg/webp/gif). v0.1.27
- ⬜ **Embeddings via Gemini** (v0.1.33+) — `gemini-embedding-001` (texto, dim configurável até 3072, tier free generoso) e `gemini-embedding-2` (multimodal, unified embedding space). Endpoint OpenAI-compat `/v1beta/openai/embeddings`. Adicionar `gemini` ao tipo `EmbeddingProvider`. Roteador `embedItems` já abstrato — só plugar o provider no spec list.
- ⬜ **Embeddings via Nvidia NIM** (opcional v0.1.33+) — `nvidia/nv-embedqa-e5-v5` (1024d, retrieval-tuned). NIM hospedado tem tier free de inferência. Adicionar como spec extra em `EMBEDDING_MODELS`.
- ⬜ Embeddings via Ollama (nomic-embed-text local) — futuro
- ⬜ Áudio embedding — requer pipeline Whisper (transcrição) → texto → embed. Sprint próprio (Whisper API ou whisper.cpp local)
- ✅ Pasta de indexação configurável (`axxa-ai/index/embeddings.json` default)
- ✅ **Chunking por parágrafo** com overlap (1500 chars/chunk, 200 overlap)
- ✅ **Imagens: 1 entry por arquivo** (sem chunking), preserva filename como text pro display
- ✅ **Integração no Vault Q&A** — quando índice tem entries, embed query → cosine search → top K chunks como contexto. Senão fallback pra keyword
- ✅ **Router `embedItems`** — escolhe provider/endpoint baseado no spec do modelo. OpenAI = batch nativo, OpenRouter Nemotron = 1 request por item
- ✅ **Progress UI** — barra + label com contadores separados: "Indexando: 87/145 arquivos · 312 chunks · 🖼️ 24" → "Concluído · 🖼️ 24 imagens · 🎙️ 3 áudios pulados"
- ✅ **Stats no Settings** — "X chunks em Y arquivos · última: data" ou "Índice vazio". Aviso se modelo configurado ≠ modelo do índice

---

## SPRINT I — Gemini + Nvidia NIM + Ollama tools (v0.1.33) ✅ Concluído
> **Objetivo:** Subir de 4 pra 6 providers + completar a matriz de tool calling (Ollama 6/6).
> **Status:** ✅ Código entregue 07/06/2026. Smoke test do dev pendente.

### I.1 Provider Gemini (`src/providers/gemini.ts`) ✅
- ✅ Cópia ajustada de `openrouter.ts` — mesmo padrão Bearer + reuso de `toOpenAIMessages()`
- ✅ Endpoint base: `https://generativelanguage.googleapis.com/v1beta/openai/`
- ✅ Auth: `Authorization: Bearer ${geminiApiKey}` (chave do AI Studio direto)
- ✅ Tool calling: `supportsTools = true` (mesmo body que OpenAI)
- ✅ Defaults: `gemini-2.5-flash`; activeModels seed com 5 modelos 2.5/3.x
- ✅ Erros 401/403 → "API key Gemini inválida (aistudio.google.com)"
- ✅ Filtro de modelos exclui tts/live/image/embedding/aqa + strip de prefixo `models/`

### I.2 Provider Nvidia NIM (`src/providers/nim.ts`) ✅
- ✅ Mesmo padrão Bearer + reuso de `toOpenAIMessages()`
- ✅ Endpoint: `https://integrate.api.nvidia.com/v1/chat/completions`
- ✅ Auth: `Authorization: Bearer nvapi-...`
- ✅ Tool calling: `supportsTools = true`
- ✅ Defaults: `nvidia/llama-3.3-nemotron-super-49b-v1.5`; activeModels seed com 5 modelos
- ✅ listModels via `GET /v1/models` filtra publishers principais (nvidia/meta/qwen/deepseek-ai/microsoft/mistralai/google) + exclui embed/rerank/tts/parakeet/canary/etc

### I.3 Ollama tool calling (`src/providers/ollama.ts`) ✅ — BÔNUS do sprint
- ✅ `supportsTools = true` (Ollama ≥0.3 com modelos compatíveis)
- ✅ chat() usa `toOpenAIMessages()` (igual OpenAI/NIM/Gemini)
- ✅ Body envia `tools[]` no formato OpenAI — Ollama ignora `tool_choice` (omitido)
- ✅ Parser de `tool_calls` aceita `arguments` como objeto (path Ollama) OU string JSON (compat)
- ✅ Gera `id` `"ollama_call_${ts}_${idx}"` quando ausente (Ollama frequentemente omite)
- ✅ Captura usage no chat não-streaming via `prompt_eval_count` + `eval_count`

### I.4 Plumbing comum ✅
- ✅ `providers/index.ts` — registry com 6 providers
- ✅ `main.ts` — 4 campos novos (`geminiApiKey`, `geminiModel`, `nimApiKey`, `nimModel`) + activeModels seed
- ✅ `AxxaSettingsTab.ts` — `ProviderTabId` ganha `"gemini" | "nim"`; `renderGemini` + `renderNim`; dropdown defaultProvider em 6 opções; ordem das tabs OpenAI · Anthropic · Gemini · OpenRouter · NIM · Ollama
- ✅ `i18n/pt-br.ts` + `en-us.ts` — `tabs.gemini`, `tabs.nim`, `apiKeyDescGemini`, `apiKeyDescNim`, `geminiIntro`, `nimIntro`; `agent.needsOpenAI` reescrita pra ser provider-agnóstica
- ✅ `StarterScreen.tsx` — entries Gemini (icon `sparkle`) e Nvidia NIM (icon `cpu`) no array `PROVIDERS`
- ✅ **Smoke test NIM** validado pelo dev na v0.1.39 (chat funcionando após correção do default model em meta/llama-3.3-70b-instruct)
- 🟡 Smoke test Gemini — plumbing correto, validar com chave real
- 🟡 Smoke test Ollama tools — exige `ollama pull llama3.1` ou similar

### I.5 RAG opcional (pulado pra v0.1.40+)
- ⬜ Specs em `rag/types.ts` pra `gemini-embedding-001` (dim 3072) e `nvidia/nv-embedqa-e5-v5` (dim 1024)
- ⬜ Estender `EmbeddingProvider` pra incluir `"gemini" | "nim"`
- ⬜ Handlers `embedBatchGemini` / `embedBatchNim` em `embeddings.ts`
- ⬜ Settings RAG dropdown: 4 providers em vez de 2

### I.6 Marco ✅
- ✅ **🎯 MARCO:** 6 providers funcionando via UI (Settings + StarterScreen), Agent multi-provider 6/6
- ✅ Bump pra `v0.1.33` em `manifest.json` e `package.json`
- ⬜ `README.md` mencionando os 2 novos providers — TODO pequeno

---

## SPRINT K.4 — Image Gen Fix + Usage Tab (v0.1.44–v0.1.46 · v0.1.56) ✅ Concluído

> **Objetivo:** Tornar a geração de imagem realmente funcional (era wired mas
> quebrada em runtime) e expor a contabilidade real de gastos de tokens numa
> tela dedicada exportável como PDF/Markdown.
>
> **Status:** ✅ Concluído. Entregue ao longo de:
> - **v0.1.44** — geração de imagem funcional (fix do fluxo OpenAI) + folder picker nas Settings + autocomplete acima do cursor
> - **v0.1.45** — aba Usage completa: `src/usage/pricing.ts` + `aggregate.ts` + `export.ts` (PDF/Markdown)
> - **v0.1.46** — fix geração Gemini (params em snake_case) + OpenAI retry/org-error + model cards
> - **v0.1.56** — Usage e Appearance promovidas a top-tabs nas Settings + reaction persistida
>
> A spec detalhada abaixo fica como referência histórica. Itens que sobraram
> (NIM Visual GenAI · validação multi-modelo de image gen) migraram pro
> **Sprint N — Validação & Estabilização** (ver 🎯 PRÓXIMOS PASSOS).

### K.4.1 Fix geração de imagem (BLOCKER)

#### Estado atual — o que já está pronto
- ✅ `ModelCapabilities` tem flags `imageGen`/`audioGen`/`videoGen`
- ✅ Provider interface tem `generateImage`/`generateAudio`/`generateVideo` opcionais
- ✅ `runGenerationTurn` em AxxaApp roteia para o método certo quando o modelo tem `imageGen`
- ✅ `saveGeneration` salva arquivo + sidecar `.md` com frontmatter completo em `axxa-ai/generation/{type}/`
- ✅ OpenAI/Gemini/NIM têm `generateImage` implementado no código
- ✅ activity timeline mostra "Gerando imagem..." e troca pra check no done

#### O que tá quebrado
1. **OpenAI `/v1/images/generations`** — usado pra DALL-E 3 e gpt-image-1
   - Possível: `gpt-image-1` exige `response_format: "url"` (não `b64_json`)
   - Possível: param `size` rejeitado em alguns modelos (DALL-E 3 só aceita 1024x1024, 1024x1792, 1792x1024)
   - Validar: testar com chave real, ver erro real no DevTools

2. **Gemini Nano Banana** (`gemini-2.5-flash-image`)
   - Endpoint nativo `/v1beta/models/{model}:generateContent` — usando query param `?key=`
   - Body com `generationConfig: { responseModalities: ["IMAGE"] }`
   - Possível: Google mudou shape pra `responseMimeType` ou outro param
   - Possível: Nano Banana renomeado pra `gemini-2.5-flash-image-preview` ou similar
   - **Web fetch antes de testar** — catálogo Gemini muda direto

3. **NIM Visual GenAI** (SDXL, FLUX)
   - Endpoint `https://ai.api.nvidia.com/v1/genai/{model}` — pode ter mudado pra `/v1/inference/{model}` ou similar
   - Body usado: `{ prompt, mode: "text-to-image", aspect_ratio, cfg_scale, steps, seed }`
   - Cada modelo NIM Visual tem shape de body diferente — não tem padrão único
   - Possível: precisa de endpoint dedicado por modelo (não generic)

#### Plano de fix
- ⬜ **Diagnóstico**: rodar o fluxo com cada modelo (DALL-E 3, gemini-2.5-flash-image, stable-diffusion-3-medium) e capturar o request/response REAL no DevTools
- ⬜ **OpenAI**: testar `b64_json` vs `url` (gpt-image-1 exige `url` por default), confirmar params válidos por modelo
- ⬜ **Gemini**: webfetch `https://ai.google.dev/gemini-api/docs/image-generation` pra ver shape atual; renomear default se necessário (não usar `gemini-2.5-flash-image` se foi descontinuado)
- ⬜ **NIM**: webfetch `https://docs.nvidia.com/nim/visual-genai/latest/api/` pra ver endpoint atual; possível precisar de adapter por modelo (SDXL vs FLUX têm shapes diferentes)
- ⬜ **Error handling**: cada falha hoje cai em "Resposta vazia" — surfacing do body real (igual fix do NIM chat na v0.1.42)
- ⬜ **Smoke test**: 3 modelos × 3 prompts, confirmar arquivo salvo + sidecar válido + frontmatter parseável

#### Aceite
- ✅ Pelo menos OpenAI (DALL-E 3) gera imagem real, salva em `axxa-ai/generation/images/`, sidecar tem frontmatter completo
- ✅ Pelo menos 1 modelo Gemini gera imagem real
- ✅ Pelo menos 1 modelo NIM Visual gera imagem real
- ✅ Activity vira `failed` com mensagem clara em erros (não "Falha na geração" genérico)

### K.4.2 Aba Usage — contabilidade de tokens

#### Estado atual
- ✅ `chatStore` já guarda `tokensIn`, `tokensOut` da SESSÃO atual
- ✅ Cada chat salvo em `.md` tem `tokens_in:` e `tokens_out:` no frontmatter
- ✅ Cada chat tem `provider:`, `model:`, `mode:` no frontmatter
- ⚠️ Custos NÃO são calculados — só contagem bruta

#### O que falta
- ⬜ **Tabela de preços** (`src/usage/pricing.ts`):
  - 6 providers × N modelos cada
  - Por modelo: `{ inputPerMillion: USD, outputPerMillion: USD }`
  - Update via webfetch periódico (anotar fonte + data no arquivo)
  - Modelos free (Gemini free tier, OpenRouter `:free`, Ollama local): `{ inputPerMillion: 0, outputPerMillion: 0 }`
  - Generation: por imagem/segundo de áudio em vez de por token

- ⬜ **Agregador** (`src/usage/aggregate.ts`):
  - `aggregateUsage(app, chatsPath)` lê todos `.md` em `chatsPath/{chat,vault-qa,agent}/`
  - Retorna `{ total: {in, out, cost}, byProvider: Record<id, {...}>, byModel: Record<id, {...}>, byMode: Record<id, {...}>, byDay: Record<isoDate, {...}>, byChat: Array<{id, title, ...}> }`
  - Cache em memória (recompute ao detectar mudança via `app.metadataCache.on("changed")`)

- ⬜ **Settings → Outros → Usage** (sub-tab nova):
  - **Cards de resumo**: gasto total (USD), tokens in totais, tokens out totais, # de conversas, modelo mais usado, provider dominante
  - **Tabela por provider**: provider | conversas | tokens in | tokens out | custo (USD) | % do total — sortable
  - **Tabela por modelo**: model | conversas | tokens | custo — mostra os 10 mais usados, link "ver tudo"
  - **Tabela por modo**: chat / vault-qa / agent — uso de cada um
  - **Heatmap por dia** (últimos 30 dias) — chart simples só com divs (sem chart library, pra não inflar bundle)
  - **Top 10 conversas mais caras** — clique abre o chat
  - Pickers de período: "últimos 7d / 30d / 90d / todos"

- ⬜ **Export PDF/Markdown**:
  - Botão "Exportar como PDF" → gera HTML stylizado → usa Electron `printToPDF` (já disponível no Obsidian Desktop)
  - No mobile, fallback pra "Exportar como Markdown" — formato:
    ```markdown
    # AXXA OS — Usage Report
    > Período: 2026-05-01 a 2026-06-08 · gerado em 2026-06-08 15:30
    
    ## Resumo
    - Gasto total: $X.XX
    - Tokens consumidos: X in / X out
    - Conversas: N
    
    ## Por provider
    | Provider | Conversas | Tokens in | Tokens out | Custo |
    | -------- | --------- | --------- | ---------- | ----- |
    ...
    ```
  - Salva em `axxa-ai/reports/usage-{YYYY-MM-DD}.{pdf,md}`

- ⬜ **i18n**: `settings.outrosTabs.usage`, labels da tabela, etc.

#### Aceite
- ✅ User entra em Settings → Outros → Usage, vê gasto real estimado (USD)
- ✅ Breakdown por provider / modelo / modo / dia funciona
- ✅ Botão exportar gera PDF ou MD em `axxa-ai/reports/` que abre legível
- ✅ Modelos sem preço listado aparecem como "—" em vez de quebrar a tabela
- ✅ Modelos free aparecem com badge "FREE" em vez de $0.00

### K.4.3 Marco
- ✅ **🎯 MARCO:** Image gen funcional ponta-a-ponta (OpenAI + Gemini) + Usage como feature shippable (custos USD + export PDF/MD)
- 🟡 NIM Visual GenAI (SDXL/FLUX) ainda não validado em runtime → backlog do Sprint N

### Notas técnicas
- Calcular custo só em USD por enquanto — conversão de moeda fica como follow-up
- Pricing.ts deve ser fácil de atualizar — talvez sourced de uma fonte externa (LiteLLM tem um JSON público com pricing de ~200 modelos: `https://github.com/BerriAI/litellm/blob/main/litellm/model_prices_and_context_window_backup.json`)
- Não migrar dados antigos — chats salvos antes da v0.1.44 não têm o campo `cost` no frontmatter; agregador calcula on-the-fly via pricing lookup
- PDF export usa `window.print()` com `@page` CSS — funciona em qualquer plataforma Electron. Mobile precisa do path Markdown

---

## SPRINT L — Mobile/UX Deep Polish + Fullscreen Saga (v0.1.47 → v0.1.72) ✅ Concluído

> **Objetivo:** Levar o feel mobile de "funciona" pra "parece app nativo": composer
> edge-to-edge cobrindo a safe-area e a navbar do OS, status bar do celular tingida
> pelo preset, e o experimento de fullscreen no drawer. Período de muita iteração
> visual guiada por testes no device (S23 FE).
> **Status:** ✅ ~25 versões shippadas. O fullscreen foi adicionado, revertido e
> REMOVIDO aqui — depois reintroduzido limpo no Sprint M (v0.1.74).

### L.1 Composer & status line edge-to-edge (v0.1.47–v0.1.50, v0.1.57–v0.1.65)
- ✅ Banner auto-suggest pra combos incompatíveis modo+provider+modelo (`IncompatibleBanner`, v0.1.48)
- ✅ Wikilinks como anexo + composer FAB + text style consistente (v0.1.47)
- ✅ Centralização X/Y do texto no composer + keyboard handling refinado + blur agressivo (v0.1.49, v0.1.50)
- ✅ Text-area bg edge-to-edge cobrindo a OS nav bar nativa (v0.1.57); auditoria que eliminou barra horizontal ~20px (v0.1.58)
- ✅ Unificação visual: header / status line / back-to-bottom usam o bg do text field (v0.1.63, v0.1.64)
- ✅ Attach some quando o user digita; botão send ancorado embaixo (v0.1.65)

### L.2 Tint da status bar do OS + navbar (v0.1.51, v0.1.59–v0.1.61)
- ✅ `theme-color` do OS sincronizado — a status bar do celular acompanha o app (v0.1.51)
- ✅ mobile-navbar bg + sombra da status line + ajuste do stop button (v0.1.59)
- ✅ Truque do mobile-navbar 5px transparente (sugestão do dev) (v0.1.60)
- ✅ Camadas de z-index (800/900/1000) + esconder nav do Obsidian agressivamente (v0.1.61)

### L.3 Backgrounds & Settings (v0.1.55, v0.1.56)
- ✅ `!important` nos presets + preview hug + bg ao vivo dentro das Settings (v0.1.55)
- ✅ Usage e Appearance promovidas a top-tabs + reaction (like/dislike) persistida no `.md` (v0.1.56)

### L.4 Fullscreen saga (v0.1.52–v0.1.54, v0.1.62, v0.1.66–v0.1.72)
- ✅ Tentativa de TRUE fullscreen: esconder todo chrome do Obsidian que não seja AXXA (v0.1.68)
- ✅ Debug overlay com toggle nas Settings pra inspecionar layout no device (v0.1.66, v0.1.69)
- 🔁 Reverts: comportamento default do Obsidian restaurado (v0.1.62), break do fullscreen revertido (v0.1.70)
- ✅ **Decisão:** módulo de fullscreen + debug overlay REMOVIDO por completo (v0.1.72) — abordagem global frágil demais; reescrito limpo e escopado no Sprint M

> **Lição registrada:** mexer no chrome nativo do Obsidian (drawer-header, tabs,
> navbar) é território escorregadio — cada versão do app móvel posiciona diferente.
> A v2 (Sprint M) escopou tudo em `body.is-mobile.axxa-fullscreen` em vez de
> overrides globais.

---

## SPRINT M — Effort Engine + Fullscreen Mobile v2 (v0.1.73 → v0.1.74) ✅ Concluído

> **Objetivo:** Centralizar TODOS os parâmetros escaláveis num único `EffortConfig`
> por nível (editável na UI) e reintroduzir o fullscreen mobile de forma limpa e
> escopada (sem os overrides globais que quebraram no Sprint L).

### M.1 Effort Engine (v0.1.73)
- ✅ `EffortConfig` central em `src/components/_shared/effort.ts` — um objeto por nível (Low→Max) reúne: `maxTokens`, `temperature`, `agentMaxTurns`, `toolRetryOnError`, `parallelToolCalls`, `loopDetectionWindow` + lookup do Vault Q&A (`topK`/`excerptChars`)
- ✅ `DEFAULT_EFFORT_CONFIGS` built-in + overrides do usuário via `settings.effortConfigs` (merge per-nível no loader, não pisa em config existente)
- ✅ Nova aba **Settings → Effort** com sub-tab por nível pra editar cada param
- ✅ Agent "incansável" no Max: `agentMaxTurns` sobe pra 200 (0 = uncapped, só loop-detection limita)
- ✅ `effortToMaxTokensSmart()` clampa o maxTokens à context window real do modelo (`getContextWindow`)
- ✅ Effort emojis + smart max no selector (v0.1.66 preparou, v0.1.73 fechou)
- ✅ Fix `.axxa-root` fill (preset pinta a raiz inteira) + SVG marks únicos por provider via `addIcon` (ícones deixam de ser todos `zap`)

### M.2 Fullscreen Mobile v2 (v0.1.74)
- ✅ Reintroduzido via menu "..." no Header → toggle `mobileFullscreen` (persiste entre reloads)
- ✅ Escopado em `body.is-mobile.axxa-fullscreen` — drawer ocupa 100vw + esconde chrome nativo SEM overrides globais
- ✅ bg/preset pinta no container do drawer (não na `.axxa-root`) — corrige bloco de cor errado
- ✅ `theme-color` do OS + tint da `.mobile-navbar` casam com o preset ativo
- ✅ Header com `padding-top: 40px` (escapa a status bar) + bg transparente

---

## SPRINT K.3 — UX polish (labels hug + PlusModal v3 + composer invisível) (v0.1.43) ✅ Concluído

> **Objetivo:** Fechar feedback do usuário sobre detalhes visuais que estavam
> causando atrito (labels cortados, ícones pequenos demais, composer com scroll
> interno desnecessário).

### K.3.1 Labels hug no StarterScreen ✅
- ✅ `.axxa-starter-segment-btn` ganha `line-height: 1.4 !important + height: auto !important + min-height: 0 + box-sizing: border-box` (mesmo fix dos recent-items — Obsidian aplica line-height global agressivo em `<button>` que comprimia o container abaixo da altura natural do texto)
- ✅ Label sobe pra 11px (era 10), line-height 1.3, min-height 14px, padding 1px 0, display:block — hug do texto mesmo com Obsidian global
- ✅ Padding btn 8/4/10 + gap 6 — mais respiro entre ícone e label

### K.3.2 PlusModal v3 ✅
- ✅ Ícones MAIORES: circle 64x64 (era 56x56) + ícone interno 32px (era 26px) + stroke-width 1.8
- ✅ Pop animation no `:active` (scale 0.93) + hover brightness 1.08
- ✅ **Action rows** estilo iOS Settings (Web Search / Create Image / Extended Thinking):
  - Componente `PlusToggleRow` novo: ícone tonal 40x40 + label/desc + toggle switch
  - Toggle switch iOS-style 44x26 com thumb 20x20 deslizando 18px (cubic-bezier elastica), verde quando on
  - Click em qualquer área da row dispara o toggle
  - `imageGenEnabled` prop: Create Image fica disabled quando modelo não tem `imageGen` cap
  - Tab/Enter/Space accessibility (keyboard nav)
- ✅ **Effort selector single-line**: substituí grid 2 colunas por row horizontal de 5 pills com scroll-x quando não couber. Container pill cinza segmented (mesma estética dos segments do StarterScreen)
- ✅ State `plusToggles` no AxxaApp (preferência da sessão, cada provider decide se respeita)
- ✅ i18n PT/EN: `plus.webSearchTitle/Desc`, `createImageTitle/Desc/NoGen`, `extendedThinkingTitle/Desc`

### K.3.3 Composer invisível ✅
- ✅ `EditorView.theme`: removido `maxHeight: 200px` (causa do scroll interno) + `overflowY: visible`
- ✅ `cm-content`: `height: auto !important + min-height: 0 !important` (impede CodeMirror forçar altura)
- ✅ `.axxa-composer-editor`: `max-height: 40vh` (só clamp em viewports gigantes — texto longo continua expandindo natural)
- ✅ `.axxa-composer-pill`: `border-radius: 22px` (era 999 redondo total), `align-items: flex-end` (botões alinham embaixo quando texto cresce), padding ajustado
- ✅ `.axxa-composer-row`: `min-height: 0` — sem altura artificial

### K.3.4 Estado final ✅
- ✅ Composer cresce com o texto, sem scroll interno, sem container "fantasma"
- ✅ Modal +: ícones grandes (instagram-style), 3 toggles configuráveis, effort single-line
- ✅ Labels do StarterScreen respirando, sem texto cortado

---

## SPRINT K.2 — PlusModal Claude-style + multi-tipo attachments + Composer cobre safe area (v0.1.41) ✅ Concluído

> **Objetivo:** Refinar o modal `+` pra estética Claude chat (3 pills coloridas
> grandes), aceitar nota/PDF/imagem/áudio nas conversas, e fazer o composer
> ocupar a área total do drawer cobrindo a safe-area mobile.

### K.2.1 PlusModal v2 ✅
- ✅ Row de 3 pills grandes: Nota (verde) / PDF (vermelho) / Imagem (roxo)
- ✅ Cada pill com circle 56x56 + label
- ✅ Imagem disabled (alpha 0.4) quando modelo não suporta vision
- ✅ Notice clara explicando o motivo do disabled
- ✅ Effort selector abaixo do divider

### K.2.2 Attachments multi-tipo ✅
- ✅ `ProviderMessage.attachments` aceita `NoteAttachment/PdfAttachment/AudioAttachment`
- ✅ Providers ignoram tipos não-image no wire; notas viram contexto inline, pdf/audio passam como meta
- ✅ Composer renderiza chips por kind: image (shimmer+thumb), note (file-text verde), pdf (file vermelho), audio (mic ciano)
- ✅ `streamReply` inlina notes anexadas no system prompt automaticamente

### K.2.3 Note picker ✅
- ✅ `FuzzySuggestModal` nativo (igual Quick Switcher)
- ✅ Type-ahead em todas as `.md` do vault

### K.2.4 Composer cobre safe area ✅
- ✅ `z-index: 50 + position: relative`
- ✅ Pseudo-element `::after` estende background até cobrir `safe-area-inset-bottom + copilot-status-bar-clearance`
- ✅ Mobile com mobile-navbar: soma `--navbar-height` (~50px)
- ✅ Não toquei o padding-bottom hand-tuned do dev

### K.2.5 Generation infra (precursor pra K.4) ✅
- ✅ Tipos `ImageAttachment/NoteAttachment/PdfAttachment/AudioAttachment` em `base.ts`
- ✅ `MessageAttachment` union discriminada

---

## SPRINT K.1 — Multimodal + Agent Streaming + Badges (v0.1.40) ✅ Concluído
> **Objetivo:** Trazer pra Agent/Vault-QA o mesmo streaming + sticky-bottom do Chat mode; aceitar imagens em todos os modos quando o modelo suporta vision; identificar capacidades dos modelos visualmente (DS chips) no seletor.
> **Status:** ✅ Código entregue 08/06/2026. Smoke test (especialmente vision) pendente.

### K.1.1 Matriz de capacidades (`src/providers/modelCapabilities.ts`) ✅
- ✅ `getModelCapabilities(provider, model)` retorna `{ vision, tools, streaming, free }`
- ✅ Match por prefixo (resiliente a versão); ordem do array prioriza prefixos específicos
- ✅ Cobre 6 providers: OpenAI (gpt-4o+/o1+ família), Anthropic (claude-3/4 vision), Gemini (1.5+/2.5+/3.x), OpenRouter (mapeia por upstream), NIM (Nemotron VL, Llama 3.2 Vision; streaming=false porque é fake via requestUrl), Ollama (llava/bakllava/llama3.2-vision/qwen2.5-vl + texto local)
- ✅ `capabilityBadges(caps)` helper retorna `[{id,label,icon}]` ordenado pro UI consumir

### K.1.2 Imagens (multimodal) em chat/vault-qa/agent ✅
- ✅ Tipo novo `ImageAttachment` + `MessageAttachment` em `providers/base.ts`; `ProviderMessage.attachments?: MessageAttachment[]`
- ✅ `toOpenAIMessages()` (openai.ts) faz user-msg com attachments virar content array `[{type:"text"},{type:"image_url"}]` — formato vision compatível com OpenAI/Gemini/OpenRouter/NIM/Ollama
- ✅ Anthropic (`toAnthropicPayload`): user com imagens vira content array com `{type:"image",source:{type:"base64",media_type,data}}` — parser de data URL embutido; URLs externas usam `source:{type:"url"}`
- ✅ Composer (`Composer.tsx`):
  - Novo botão attach (icon `image`) ao lado do `+` — visível apenas quando `visionEnabled=true`
  - Hidden `<input type="file" multiple accept="image/*">` (FileReader → dataUrl)
  - **Paste de imagem no editor**: `EditorView.domEventHandlers({paste})` — intercepta `image/*` do clipboard, gera PendingImage, mostra Notice
  - Chips de preview acima do composer (`.axxa-composer-attachments`) com thumbnail 28x28 + nome + botão X
  - Notice clara quando user tenta anexar em modelo sem vision
- ✅ AxxaApp:
  - State `pendingAttachments: PendingAttachmentEntry[]` (id estável pra UI tracking)
  - `handleSend` filtra via `getModelCapabilities().vision` (dupla checagem além da UI)
  - `streamReply(userText, userAttachments?)` e `runAgentTurn(userText, userAttachments?)` aceitam attachments — propagados pra última user msg do `history`
- ⚠️ Decisão: attachments NÃO persistem no `.md` do chat (frontmatter ficaria pesado com base64). Trade-off: regen de msg com imagem perde o anexo. Resolver com upload-to-vault depois

### K.1.3 Streaming no Agent mode (refactor `runAgentTurn`) ✅
- ✅ `streamChat` no contrato `Provider` agora retorna `Promise<ProviderResponse>` (era `Promise<void>`); callers antigos só ignoram o retorno (backwards-compat)
- ✅ Cada provider parseia tool_calls no STREAM e devolve no retorno:
  - **OpenAI/Gemini/OpenRouter**: acumulador por `index` (deltas de `tool_calls[i].function.arguments` viram string concatenada → JSON.parse no fim). Helper `finalizeOpenAIResponse` exportado
  - **Anthropic**: parser de `content_block_start` (tipo tool_use) + `content_block_delta` com `input_json_delta` acumula `partial_json` por block index
  - **NIM**: streaming "fake" via chat() — apenas retorna a resposta completa (já tinha o trabalho feito)
  - **Ollama**: parser NDJSON acumula `message.tool_calls[]` quando aparece (Ollama emite tool_calls inteiros, não em deltas)
- ✅ Body de streamChat agora envia `tools[]` + `tool_choice:"auto"` (faltava em quase todos)
- ✅ `runAgentTurn` reescrito:
  - Usa `streamChat` em cada turno, com `onToken` que cria/anexa numa ai-response (não mais ai-comment)
  - `startStreamTimer` + `tickStreamTokens` + `endStreamTimer` ativam métrica de t/s (chip `speed`)
  - `setStreamingMessageId` esconde footer durante stream (igual chat mode)
  - Sticky-bottom scroll dispara naturalmente via ChatArea (já era mode-agnóstico)
  - AbortController integrado — botão "stop" cancela o agent loop, não só o chat
  - Retorno do streamChat informa se tem tool_calls → loop continua ou termina
- ✅ Max turns mantido em 10; permission level (`ask/vault/yolo`) inalterado

### K.1.4 Badges de capacidade no seletor de modelo ✅
- ✅ `StarterScreen.tsx`: abaixo do `<select>` de modelo, novo `.axxa-model-caps` mostra chips do design system
- ✅ Cores semânticas do DS:
  - vision → roxo (`--color-purple`) — combina com chip de model
  - tools → laranja (`--color-orange`) — combina com chip de effort
  - stream → verde (`--color-green`) — combina com chip de tokens out
  - free → cyan (`--color-cyan`) — combina com chip de context
- ✅ Tooltip por badge via `title` prop (PT-BR + EN-US): explica o significado da capacidade
- ✅ Reusa `InfoChip` (mesmo componente do status line) — visual unificado

### K.1.5 i18n novos strings ✅
- ✅ PT-BR + EN-US: `composer.attachImageLabel/RemoveLabel/NoVision/PastedNotice/Failed`
- ✅ PT-BR + EN-US: `starter.modelCapsAria` + `capVisionTooltip/capToolsTooltip/capStreamTooltip/capFreeTooltip`
- ✅ `agent.thinking` reusado no `runAgentTurn` (era hardcoded antes)
- ✅ `agent.maxTurnsReached(n)` reusado

### K.1.6 CSS novo (`styles/main.css`) ✅
- ✅ `.axxa-composer-attach` — botão de clip com cor accent roxa, hover invertido (text-on-accent sobre bg-purple)
- ✅ `.axxa-composer-attachments` — linha horizontal scrollável de chips, scrollbar thin
- ✅ `.axxa-attachment-chip` — pill com thumb 28x28 + name truncate + X
- ✅ `.axxa-model-caps` — wrap row de InfoChips abaixo do select de modelo

### K.1.7 Estado final ✅
- ✅ **Chat mode**: streaming SSE (já era) + sticky-bottom + token/s + multimodal opt-in
- ✅ **Vault Q&A**: streaming SSE (já era, via streamReply compartilhado) + multimodal opt-in
- ✅ **Agent mode**: AGORA com streaming real (parsing de tool_calls deltas em SSE) + token/s + abort + multimodal opt-in
- ✅ **Badges no seletor**: usuário vê de cara se o modelo aceita imagem / tem tools / faz streaming real / é grátis
- ✅ Build verde (`npm run build` exit 0)
- 🟡 Smoke test pendente: verificar paste de imagem em PT-BR, agent loop com Anthropic (tool_use blocks no stream), NIM com modelo Vision (Llama 3.2 90B Vision via NIM)

### K.1.8 Tech debt remanescente
- ⬜ Attachments não persistem no `.md` — regen e reload perdem anexo. Mover pro vault como `axxa-ai/attachments/{ts}-{name}` e gravar wikilink no body
- ⬜ Composer não distingue "streaming fake" (NIM) vs real no chip de speed — funciona, mas o usuário só vê o "spike" no final. Pode mostrar shimmer estático em vez de chip de t/s vivo
- ⬜ Anthropic chat() non-streaming ainda existe — pode ser removido se Agent loop só usa streamChat agora (mas chat() ainda é usado por outros lugares? checar `chat()` calls antes de remover)

---

## SPRINT J — UX Polish + Profissionalização (v0.1.34 → v0.1.39) ✅ Concluído
> **Objetivo:** Pegar o produto "funcional 6 providers" e levar pra "produto que parece profissional" — visual unificado, status line refinada, listas densas, Settings organizado, bugs do NIM resolvidos.
> **Status:** ✅ 6 versões shippadas em 1 dia (08/06/2026).

### J.1 v0.1.34 — Plumbing NIM/Gemini + multi-modo + rename
- ✅ **Bug fix crítico**: 4 switches em AxxaApp (modelFor / handleStarterModel / streamReply / runAgentTurn) caíam em `default = openaiApiKey` quando providerId era `gemini` ou `nim` → causa raiz do "erro de conexão" no NIM. Centralizei em `apiKeyFor()` + `modelFor()` com cases pros 6 providers
- ✅ NIM `streamChat` → via `requestUrl` (chama `chat()` + emit final). `integrate.api.nvidia.com` não devolve CORS headers liberais; fetch direto do browser bloqueia. Trade-off: streaming "fake" (resposta vem inteira), mas funciona em prod
- ✅ Settings tabs com `flex-wrap:nowrap + overflow-x:auto` (não quebram em 2 linhas com 6 providers)
- ✅ `listAllChats()` em chatPersistence — walk em todas subpastas de `chatsPath`, agrega chat + agent + vault-qa
- ✅ `ChatSummary.mode` incluído pra cada item conhecer modo (necessário pra loadChat usar a subpasta certa)
- ✅ `handleLoadChat` aceita `chatMode` opcional (default "chat" pra compat)
- ✅ `renameChat()` em chatPersistence — reescreve frontmatter `title:` + `# h1` do body sem mudar id/path
- ✅ Header com input editável inline do título do chat (Enter/blur salva, Escape descarta)
- ✅ `RenameChatModal` (Obsidian Modal nativo) — usado também via lápis na ConversationsList (depois removido em v0.1.37)

### J.2 v0.1.35 — Título visível + pills segmented icon-only
- ✅ `.axxa-recent-title` reescrito: drop `-webkit-line-clamp` (zerava texto em alguns flex parents), usa single-line ellipsis bulletproof (`display:block + white-space:nowrap + text-overflow:ellipsis + color !important`)
- ✅ Provider e Mode selectors da StarterScreen viraram `.axxa-starter-segment` (mesma estética das sub-tabs do Settings) — icon-only com tooltip + aria-label
- ✅ Active state com `background-primary` + box-shadow
- ✅ Scroll horizontal mantido pra caber 6 providers em sidebar estreita

### J.3 v0.1.36 — Compact mode (pills stacked)
- ✅ Pills do Starter agora **stacked**: ícone 24px em cima + label 10px embaixo (em vez de só ícone)
- ✅ Effort também virou segmented pill (estava btn solto com border)
- ✅ Cards `.axxa-recent-item` — padding 8x10 (era 12x14), border-radius 10, line-height 1.4 explícito **resolve "container menor que altura do texto"** (Obsidian aplica line-height global em buttons que comprimia o flex column)
- ✅ Meta font 9px, gap mais apertado, mode chip uppercase 8px
- ✅ Starter title 18px (era 22px); section labels 10px

### J.4 v0.1.37 — InfoChip extraído + filtros segmented pill
- ✅ `InfoChip` extraído pra `_shared/InfoChip.tsx` (vivia inline no Composer; agora reusado em StarterScreen recent + ConversationsList items)
- ✅ Recent items meta refeitos com info chips coloridos (mesmo padrão do status line):
  - 🩷 mode (library/bot/message-square por modo)
  - 🟣 model (cpu)
  - ⚫ date (clock)
  - 🔵 messages (message-square)
  - 🟢 tokens (sigma)
- ✅ **Lápis removido** da ConversationsList (UX cleaner — rename só via Header)
- ✅ Filtros mode + provider viraram segmented pill (mesmo container cinza pill das tabs do Settings)
- ✅ Limpa ~80 linhas de CSS dead da v0.1.34 (`-item-row`, `-item-action`, `-title-row`, `-mode-chip`)

### J.5 v0.1.38 — Chip visibility configurável + single-line
- ✅ Settings novo: "Chips visíveis" — 2 seções de checkboxes pro composer status line + lista de chats
- ✅ `AxxaSettings.composerChips: string[]` + `listChips: string[]`
- ✅ Defaults SLIM: composer `[model, effort, in, out]` / lista `[mode, model, date]` — user opta por mais via checkboxes
- ✅ `.axxa-composer-info` → `flex-wrap:nowrap + overflow:hidden` — single line garantida mesmo se user habilitar todos
- ✅ Cards extra compact: padding 6x9, border-radius 10, gap 2, meta font 9px, list gap 5

### J.6 v0.1.39 — NIM 404 + token/s + Settings sub-tabs semânticas
- ✅ **NIM 404 corrigido**: default `nimModel` era `nvidia/llama-3.3-nemotron-super-49b-v1.5` (não existe no catálogo NIM hosted) → mudado pra `meta/llama-3.3-70b-instruct`. activeModels seed com 5 modelos validados via webfetch
- ✅ NIM ganhou case 404 explícito: aponta direto pra Settings → Providers → NIM → "Buscar da API" + cita o ID inválido
- ✅ Placeholder do composer single-line garantida (`.cm-placeholder` com nowrap + ellipsis)
- ✅ **Token/s ao vivo**: chat store ganhou `streamStartedAt + streamTokens + tokensPerSec + startStreamTimer / tickStreamTokens / endStreamTimer`. AxxaApp dispara nos pontos certos do stream; cálculo via chars/3.5. Novo chip `speed` no status line (icon `activity`, cor amarela)
- ✅ **Settings → Outros** quebrado em 4 sub-tabs (mesmo padrão segmented pill dos providers):
  - **Geral**: idioma, paths (chats/skills/recordings), Em breve
  - **Interface**: code wrap, chips visíveis, aparência (backgrounds)
  - **Agent**: nível de permissão
  - **RAG**: provider/model embeddings + indexação

### J.7 Estado final do Sprint J ✅
- ✅ 6 providers operacionais via UI: dropdown defaultProvider, 6 sub-tabs nas Settings, 6 entries no StarterScreen com tooltip+stack
- ✅ Agent Mode multi-provider 6/6 (todos com tool calling habilitado)
- ✅ Status line com 8 chips opcionais (mode/model/effort/context/in/out/total/**speed**)
- ✅ Lista de chats agora cross-mode (chat + agent + vault-qa), com filtros segmented pill e InfoChips
- ✅ Settings reorganizado: Providers (6 sub-tabs) · Outros (4 sub-tabs: Geral/UI/Agent/RAG)
- ✅ Rename de título via Header inline (Enter salva, Escape descarta)
- ✅ Bug do título sumindo eliminado em definitivo (CSS bulletproof)

---

## MÓDULO 7 — Skills + Projects ⏭️ v0.2
> Após Agent mode estável

### 7.1 Skills Management
- ⬜ Tela de Skills em Settings
- ⬜ CRUD completo (criar, editar, duplicar, deletar)
- ⬜ Formato `.md` com frontmatter padronizado
- ⬜ Import/Export em `.md` e `.html`
- ⬜ Preview do system prompt

### 7.2 Project Management
- ⬜ Comando `/project [nome]` no chat
- ⬜ Wikilinks `[[projeto]]` no frontmatter do chat
- ⬜ Filtro de Last Chats por projeto
- ⬜ Auto-indexação da pasta do projeto ao vincular

---

## MÓDULO 8 — Premium + Auth ⏭️ v0.3
> Após estabilidade e primeiros 500 usuários

### 8.1 Stripe
- ⬜ Conta Stripe criada
- ⬜ Produto criado: AXXA OS Premium ($9,99/mês ou $79/ano)
- ⬜ Checkout link gerado
- ⬜ Webhook de confirmação de pagamento

### 8.2 Supabase Auth
- ⬜ Projeto Supabase criado
- ⬜ Google OAuth configurado
- ⬜ Tabela de licenças (user_id, stripe_customer_id, status)
- ⬜ JWT verification no plugin startup

### 8.3 Features premium
- ⬜ Feature flag por usuário
- ⬜ Media transcription (Whisper em vídeo/áudio do Vault)
- ⬜ Sync entre devices via Google login

---

## MÓDULO 9 — MCP Connect ⏭️ v0.3
> Primeiro update grande pós-alpha

### 9.1 Notion
- ⬜ OAuth Notion configurado em Settings
- ⬜ Leitura de páginas e databases
- ⬜ Criação e edição de páginas
- ⬜ Sync bidirecional básico

### 9.2 ClickUp
- ⬜ API key configurável
- ⬜ Leitura de tasks e spaces
- ⬜ Criar e atualizar tasks via chat

### 9.3 Figma
- ⬜ API token configurável
- ⬜ Leitura de arquivos e componentes
- ⬜ Referências a frames no contexto do chat

---

## Notas e Decisões Técnicas
> Atualizar conforme o projeto avança

| Data | Decisão | Motivo |
|------|---------|--------|
| 05/06/2026 | LanceDB para RAG | Zero-config, embutido, sem servidor |
| 05/06/2026 | React 18 para UI | Componentização, ecossistema |
| 05/06/2026 | Zustand para state | Leve, sem boilerplate |
| 05/06/2026 | esbuild para build | Template oficial Obsidian |
| 05/06/2026 | Supabase para auth | Auth + DB mínimo sem ops |
| 05/06/2026 | `AxxaView.tsx` (não `.ts`) | Contém JSX (`<AxxaApp/>`) — `.tsx` é necessário pra TypeScript reconhecer |
| 05/06/2026 | `scripts/deploy.mjs` cross-platform | Substitui `cp` Unix do prompt original — Node script funciona em Windows |
| 05/06/2026 | `.axxa.local.json` (gitignored) | Guarda vault path local sem vazar no repo |
| 05/06/2026 | `tsconfig.json` com `jsx: "react-jsx"` | Novo JSX transform do React 18 — sem precisar importar React em todo `.tsx` |
| 05/06/2026 | TODO: minify production build | `main.js` em 1MB — adicionar `minify: prod` no esbuild reduz pra ~200KB |
| 05/06/2026 | ✅ `minify: prod` adicionado | Bundle: 1025 KB → 142 KB (Hello World) → 151 KB (chat completo) |
| 05/06/2026 | 4 tipos de mensagem no chat | `user` (bubble dir), `ai-response` (texto + footer), `ai-comment` (bubble esq), `ai-options` (botões) — definido pelo dev |
| 05/06/2026 | Composer com CodeMirror nativo | Em vez de `<textarea>` — herda tema/atalhos/markdown do Obsidian. Externals já configurados no esbuild |
| 05/06/2026 | Vulnerabilidade esbuild (audit) | Afeta só modo `serve` HTTP — não usamos. Adiada pra v1.0 (upgrade pra esbuild 0.28 é breaking) |
| 05/06/2026 | `setIcon` do Obsidian (Lucide) | Wrapper React `<Icon name="..." />` — mantém ícones consistentes com o resto do app |
| 06/06/2026 | Mobile keyboard handler estilo Copilot | MutationObserver no `<html>` lendo `--keyboard-height`, toggle de `.axxa-keyboard-open` no drawer. Reverse-engineering do plugin Copilot. |
| 06/06/2026 | CSS de view-content do dev é LOCKED | Bloco com `padding-bottom: calc(...)` foi hand-tuned/testado no device, não tocar sem confirmação |
| 06/06/2026 | Scroll sticky-bottom estilo ChatGPT | `shouldStickRef` controlado por scroll events; força stick em nova msg do user; botão back-to-bottom flutuante quando scrollado pra cima |
| 06/06/2026 | Markdown render durante streaming | `MarkdownRenderer.render` re-renderiza a cada token (Component local destruído/criado por update); fine pra UX, custo aceitável |
| 06/06/2026 | Status info chips com cores | 6-7 chips coloridos abaixo do composer (purple/orange/cyan/blue/green/pink) com micro-ícones Lucide — visual de "dashboard" pequeno |
| 06/06/2026 | PlusModal bottom sheet estilo ChatGPT | Effort selector via modal que sobe do bottom; ficou em PlusModal pra acomodar opções futuras (attach, screenshot, etc) |
| 06/06/2026 | Session lock após primeira msg | Provider+model+mode travados no `store.sessionXxx` quando user manda primeira msg. Effort continua livre via "+". |
| 06/06/2026 | Persistência: chat = arquivo .md no vault | Frontmatter YAML (id, title, date, mode, provider, model, effort, tokens) + body com `## You`/`## Assistant`. Editável pelo user no Obsidian. |
| 06/06/2026 | Token tracking | OpenAI: `stream_options.include_usage` no body. Anthropic: parse `message_start` (input) + `message_delta` (output). Ollama: `prompt_eval_count` + `eval_count`. |
| 07/06/2026 | OpenRouter como provider | Endpoint OpenAI-compatible; headers extras `HTTP-Referer` + `X-Title`; modelos prefixados (`anthropic/claude-3.5-sonnet`) |
| 07/06/2026 | Ollama NDJSON parsing | Diferente de SSE — cada linha é JSON completo. `done: true` na última linha tem os counts. |
| 07/06/2026 | Pasta `axxa-ai/` (não `.axxa/`) | Dev pediu pasta visível no vault, sem prefixo dot oculto |
| 07/06/2026 | Vault Q&A keyword-based (MVP) | Scoring: title=5pts/keyword, content=1pt/ocorrência; top 5 notas, excerpt 500 chars. Embeddings reais virão no Módulo 6.4 |
| 07/06/2026 | `.axxa-chat-area-wrapper` precisa `flex-direction:column` | Sem isso, chat-area sem altura constraint quebra layout (composer some). Bug recorrente — fixado em v0.1.17 |
| 07/06/2026 | Placeholder via `Compartment` do CodeMirror (v0.1.18) | Reconfigura placeholder sem destruir o editor — usuário não perde texto ao trocar de modo. Helper `placeholderForMode(mode)` no AxxaApp. |
| 07/06/2026 | Copy button em code blocks via DOM post-process (v0.1.18) | MarkdownRenderer não tem hook de "afterRender" pra blocos específicos. Solução: aguardar Promise do render e fazer `querySelectorAll("pre")` injetando o botão. Idempotente (`:scope > .axxa-code-copy` check). |
| 07/06/2026 | `output/` removido do `.gitignore` (v0.1.19) | Os 3 arquivos do build (`main.js`, `manifest.json`, `styles.css`) já eram tracked. Alinhar o gitignore com a realidade evita warnings em todo commit. |
| 07/06/2026 | Composer info chips com truncate + tamanho reduzido (v0.1.19) | Nomes longos de modelo (ex: `anthropic/claude-3.5-sonnet-20241022`) estouravam a largura. Solução: `max-width:100%` + `min-width:0` + `text-overflow:ellipsis` no `<span>` interno, font 11→10px, ícones 12→11px. |
| 07/06/2026 | `activeModels: Record<string, string[]>` nas Settings (v0.1.19) | Lista curada por provider — sai do hardcoded MODELS na StarterScreen e vira config do user. Permite incluir legacy (gpt-3.5-turbo, claude-2.1) e evita rolar lista gigante do fetch. `loadSettings` faz merge per-provider pra preservar defaults nos providers não tocados. |
| 07/06/2026 | Sprint A (v0.1.20) — Context menu + regen funcional | Right-click (desktop) e long-press 500ms (mobile) abrem Menu nativo do Obsidian em cada mensagem. Cancel critério: dedo move >10px OU touchend antes do timer. Itens vermelhos via `MenuItem.setWarning(true)`. |
| 07/06/2026 | Refactor `streamReply()` reusável (v0.1.20) | Lógica de vault search + comment "Pensando..." + streamChat + erro extraída em função. Reutilizada por handleSend (adiciona user msg primeiro) e handleRegenerate (remove ai-response + posteriores antes). Lê history via `useChatStore.getState()` pra trabalhar com o array mutado. |
| 07/06/2026 | `ChatActionsContext` pra evitar prop drilling (v0.1.20) | regenerate/deleteMessage são definidas no AxxaApp (closure sobre provider/settings/abortRef) e consumidas em Messages (3 níveis abaixo). Context = passar o token sem prop chain. |
| 07/06/2026 | Sprint B (v0.1.21) — Vault Q&A escalonado por effort | `EFFORT_VAULT_LOOKUP` mapeia cada nível pra `{topK, excerptChars}`. Low=900 chars total, Max=24k chars. Comment durante busca mostra topK + effort pra transparência. |
| 07/06/2026 | Sprint B (v0.1.21) — Attach UI no PlusModal | 3 botões dashed (PDF / Imagem / Nota) disabled com Notice "vem no Módulo 5". Seção tem badge "em breve" + opacity 0.78. Coexiste com Effort selector via border-top separator. |
| 07/06/2026 | Sprint C (v0.1.22) — i18n PT-BR/EN-US tipado | `src/i18n/pt-br.ts` é a fonte (type `Translations = typeof PT_BR`); `en-us.ts: Translations` é forçado pelo TS a ter o mesmo shape. `useT()` hook + `TranslationsContext.Provider` no AxxaApp. Strings com placeholder usam functions tipadas (`vault.searching(topK, effort)`). |
| 07/06/2026 | Sprint C (v0.1.22) — Settings com 5 sub-tabs | Tabs OpenAI/Anthropic/OpenRouter/Ollama/Outros — cada provider isolado pra facilitar navegação. Provider padrão sempre visível acima das tabs + bolinha de cor no tab matching. flex-wrap pra mobile (5 tabs cabem). |
| 07/06/2026 | Sprint C (v0.1.22) — Settings listener reativo | `plugin.onSettingsChange(cb)` chamado a cada saveSettings. AxxaApp registra listener no mount → forceRender no callback → re-pega `t` na hora. Idioma muda sem precisar reabrir a aba. |
| 07/06/2026 | Sprint D (v0.1.23) — Vibração no long-press | `navigator.vibrate?.(30)` dentro do setTimeout do long-press. Android vibra, iOS Safari ignora silenciosamente (`?.`). 30ms é o "tap háptico" canônico — mais que isso vira buzz. |
| 07/06/2026 | Sprint D (v0.1.23) — Backgrounds via classe na .axxa-root | 5 presets de gradient (Sunset/Ocean/Forest/Violet/Mono) + None default. Cada preset tem variante `body.theme-dark` pra adaptação automática. Aplicado via `axxa-bg-<id>` na .axxa-root — gradient overlay sobre `var(--background-primary)` mantém compat com qualquer tema. |
| 07/06/2026 | Sprint D (v0.1.23) — Background picker como swatch grid | Grid auto-fill 108px com preview real do gradient (não swatch sintético). `outline: 2px var(--interactive-accent)` no ativo. Inspirado em ChatGPT themes panel. |
| 07/06/2026 | Sprint E (v0.1.24) — Audio recorder hold-to-record | MediaRecorder API + `getUserMedia({audio})`. Press → start, release → stop + save webm em `axxa-ai/recordings/`. Listener global `document.mouseup/touchend` pra detectar release fora do botão. Filtro de gravações <300ms (taps acidentais). Wikilink `[[path\|Áudio 0:05]]` inserido no cursor via `view.state.replaceSelection`. |
| 07/06/2026 | Sprint E (v0.1.24) — Visual feedback de gravação | Botão vermelho pulsante (`@keyframes axxa-recording-pulse` com box-shadow ripple). Indicator chip acima do composer com bolinha vermelha pulsante + timer `0:05` em tabular-nums + hint. Vibração háptica no start E no stop. |
| 07/06/2026 | Sprint E (v0.1.24) — `DESIGN-SYSTEM.md` na raiz | Doc consolida tokens, paleta de 6 chips coloridos, regras de radius (18px ou 999px, nada mais), animations, tipos de mensagem, convenções de naming, e seção "o que NÃO fazer". Atualizar a cada decisão visual nova. |
| 07/06/2026 | Sprint F (v0.1.25) — RAG MVP sem LanceDB | Cosine similarity em memória + JSON persistido em vez de LanceDB. Razão: LanceDB é Rust+WASM, integração complexa no Electron. Cosine sim O(n×dim) é "fast enough" pra até ~10k chunks (target user típico). LanceDB vira upgrade pra vaults >50k chunks. |
| 07/06/2026 | Sprint F (v0.1.25) — Chunking por parágrafo com overlap | Split em `\n\n`, agrega até 1500 chars/chunk, overlap de 200 chars entre chunks consecutivos. Trade-off: preserva contexto entre quebras mas duplica ~13% do conteúdo. Chunking semântico (por heading H2/H3) vem em v0.2.x. |
| 07/06/2026 | Sprint F (v0.1.25) — Indexação incremental por SHA-1 | Cada entry guarda hash do conteúdo. No reindex, re-embeda só arquivos com hash diferente. Persiste a cada batch (16 chunks) pra durabilidade contra crash. Pruning automático de arquivos deletados. |
| 07/06/2026 | Sprint F (v0.1.25) — Min score threshold 0.3 na busca | Cosine similarity < 0.3 é considerado "off-topic" e descartado. Evita injetar contexto irrelevante quando query é muito diferente das notas. |
| 07/06/2026 | Sprint F (v0.1.25) — RAG é opcional, fallback automático | Se índice vazio ou sem API key, Vault Q&A usa keyword search (busca por título/ocorrências). Garante que o modo nunca quebra mesmo sem RAG configurado. Migrar pra RAG = só clicar "Indexar vault". |
| 07/06/2026 | Alpha launch (Sprint F/G) adiado pra v0.3 | Decisão de produto: priorizar RAG + Agent (core differentiators) antes de publicar. Submeter ao Community Plugins só faz sentido com o produto "que vai viralizar" pronto. |
| 07/06/2026 | UX polish (v0.1.26) — Settings tabs aninhadas | Top-tabs: Providers / Outros (organizadas por tema). Dentro de Providers, sub-tabs estilo segmented control (pill container com pills brancas no ativo). Provider padrão vive dentro do tema "Providers" — não pollui Outros. |
| 07/06/2026 | UX polish (v0.1.26) — backgrounds bumpados + 3 radiais | Opacidades dos 5 lineares originais subiram 2-3x (era sutil demais). Novos: Aurora (verde+roxo opostos), Spotlight (dourado top), Nebula (cosmic 3-pontos). Aplicados também na `.axxa-settings-root` — bg aparece nas Settings. |
| 07/06/2026 | UX polish (v0.1.26) — zero scroll-x | Composer CodeMirror: `overflowX: hidden` no theme + word-break:break-word + overflow-wrap:anywhere no .cm-content. CSS externo reforça com `.cm-editor` e `.cm-scroller`. Bubbles ganharam mesmo tratamento. Code blocks mantêm scroll-x exceto quando `codeWrap` no settings. |
| 07/06/2026 | UX polish (v0.1.26) — code wrap toggle | Novo setting `codeWrap: boolean`. Quando true, `.axxa-root.axxa-code-wrap` aplica `white-space: pre-wrap` + `word-break: break-all` nos `<pre>`. Default false (preserva formatação do código). |
| 07/06/2026 | UX polish (v0.1.26) — StarterScreen fill | `flex: 1 1 auto` + `height: 100%` + `width: 100%` + `box-sizing: border-box`. Sem isso, com poucas recent chats a bg ficava cortada no meio. Agora ocupa 100% entre header e composer. |
| 07/06/2026 | RAG multimodal (v0.1.27) — Nemotron VL :free no OpenRouter | `nvidia/llama-nemotron-embed-vl-1b-v2:free` (2048d, FREE). Adicionado provider `openrouter` aos types. Endpoint `https://openrouter.ai/api/v1/embeddings`. 1 request por item (sem batch nativo). Imagem via base64 data URL + content array `[{type:"image_url"}]`. |
| 07/06/2026 | RAG multimodal (v0.1.27) — router `embedItems` | Função única que aceita `EmbedInput[]` (texto OU imagem), olha o spec do modelo e despacha pra `embedBatch` (OpenAI text) ou `embedBatchOpenRouter` (multimodal). Erro claro se modelo não-VL recebe imagem. |
| 07/06/2026 | RAG multimodal (v0.1.27) — indexer walks imagem + skip áudio | `getFiles()` em vez de só `getMarkdownFiles()`. Filtra extensão pra png/jpg/jpeg/webp/gif. Áudio (mp3/wav/m4a/ogg/flac) detectado e contado mas pulado — modelo VL atual não embeda áudio (precisaria Whisper). |
| 07/06/2026 | RAG multimodal (v0.1.27) — `arrayBufferToDataUrl` | Helper pra converter binário → base64 data URL em chunks de 32K (evita stack overflow do `String.fromCharCode.apply` com bytes >32K). |
| 07/06/2026 | Sprint G (v0.1.28) — Agent loop non-streaming | streamReply (chat mode) usa streamChat. Agent loop usa chat() não-streaming pra simplicidade. Agent é "stateful" (tool → result → tool) — streaming agentic é complexo e inconsistente entre providers. Streaming agent vem em v0.2.x. |
| 07/06/2026 | Sprint G (v0.1.28) — Provider supportsTools flag | `Provider.supportsTools?: boolean` no base.ts. AxxaApp checa antes de rodar agent. OpenAI = true. Anthropic/OpenRouter/Ollama = false (por enquanto). Erro claro se user tentar usar outro provider em Agent. |
| 07/06/2026 | Sprint G (v0.1.28) — Path safety nas tools | Toda tool normaliza: replace `\\`→`/`, remove leading `/`, bloqueia `..` (path traversal) e `:` (Windows drive), cap em 32 níveis de profundidade. Anti shell-injection: tools NUNCA executam comandos, só I/O via vault.adapter. |
| 07/06/2026 | Sprint G (v0.1.28) — vault_edit exige string única | LLM tem que fornecer `oldStr` que aparece exatamente 1x. Se 0 = "string não encontrada", se >1 = "ambígua, use mais contexto". Anti edits acidentais que mexem na linha errada. |
| 07/06/2026 | Sprint G (v0.1.28) — vault_delete só pasta vazia | Tool delete em pasta com conteúdo falha (safety). LLM precisa deletar arquivos um por um — confirma cada um (irreversível). Evita rm-rf acidental. |
| 07/06/2026 | Sprint G (v0.1.28) — MAX_TURNS=10 no agent loop | Cap pra evitar LLM ficar chamando tools infinitamente. Se atingir, devolve erro pedindo refrasear. 10 cobre ~95% dos casos legítimos. |
| 07/06/2026 | Hotfix v0.1.29 — Nemotron VL text como content-array | Bug: text input como string crua devolvia `data: []`. Fix: input vira `[{type:"text",text:"..."}]` (formato content-array que o modelo espera). Log de body+response no console em qualquer erro pra facilitar debug. |
| 07/06/2026 | Hotfix v0.1.29 — Indexer save por arquivo, não por batch | Bug crítico mobile: salvar índice (40MB JSON) a CADA batch causava OOM no WebView do Android (S23 FE crashou). Fix: SAVE_EVERY_N_FILES=25 + sempre no final. Reduz I/O em ~25x. Trade-off: durabilidade menor (perde até 25 arquivos em crash) por estabilidade. |
| 07/06/2026 | Hotfix v0.1.29 — Per-file try-catch + skip on error | Bug: 1 arquivo com erro de embed (rate limit, payload, etc.) derrubava o resto do batch (16 chunks). Fix: try-catch por arquivo. Lista de `failedFiles[]` logada no final pra inspeção. Continua com próximo arquivo. |
| 07/06/2026 | Hotfix v0.1.29 — Retry 429 com 3s backoff | OpenRouter free tier tem rate limit apertado. Antes: qualquer 429 jogava erro fatal. Agora: 1 retry após 3s. Se persistir, joga ProviderError clara. |
| 07/06/2026 | Sprint H (v0.1.30) — ConversationsList tela cheia | Nova view: `view: "chat" \| "conversations"` state em AxxaApp. Botão no header (ícone `messages-square`) abre. Lista carrega `listChats(... limit: 1000)`. Filtro inline por título/model/provider. Agrupado por dia (Hoje/Ontem/data). |
| 07/06/2026 | Sprint H (v0.1.30) — @ autocomplete wikilink no Composer | `wikilinkCompletionSource` em src/components/composer/completions.ts. Trigger `@`. Lista todas as notas (basename) + pastas. Apply insere `[[path]] `. Usa `autocompletion` extension nativa do CodeMirror — mesma engine do Quick Switcher do Obsidian. |
| 07/06/2026 | Sprint H (v0.1.30) — / commands no Composer | 9 comandos MVP: /new /clear /regen /stop /conversations /settings /mode-chat /mode-vault-qa /mode-agent. Apply CUSTOM: dispatch limpa o texto + executa action em microtask. Não insere literal — vira UX rico (slash commands ChatGPT-style). |
| 07/06/2026 | Sprint H (v0.1.30) — CSS polish starter + recent chats | Ícones nos buttons de provider/mode: 18px → 14px. Separador `·` virou bolinhas reais (`.axxa-recent-meta-dot`). flex-wrap + gap horizontal melhor no meta. Spacing geral mais arejado. |
| 07/06/2026 | Sprint H (v0.1.30) — modal audit | ConfirmationModal usa `Modal` nativo do Obsidian ✅. PlusModal é bottom sheet custom (ChatGPT-style mobile) — intencional, fica como está. Decisão documentada. |
| 07/06/2026 | Fix v0.1.31 — autocomplete dropdown clipado | `overflow-x: hidden` no .cm-editor cortava o popup do autocomplete. Fix: `tooltips({ position: "fixed", parent: document.body })` do `@codemirror/view`. Renderiza o popup direto no body, escapa do clip, CodeMirror posiciona acima ou abaixo do cursor conforme espaço. CSS adicional pra estilo do `.cm-tooltip-autocomplete`. |
| 07/06/2026 | Fix v0.1.31 — search input com 1px | Obsidian colapsa height de inputs filhos de flex. Fix: `min-height: 24px` + `line-height: 1.5` + `height: auto !important` + `padding: 4px 0` no input. Pai `.axxa-conversations-search` ganhou `min-height: 40px`. |
| 07/06/2026 | v0.1.31 — Filtros + sort na ConversationsList | 5 sort options (data desc/asc, título, msgs, tokens). Provider filter chips horizontal scroll (all/openai/anthropic/openrouter/ollama). Quando sort != data, agrupa em lista plana (sem header de dia). |
| 07/06/2026 | v0.1.31 — 3 backgrounds animados reativos | `Pulse` (radial pulsante) / `Flow` (linear gradient correndo) / `Aurora Live` (2 radials cruzando via translate). Animação via `::before`/`::after` pseudo-elementos. Classe `.axxa-bg-active` adicionada quando `isLoading=true` → animation-duration acelera 3-4x. |
| 07/06/2026 | Hotfix v0.1.32 — Settings scroll quebrado | Causa: `.axxa-settings-root.axxa-bg-pulse/flow/aurora-live` herdava `overflow:hidden` (necessário pra animação caber no .axxa-root). Fix: removo .axxa-settings-root dos seletores animados + adiciono `overflow-y: auto !important` explícito na .axxa-settings-root. Settings sempre scrolla. |
| 07/06/2026 | Hotfix v0.1.32 — Modal escondido atrás do teclado mobile | Causa: ConfirmationModal ficava centralizado, teclado virtual cobria. Fix: AxxaView agora marca `body.axxa-keyboard-open` também (antes só drawer). Modal nosso ganha classe `.axxa-modal-keyboard-aware` em onOpen. CSS com `:has()` reposiciona modal pro top quando body tem .axxa-keyboard-open + limita max-height pra não cobrir teclado. PlusModal (bottom sheet) ganha `padding-bottom: var(--keyboard-height)`. |
| 07/06/2026 | v0.1.32 — Anthropic tool use | Provider Anthropic agora `supportsTools=true`. Implementação: converter `toAnthropicPayload()` mapeia ProviderMessage[] pro formato content-array (assistant com tool_calls vira content blocks text+tool_use; role "tool" vira role "user" com tool_result block). Tool_results consecutivos viram 1 user msg com content[] mergeado (Anthropic exige alternância). Body com `tools[]` no formato `{name, description, input_schema}`. Parse de content array no response separa text + tool_use blocks. |
| 07/06/2026 | v0.1.32 — OpenRouter tool use (proxy) | `supportsTools=true`. Reutiliza `toOpenAIMessages()` (exportada do openai.ts) — OpenRouter é 100% OpenAI-compat no endpoint chat. Modelos que suportam: Claude (3.5-sonnet, 3.7, opus), GPT-4o family, Llama 3.1+, Gemini, Qwen 2.5+. Modelos antigos ignoram tools silenciosamente — agent vai falhar com erro do LLM ("não chamei tool"). |
| 07/06/2026 | Caminho pra Ollama tools (TODO v0.1.33+) | Ollama ≥0.3 suporta tool calling em modelos compatíveis (llama3.1, llama3.2, qwen2.5, mistral-large). Formato é OpenAI-compat — basta replicar o que fiz no openrouter.ts: importar `toOpenAIMessages`, adicionar `tools` ao body, parsear `tool_calls`, setar `supportsTools=true`. Diferença é que Ollama NÃO usa `tool_choice` (ignora). Pra v0.1.33. |
| 07/06/2026 | Sprint I (v0.1.33) — Gemini via OpenAI-compat (não via generateContent nativo) | Google publicou endpoint `/v1beta/openai/` que aceita exatamente o mesmo body da OpenAI (messages, tools, tool_choice, stream, stream_options). Auth via `Authorization: Bearer ${key}`. Trade-off: perdemos features Gemini-only (grounding, thinking budget, native multimodal de vídeo). Ganho: reuso TOTAL de `toOpenAIMessages()` + parser SSE já testado. Migrar pra generateContent vira upgrade futuro só se algum cliente pedir. |
| 07/06/2026 | Sprint I (v0.1.33) — Nvidia NIM 100% OpenAI-compat | NIM hospedado (integrate.api.nvidia.com) é o caminho — sem deploy local. Auth Bearer com chave `nvapi-...` do build.nvidia.com. Free tier de 1k créditos por conta basta pra testes. Modelos com tool calling validado: Nemotron Super/Ultra, Llama 3.3+, Qwen3+, DeepSeek v4. Modelos pequenos (Phi-4 mini, Llama 3.2 8b) ignoram silenciosamente — incluir aviso no campo Settings. |
| 07/06/2026 | Sprint I — ordem das tabs nas Settings | Proposta: OpenAI · Anthropic · **Gemini** · OpenRouter · **NIM** · Ollama. Critério: providers de fronteira primeiro (3 big labs), agregadores no meio, local no fim. flex-wrap já cobre overflow no mobile (6 tabs cabem em 2 linhas em telas <380px). |
| 07/06/2026 | Sprint I — embeddings Gemini/NIM ficam no I.4 (não bloqueia chat/agent) | Razão: o valor imediato é mais opções de chat + agent. Embeddings dependem de mexer no `EmbeddingProvider` type, `EMBEDDING_MODELS` spec list, router `embedItems`, e UI de Settings RAG. Dá pra entregar I.1+I.2+I.3 em 1 sprint, e I.4 num follow-up de 1-2h. Evita escopo inflado bloqueando o release. |
| 08/06/2026 | J.1 (v0.1.34) — `apiKeyFor()` + `modelFor()` centralizados | 4 switches espalhados em AxxaApp (modelFor/handleStarterModel/streamReply/runAgentTurn) caíam em `default = openaiApiKey` quando providerId era gemini/nim → causa raiz do "erro de conexão" no NIM. Lição: switches duplicados convidam bugs quando adiciona provider novo. Solução: 2 helpers no topo do AxxaApp; quem precisa chama. Quando adicionar 7º provider, é só editar um lugar. |
| 08/06/2026 | J.1 (v0.1.34) — NIM streamChat via requestUrl (não fetch) | integrate.api.nvidia.com bloqueia CORS no browser → `fetch` direto throw TypeError. Solução: streamChat chama internamente o próprio `chat()` (que usa `requestUrl` do Obsidian) + emite o conteúdo como único token no final. Trade-off: usuário vê resposta completa de uma vez, sem efeito token-a-token. UX < real streaming, mas funciona. Alternativa futura: proxy próprio. |
| 08/06/2026 | J.1 (v0.1.34) — `listAllChats()` walk em subpastas | Antes: `listChats(chatsPath, "chat", limit)` hardcoded → só listava chats do modo "chat". Bug: agentes/vault-qa salvos não apareciam. Solução: novo `listAllChats` faz `adapter.list(chatsPath).folders` e itera. Cada chat já guardava `mode` no frontmatter; só faltava agregar. |
| 08/06/2026 | J.1 (v0.1.34) — `renameChat()` sem mudar id/path | Reescreve só frontmatter `title:` + h1 do body; mantém id e file path. Razão: id é UUID estável, mudar arrastaria wikilinks/refs. Trade-off: chats antigos podem ter title divergente do filename, mas nunca quebram referência. |
| 08/06/2026 | J.2 (v0.1.35) — drop `-webkit-line-clamp` no título | Em alguns flex parents, line-clamp colapsava texto pra 0px (mesmo com display:-webkit-box explícito). Causa: combo line-clamp + width:100% + flex parent + Obsidian button reset. Solução: single-line ellipsis padrão (display:block + nowrap + ellipsis + color !important). Funciona em todos os contextos sem mistério. |
| 08/06/2026 | J.3 (v0.1.36) — line-height 1.4 explícito em `.axxa-recent-item` | Obsidian aplica line-height global agressivo em `<button>` que comprimia flex column → container ficava MENOR que altura natural do conteúdo. Solução: line-height:1.4 explícito + height:auto + min-height:0 + box-sizing:border-box. Vale pra qualquer button-as-card no Obsidian. |
| 08/06/2026 | J.3 (v0.1.36) — pills stacked icon 24 + label 10 | Padrão "ícone em cima, label embaixo" gera reconhecimento sem cluttering. 24px ícone é o sweet spot pra mobile (>=24 = touch target visível). Label 10px é "legível mas claramente secundário". flex-direction:column no btn + alinhamento centralizado. |
| 08/06/2026 | J.4 (v0.1.37) — `InfoChip` extraído pra `_shared/` | Vivia inline em Composer.tsx; reusado em StarterScreen recent + ConversationsList items. Sinal de extração: 2+ consumidores com lógica idêntica. Component é tiny (10 linhas) — não justifica mais que isso, mas o reuso evita drift visual entre lugares. |
| 08/06/2026 | J.4 (v0.1.37) — filtros viraram segmented pill (mesmo padrão do Settings) | Consistência: 4 lugares no app agora usam o mesmo padrão (sub-tabs Providers, pills do Starter, filtros da Conversations, sub-tabs Outros). Container `var(--background-modifier-hover)` border-radius pill + pills internas com active state `--background-primary` + box-shadow. Visual unificado SEM duplicar CSS (cada um tem sua classe wrapper). |
| 08/06/2026 | J.5 (v0.1.38) — chips configuráveis via Settings | `composerChips` + `listChips` em AxxaSettings. Defaults SLIM (4+3 chips). User opta por mais. Razão: tela do mobile não tolera 8 chips visíveis; sidebar de 320px também não. Setting controla individualmente por contexto (status line ≠ lista). Loader faz merge (não pisa em config existente). |
| 08/06/2026 | J.5 (v0.1.38) — `.axxa-composer-info { flex-wrap: nowrap; overflow: hidden }` | Status line NUNCA quebra pra 2 linhas. Se user habilita 8 chips e largura não cabe, esconde silenciosamente os da direita. Prioridade implícita pela ordem do JSX. Alternativa rejeitada: scroll horizontal na status line — fica ruidoso visualmente. |
| 08/06/2026 | J.6 (v0.1.39) — Default NIM model atualizado pra meta/llama-3.3-70b-instruct | `nvidia/llama-3.3-nemotron-super-49b-v1.5` (default antigo) não existe no catálogo da NIM hosted → 404. Lição: confirmar modelo via webfetch antes de hardcodar default. activeModels seed também trocada pelos 5 modelos retornados oficialmente. Caso 404 ganhou mensagem que cita o ID inválido e aponta pra "Buscar da API". |
| 08/06/2026 | J.6 (v0.1.39) — Token/s via store + estimativa chars/3.5 | Não tem endpoint que devolve tokens-emitidos-no-stream em tempo real (só usage no final). Solução: estimar localmente. Cada token recebido contribui `Math.ceil(chunk.length / 3.5)` (heurística pra PT/EN). Razão de 3.5 vs 4: PT-BR tem mais chars/token que inglês. Store guarda startTime + token counter + computed tokensPerSec. AxxaApp dispara nos pontos certos. |
| 08/06/2026 | J.6 (v0.1.39) — `.cm-placeholder` single-line | Placeholder do CodeMirror agora `white-space:nowrap + overflow:hidden + text-overflow:ellipsis`. Texto do user continua wrapping normal. Era assimétrico: o placeholder podia quebrar mas o composer queria parecer compacto. Fix: forçar single-line só no placeholder, deixa user wrappear normal. |
| 08/06/2026 | J.6 (v0.1.39) — Settings "Outros" com 4 sub-tabs semânticas | Geral / Interface / Agent / RAG. Mesmo padrão segmented pill dos providers. Antes era 1 tab gigante com scroll de ~600px. UX profissional precisa de organização semântica — agrupar settings por intenção, não por ordem de implementação. |
| 08/06/2026 | K.4.1 (v0.1.44) — Image gen funcional via fluxo OpenAI | Geração estava wired mas quebrada. Fix do request/response + folder picker nas Settings + autocomplete acima do cursor. Resultado salvo em `axxa-ai/generation/images/` com sidecar `.md` (frontmatter: prompt/model/provider/seed/dims). |
| 08/06/2026 | K.4.2 (v0.1.45) — Aba Usage com custos em USD | `src/usage/{pricing,aggregate,export}.ts`. Pricing por modelo (USD/M tokens, free = badge). Aggregator percorre os `.md` de chats e quebra por provider/modelo/modo/dia. Export PDF (desktop via printToPDF) + Markdown (mobile). Custo calculado on-the-fly — chats antigos não migram. |
| 08/06/2026 | v0.1.46 — Gemini image params em snake_case | Gemini rejeitava camelCase nos params de geração. Fix + OpenAI retry/org-error message + model cards no seletor. |
| 08/06/2026 | Sprint L (v0.1.72) — fullscreen global REMOVIDO | A 1ª tentativa de fullscreen (v0.1.52→0.1.68) usava overrides globais do chrome do Obsidian → frágil, quebrava entre versões do app móvel. Decisão: remover tudo + debug overlay e reescrever escopado no Sprint M. Lição: nunca sobrescrever chrome nativo globalmente. |
| 09/06/2026 | M.1 (v0.1.73) — `EffortConfig` central | Todos os params escaláveis (maxTokens, temperature, agentMaxTurns, toolRetryOnError, parallelToolCalls, loopDetectionWindow, topK/excerptChars) num objeto por nível em `effort.ts`. `DEFAULT_EFFORT_CONFIGS` + overrides do user (`settings.effortConfigs`, merge per-nível). UI: Settings → Effort com sub-tab por nível. Max "incansável" = agentMaxTurns 200 (0 = uncapped). |
| 09/06/2026 | M.2 (v0.1.74) — Fullscreen mobile v2 escopado | Reescrito em `body.is-mobile.axxa-fullscreen` (toggle via menu "..." no Header, persiste). Drawer 100vw + esconde chrome SEM overrides globais. bg/preset pinta no container do drawer; `theme-color` do OS + navbar tint casam com o preset. |
| 09/06/2026 | v0.1.75 — Wikilink/áudio viram anexo (não `[[cru]]`) | `@` pick, paste de wikilink e gravação de áudio agora inserem só o ALIAS legível no texto ("MinhaNota" / "Áudio 0:05") + adicionam o item como chip de anexo. **Fix do bug "wikilink de pasta não funciona":** detecção de pasta trocada de `constructor.name === "TFolder"` (quebra na minificação de prod) pra `instanceof TFolder`. **Lição:** nunca depender de `constructor.name` com classes do Obsidian em prod — usar `instanceof` com import de valor. |
| 09/06/2026 | v0.1.76 — `isError` flag: contexto limpo por chat | Mensagens de erro (rate-limit/network) ganham `isError:true` em `AIResponseMessage`. Filtradas em 3 pontos: history do `streamReply`, history do `runAgentTurn` e auto-save `.md`. **Resolve bug real:** antes o erro era `ai-response` normal e entrava no contexto da próxima chamada — o LLM via "⚠️ Erro: ..." como turn de assistant dele. Agora o erro renderiza na UI mas é efêmero (não vai pro wire nem pro disco). A janela de contexto de cada chat sobrevive a erros sem contaminação. |
| 09/06/2026 | v0.1.79 — RAG v2 (2/n): índice Obsidian-native | Cada chunk é embedado com um cabeçalho de contexto montado do `metadataCache` nativo: `Nota: <título> · Aliases · Tags (frontmatter + inline #tag) · Links (wikilinks do corpo)`. Melhora recall — a query casa com título/tags/links mesmo quando o termo não está no corpo. O `text` da entry segue puro (excerpt limpo). Requer "Reindexar do zero" pra ativar em notas já indexadas (o hash é do conteúdo, não do header). |
| 09/06/2026 | v0.1.78 — RAG v2 (1/n): tool `vault_search` no agent | Agent ganhou **busca semântica do vault**: tool `vault_search(query, topK)` usa `plugin.vectorIndex` (cosine) com **fallback keyword** (`searchVault`) quando não há índice. Introduzido `ToolContext` (app + vectorIndex + creds de embedding) — entries do `TOOL_REGISTRY` viram adapters `(ctx) => tool(ctx.app, ...)`, funções tool intactas. System prompt instrui o agent a usar vault_search ANTES de listar/ler. Antes ele navegava por força bruta (vault_list+vault_read) — caro em tokens e não escalava em vault grande. **Próximos passos RAG v2:** typed arrays + int8 + dim reduzida + persistência binária (10k notas no mobile), reindex automático por evento, chunking estrutural + hybrid search. |
| 09/06/2026 | v0.1.77 — Wake lock + virtualização do composer | **Wake lock:** hook `useWakeLock(isLoading)` mantém a tela ligada durante a geração (chat/agent/mídia) → tela não apaga por inatividade e o stream não congela. Re-adquire no `visibilitychange`. Limitação: bloqueio manual / background não dá (WebView, sem foreground service nativo). **Composer:** colar texto grande travava porque `.cm-scroller` tinha `height:auto + overflow:visible` → CM6 perdia a virtualização e renderizava todas as linhas no DOM. Fix: `max-height:40vh + overflow-y:auto` no scroller → viewport scrollável, virtualização restaurada. |
| 09/06/2026 | v0.1.76 — Modos Coder + Study (mock) | Adicionados ao StarterScreen como mocks visuais: badge laranja "em breve" + opacity 0.45 + clicar mostra Notice (não selecionável, `soon:true` em MODES_META). i18n PT/EN com `coder`/`study`/`soonBadge`/`comingSoon`. Lógica real vem nas Fases 2 (Coder) e futura (Study). UI: starter compactado (gap 18→13px, padding 20→14px, segment-btn padding/gap menores). |

---

## 🎯 PRÓXIMOS PASSOS (Plano — 09/06/2026)
> **Onde estamos:** 6 providers, 3 modos (chat/vault-qa/agent) com streaming, RAG
> multimodal, geração de imagem, aba Usage com custos, Effort Engine e polish
> mobile pesado — tudo em v0.1.74. **O que falta:** o 4º modo prometido (Coder),
> validação real de muita coisa "escrita mas não testada", e o caminho de
> lançamento. As 4 fases abaixo estão em ordem de dependência.

### 📌 Recomendação
**Começar pela Fase 1 (Validação).** É barata, de-risca tudo o que foi shippado
no escuro e é pré-requisito honesto pra qualquer lançamento. Os quick wins
(embeddings Gemini/NIM, README) encaixam em paralelo sem inflar o sprint.

> Decisão a reavaliar: a nota de 07/06 (Decisões Técnicas) adiou o Alpha pra v0.3
> "até RAG + Agent estarem prontos". Esses diferenciais JÁ existem — o gate agora é
> **estabilidade comprovada**, não mais features. Por isso Validação vem primeiro.

---

### FASE 1 — Sprint N · Validação & Estabilização 🔴 (recomendado AGORA)
> Antes de adicionar superfície nova, fechar o que está wired mas não testado com
> chave real. Várias features "parecem prontas" e podem quebrar em runtime.

- ⬜ **Matriz de smoke test**: 6 providers × 3 modos × (chat simples / tool calling) com chaves reais → preencher tabela ✅/❌
- ⬜ **Image gen multi-modelo**: validar Gemini (Nano Banana — webfetch do shape atual antes) + implementar/validar **NIM Visual GenAI** (SDXL/FLUX — endpoint mudou? ver K.4.1)
- ⬜ **Ollama tool calling**: testar com modelo local (`ollama pull llama3.1` / qwen2.5 / mistral-large) no Agent Mode
- ⬜ **Aba Usage com dados reais**: custos estimados batem com a fatura dos provedores? Modelos sem preço caem em "—" sem quebrar a tabela?
- ⬜ **Effort Engine**: confirmar que cada nível (Low→Max) altera comportamento de fato (maxTokens, agentMaxTurns, paralelismo) — testar Max "incansável" num agent task real
- ⬜ Corrigir bugs encontrados + registrar a **matriz de compatibilidade no README**
- 🎯 **Aceite:** tabela provider×modo×capacidade preenchida com resultados reais; image gen validado em ≥2 providers; zero crash conhecido no fluxo principal mobile

### FASE 2 — Sprint O · Coder Mode (Módulo 6.3) + quick wins
> Completar os 4 modos prometidos. Coder reaproveita quase toda a infra do Agent.

- ⬜ 4º modo "Coder" no StarterScreen (ao lado de Chat / Vault Q&A / Agent)
- ⬜ Reusa `TOOL_REGISTRY` + permissões do Agent; adiciona **diff preview** antes de aplicar (`vault_edit` em arquivos de código)
- ⬜ Restrição a extensões de código (.ts/.js/.py/.css/.json/.md-com-código); syntax highlight já vem do MarkdownRenderer
- ⬜ **Quick win paralelo (~1-2h):** embeddings Gemini (`gemini-embedding-001`) + NIM (`nv-embedqa-e5-v5`) — estende `EmbeddingProvider`, pluga 2 handlers, dropdown RAG vira 4 opções (default free pra quem não tem OpenAI key) — ver K.4.4
- 🎯 **Aceite:** editar um `.ts` via chat com diff preview + confirmação; RAG funcionando com embeddings free

### FASE 3 — Sprint P · Skills + Projects + Whisper (Módulo 7)
> Diferenciais "vault-native" que ninguém mais tem.

- ⬜ **Skills** (7.1): CRUD de system prompts em `.md` com frontmatter, vincular a modo, preview, import/export
- ⬜ **Projects** (7.2): comando `/project`, wikilinks `[[projeto]]` no frontmatter do chat, filtro de chats por projeto
- ⬜ **Whisper áudio** (K.4.5): transcrever os `.webm` já gravados → texto no composer + indexável no RAG (`/v1/audio/transcriptions`)
- 🎯 **Aceite:** criar uma skill e usá-la numa conversa; vincular um chat a um projeto e filtrar por ele

### FASE 4 — Sprint Q · Caminho do Alpha Público (Módulo 5) 🚀
> Com os diferenciais prontos e estáveis, publicar.

- ⬜ Auditoria de review do Obsidian: zero `eval()`/`innerHTML` direto, APIs proibidas, secrets fora de localStorage
- ⬜ README com screenshots da UI atual + quick start (gerar API key em cada lab) + matriz dos 6 providers
- ⬜ Demo video 60s (mobile + desktop) + landing page (Vercel) + waitlist
- ⬜ GitHub Release (`main.js`/`manifest.json`/`styles.css`) + PR em `obsidianmd/obsidian-releases`
- 🎯 **Aceite:** plugin submetido ao Community Plugins

---

### 🧹 Tech debt que vira candidato durante as fases
- **Attachments não persistem no `.md`** → regen/reload de msg com imagem perde o anexo. Fix: subir pro vault (`axxa-ai/attachments/`) e gravar wikilink (encaixa na Fase 1/2)
- **`AGENT_SYSTEM_PROMPT` em PT hardcoded** (AxxaApp) → mover pro i18n antes do EN-US ir a produção (Fase 4)
- **ConversationsList sem paginação** (`listAllChats(..., 1000)`) → virtual scrolling quando vaults grandes aparecerem
- **`RenameChatModal.ts` morto** → reusar em Skills/Projects (Fase 3) ou deletar

---

## Estado Atual & Handoff (09/06/2026)
> **Lê isso primeiro se você é o próximo agente continuando o trabalho.**
> Última sessão: v0.1.43 → v0.1.74 (Sprints **K.4 + L + M** completos: image gen funcional, aba Usage com custos, deep polish mobile + fullscreen saga, Effort Engine e fullscreen v2). Próximo plano detalhado em **🎯 PRÓXIMOS PASSOS** acima.

### O que tá funcionando hoje ✅

**6 providers operacionais** (OpenAI / Anthropic / Gemini / OpenRouter / NIM / Ollama):
- Chat com streaming (NIM é streaming "fake" via requestUrl, ver J.1)
- Agent Mode com tool calling em todos os 6 (Ollama exige modelo compatível ≥0.3 + llama3.1/qwen2.5/mistral-large)
- Settings com sub-tabs: 6 provider tabs + 4 outras (Geral/UI/Agent/RAG)
- Listar modelos via API (botão "Buscar da API" + activeModels curados)

**Persistência multi-modo:**
- Chats salvos como `.md` em `axxa-ai/chats/{mode}/{uuid}.md`
- `listAllChats()` agrega todos os modos pra Recent + ConversationsList
- Rename inline via título do Header (Enter salva, Escape descarta) — persiste no `.md`

**RAG multimodal:**
- OpenAI text-embedding-3-small/large
- OpenRouter Nemotron VL :free (texto + imagem)
- Indexação incremental (SHA-1 por arquivo, save a cada 25 arquivos)
- Mobile-safe (não OOM em S23 FE)

**UI profissional:**
- Status line single-line + 8 chips opcionais (mode/model/effort/context/in/out/total/**speed**)
- Listas de chat com InfoChip pattern (mesmo visual em todos os lugares)
- Pills stacked (icon 24 + label 10) em todos os selectors
- Filtros segmented pill em ConversationsList
- 12 backgrounds (none + 8 estáticos + 3 animados live)
- Mobile responsive: drawer, teclado handler estilo Copilot, sticky-bottom scroll

**Novidades pós-v0.1.43 (Sprints K.4 / L / M):**
- Geração de imagem funcional (OpenAI + Gemini) → salva em `axxa-ai/generation/images/` com sidecar `.md` (`src/generation/save.ts`)
- Aba **Usage**: custo estimado em USD por provider/modelo/modo/dia + top conversas caras + export PDF/Markdown (`src/usage/`)
- **Effort Engine**: `EffortConfig` central editável por nível (maxTokens, agentMaxTurns, retry, paralelismo, loop-detection, lookup do Vault Q&A)
- Mobile chrome: fullscreen v2 (menu "..."), `theme-color` do OS + navbar tint por preset, composer edge-to-edge
- Banner de incompatibilidade (modo+provider+modelo) com sugestão de swap (`IncompatibleBanner`)
- Reaction (like/dislike) persistida no `.md`

### O que ainda precisa de validação 🟡

1. **Smoke test Gemini chat texto + agent** — plumbing tá correto pós v0.1.34, mas dev não confirmou com chave real ainda
2. **Smoke test Ollama tool calling** — exige `ollama pull llama3.1` (ou qwen2.5, mistral-large) e mode Agent. v0.1.33 adicionou o wiring; ninguém testou com modelo local rodando
3. **NIM chat com modelo customizado** — default `meta/llama-3.3-70b-instruct` confirmado existir. Outros 4 da seed precisam validação real (já saem em "Buscar da API", então user descobre fácil)
4. **Image gen Gemini + NIM** — OpenAI validado (v0.1.44). Gemini Nano Banana (v0.1.46) e NIM Visual GenAI precisam confirmação em runtime com chave real
5. **Aba Usage com dados reais** — pricing.ts precisa bater com faturas reais dos provedores; conferir modelos sem preço listado

> ⚠️ Esses itens são exatamente o escopo da **Fase 1 — Sprint N** (ver 🎯 PRÓXIMOS PASSOS no topo).

### Backlog detalhado — specs dos itens do plano 🎯
> K.4.1 (image gen) e K.4.2 (Usage) já ✅ concluídos. As specs abaixo permanecem
> como referência pros itens que migraram pro Sprint N+ (Coder, embeddings,
> Whisper, README). Priorização de alto nível vive em 🎯 PRÓXIMOS PASSOS.

#### K.4.1 Fix geração de imagem (BLOCKER) — 🔴
- **Status:** wired ponta-a-ponta mas quebrado em runtime (OpenAI/Gemini/NIM)
- **Diagnóstico necessário:** rodar com chave real, capturar request/response no DevTools, surfacing dos errors
- **OpenAI** possivelmente quer `response_format: "url"` (não `b64_json`) em gpt-image-1
- **Gemini** Nano Banana provavelmente renomeado / shape mudou — webfetch antes
- **NIM** Visual GenAI endpoint pode ter mudado pra `/v1/inference/{model}` em vez de `/v1/genai/{model}`
- Ver detalhes completos em **SPRINT K.4** acima

#### K.4.2 Aba Usage — contabilidade de tokens — ⬜
- Settings → Outros → Usage (nova sub-tab)
- Pricing.ts com USD por modelo de cada provider (sourced de LiteLLM JSON público)
- Aggregator percorre todos os `.md` em chatsPath, computa breakdown
- Tabelas por provider / modelo / modo / dia + top 10 conversas caras
- Export PDF (desktop via `printToPDF`) + Export Markdown (mobile)
- Ver detalhes completos em **SPRINT K.4** acima

#### K.4.3 Coder Mode (Módulo 6.3) — ⬜
- Modo "Coder" no StarterScreen (4º opção ao lado de Chat / Vault Q&A / Agent)
- Detecta arquivos de código nas mensagens (markdown code blocks + .ts/.js/.py/etc anexados)
- Diff preview antes de aplicar edição (vault_edit em arquivos de código)
- Syntax highlighting no output (já vem do Obsidian MarkdownRenderer)
- Pode usar a mesma estrutura de tools do Agent — apenas adicionar `coder_apply_diff` e `coder_create_file`

#### K.4.4 Embeddings Gemini + NIM (Sprint I.5 — pulado) — ⬜
- Adicionar specs em `rag/types.ts`:
  - `{ provider: "gemini", model: "gemini-embedding-001", dim: 3072, maxInputTokens: 2048 }`
  - `{ provider: "nim", model: "nvidia/nv-embedqa-e5-v5", dim: 1024, maxInputTokens: 512 }`
- Estender `EmbeddingProvider` pra `"openai" | "openrouter" | "gemini" | "nim"`
- Handlers `embedBatchGemini` / `embedBatchNim` em `embeddings.ts` — mesma forma do `embedBatch` da OpenAI, só URL/auth diferentes
- Settings RAG dropdown: 4 providers em vez de 2
- **Estimativa:** 1-2h de trabalho. Embeddings da Gemini têm tier free generoso (boa default pra users sem OpenAI key)

#### K.4.5 Whisper áudio (Módulo 6.4 follow-up) — ⬜
- Áudios já ficam salvos em `axxa-ai/recordings/{ts}.webm` (Sprint E v0.1.24)
- Falta pipeline: Whisper API (OpenAI) → transcrição → injetar como texto no composer / embedar no índice RAG
- Endpoint: `https://api.openai.com/v1/audio/transcriptions` com `multipart/form-data`
- 2 use cases:
  1. Botão "transcrever" no chip de áudio gravado → vira texto no composer
  2. Indexer reconhece áudios e roda Whisper → embed o texto pra busca RAG

#### K.4.6 README polish — ⬜ pequeno
- Mencionar os 6 providers (atualmente menciona só os 4 originais)
- Screenshot da UI nova (pills stacked + status line single-line + composer hug + plus modal v3)
- Quick start: gerar API key em cada lab, colar em Settings
- Comentário sobre Agent Mode + tool calling + Generation

### Tech debt conhecido (não bloqueia, mas vale endereçar)

- **`parseSimpleYaml` em chatPersistence** — regex line-by-line, frágil pra YAML real (multiline strings, nested objects, etc.). OK pra nosso frontmatter simples, mas se algum dia ficar mais rico considerar `js-yaml` ou similar. Hoje: zero issues
- **ConversationsList sem paginação** — `listAllChats(..., 1000)`. Em vaults com >1k chats fica lento (carrega todos no mount). Solução futura: virtual scrolling + paginação por scroll
- **`generateTitle()`** — simplista (primeira msg cortada em 60 chars). Poderia usar LLM pra resumir, mas custo de tokens + latência não compensa. Manter
- **NIM sem streaming real** — trade-off documentado. Aceitável até alguém pedir
- **Dead `RenameChatModal`** — modal criado em v0.1.34, usado por handleRenameChatSummary, REMOVIDO em v0.1.37. O arquivo ainda existe (`src/components/chat/RenameChatModal.ts`). Manter porque vai ser útil pra futuras telas (rename de skill, project, etc.) — ou deletar quando próxima sprint começar e ninguém usa
- **TypeScript path `*.tsx` vs `*.ts`** — Header virou `.tsx` mas tem outros componentes (`RenameChatModal.ts`, `useMessageContextMenu.ts`) que usam `.ts` apesar de ter JSX? Não — só `.tsx` tem JSX. OK
- **Mensagens do agent system prompt em PT hardcoded** — em AxxaApp:451 `AGENT_SYSTEM_PROMPT` tá em PT. Mover pro i18n quando EN-US ficar production

### Gotchas conhecidos pra próximo agente

1. **Sempre validar models via webfetch antes de hardcodar default** — bug do NIM 404 saiu disso. Especialmente NIM/Gemini que mudam catálogo rápido
2. **Switches por provider são lugar de bug** — quando adicionar provider 7, use o pattern `apiKeyFor/modelFor` em vez de duplicar switch
3. **`requestUrl` bypassa CORS, `fetch` não** — pra qualquer API que retorne CORS restritivo no browser, use requestUrl. Streaming real só funciona com fetch
4. **Obsidian aplica line-height global em buttons** — sempre setar `line-height:` explícito em buttons que viram cards/items
5. **`-webkit-line-clamp` é flaky em flex parents** — preferir single-line ellipsis quando bug aparecer
6. **`.cm-editor` clipa autocomplete tooltip** — usar `tooltips({ position: "fixed", parent: document.body })` do CodeMirror sempre que adicionar completion source nova
7. **Mobile keyboard handler é hand-tuned** — `.axxa-keyboard-open` é gerenciado pelo AxxaView, NÃO mexer no padding-bottom da view-content sem confirmar com dev
8. **Save por arquivo no indexer** — `SAVE_EVERY_N_FILES = 25` em rag/indexer.ts; mexer com cuidado (salvar a cada batch causava OOM em mobile)

### Como rodar / testar local

```bash
npm install
npm run build  # tsc -noEmit + esbuild production
npm run dev    # watch mode
```

Plugin output em `output/main.js` + `output/manifest.json` + `output/styles.css`. Pra testar no Obsidian local, copiar pro `<vault>/.obsidian/plugins/axxa-os-ai-agent/`.

### Como contribuir

- **NÃO criar `.md` de planning/docs além deste action plan + DESIGN-SYSTEM.md** — mantém repo enxuto
- **Commit message style:** `tipo(escopo): descrição (vX.Y.Z)` — ex: `feat(provider): Gemini API (v0.1.33)`, `fix(ux): título visível (v0.1.35)`
- **Sempre bumpar manifest.json + package.json juntos**
- **Build verde antes de commitar** — `npm run build` exit 0 obrigatório
- **Marcar tasks completed nesta tabela conforme avança** — adicionar entradas novas no fim das Decisões Técnicas

---

## Bugs e Issues Conhecidos
> Mover para GitHub Issues quando o repositório estiver criado

| # | Descrição | Módulo | Status |
|---|-----------|--------|--------|
| — | — | — | — |

---

*AXXA OS — AI Agent · Action Plan v1.6 · revisado 09/06/2026 pós-Sprint M (v0.1.74)*  
*"Cada módulo concluído é um passo irreversível."*