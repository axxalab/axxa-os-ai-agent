# AXXA OS — AI Agent
## Estrutura Completa do Projeto | Plugin Obsidian

> **Versão do Documento:** 1.0  
> **Status:** Pré-desenvolvimento — Aprovação e Alinhamento  
> **Stack:** TypeScript · Obsidian Plugin API · esbuild · React (UI interna)

---

## 1. VISÃO GERAL

**AXXA OS** é um ecossistema operacional para gestão da vida. O **AI Agent** é o core desse sistema — um plugin nativo para Obsidian que traz um assistente de IA completo diretamente integrado ao Vault, com modos de operação distintos, gestão de arquivos, memória contextual e expansão via MCP.

### Identidade do Produto

| Atributo | Valor |
|---|---|
| Nome Público | AXXA OS — AI Agent |
| ID do Plugin | `axxa-os-ai-agent` |
| Plataforma | Obsidian Community Plugins |
| Modelo de Negócio | Free + Premium (Stripe) |
| Target | Mobile First (iOS/Android), Desktop compatível |
| Filosofia de UI | Native Obsidian feel — como se fosse feature nativa |

---

## 2. PROVIDERS SUPORTADOS

### Alpha (v0.1)
| Provider | Tipo | Auth |
|---|---|---|
| OpenAI | Cloud | BYOK (API Key) |
| Anthropic | Cloud | BYOK (API Key) |
| OpenRouter | Cloud Proxy | BYOK (API Key) |
| Ollama / LLaMA | Local | Endpoint configurável |

### Futuro (v0.3+)
- Google Gemini
- Groq
- Azure OpenAI
- Cohere

### Regra de Sessão
Uma vez iniciado o chat, **provider, modelo, modo e effort ficam travados** para aquela sessão. Mudanças só se aplicam a novos chats.

---

## 3. MODOS DE OPERAÇÃO

### 3.1 CHAT
- Conversacional clássico
- Sem acesso ao Vault por padrão
- Histórico persistido como `.md` em `.axxa/chats/`

### 3.2 VAULT Q&A
- RAG local com indexação vetorial do Vault
- **Stack de indexação:** LanceDB (embutido, zero-config)
- Suporte a: Notes, PDFs (texto), imagens (metadados), áudio (metadados)
- Reindexação incremental automática ao detectar mudanças no Vault
- Pastas indexadas configuráveis nas Settings (com search vinculado às pastas existentes)

### 3.3 AGENT
- Acesso semântico a qualquer tema de arquivo no Vault
- Operações: criar, editar, mover, renomear, deletar arquivos e pastas
- Governado pelo sistema de permissões `/permissions`
- Confirmações inline antes de ações destrutivas (conforme nível)

### 3.4 CODER
- Acesso restrito a arquivos de código (`.js`, `.ts`, `.py`, `.css`, `.json`, etc.)
- Mesmo sistema de permissões do AGENT
- Syntax highlighting no output
- Diff preview antes de aplicar edições

---

## 4. SISTEMA DE PERMISSÕES

Inspirado no modelo Claude Code / Codex. Três níveis:

```
/permissions basic   → Pede confirmação para cada ação (padrão)
/permissions vault   → Leitura e escrita livre no Vault (sem confirmações)
/permissions yolo    → Acesso total, incluindo arquivos ocultos e dotfiles (.)
```

### Escopo de Configuração
- **Global:** configurável nas Obsidian Settings do plugin
- **Por sessão:** via comando `/permissions [nível]` no chat
- **Log de ações:** cada operação de escrita/deleção é registrada em `.axxa/logs/agent.md`

---

## 5. SISTEMA DE ÁUDIO

| Função | Solução |
|---|---|
| Transcrição (STT) | **Whisper** (OpenAI) — default |
| Fallback local | **Whisper.cpp / local TTS** |
| Input | Gravar áudio direto no campo de texto |
| Output | Text-to-speech (futuro) |
| Configuração | Painel dedicado em Settings → Audio |

---

## 6. MEDIA INDEX

| Tipo | Alpha | Premium Futuro |
|---|---|---|
| Notes (.md) | ✅ Indexado + RAG | — |
| Folders | ✅ Estrutura mapeada | — |
| Text files | ✅ Indexado | — |
| Images | ✅ Referência/metadados | 🔒 OCR + análise visual |
| Videos | ✅ Referência (título, path, duração) | 🔒 Transcrição automática |
| Áudio | ✅ Referência (título, path, duração) | 🔒 Transcrição automática |

---

## 7. EFFORT SELECTOR

Mapeamento de temperatura e profundidade de raciocínio:

| Nível | Descrição | Tokens Aprox. |
|---|---|---|
| Low | Rápido, direto | ~500 |
| Med | Balanceado | ~1.500 |
| High | Detalhado | ~4.000 |
| xHigh | Aprofundado, multi-etapas | ~8.000 |
| Max | Exaustivo, reasoning completo | ~16.000+ |

---

## 8. UI / UX — INTERFACE PRINCIPAL

### 8.1 Posicionamento
- **Sempre na sidebar direita** (desktop e mobile)
- Mobile: abre como **drawer lateral** — toda a gestão do frontend do plugin acontece nesse drawer
- Detecção automática de mobile/desktop para adaptar comportamentos

### 8.2 Layout Principal (ChatGPT Composer Style)

```
┌─────────────────────────────────┐
│  [AXXA OS] ⚡ Model • Mode      │  ← Header com status
├─────────────────────────────────┤
│                                 │
│   Área de mensagens             │
│   (scrollable, WhatsApp-like)   │
│                                 │
│   [Hoje, 14:32] ─────────       │  ← Day separators
│                                 │
│   ┌──────────────────────┐      │
│   │ Mensagem do usuário  │      │  ← Balloons (resizable)
│   └──────────────────────┘      │
│                                 │
│   ┌──────────────────────┐      │
│   │ Resposta do AI       │      │
│   └──────────────────────┘      │
│                                 │
├─────────────────────────────────┤
│ [Status] model • mode • tokens  │  ← Status line
├─────────────────────────────────┤
│  📎  [  Campo de texto...  ] 🎤 │  ← Composer
│                          [Send] │
└─────────────────────────────────┘
```

### 8.3 Composer (campo de texto)
- Igual ao ChatGPT em comportamento e feel
- Expande verticalmente conforme o texto cresce
- Shift+Enter = nova linha / Enter = enviar
- Botão 📎 = attach (arquivos do Vault ou upload)
- Botão 🎤 = gravar áudio (hold-to-record, igual WhatsApp)
- Botão ▶ = enviar (muda para stop durante geração)

### 8.4 Mensagens
- Balloons resizáveis
- Long press / hover = menu de ações (copiar, favoritar ⭐, reenviar, deletar)
- Day separators automáticos ("Hoje", "Ontem", "dd/mm")
- Markdown renderizado no output do AI
- Code blocks com syntax highlight e botão de copy

### 8.5 Status Line
Localização: **dentro do plugin, logo acima ou abaixo do composer** (estilo GPT Codex)

```
● Connected | claude-opus-4 | Agent | 42k/128k ctx | 1,234 tokens used
```

### 8.6 Backgrounds
- Configurável: cor sólida, gradiente suave, ou textura (respeitando o tema Obsidian ativo)
- CSS variables para não quebrar temas como Minimal

---

## 9. ESTRUTURA DE PASTAS DO VAULT (Default)

```
📁 .axxa/                          ← Pasta raiz do plugin (oculta)
├── 📁 chats/                      ← Histórico de conversas
│   ├── 2025-06-05-chat-001.md
│   └── 2025-06-05-qa-002.md
├── 📁 projects/                   ← Projetos vinculados a chats
│   └── [project-name]/
├── 📁 skills/                     ← Skills criadas pelo usuário
│   ├── revisor-de-texto.md
│   └── programador-python.md
├── 📁 logs/                       ← Logs de operações do Agent
│   └── agent.md
├── 📁 exports/                    ← Skills exportadas
├── 📁 index/                      ← Index vetorial (LanceDB)
│   └── vault.lancedb
└── 📄 permissions.md              ← Arquivo de permissões da sessão
```

> **Todos os paths são configuráveis nas Settings.** O search de pastas é vinculado às pastas existentes no Vault para facilitar a seleção.

---

## 10. FORMATO DOS CHATS SALVOS

Cada output/conversa gera um `.md` com frontmatter estruturado:

```yaml
---
title: "Conversa sobre arquitetura do plugin"
date: 2025-06-05T14:32:00
mode: agent
provider: anthropic
model: claude-opus-4-6
effort: high
projects:
  - "[[AXXA OS]]"
tags:
  - axxa-chat
  - agent
  - architecture
favorite: false
tokens_used: 2847
---
```

---

## 11. SKILL MANAGEMENT

### O que é uma Skill
Uma skill é um **system prompt customizado** com metadados, que define comportamento, tom e capacidades do modelo para um contexto específico.

### Estrutura de uma Skill (.md)

```yaml
---
skill-name: "Revisor de Texto PT-BR"
description: "Revisa textos em português com foco em clareza e coesão"
mode: chat
provider: any
language: pt-br
version: 1.0
tags: [escrita, revisão, português]
---

Você é um revisor de textos especializado...
[conteúdo do system prompt]
```

### Interface de Skills
- Tela própria dentro de **Settings → Skills**
- CRUD completo (criar, editar, duplicar, deletar)
- Import/Export em `.md` ou `.html`
- Preview do system prompt
- Vincular skill a um modo específico

---

## 12. PROJECT MANAGEMENT

- **Cada chat pode ser vinculado a múltiplos projetos**
- Projetos são identificados como wikilinks `[[Nome do Projeto]]` no frontmatter
- No chat, comando `/project [nome]` vincula o chat ao projeto
- A pasta do projeto no Vault pode ser indexada automaticamente ao vincular
- View "Last Chats" mostra histórico filtrado por projeto

---

## 13. MCP CONNECT (v0.2 — Primeiro Update Pós-Alpha)

### Integrações Planejadas
| Serviço | Read | Write |
|---|---|---|
| Notion | ✅ | ✅ |
| ClickUp | ✅ | ✅ |
| Figma | ✅ | ✅ |
| Google Drive | ✅ | ✅ |
| Linear | ✅ | ✅ |
| GitHub | ✅ | ✅ |

### Modelo de Autenticação
- OAuth por serviço, tokens armazenados no Obsidian keystore
- Configurado em **Settings → Integrations**
- Por sessão, o usuário pode habilitar/desabilitar integrações

---

## 14. MULTILANGUAGE

- PT-BR (default para AXXA)
- EN-US
- Detecção automática pelo locale do sistema
- Override manual nas Settings

---

## 15. PREMIUM / STRIPE

### Free (Community)
- Todos os modos (CHAT, Q&A, AGENT, CODER)
- BYOK todos os providers listados
- Skills ilimitadas
- Histórico ilimitado local
- Media Index (referência)

### Premium (via Stripe)
- Login with Google (sync entre devices)
- Media transcrição automática (vídeo/áudio)
- Priority support
- [Reservado para futuras features]

### Modelo de Auth
- Stripe Checkout para pagamento
- Login with Google (OAuth) para sessão
- Token JWT armazenado no plugin
- Verificação de licença no startup

---

## 16. OBSIDIAN SETTINGS (Painel Oficial)

Dentro de **Obsidian → Settings → Community Plugins → AXXA OS AI Agent:**

```
AXXA OS — AI Agent Settings
├── 🔑 API Keys & Providers
│   ├── OpenAI API Key
│   ├── Anthropic API Key
│   ├── OpenRouter API Key
│   └── Ollama Endpoint
│
├── 🎯 Default Preferences
│   ├── Default Provider
│   ├── Default Model
│   ├── Default Mode
│   ├── Default Effort
│   └── Default Language
│
├── 📁 Vault Storage
│   ├── Chats Folder Path [search picker]
│   ├── Skills Folder Path [search picker]
│   ├── Projects Folder Path [search picker]
│   └── Logs Folder Path [search picker]
│
├── 🔒 Permissions
│   └── Default Permission Level [basic/vault/yolo]
│
├── 🎤 Audio
│   ├── STT Provider [Whisper / Local / Custom]
│   └── Whisper API Key (se diferente do OpenAI principal)
│
├── 🎨 Appearance
│   ├── Chat Background
│   ├── Message Balloon Style
│   └── Status Line Position
│
├── 🧠 Skills
│   └── [Gerenciar Skills →]
│
├── 🔌 Integrations (MCP)
│   └── [Configurar Integrações →]
│
└── 👤 Account
    ├── Login with Google
    └── Subscription Status
```

---

## 17. STACK TÉCNICA

### Core
| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript 5.x |
| Build | esbuild (template oficial Obsidian) |
| API Base | Obsidian Plugin API (ItemView, WorkspaceLeaf) |
| UI Interna | React 18 + CSS Modules |
| State | Zustand |
| Indexação | LanceDB (embutido) |
| Embeddings | OpenAI text-embedding-3-small / Ollama local |

### AI / LLM
| Camada | Tecnologia |
|---|---|
| HTTP Client | Fetch nativo (sem axios) |
| Streaming | SSE (Server-Sent Events) |
| Providers | OpenAI SDK compatível para todos |
| Audio STT | Whisper API / Whisper.cpp |

### Storage / Persistência
| Camada | Tecnologia |
|---|---|
| Dados do plugin | `plugin.loadData()` / `plugin.saveData()` (Obsidian nativo) |
| Chats | `.md` files no Vault |
| Skills | `.md` files no Vault |
| Vetores | LanceDB local no `.axxa/index/` |
| Secrets | Obsidian SecretStorage API |

### Premium / Auth
| Camada | Tecnologia |
|---|---|
| Pagamento | Stripe Checkout (link externo) |
| Auth | Google OAuth 2.0 |
| Backend mínimo | Supabase (auth + license validation) |
| Token | JWT verificado no plugin startup |

---

## 18. ESTRUTURA DE ARQUIVOS DO PLUGIN

```
axxa-os-ai-agent/
├── src/
│   ├── main.ts                    ← Entry point (extends Plugin)
│   ├── views/
│   │   ├── AxxaView.ts            ← ItemView principal (sidebar)
│   │   └── AxxaView.tsx           ← React root do panel
│   │
│   ├── components/
│   │   ├── ChatPanel/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── DaySeparator.tsx
│   │   │   └── FavoriteBar.tsx
│   │   ├── Composer/
│   │   │   ├── Composer.tsx
│   │   │   ├── AttachButton.tsx
│   │   │   ├── AudioRecorder.tsx
│   │   │   └── SendButton.tsx
│   │   ├── StatusLine/
│   │   │   └── StatusLine.tsx
│   │   ├── ModeSelector/
│   │   │   └── ModeSelector.tsx
│   │   ├── SkillsManager/
│   │   │   └── SkillsManager.tsx
│   │   └── SettingsTab/
│   │       └── AxxaSettingsTab.ts  ← Obsidian PluginSettingTab
│   │
│   ├── providers/
│   │   ├── index.ts
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   ├── openrouter.ts
│   │   └── ollama.ts
│   │
│   ├── modes/
│   │   ├── chat.ts
│   │   ├── vaultQA.ts
│   │   ├── agent.ts
│   │   └── coder.ts
│   │
│   ├── vault/
│   │   ├── VaultManager.ts        ← CRUD de arquivos
│   │   ├── VaultIndexer.ts        ← LanceDB indexing
│   │   ├── PermissionsManager.ts  ← /permissions logic
│   │   └── ProjectLinker.ts       ← Frontmatter + wikilinks
│   │
│   ├── skills/
│   │   ├── SkillsManager.ts
│   │   └── SkillParser.ts
│   │
│   ├── audio/
│   │   ├── AudioRecorder.ts
│   │   └── WhisperSTT.ts
│   │
│   ├── auth/
│   │   ├── StripeAuth.ts
│   │   └── GoogleAuth.ts
│   │
│   ├── store/
│   │   ├── chatStore.ts           ← Zustand
│   │   ├── settingsStore.ts
│   │   └── sessionStore.ts
│   │
│   ├── types/
│   │   ├── index.ts
│   │   ├── providers.ts
│   │   ├── messages.ts
│   │   └── skills.ts
│   │
│   └── utils/
│       ├── formatters.ts
│       ├── markdown.ts
│       └── mobile.ts              ← Mobile detection helpers
│
├── styles/
│   └── main.css                   ← CSS variables, respeita tema Obsidian
│
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── AGENTS.md                      ← Instructions para AI coding agents
```

---

## 19. ROADMAP DE DESENVOLVIMENTO

### 🔴 ALPHA — v0.1 (MVP)
**Objetivo:** Plugin funcional e publicável no Community Plugins

| Feature | Prioridade |
|---|---|
| Sidebar view (ItemView) — desktop + mobile drawer | 🔴 P0 |
| Chat mode com OpenAI | 🔴 P0 |
| Streaming de respostas | 🔴 P0 |
| Salvar chats como .md no Vault | 🔴 P0 |
| Settings básico (API key, provider, model) | 🔴 P0 |
| Chat mode com Anthropic | 🔴 P0 |
| Chat mode com OpenRouter | 🔴 P1 |
| Chat mode com Ollama local | 🔴 P1 |
| Effort selector (Low → Max) | 🔴 P1 |
| Status line | 🔴 P1 |
| Day separators no chat | 🔴 P1 |
| Composer estilo GPT (resize, enter/shift) | 🔴 P1 |
| Markdown rendering no output | 🔴 P1 |
| Mensagens favoritas ⭐ | 🔴 P2 |
| Last chats view | 🔴 P2 |
| Vault Q&A básico (context stuffing) | 🔴 P2 |
| Background configurável | 🔴 P2 |
| Multilanguage PT-BR/EN | 🔴 P2 |

### 🟡 v0.2 — Primeiro Update Pós-Alpha
| Feature | Prioridade |
|---|---|
| AGENT mode completo | 🟡 |
| CODER mode completo | 🟡 |
| Sistema de permissões `/permissions` | 🟡 |
| Vault Q&A com LanceDB (RAG real) | 🟡 |
| Skills management (UI + CRUD) | 🟡 |
| Audio record + Whisper STT | 🟡 |
| Project management + wikilinks | 🟡 |
| MCP Connect (Notion + ClickUp) | 🟡 |
| Attach files do Vault | 🟡 |
| Log de ações do agent | 🟡 |

### 🟢 v0.3 — Features Avançadas
| Feature | Prioridade |
|---|---|
| MCP Connect (Figma + Google Drive + GitHub) | 🟢 |
| Premium / Stripe / Google Login | 🟢 |
| Media Index (transcrição vídeo/áudio) | 🟢 |
| Skills import/export | 🟢 |
| Reindexação incremental automática | 🟢 |
| Mobile UX polish completo | 🟢 |
| Themes (WhatsApp bg, etc.) | 🟢 |

### 🔵 v1.0 — Release Público
| Feature | Prioridade |
|---|---|
| Compatibilidade verificada com top 20 plugins | 🔵 |
| Plugin review scorecard Obsidian limpo | 🔵 |
| Documentação completa | 🔵 |
| Site de landing AXXA OS | 🔵 |
| Changelog público | 🔵 |

---

## 20. REGRAS DE DESENVOLVIMENTO (para o Vibe Coding com Claude)

1. **Sempre basear no template oficial** `obsidianmd/obsidian-sample-plugin`
2. **Não usar axios** — fetch nativo apenas
3. **Não usar React fora da UI interna** — lógica de Vault usa API Obsidian pura
4. **CSS Variables obrigatório** — usar `var(--background-primary)`, `var(--text-normal)`, etc. do tema ativo
5. **Mobile first** — testar todo componente no contexto de drawer antes do desktop
6. **Nunca usar `eval()` ou `innerHTML` direto** — requisito do plugin review
7. **Secrets sempre via `SecretStorage`** — nunca em `localStorage`
8. **Sem dependências externas desnecessárias** — bundle size é crítico para Obsidian mobile
9. **AGENTS.md na raiz** — instruções para qualquer AI agent que trabalhar no projeto
10. **Commits semânticos** — `feat:`, `fix:`, `refactor:`, `docs:` etc.

---

## 21. MANIFEST.JSON (Base)

```json
{
  "id": "axxa-os-ai-agent",
  "name": "AXXA OS — AI Agent",
  "version": "0.1.0",
  "minAppVersion": "1.4.0",
  "description": "AI Agent nativo para seu Vault. Chat, Q&A, Agent e Coder modes com suporte a múltiplos providers.",
  "author": "Axxa Lab",
  "authorUrl": "https://axxa.lab",
  "fundingUrl": "https://axxa.lab/support",
  "isDesktopOnly": false
}
```

> `isDesktopOnly: false` — obrigatório para mobile support

---

## 22. DECISÕES DE ARQUITETURA — JUSTIFICATIVAS

| Decisão | Alternativa Descartada | Motivo |
|---|---|---|
| LanceDB para RAG | ChromaDB, Pinecone | Zero-config, embutido, sem servidor |
| React para UI | Svelte, Vue, DOM puro | Ecossistema, componentização, state management |
| Zustand para state | Redux, Context | Leve, sem boilerplate, ideal para plugins |
| esbuild | Vite, Webpack | Template oficial Obsidian, menor bundle |
| Supabase para auth | Firebase, backend próprio | Auth + DB mínimo, sem ops |
| Stripe Checkout | PayPal, outro gateway | Mais usado por devs indie, fácil integração |
| MD para skills/chats | SQLite, JSON | Nativo Obsidian, editável pelo usuário, versionável |

---

*Documento gerado para vibe coding com Claude — AXXA Lab*
*Próximo passo: Setup do repositório + scaffold do plugin*