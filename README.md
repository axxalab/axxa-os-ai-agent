# AXXA OS — AI Agent

> **Your AI workspace, native to Obsidian.** Chat, ask your vault, and let an agent act on your notes — across 6 LLM providers, with your own API keys. Mobile-first.

[![Version](https://img.shields.io/badge/version-0.1.151-6c5ce7)](manifest.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Obsidian](https://img.shields.io/badge/Obsidian-1.11.4%2B-7c3aed)](https://obsidian.md)
[![Mobile](https://img.shields.io/badge/mobile-supported-success)](#)

AXXA OS — AI Agent turns Obsidian into a full AI workspace. It feels like a native feature, not a bolted-on panel: a chat lives in the right sidebar (a drawer on mobile), talks to the model of your choice, and — when you let it — reads, searches, and edits the notes in your vault. Bring your own keys, pick any of six providers, and keep every conversation as plain Markdown inside your vault.

> 🇧🇷 **Versão em português** mais abaixo → [Pular para PT-BR](#-axxa-os--ai-agent-português).

---

## ✨ Highlights

- **3 modes, one panel** — Chat, Vault Q&A (RAG over your notes), and Agent (tool-calling on your files).
- **6 providers, bring your own key** — OpenAI, Anthropic (Claude), Google Gemini, OpenRouter, Nvidia NIM, and local Ollama. Switch freely; your keys never leave your device.
- **Talk to your vault** — local semantic search (RAG) with hybrid keyword + vector ranking and wikilink-graph awareness. 8 embedding models across 4 providers, including free options.
- **An agent that acts** — create, read, edit, move, and delete notes through a safe, permissioned tool layer. Destructive actions always ask first.
- **Image generation** — generate images right in the chat (OpenAI & Gemini) and save them into your vault with metadata sidecars.
- **Real cost tracking** — a Usage dashboard estimates spend in USD per provider, model, mode, and day, with PDF / Markdown / HTML export.
- **Everything is Markdown** — chats, generated media, and skills are saved as `.md` files in your vault. Portable, versionable, yours.
- **Mobile-first** — built for the Obsidian mobile drawer first: edge-to-edge composer, hold-to-record audio, haptics, keyboard-aware layout, screen wake-lock during generation.
- **Bilingual UI** — Portuguese (BR) and English, auto-detected from your locale.

### 📸 Screenshots

> Capture targets and naming live in [`docs/screenshots/`](docs/screenshots/). Drop the PNGs there and uncomment below.

<!-- Uncomment as the images land:
| Desktop — chat | Mobile — drawer | Vault Q&A with citations |
|---|---|---|
| ![Desktop chat](docs/screenshots/desktop-chat.png) | ![Mobile drawer](docs/screenshots/mobile-drawer.png) | ![Vault Q&A](docs/screenshots/vault-qa.png) |

| Agent diff approval | Usage dashboard | Starter screen |
|---|---|---|
| ![Agent diff](docs/screenshots/agent-diff.png) | ![Usage](docs/screenshots/usage-dashboard.png) | ![Starter](docs/screenshots/starter.png) |
-->


---

## 🔒 Privacy & local-first

AXXA OS is built for the Obsidian ethos — **your notes are yours**.

- **Everything stays in your vault.** Chats, generated media, and skills are plain `.md` files on disk. Nothing is uploaded to us.
- **No telemetry, no tracking, no accounts.** The plugin phones home to *nobody*. The only network calls are the ones you trigger to the LLM provider you chose (with your own key).
- **Bring your own key — keys never leave your device.** They live in your OS keychain (secure storage), used only to call the provider you picked.
- **Works fully offline with Ollama.** Run local models with zero data leaving your machine — chat, RAG, and the agent all work air-gapped.
- **Cite & open your notes.** Vault answers cite the source notes as clickable `[[wikilinks]]` that open the real note.

> Start free, no credit card: Gemini's free tier, OpenRouter's free models, or local Ollama.

---

## 🚀 Installation

### From Obsidian (recommended, once published)

1. Open **Settings → Community plugins**.
2. Make sure **Restricted mode** is off.
3. Click **Browse**, search for **AXXA OS — AI Agent**, and install.
4. **Enable** the plugin. Open it from the ribbon icon or the command palette (**"AXXA OS: Open"**).

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases).
2. Copy them into your vault at `<vault>/.obsidian/plugins/axxa-os-ai-agent/`.
3. Reload Obsidian and enable the plugin in **Settings → Community plugins**.

> **Requires** Obsidian **1.11.4+** (for OS-level secret storage of API keys). Works on desktop and mobile.

---

## ⚡ Quick start

1. Open the plugin and go to **Settings → Providers**.
2. Pick a provider and paste your API key (see the [provider table](#-providers) for where to get one). Ollama needs only a local endpoint — no key.
3. Open a new chat: choose **provider → model → mode → effort** on the starter screen.
4. Type and send. Your conversation is saved automatically as Markdown in your vault.

That's it. The first message **locks** the provider, model, and mode for that conversation, so a chat stays consistent end-to-end. New settings apply to new chats.

---

## 🧠 The three modes

| Mode | What it does |
|---|---|
| **Chat** | Classic conversational AI with streaming responses, Markdown rendering, and code blocks with copy buttons. No vault access. |
| **Vault Q&A** | Retrieval-augmented chat grounded in *your* notes. Local semantic search finds the relevant passages and feeds them to the model as context. |
| **Agent** | The model can use tools to act on your vault — search, list, read, create, edit, move, delete files and folders — under a permission system with confirmations for destructive actions. |

---

## 🔌 Providers

All providers use **BYOK** (bring your own key). You only need a key for the provider(s) you actually use.

| Provider | Type | Get a key |
|---|---|---|
| **OpenAI** | Cloud | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Anthropic (Claude)** | Cloud | [console.anthropic.com](https://console.anthropic.com/) |
| **Google Gemini** | Cloud | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **OpenRouter** | Cloud proxy (many models) | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **Nvidia NIM** | Cloud | [build.nvidia.com](https://build.nvidia.com/) |
| **Ollama** | Local (no key) | [ollama.com](https://ollama.com/) — set your local endpoint in Settings |

Each provider's model list can be fetched live from its API, and the UI shows per-model capability badges (vision, tools, streaming, free tier, image/audio/video generation) so you always know what a model can do in a given mode. An **incompatibility banner** warns you (and suggests a swap) if a model can't do what the current mode needs.

---

## 🔎 Vault Q&A & RAG

AXXA builds a **local** semantic index of your vault — nothing is uploaded except the text sent to your chosen embedding API.

- **8 embedding models** across **4 providers**: OpenAI (`text-embedding-3-small/large`, `ada-002`), Gemini (`gemini-embedding-001`, `text-embedding-004`), Nvidia NIM (`nv-embedqa-e5-v5`, `llama-3.2-nv-embedqa-1b-v2`), and OpenRouter's free multimodal Nemotron VL — so you can run RAG even without a paid key.
- **Hybrid search** combines semantic similarity with keyword (BM25) ranking, then re-ranks using your vault's wikilink graph.
- **Structural chunking** preserves heading breadcrumbs and note context (title, tags, aliases, links).
- **Selectable quantization** (precision → minimal) trades index size for memory, the same way Effort trades depth for speed.
- **Incremental indexing** re-embeds only changed files (detected by hash) and is mobile-safe — it won't blow up memory on phones.

---

## 🛠️ Agent mode & safety

The Agent can operate on your vault through a small, explicit set of tools: `vault_search`, `vault_list`, `vault_read`, `vault_create`, `vault_edit`, `vault_move`, `vault_delete`, and `vault_create_folder`.

Three permission levels control how much it can do without asking:

- **Ask** — confirm every action that changes files *(default, safest)*.
- **Vault** — auto-approve create/edit/move; still confirm deletes.
- **YOLO** — auto-approve everything *except* irreversible deletes, which **always** ask.

All file paths are sandboxed (no path traversal), and a confirmation dialog shows you exactly what the agent wants to do before any destructive change.

---

## 💸 Usage & cost tracking

A built-in **Usage** dashboard reads your saved chats and estimates real spend in **USD**, broken down by provider, model, mode, and day (with a 30-day heatmap). Export the report as **PDF, Markdown, or HTML**. Token counts are tracked live during streaming, including tokens/second.

---

## 🎚️ Effort

A single **Effort** selector (Low → Max) scales how hard the model works: max tokens, agent turn limits, temperature, parallel tool calls, retry behavior, and how much of your vault gets pulled into context. Every parameter is tunable per level in Settings.

---

## 🔐 Privacy & network use

AXXA OS — AI Agent is **bring-your-own-key** and stores everything locally. Specifically:

- **Your API keys** are stored in your operating system's secure storage (Obsidian's `secretStorage` / OS keychain) — **not** in the plugin's `data.json`, so they don't leak through Obsidian Sync or vault backups. They're sent **only** to the corresponding provider's official API endpoint. *(Legacy keys from older versions are migrated automatically on first load.)*
- **Network requests** are made **only** to the LLM/embedding/image provider you choose (OpenAI, Anthropic, Google, OpenRouter, Nvidia, or your local Ollama), to send your prompts and vault context and stream back responses.
- **Vault content** leaves your device only as part of the prompts/embeddings you explicitly send to your chosen provider. The semantic index itself is stored locally in your vault.
- **No telemetry, no analytics, no tracking.** AXXA does not phone home.
- **Chats, generated media, and settings** are saved as plain files inside your vault.

When you use a third-party provider, your data is subject to **that provider's** terms and privacy policy. Review them before sending sensitive content.

---

## 🗺️ Roadmap

- **Now:** validation & stabilization across all 6 providers; real screenshots.
- **Next:** Coder mode with diff previews; Skills (custom system prompts as `.md`); Projects (link chats to `[[projects]]`); Whisper audio transcription.
- **Later:** MCP connectors (Notion, Linear, GitHub, …); optional Premium (cross-device sync, automatic media transcription).

---

## 💜 Support

If AXXA OS — AI Agent helps your workflow, consider [supporting development](https://axxa.lab/support). Built by **Axxa Lab**.

---

## 📄 License

[MIT](LICENSE) © 2026 Axxa Lab.

---
---

# 🇧🇷 AXXA OS — AI Agent (Português)

> **Seu workspace de IA, nativo no Obsidian.** Converse, pergunte ao seu vault e deixe um agente agir nas suas notas — em 6 provedores de LLM, com suas próprias chaves. Mobile-first.

O AXXA OS — AI Agent transforma o Obsidian num workspace de IA completo. Parece uma feature nativa, não um painel colado: o chat fica na sidebar direita (drawer no mobile), fala com o modelo que você escolher e — quando você permite — lê, busca e edita as notas do seu vault. Use suas próprias chaves, escolha entre seis provedores, e guarde cada conversa como Markdown puro dentro do vault.

## ✨ Destaques

- **3 modos, um painel** — Chat, Vault Q&A (RAG sobre suas notas) e Agente (tool-calling nos seus arquivos).
- **6 provedores, com sua própria chave** — OpenAI, Anthropic (Claude), Google Gemini, OpenRouter, Nvidia NIM e Ollama local. Troque à vontade; suas chaves não saem do seu aparelho.
- **Converse com o vault** — busca semântica local (RAG) com ranqueamento híbrido (palavra-chave + vetor) e consciência do grafo de wikilinks. 8 modelos de embedding em 4 provedores, incluindo opções gratuitas.
- **Um agente que age** — criar, ler, editar, mover e deletar notas por uma camada de ferramentas com permissões. Ações destrutivas sempre pedem confirmação.
- **Geração de imagem** — gere imagens direto no chat (OpenAI e Gemini) e salve no vault com metadados.
- **Controle de custo real** — painel de Uso estima o gasto em USD por provedor, modelo, modo e dia, com export em PDF / Markdown / HTML.
- **Tudo é Markdown** — conversas, mídia gerada e skills viram arquivos `.md` no seu vault. Portátil, versionável, seu.
- **Mobile-first** — feito pro drawer do Obsidian mobile primeiro: composer edge-to-edge, gravação de áudio segurando, háptico, layout que respeita o teclado, wake-lock de tela durante a geração.
- **Interface bilíngue** — Português (BR) e Inglês, detectados pelo locale.

## 🚀 Instalação

**Pela loja do Obsidian (recomendado, após publicação):** Settings → Community plugins → Browse → busque **AXXA OS — AI Agent** → Install → Enable.

**Manual:** baixe `main.js`, `manifest.json` e `styles.css` da [última release](../../releases) e copie pra `<vault>/.obsidian/plugins/axxa-os-ai-agent/`. Recarregue o Obsidian e ative o plugin.

> **Requer** Obsidian **1.11.4+** (pra guardar as chaves no cofre seguro do SO). Funciona em desktop e mobile.

## ⚡ Começo rápido

1. Abra o plugin e vá em **Settings → Providers**.
2. Escolha um provedor e cole sua chave de API (veja a [tabela de provedores](#-providers) pra onde gerar). Ollama precisa só de um endpoint local — sem chave.
3. Abra um chat novo: escolha **provedor → modelo → modo → effort** na tela inicial.
4. Digite e envie. A conversa é salva automaticamente como Markdown no seu vault.

A primeira mensagem **trava** provedor, modelo e modo daquela conversa, mantendo o chat consistente do início ao fim. Configurações novas valem pra chats novos.

## 🧠 Os três modos

| Modo | O que faz |
|---|---|
| **Chat** | IA conversacional clássica com respostas em streaming, render de Markdown e blocos de código com botão de copiar. Sem acesso ao vault. |
| **Vault Q&A** | Chat com RAG ancorado nas *suas* notas. A busca semântica local encontra os trechos relevantes e os passa ao modelo como contexto. |
| **Agente** | O modelo usa ferramentas pra agir no vault — buscar, listar, ler, criar, editar, mover, deletar arquivos e pastas — sob um sistema de permissões com confirmação pra ações destrutivas. |

## 🔐 Privacidade & uso de rede

O AXXA é **BYOK** (suas próprias chaves) e guarda tudo localmente:

- **Suas chaves** ficam no armazenamento seguro do sistema operacional (o `secretStorage` do Obsidian / keychain do SO) — **não** no `data.json` do plugin, então não vazam por Obsidian Sync nem backup do vault. São enviadas **apenas** pra API oficial do provedor correspondente. *(Chaves legadas de versões antigas são migradas automaticamente no primeiro load.)*
- **Requisições de rede** acontecem **só** com o provedor que você escolher (OpenAI, Anthropic, Google, OpenRouter, Nvidia ou seu Ollama local), pra mandar seus prompts/contexto e receber as respostas.
- **Conteúdo do vault** sai do aparelho apenas como parte dos prompts/embeddings que você explicitamente envia. O índice semântico fica salvo localmente no vault.
- **Sem telemetria, sem analytics, sem rastreio.** O AXXA não "liga pra casa".

Ao usar um provedor terceiro, seus dados ficam sujeitos aos termos e à política de privacidade **daquele provedor**. Revise antes de enviar conteúdo sensível.

## 📄 Licença

[MIT](LICENSE) © 2026 Axxa Lab.

---

*Built with 💜 by Axxa Lab · Feito com 💜 pela Axxa Lab*
