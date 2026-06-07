# AXXA OS — Action Plan
## Plano de Ação Modular · Revisão Contínua

> **Status:** 🟡 Em andamento — Módulos 0 ✅, 1 ✅, 2 ✅, 3 ✅, 4 ✅, 6.4 ✅ RAG **multimodal** (texto + imagem) · próximo: Sprint G — Agent Mode (6.1+6.2)  
> **Versão:** 1.0 · plugin em v0.1.27  
> **Última revisão:** 07/06/2026  
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
- ✅ `providers/ollama.ts` — local LLM (NDJSON streaming via /api/chat, listModels via /api/tags, sem auth)
- ✅ `providers/base.ts` — interface comum (chat + streamChat obrigatórios)
- ✅ `providers/index.ts` — registry + getProvider(id) com 4 providers registrados

### 2.3 Obsidian Settings Tab
- ✅ `AxxaSettingsTab.ts` registrado no Obsidian (**5 sub-tabs: OpenAI/Anthropic/OpenRouter/Ollama/Outros** — v0.1.22)
- ✅ Provider padrão sempre visível acima das tabs + bolinha colorida no tab do padrão
- ✅ Seção API Keys (OpenAI ✅, Anthropic ✅, OpenRouter ✅) + botão "↻ Buscar modelos" via API
- ✅ Ollama endpoint configurável + listModels via `/api/tags`
- ✅ Defaults: provider (dropdown 4 opções), model (por provider), effort (placeholder via PlusModal), mode (via StarterScreen)
- ✅ Vault paths (chatsPath, skillsPath na tab Outros)
- ✅ **Modelos ativos por provider** — curadoria de qual modelo aparece no seletor da StarterScreen. Pills removíveis + input manual (suporta legacy) + "Buscar API" com checkboxes (v0.1.19)
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

### 6.1 Sistema de permissões
- ⬜ `PermissionsManager.ts` implementado
- ⬜ Comando `/permissions basic` — pede confirmação
- ⬜ Comando `/permissions vault` — leitura/escrita livre
- ⬜ Comando `/permissions yolo` — acesso total
- ⬜ Modal de confirmação para ações destrutivas (modo basic)
- ⬜ Log em `.axxa/logs/agent.md`

### 6.2 Agent Mode
- ⬜ Criar, editar, mover, renomear arquivos
- ⬜ Deletar com confirmação (sempre, independente de permissão)
- ⬜ Criar e organizar pastas
- ⬜ Operações semânticas ("mova todas as notas sobre X para Y")

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

---

## Bugs e Issues Conhecidos
> Mover para GitHub Issues quando o repositório estiver criado

| # | Descrição | Módulo | Status |
|---|-----------|--------|--------|
| — | — | — | — |

---

*AXXA OS — AI Agent · Action Plan v1.0*  
*"Cada módulo concluído é um passo irreversível."*