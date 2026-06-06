# AXXA OS — Action Plan
## Plano de Ação Modular · Revisão Contínua

> **Status:** 🟡 Em andamento — Módulo 0 ✅ · próximo: Módulo 1  
> **Versão:** 1.0  
> **Última revisão:** 05/06/2026  
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
- ⬜ Repositório `axxa-os-ai-agent` criado no GitHub (público)
- ✅ Template oficial `obsidianmd/obsidian-sample-plugin` — estrutura criada via prompt mestre (configs equivalentes ao template)
- ✅ `manifest.json` atualizado com dados do AXXA OS
- ✅ `AGENTS.md` criado na raiz (instruções para AI agents)
- 🟡 `README.md` inicial criado (pendente commitar)

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
- ⬜ `AxxaView.ts` — ItemView registrado no Obsidian (sidebar direita)
- ⬜ `AxxaApp.tsx` — React root montado dentro da view
- ⬜ Layout base: header + chat area + composer
- ⬜ Funciona no mobile (drawer lateral)

### 1.2 Composer básico
- ⬜ Campo de texto funcional
- ⬜ Enter envia, Shift+Enter quebra linha
- ⬜ Botão de enviar

### 1.3 Provider OpenAI
- ⬜ `providers/openai.ts` — chamada básica à API
- ⬜ API key configurável nas Settings
- ⬜ Resposta aparecendo na tela (sem streaming ainda)
- ⬜ Tratamento de erro (key inválida, sem conexão)

### 1.4 Streaming
- ⬜ SSE implementado para OpenAI
- ⬜ Texto aparecendo token a token
- ⬜ Indicador de loading ("digitando...")
- ⬜ Botão stop durante geração

### 1.5 Mensagens básicas
- ⬜ Bubble de usuário (direita)
- ⬜ Bubble do AI (esquerda)
- ⬜ Timestamp em cada mensagem
- ⬜ Day separator automático

### 1.6 Build de teste
- ⬜ `npm run build` gera arquivos na pasta `/output`
- ⬜ Plugin testado no Obsidian desktop
- ⬜ Plugin testado no Obsidian mobile
- ⬜ **🎯 MARCO:** Chat com OpenAI funcionando end-to-end

---

## MÓDULO 2 — Multi-Provider + Settings
> Objetivo: Todos os 4 providers do alpha funcionando

### 2.1 Session Modal
- ⬜ Modal abre antes do primeiro chat
- ⬜ Seleção de: Provider, Modelo, Modo, Effort
- ⬜ Configuração trava ao iniciar a sessão
- ⬜ Indicador visual do estado travado no header

### 2.2 Providers adicionais
- ⬜ `providers/anthropic.ts` — Claude models
- ⬜ `providers/openrouter.ts` — proxy multi-model
- ⬜ `providers/ollama.ts` — local LLM
- ⬜ `providers/base.ts` — interface comum para todos

### 2.3 Obsidian Settings Tab
- ⬜ `AxxaSettingsTab.ts` registrado no Obsidian
- ⬜ Seção: API Keys (OpenAI, Anthropic, OpenRouter)
- ⬜ Seção: Ollama endpoint configurável
- ⬜ Seção: Defaults (provider, model, mode, effort)
- ⬜ Seção: Vault paths (chats, skills, etc.)
- ⬜ Seção: Appearance (background, balloon style)

### 2.4 Effort Selector
- ⬜ 5 níveis: Low / Med / High / xHigh / Max
- ⬜ Mapeamento para max_tokens e temperatura por provider
- ⬜ Visível no Status Line

### 2.5 Status Line
- ⬜ Indicador de conexão (● verde / ● vermelho)
- ⬜ Provider + Model ativos
- ⬜ Modo atual
- ⬜ Context window usado / total
- ⬜ Tokens consumidos na sessão

### 2.6 Build de teste
- ⬜ Todos os providers testados com chaves reais
- ⬜ Settings persistidas após reabrir o Obsidian
- ⬜ **🎯 MARCO:** 4 providers funcionando com effort selector

---

## MÓDULO 3 — UI de Produção
> Objetivo: Visual que vai viralizar. Parece feature nativa do Obsidian.

### 3.1 Design System
- ⬜ CSS variables baseadas no tema Obsidian ativo
- ⬜ Paleta de cores própria não conflitante
- ⬜ Tipografia definida
- ⬜ Dark/light mode funcionando automaticamente

### 3.2 Composer completo (estilo ChatGPT)
- ⬜ Textarea auto-expande com o conteúdo
- ⬜ Botão 📎 attach (placeholder visual, funcional no módulo 5)
- ⬜ Botão 🎤 audio recorder (hold-to-record)
- ⬜ Botão ▶ send / ⬛ stop durante geração
- ⬜ Placeholder dinâmico por modo ("Pergunte sobre seu Vault...", etc.)

### 3.3 Mensagens avançadas
- ⬜ Markdown renderizado no output do AI
- ⬜ Code blocks com syntax highlighting
- ⬜ Botão "copiar" em code blocks
- ⬜ Long press / hover menu (copiar, favoritar, reenviar, deletar)
- ⬜ Favoritar mensagem ⭐ (persistido localmente)

### 3.4 Mobile
- ⬜ Drawer lateral responsivo
- ⬜ Toda interação testada com toque
- ⬜ Teclado virtual não quebra o layout
- ⬜ Scroll funcional no histórico

### 3.5 Backgrounds e temas
- ⬜ Background configurável (sólido / gradiente)
- ⬜ Compatibilidade verificada com tema Minimal
- ⬜ Compatibilidade verificada com tema default Obsidian

### 3.6 Build de teste
- ⬜ Screenshots tiradas para uso no lançamento
- ⬜ Demo video de 60 segundos gravado
- ⬜ **🎯 MARCO:** UI pronta para screenshots públicas

---

## MÓDULO 4 — Persistência e Vault Q&A
> Objetivo: Chats salvos. Primeira integração real com o Vault.

### 4.1 Estrutura de pastas no Vault
- ⬜ `.axxa/` criada automaticamente no primeiro uso
- ⬜ Subpastas: `chats/`, `skills/`, `logs/`, `index/`
- ⬜ Paths configuráveis nas Settings com folder picker

### 4.2 Chats como Markdown
- ⬜ Cada conversa salva como `.md` em `.axxa/chats/[modo]/`
- ⬜ Frontmatter correto: title, date, mode, provider, model, effort, tokens
- ⬜ Histórico de mensagens formatado em Markdown
- ⬜ Last Chats view (lista dos chats recentes)

### 4.3 Vault Q&A básico (context stuffing)
- ⬜ Modo Vault Q&A ativo no session modal
- ⬜ Notas relevantes injetadas no contexto (busca por keywords)
- ⬜ Indicador visual de "usando X notas como contexto"
- ⬜ Limite de contexto respeitado por effort level

### 4.4 Multilanguage
- ⬜ PT-BR como padrão
- ⬜ EN-US disponível
- ⬜ Strings externalizadas em arquivos de locale
- ⬜ Detecção automática pelo locale do sistema

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

### 6.4 Vault Q&A com RAG real
- ⬜ LanceDB integrado localmente
- ⬜ Indexação incremental automática
- ⬜ Embeddings via OpenAI ou Ollama (local)
- ⬜ Pasta de indexação configurável

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

---

## Bugs e Issues Conhecidos
> Mover para GitHub Issues quando o repositório estiver criado

| # | Descrição | Módulo | Status |
|---|-----------|--------|--------|
| — | — | — | — |

---

*AXXA OS — AI Agent · Action Plan v1.0*  
*"Cada módulo concluído é um passo irreversível."*