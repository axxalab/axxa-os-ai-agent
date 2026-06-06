# AXXA OS — MASTER PLAN
## Do Zero ao Primeiro Milhão: O Plano Completo

> **Documento vivo** — atualizado a cada sprint  
> **Câmbio de referência:** R$ 5,06/USD (Banco Central, 05/06/2026)  
> **Fase atual:** Pré-desenvolvimento — Dia 0  
> **Missão:** Construir o sistema operacional da vida moderna, começando pelo AI Agent

---

# PARTE I — A EMPRESA

## 1.1 O que é a AXXA?

A AXXA não é uma empresa de plugin. É uma empresa de infraestrutura cognitiva.

O AI Agent para Obsidian é o **seed product** — o ponto de entrada que vai
provar a visão, gerar receita, construir audiência e validar o ecossistema.
Mas a visão é maior: AXXA OS como o sistema operacional completo para
gestão da vida e do trabalho para criadores, designers e profissionais de
conhecimento.

**Tagline:** *The OS for your mind.*

---

## 1.2 Visão em 3 horizontes

### Horizonte 1 — Agora (2026)
Plugin Obsidian como produto principal. Audiência sendo construída.
Primeira receita. Prova de conceito do ecossistema.

### Horizonte 2 — 2027
AXXA OS como plataforma multi-produto: plugin + templates + comunidade +
cursos. Primeiros contratos B2B. Time de 2–3 pessoas.

### Horizonte 3 — 2028+
AXXA OS como sistema independente de Obsidian. App próprio.
Possível fundraise ou acqui-hire estratégico. $10M ARR target.

---

## 1.3 Posicionamento competitivo

| Produto | Pontos Fortes | Fraqueza fatal |
|---------|--------------|----------------|
| Obsidian Copilot | 1,4M downloads, pioneiro | UI mediana, sem mobile focus |
| Smart Connections | RAG sólido | Complexo, visual antigo |
| ChatGPT no browser | Familiar | Fora do Vault, sem contexto |
| **AXXA OS AI Agent** | **Design excepcional, mobile-first, ecossistema** | **Chegou depois** |

**Seu moat real:** Você é UX. Você entrega o que os outros não conseguem —
um produto que as pessoas amam usar, não só usar.

---

# PARTE II — TOOLSTACK E ASSINATURAS

## 2.1 Stack de desenvolvimento (o que assinar e quando)

### Agora — Dia 1 (obrigatório para começar)

| Ferramenta | Plano | Custo/mês | Para quê |
|------------|-------|-----------|----------|
| **Claude Pro** | Pro | $20 | Vibe coding diário, arquitetura, código |
| **GitHub** | Free | $0 | Repositório do plugin (público) |
| **Node.js** | Free | $0 | Runtime para desenvolvimento |
| **VS Code** | Free | $0 | Editor de código |
| **Obsidian** | Free | $0 | Testar o plugin enquanto constrói |

**Custo total Dia 1: $20/mês (~R$ 101)**

---

### Mês 2–3 (ao lançar o alpha)

| Ferramenta | Plano | Custo/mês | Para quê |
|------------|-------|-----------|----------|
| **Claude Max 5x** | Max | $100 | Sessões longas de vibe coding sem interrupção |
| **Supabase** | Free → Pro | $0–$25 | Auth + DB para premium users |
| **Stripe** | Pay-as-you-go | ~1% + fees | Pagamentos dos assinantes |
| **Vercel** | Hobby | $0 | Landing page AXXA OS |
| **Figma** | Starter | $15 | UI do plugin (você já usa) |

**Custo total Mês 2–3: ~$140/mês (~R$ 708)**

---

### Por que Claude Max e não só Pro?

Pro ($20): ~17.500 tokens por janela de 5h. Bom para começar.
Max 5x ($100): ~88.000 tokens por janela de 5h. Para sessões de vibe
coding pesado — uma tarde inteira de construção sem bater no limite.

Um desenvolvedor reportou usar 10 bilhões de tokens em 8 meses.
Com API direta isso custaria $15.000+. Com Max $100/mês, foram $800.
Para o contexto do plugin, Max 5x é o sweet spot custo-benefício.

**Upgrade para Max quando:** Você começar a bater no limite do Pro
mais de 3 vezes por semana. Isso vai acontecer no mês 1-2.

---

## 2.2 Stack de marketing e conteúdo (gratuito para começar)

| Canal | Custo | Quando ativar |
|-------|-------|---------------|
| X/Twitter | $0 | Dia 1 |
| LinkedIn | $0 | Dia 1 |
| GitHub (público) | $0 | Dia 1 |
| YouTube | $0 | Mês 2 |
| Reddit (r/ObsidianMD) | $0 | No launch |
| Newsletter (Beehiiv free) | $0 | Mês 3 |

---

# PARTE III — ESTRUTURA DO PROJETO

## 3.1 O que é scaffold (explicado de vez)

Scaffold é o esqueleto inicial do projeto. É o momento em que você
executa os primeiros comandos no terminal e o plugin passa a existir —
mesmo sem fazer nada útil ainda.

**Analogia de design:** É como criar um novo arquivo no Figma,
configurar os frames, definir o grid e as variáveis de cor.
Você ainda não tem uma tela pronta, mas o ambiente está preparado.

**O que o scaffold entrega:**
- Repositório no GitHub criado e configurado
- Template oficial do Obsidian clonado
- Arquivos de configuração ajustados (manifest.json, tsconfig, esbuild)
- Plugin aparecendo na lista de Community Plugins do Obsidian local
- Primeiro "Hello World" aparecendo na sidebar direita

Isso acontece em uma tarde de trabalho. É o nosso primeiro objetivo.

---

## 3.2 Estrutura de arquivos completa do projeto

```
axxa-os-ai-agent/
│
├── .github/
│   └── workflows/
│       └── release.yml          ← Deploy automático no GitHub Releases
│
├── src/
│   ├── main.ts                  ← Entry point — onde tudo começa
│   │
│   ├── views/
│   │   ├── AxxaView.ts          ← Registra a sidebar no Obsidian
│   │   └── AxxaApp.tsx          ← Root do React — monta a UI
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx       ← Logo, model selector, mode selector
│   │   │   └── StatusLine.tsx   ← Connection • Model • Tokens usados
│   │   │
│   │   ├── chat/
│   │   │   ├── ChatPanel.tsx    ← Container do histórico de mensagens
│   │   │   ├── MessageBubble.tsx ← Cada mensagem (user ou AI)
│   │   │   ├── DaySeparator.tsx ← "Hoje", "Ontem", "05/06"
│   │   │   └── TypingIndicator.tsx ← Animação enquanto AI responde
│   │   │
│   │   ├── composer/
│   │   │   ├── Composer.tsx     ← Campo de texto + botões
│   │   │   ├── AttachMenu.tsx   ← Picker de arquivos do Vault
│   │   │   └── AudioRecorder.tsx ← Hold-to-record estilo WhatsApp
│   │   │
│   │   ├── modals/
│   │   │   ├── SessionModal.tsx ← Escolhe provider/model/mode ao iniciar
│   │   │   └── PermissionModal.tsx ← Confirma ações do Agent (modo basic)
│   │   │
│   │   └── settings/
│   │       ├── AxxaSettingsTab.ts ← Painel oficial do Obsidian Settings
│   │       └── SkillsEditor.tsx  ← Tela de criação/edição de Skills
│   │
│   ├── providers/
│   │   ├── base.ts              ← Interface comum para todos os providers
│   │   ├── openai.ts            ← OpenAI + streaming
│   │   ├── anthropic.ts         ← Anthropic + streaming
│   │   ├── openrouter.ts        ← OpenRouter (proxy multi-model)
│   │   └── ollama.ts            ← Ollama local
│   │
│   ├── modes/
│   │   ├── chat.ts              ← Modo conversacional
│   │   ├── vaultQA.ts           ← RAG + perguntas sobre o Vault
│   │   ├── agent.ts             ← Leitura/escrita semântica no Vault
│   │   └── coder.ts             ← Operações em arquivos de código
│   │
│   ├── vault/
│   │   ├── VaultManager.ts      ← CRUD de arquivos via Obsidian API
│   │   ├── VaultIndexer.ts      ← Indexação vetorial com LanceDB
│   │   ├── PermissionsManager.ts ← Lógica basic/vault/yolo
│   │   └── ChatPersister.ts     ← Salva conversas como .md
│   │
│   ├── skills/
│   │   ├── SkillsManager.ts     ← Carrega, cria, edita skills
│   │   └── SkillParser.ts       ← Lê frontmatter das skills .md
│   │
│   ├── audio/
│   │   ├── AudioRecorder.ts     ← Web Audio API
│   │   └── WhisperSTT.ts        ← Transcrição via Whisper API
│   │
│   ├── auth/
│   │   ├── PremiumAuth.ts       ← Verifica licença Stripe/Supabase
│   │   └── GoogleAuth.ts        ← Login Google para sync
│   │
│   ├── store/
│   │   ├── chatStore.ts         ← Estado do chat (Zustand)
│   │   ├── sessionStore.ts      ← Provider, model, mode — travados por sessão
│   │   └── settingsStore.ts     ← Configurações persistidas
│   │
│   ├── types/
│   │   ├── index.ts             ← Exporta todos os tipos
│   │   ├── messages.ts          ← Message, Role, Content
│   │   ├── providers.ts         ← Provider, Model, APIConfig
│   │   └── skills.ts            ← Skill, SkillMeta
│   │
│   └── utils/
│       ├── mobile.ts            ← Detecta mobile, adapta layout
│       ├── markdown.ts          ← Helpers de renderização
│       ├── tokens.ts            ← Conta e formata tokens
│       └── frontmatter.ts       ← Gera/lê frontmatter dos .md
│
├── styles/
│   └── main.css                 ← Design system próprio + CSS variables Obsidian
│
├── manifest.json                ← Metadados do plugin para o Obsidian
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── AGENTS.md                    ← Instruções para Claude Code e outros AI agents
└── README.md
```

---

## 3.3 Vault default do plugin

```
.axxa/                    ← Pasta oculta — root de tudo
├── chats/                ← Uma subpasta por modo
│   ├── chat/
│   ├── qa/
│   ├── agent/
│   └── coder/
├── skills/               ← System prompts salvos como .md
├── projects/             ← Projetos vinculados a conversas
├── logs/
│   └── agent.md          ← Log de todas as ações do Agent
├── index/
│   └── vault.lancedb     ← Índice vetorial local
└── permissions.md        ← Nível de permissão da sessão atual
```

---

# PARTE IV — ROADMAP DE DESENVOLVIMENTO

## Semana a semana — os primeiros 90 dias

### SPRINT 0 — Semana 1: O Scaffold
**Objetivo:** Plugin existindo no Obsidian

```
Dia 1  → Criar conta GitHub, clonar template oficial obsidianmd/obsidian-sample-plugin
Dia 2  → Configurar ambiente Node.js, rodar npm install, primeiro build
Dia 3  → Plugin aparecendo na sidebar do Obsidian (hello world)
Dia 4  → Renomear para AXXA OS, atualizar manifest.json
Dia 5  → Criar estrutura de pastas do src/
Dia 6  → Primeiro commit público no GitHub com README
Dia 7  → Postar no X: "Dia 1: UX virando engenheiro. Vou construir um plugin para Obsidian."
```

**Entregável:** Plugin instalável localmente. Repositório público. Primeiro post.

---

### SPRINT 1 — Semanas 2–4: Chat Mode Básico
**Objetivo:** Mandar uma mensagem e receber resposta

```
Semana 2 → Sidebar com React montado. Campo de texto. Botão enviar.
Semana 3 → Integração OpenAI. Resposta aparecendo na tela (sem streaming).
Semana 4 → Streaming implementado. Mensagens com balloons. Day separators.
```

**Entregável:** Chat funcionando com OpenAI. Visualmente básico mas real.

---

### SPRINT 2 — Semanas 5–7: Multi-provider + Settings
**Objetivo:** Anthropic, OpenRouter e Ollama funcionando

```
Semana 5 → Anthropic integrado. Session modal (provider/model/mode).
Semana 6 → OpenRouter integrado. Settings tab no Obsidian.
Semana 7 → Ollama integrado. Effort selector. Status line.
```

**Entregável:** Todos os 4 providers do alpha funcionando.

---

### SPRINT 3 — Semanas 8–10: UI de Produção
**Objetivo:** Visual que vai viralizar

```
Semana 8  → Design system completo. CSS variables. Dark/light mode.
Semana 9  → Composer estilo GPT (resize, shortcuts). Audio recorder.
Semana 10 → Mobile drawer. Favoritado de mensagens. Markdown rendering.
```

**Entregável:** UI que parece feature nativa do Obsidian. Pronto para screenshots.

---

### SPRINT 4 — Semanas 11–12: Persistência + Vault Q&A
**Objetivo:** Chats salvos como .md. Primeira integração com Vault.

```
Semana 11 → Chats salvos como .md com frontmatter correto.
Semana 12 → Vault Q&A básico (context stuffing das notas relevantes).
```

**Entregável:** Plugin com 80% das features do alpha. Pronto para beta testers.

---

### SPRINT 5 — Semana 13: Alpha Público
**Objetivo:** Publicar no Community Plugins

```
Dia 1-3  → Resolver todos os bugs reportados por beta testers (recrutados no X)
Dia 4-5  → Preparar README, screenshots, demo video (2 min)
Dia 6    → Submit no Community Plugins da Obsidian (review ~2 semanas)
Dia 7    → Post de lançamento do alpha no X, LinkedIn, Reddit r/ObsidianMD
```

**Entregável:** Plugin submetido. Primeiros 100 usuários.

---

### Meses 4–6: v0.2 — Agent + RAG Real
- AGENT mode com sistema de permissões
- CODER mode
- LanceDB para RAG real
- Skills management
- Primeiros usuários premium (Stripe)

### Meses 7–9: v0.3 — MCP + Premium
- Notion e ClickUp conectados
- Login Google premium
- Media transcription (premium)
- Workshops e templates como produto paralelo

### Meses 10–12: v1.0 — Release Público
- Compatibilidade com top plugins verificada
- Documentação completa
- B2B outreach ativo

---

# PARTE V — ESTRATÉGIA DE MARKETING E CONTEÚDO

## 5.1 A estratégia central: Build in Public

Você não está apenas construindo um plugin. Você está documentando a
primeira vez que um UX designer constrói um produto de software do zero,
ao vivo, usando AI como copiloto.

Esse é o conteúdo. O plugin é o produto. As duas coisas se reforçam.

**Por que isso funciona:**
- A comunidade Obsidian adora acompanhar o desenvolvimento de plugins
- A comunidade dev/indie hacker adora histórias de "não-dev que virou dev"
- A comunidade de design/UX fica curiosa com "designer que aprende a codar"
- O mercado brasileiro de criadores de conteúdo tech é carente desse perfil

---

## 5.2 Os 5 canais e como usar cada um

### Canal 1 — X/Twitter (prioridade máxima)
**Frequência:** 1 post/dia nos primeiros 90 dias
**O que postar:**
- Screenshots do progresso ("Ontem era HTML estático. Hoje o streaming funcionou.")
- Números honestos ("Semana 3: 47 seguidores, 0 usuários. Continuando.")
- Decisões de produto ("Escolhi LanceDB em vez de ChromaDB. Por que?")
- Erros e como resolvi ("Passei 4h num bug que era uma vírgula faltando.")
- Marcos ("Plugin aprovado no Community Plugins 🎉")

**Formato que converte:**
```
[Screenshot ou video curto]
[1 linha de contexto]
[3-5 linhas do que aprendi ou decidi]
[Pergunta pra engajar ou próximo passo]
```

**Meta X: 2.000 seguidores no mês 6 / 5.000 no mês 12**

---

### Canal 2 — LinkedIn
**Frequência:** 3 posts/semana
**O que postar:**
- Versão mais elaborada dos posts do X
- Reflexões sobre "UX → Designer Engineer"
- Decisões de produto com contexto de negócio
- Marcos financeiros (quando chegar)

**Público:** Designers, PMs, devs, pessoas de produto no Brasil
**Meta LinkedIn: 3.000 conexões no mês 12**

---

### Canal 3 — YouTube
**Frequência:** 1 vídeo/semana a partir do mês 2
**Formatos:**
- "Construindo o AXXA OS — Semana X" (devlog)
- "Aprendi X sobre TypeScript como UX" (educativo)
- "Demo do AI Agent para Obsidian" (produto)
- "Como estou ganhando dinheiro com um plugin grátis" (transparência)

**Por que YouTube é crucial:**
O Obsidian tem uma comunidade enorme no YouTube (Pt-BR é deserto).
Um canal em PT-BR sobre PKM + AI + Obsidian + construção de produto
tem diferencial absoluto. Canais como @Pelado Nerd, @Dio fazem isso
pra dev — você faz pra design engineer + produtividade.

**Meta YouTube: 1.000 inscritos no mês 6 / 5.000 no mês 12**

---

### Canal 4 — Reddit e Comunidades
**Onde:**
- r/ObsidianMD (300k+ membros)
- r/PKMS
- r/IndieHackers
- Discord oficial do Obsidian
- Comunidades brasileiras: Discord de Design/UX BR, grupos de Notion/PKM no Telegram

**Quando:**
- No alpha: post de "Feedback Wanted" + link para o plugin
- No launch: post de announcement com demo video
- Mensalmente: posts de milestone ("1 mês depois do launch — o que aprendi")

**Regra de ouro no Reddit:** Dê valor antes de pedir. Responda perguntas
sobre Obsidian e AI por 2 semanas antes de falar do seu plugin.

---

### Canal 5 — Newsletter (Beehiiv, gratuito)
**Nome sugerido:** AXXA Weekly — *Building the OS for your mind*
**Frequência:** 1x por semana a partir do mês 3
**Conteúdo:**
- Progresso da semana
- 1 aprendizado técnico (para devs curiosos)
- 1 aprendizado de produto (para UX/PMs)
- Números reais (MRR, downloads, churn)

**Meta Newsletter: 500 assinantes no mês 6 / 2.000 no mês 12**
**Por que importa:** Email é o único canal que você controla. Quando o
algoritmo do X ou do YouTube mudar, sua lista continua.

---

## 5.3 Calendário de conteúdo — os primeiros 30 dias

| Dia | Plataforma | Conteúdo |
|-----|-----------|----------|
| 1 | X + LinkedIn | "Dia 0: Sou UX, não dev. Vou construir um plugin pra Obsidian. Ao vivo." |
| 3 | X | Screenshot do VS Code aberto pela primeira vez |
| 5 | X + LinkedIn | "Dia 5: O plugin apareceu na sidebar. Não faz nada ainda. Mas existe." + screenshot |
| 7 | X | O que é scaffold — explicado por alguém que aprendeu ontem |
| 10 | X + LinkedIn | Primeira mensagem enviada ao ChatGPT via plugin. Video de 30 segundos. |
| 14 | YouTube | "Semana 2: Aprendi TypeScript sem ter estudado TypeScript" |
| 17 | X | "Streaming implementado. Essa animação de typing demorou 6h." |
| 21 | X + LinkedIn | "3 semanas in. O que é diferente do que esperava." |
| 24 | YouTube | Demo do Chat Mode — primeiros 2 minutos funcionando |
| 28 | Todos | "Mês 1 — o que construí, o que aprendi, os números reais" |
| 30 | Reddit r/ObsidianMD | "WIP: AI Agent para Obsidian — feedback wanted" |

---

## 5.4 Launch strategy — o dia do alpha público

**Semana antes do launch:**
- Teaser posts diários ("3 dias... 2 dias... amanhã")
- DMs para 20 criadores de PKM/Obsidian pedindo feedback antecipado
- Landing page no ar com waitlist

**Dia do launch:**
```
09h → Post no X com demo video (60 segundos)
09h → Post no LinkedIn com história completa do processo
10h → Submit no Reddit r/ObsidianMD
11h → Post no Discord oficial do Obsidian (#plugins)
12h → Post no Indie Hackers (Milestones)
14h → Email para a waitlist
16h → YouTube Shorts do demo
```

**Semana após o launch:**
- Responder TODOS os comentários
- Compilar feedback em lista pública de features
- Post "24h após o launch — números reais"

---

# PARTE VI — MONETIZAÇÃO E PRICING

## 6.1 Estrutura de pricing

### Free (Community)
Tudo que foi planejado para o alpha e beta.
Sem limitação de uso. BYOK. Plugin completo.
**Objetivo:** Distribuição máxima, confiança, comunidade.

### Premium — $9,99/mês ou $79/ano
- Login Google (sync entre devices)
- Transcrição automática de mídia (vídeo/áudio)
- Modelos premium exclusivos (quando aplicável)
- Priority support
- [Placeholder para features futuras]

**Por que esse preço:**
- Abaixo do Copilot Plus ($9,99 deles é similar)
- Acessível para o mercado BR mesmo sem conversão (R$ ~51/mês)
- Anual com desconto cria LTV e reduz churn

---

## 6.2 Múltiplos fluxos de receita (para atingir o milhão)

| Fonte | Mês 6 | Mês 12 | Notas |
|-------|-------|--------|-------|
| Plugin Premium | R$ 10.000 | R$ 120.000 | 1.200 users × $19.99 |
| AXXA Skills Pack | R$ 2.000 | R$ 15.000 | Templates/skills curados |
| Workshop "AXXA OS Workflow" | R$ 5.000 | R$ 40.000 | Cohorts mensais |
| Consultoria/Implementação B2B | R$ 0 | R$ 60.000 | Times de produto/design |
| Newsletter sponsorship | R$ 0 | R$ 10.000 | Quando chegar a 2k+ sub |
| **TOTAL MENSAL** | **R$ 17.000** | **R$ 245.000** | |
| **TOTAL ACUMULADO ANO 1** | | **~R$ 800.000** | |

**Para o milhão no ano 1:** 3 contratos B2B de R$ 15k+ ou 
200 alunos extras no Workshop fecham a gap.

---

## 6.3 O Workshop AXXA OS Workflow

**O que é:** Um curso/workshop intensivo de 4 semanas ensinando
como usar o AXXA OS AI Agent + Obsidian para gestão completa da vida
e do trabalho. Especialmente para designers, PMs e criadores.

**Formato:** Online, ao vivo, cohort-based (turmas fechadas)
**Preço:** R$ 497 (early bird) / R$ 797 (regular)
**Tamanho ideal da turma:** 30–50 pessoas
**Frequência:** Mensal após o mês 6

**Por que isso funciona:**
Você não está vendendo "aprenda a usar um plugin". Você está
vendendo o sistema operacional de produtividade da sua vida.
O plugin é a ferramenta. O workshop é a transformação.

---

# PARTE VII — O PLANO DE 365 DIAS (SEMANA A SEMANA)

```
FASE 0 — FUNDAÇÃO (Meses 1–2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Semana 1:  Scaffold. GitHub público. Primeiro post.
Semana 2:  Chat básico com campo de texto.
Semana 3:  OpenAI integrado. Respostas funcionando.
Semana 4:  Streaming. Balloons. Day separators.
Semana 5:  Anthropic + OpenRouter integrados.
Semana 6:  Settings tab. Session modal.
Semana 7:  Ollama local. Effort selector.
Semana 8:  Design system e CSS completo.

Meta Fase 0: Plugin funcionando com todos os providers.
             500 seguidores no X. 100 pessoas na waitlist.
             R$ 0 de receita (ainda construindo).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 1 — ALPHA PÚBLICO (Meses 3–4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Semana 9:  UI mobile. Composer estilo GPT.
Semana 10: Audio recorder + Whisper.
Semana 11: Chats salvos como .md. Vault Q&A básico.
Semana 12: Bug fixes + beta testers (20 pessoas do X).
Semana 13: Submit Community Plugins. Launch posts.
Semana 14-16: Review do Obsidian. Iteração com feedback.

Meta Fase 1: Plugin no Community Plugins.
             200 downloads na primeira semana.
             Primeiros 50 usuários premium.
             R$ 1.500/mês.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 2 — CRESCIMENTO (Meses 5–7)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Semana 17: AGENT mode — permissões basic/vault/yolo.
Semana 18: CODER mode. Log de ações.
Semana 19: LanceDB — RAG real para Vault Q&A.
Semana 20: Skills management (UI + CRUD + import/export).
Semana 21: Project management + frontmatter + wikilinks.
Semana 22: Stripe + login Google — premium live.
Semana 23: 1º Workshop AXXA OS Workflow (cohort teste).
Semana 24: Iteração com feedback do workshop.

Meta Fase 2: 1.000 downloads totais.
             200 usuários premium.
             R$ 15.000/mês combinado (plugin + workshop).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FASE 3 — ESCALA (Meses 8–12)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mês 8:  MCP Connect (Notion + ClickUp). B2B outreach.
Mês 9:  Figma MCP. Media transcription (premium).
Mês 10: Skills marketplace. Parcerias com criadores PKM.
Mês 11: v1.0 release. Product Hunt launch.
Mês 12: Retrospectiva pública. Plano Ano 2.

Meta Fase 3: 3.000+ usuários premium.
             R$ 80.000+/mês.
             Total acumulado Ano 1: R$ 700k–1M.
```

---

# PARTE VIII — MÉTRICAS E METAS

## 8.1 North Star Metric

**Downloads ativos mensais do plugin.**
Tudo deriva disso — usuários premium, workshop leads, B2B interesse.

## 8.2 Metas por fase

| Métrica | Mês 3 | Mês 6 | Mês 9 | Mês 12 |
|---------|-------|-------|-------|--------|
| Downloads totais | 500 | 5.000 | 20.000 | 50.000 |
| Usuários ativos/mês | 200 | 2.000 | 8.000 | 20.000 |
| Usuários premium | 50 | 300 | 1.000 | 3.000 |
| MRR plugin (USD) | $500 | $3.000 | $10.000 | $30.000 |
| MRR total (BRL) | R$2.500 | R$17.000 | R$55.000 | R$165.000 |
| Seguidores X | 500 | 2.000 | 4.000 | 7.000 |
| Inscritos YouTube | 0 | 1.000 | 3.000 | 5.000 |
| Newsletter subs | 0 | 500 | 1.500 | 3.000 |

## 8.3 Quando o R$ 1M acontece

**Cenário base:** Mês 14–16 (R$ 165k/mês × aceleração)
**Cenário otimista:** Mês 11–12 com B2B + workshop forte
**Cenário pessimista:** Mês 18–24 (ainda vale muito a pena)

---

# PARTE IX — GESTÃO DO RISCO

## O que pode dar errado (e como mitigar)

| Risco | Probabilidade | Impacto | Mitigation |
|-------|--------------|---------|-----------|
| Copilot lança feature similar | Alta | Médio | Seu design e mobile-first são moat |
| Plugin review leva muito tempo | Média | Baixo | Distribua o .zip direto no X enquanto espera |
| Você bate no limite de tempo/energia | Alta | Alto | Sprint de 2 semanas, não maratonas |
| Obsidian muda a API | Baixa | Alto | Template oficial reduz esse risco |
| Mercado BR não converte em USD | Média | Médio | Pricing em BRL como opção |
| Scope creep (querer tudo logo) | Muito alta | Alto | MVP é MVP. Chat antes de Agent. |

## A regra mais importante

**Ship early. Ship often. Ship ugly if necessary.**

Um plugin com 5 features funcionando e UI básica publicado em 3 meses
vale 10x mais do que um plugin com 20 features perfeito em 12 meses.
A comunidade do Obsidian tolera e ama WIPs — eles constroem junto.

---

# PARTE X — O DIA DE HOJE

## O que fazer hoje, agora, antes de dormir

```
1. Criar conta no GitHub (se não tiver)
   → github.com/new → repositório: "axxa-os-ai-agent"
   → Visibility: Public
   → Initialize with README: sim

2. Instalar Node.js
   → nodejs.org → versão LTS (a mais estável)

3. Clonar o template oficial
   → github.com/obsidianmd/obsidian-sample-plugin
   → Botão "Use this template" → criar no seu GitHub

4. Criar o post do Dia 0 no X e LinkedIn
   → "Sou UX. Não sei programar. Vou construir um plugin para Obsidian 
      que vai mudar como pessoas trabalham com AI. Ao vivo. Começa hoje."

5. Assinar Claude Pro
   → claude.ai/upgrade
   → $20/mês — seu único investimento inicial
```

**Quando você fizer isso, me manda. A próxima sessão é o scaffold.**

---

# APÊNDICE — REFERÊNCIAS

## Planos Claude (junho 2026)
- Pro: $20/mês — ~17.500 tokens/janela 5h — inclui Claude Code
- Max 5x: $100/mês — ~88.000 tokens/janela 5h — inclui early access
- Max 20x: $200/mês — ~220.000 tokens/janela 5h — para uso profissional intenso

## Recursos essenciais
- Template oficial: github.com/obsidianmd/obsidian-sample-plugin
- Docs Obsidian: docs.obsidian.md
- Submeter plugin: community.obsidian.md
- Obsidian Stats: obsidianstats.com
- Indie Hackers: indiehackers.com

## Benchmarks do mercado
- Obsidian: 1,5M usuários ativos, $25M ARR, 7 pessoas
- Obsidian Copilot: 1,4M downloads, plugin #1 de AI
- Plugins totais: 4.000+, 120M downloads
- Conversão free → premium típica de plugins: 1–5%

---

*AXXA OS — AI Agent | Plano Mestre v1.0*  
*Criado em 05 de junho de 2026*  
*"Construindo o sistema operacional da mente moderna."*