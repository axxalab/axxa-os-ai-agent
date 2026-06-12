// src/main.ts
// Entry point do plugin. O Obsidian instancia AxxaPlugin ao carregar o plugin.
// É como o "componente raiz" no Figma — todo o resto é montado a partir daqui.

import { Plugin, WorkspaceLeaf, Platform, Notice, type TAbstractFile } from "obsidian";
import { AxxaView, VIEW_TYPE_AXXA } from "./views/AxxaView";
import { AxxaSettingsTab } from "./components/settings/AxxaSettingsTab";
import { VectorIndex, loadIndex, RAG_SHARD_SIZE } from "./rag/vectorIndex";
import { indexVault } from "./rag/indexer";
import {
  inferEmbeddingSpec,
  registerDiscoveredEmbeddings,
  type EmbeddingModelSpec,
  type EmbeddingProvider,
} from "./rag/types";
import { registerLocalUsage } from "./providers/dataCollect";
import {
  listAllChats,
  type ChatSummary,
} from "./components/_shared/chatPersistence";
import { registerBrandIcons } from "./components/_shared/brandIcons";
import { registerBrandLogos } from "./components/_shared/brandLogos";
import {
  hydrateModelInfoCache,
  getModelInfoCache,
  fetchAndCacheModelInfo,
  type EnrichedModelInfo,
} from "./providers/modelInfoStore";
import { loadSkills, seedExampleSkills, type Skill } from "./skills/skills";
import type { Project } from "./projects";
import type {
  EffortConfig,
  EffortLevel,
} from "./components/_shared/effort";

interface AxxaSettings {
  openaiApiKey: string;
  anthropicApiKey: string;
  geminiApiKey: string;
  openrouterApiKey: string;
  nimApiKey: string;
  ollamaEndpoint: string;
  defaultProvider: string;
  /** Modelo usado pelo provider OpenAI (ex: gpt-4o, gpt-4o-mini) */
  defaultModel: string;
  /** Modelo usado pelo provider Anthropic (ex: claude-sonnet-4-6, claude-opus-4-8) */
  anthropicModel: string;
  /** Modelo usado pelo Gemini (ex: gemini-2.5-flash, gemini-2.5-pro) */
  geminiModel: string;
  /** Modelo usado pelo OpenRouter (ex: anthropic/claude-3.5-sonnet) */
  openrouterModel: string;
  /** Modelo usado pelo Nvidia NIM (ex: nvidia/llama-3.3-nemotron-super-49b-v1.5) */
  nimModel: string;
  /** Modelo usado pelo Ollama (instalado localmente, ex: llama3.2, qwen2.5) */
  ollamaModel: string;
  /** Modelos ativos por provider — só esses aparecem no seletor da StarterScreen.
   *  Curado pelo user nas Settings (manual + fetch da API). Permite incluir
   *  modelos legacy que não aparecem no /v1/models moderno. */
  activeModels: Record<string, string[]>;
  /** Modelos de embedding descobertos via fetch da API, por provider. Alimentam
   *  o seletor de embedding do RAG com info inferida. v0.1.151 */
  discoveredEmbeddings: Record<string, string[]>;
  defaultMode: string;
  defaultEffort: string;
  chatsPath: string;
  skillsPath: string;
  language: string;
  /** ID do background preset (v0.1.106): none | 8 estáticos (dawn/ocean/forest/
   *  violet/rose/amber/slate/mono) | 8 live (aurora/nebula/pulse/flow/tide/
   *  ember/spectrum/lagoon). Aplicado como classe `axxa-bg-<id>` na .axxa-root.
   *  Presets antigos salvos caem graciosamente em "sem fundo". */
  background: string;
  /** Densidade global da UI (large/normal/compact) — dirige os tokens do DS
   *  (--axxa-density-*). Aplicada como data-axxa-density na .axxa-root. v0.1.209 */
  density: string;
  /** Nível de motion global (soft/wave/intense/chaotic) — dirige os tokens de
   *  animação do DS (--axxa-motion-*). Aplicado como data-axxa-motion na
   *  .axxa-root; governa toda animação nova daqui pra frente. v0.1.211 */
  motion: string;
  /** Toggle GLOBAL "reduzir movimento" — quando ligado, mata toda animação do
   *  app (classe `axxa-reduce-motion` no <body>). O user decide animado ou não;
   *  não depende mais do prefers-reduced-motion do SO. v0.1.218 */
  reduceMotion: boolean;
  /** Toggle de "reduzir movimento" só no MOBILE — mesma classe, gateada por
   *  Platform.isMobile (conveniência pra bateria/enjoo em telas touch). */
  reducedMotionMobile: boolean;
  /** Pasta no Vault onde gravações de áudio (hold-mic) são salvas. */
  recordingsPath: string;
  /** Pasta no Vault onde respostas da IA salvas como nota (footer) vão. */
  notesPath: string;
  /** Estilo de resposta global (normal/concise/explanatory/formal/friendly).
   *  Vira uma instrução anexada ao system prompt. Ref: Claude "Choose style". */
  responseStyle: string;
  /** Projetos (agrupam conversas + fontes). Ref: ChatGPT iOS 182/187/189. */
  projects: Project[];
  /** Modo Voz: voiceURI do TTS ("" = padrão), velocidade, intro vista. */
  voiceURI: string;
  voiceRate: number;
  voiceIntroDone: boolean;
  /** Pasta no Vault onde mídias geradas por modelos (imagem/áudio/vídeo)
   *  são salvas. Cada saída gera 2 arquivos: mídia + sidecar .md com
   *  frontmatter (prompt, model, provider, timestamp, etc). */
  generationPath: string;
  // ============ RAG (Sprint F — v0.1.25) ============
  /** Pasta no Vault onde o índice vetorial é persistido. */
  ragIndexPath: string;
  /** Provider de embeddings (apenas "openai" no MVP). */
  ragEmbeddingProvider: string;
  /** Modelo de embedding (ex: text-embedding-3-small). */
  ragEmbeddingModel: string;
  /** Perfil de quantização do índice RAG (precision/balanced/light/minimal) —
   *  precisão (float32/int8) + dim alvo. Estilo Effort. v0.1.80. */
  ragQuantProfile: string;
  /** Índice em pedaços (stream): salva em shards e lê um por vez na busca, em
   *  vez de tudo na RAM. Memória limitada (bom pra vaults grandes / mobile),
   *  cada busca lê do disco. Requer reindexar pra aplicar. v0.1.200 */
  ragStreamShards: boolean;
  /** Reindexa o RAG automaticamente quando notas mudam (debounced). Opt-in
   *  porque cada re-embed custa tokens/$. Só roda se já houver índice. v0.1.82. */
  ragAutoReindex: boolean;
  /** Code wrap em blocos de código markdown. Default false (scroll horizontal).
   *  Quando true, aplica `.axxa-code-wrap` na .axxa-root → pre quebra linha. */
  codeWrap: boolean;
  // ============ Agent Mode (Sprint G — v0.1.28) ============
  /** Nível de permissão do Agent Mode: "ask" | "vault" | "yolo".
   *  Ask = confirma cada destrutiva. Vault = só delete pergunta. Yolo = só
   *  irreversível pergunta. Default "ask" (mais conservador). */
  agentPermissionLevel: string;
  /** Diff-approval (v0.1.140): toda ação que ESCREVE no vault (editar/criar/
   *  mover/deletar) mostra um preview/diff pra aprovar antes de gravar.
   *  Default true. */
  agentDiffApproval: boolean;
  // ============ Chip visibility (v0.1.38) ============
  /** Quais chips aparecem na status line do Composer.
   *  IDs válidos: mode, model, effort, context, in, out, total */
  composerChips: string[];
  /** Quais chips aparecem nos cards da lista de chats (recent + conversations).
   *  IDs válidos: mode, model, date, messages, tokens */
  listChips: string[];
  // ============ Effort overrides (v0.1.73) ============
  /** Overrides do usuário pra cada nível de Effort. Campos ausentes caem nos
   *  DEFAULT_EFFORT_CONFIGS built-in (src/components/_shared/effort.ts).
   *  Configurado via Settings → Effort → sub-tab por nível. */
  effortConfigs: Partial<Record<EffortLevel, Partial<EffortConfig>>>;
  // ============ Fullscreen mobile (v0.1.74 — reintroduzido) ============
  /** Modo fullscreen mobile: drawer direito ocupa 100vw + esconde chrome
   *  nativo do Obsidian (drawer-header, tabs, footer). Toggle via menu
   *  "..." no Header. Persiste entre reloads. */
  mobileFullscreen: boolean;
  // ============ OpenAI specifics (v0.1.165) ============
  /** Inscrito no programa de data-sharing da OpenAI — dá tokens grátis diários
   *  em modelos de TEXTO (NÃO cobre geração de imagem). Informa os hints de
   *  custo no seletor de geração. */
  openaiDataSharing: boolean;
  /** Usage tier da conta OpenAI (1–5) — define o volume de tokens grátis do
   *  data-sharing. Default 1. */
  openaiUsageTier: number;
  /** Admin key OPCIONAL da OpenAI (sk-admin-…) — só pra custos/saldo reais
   *  (Admin API). NÃO faz chat; a chave de projeto continua no campo principal. */
  openaiAdminKey: string;
  /** Admin key OPCIONAL da Anthropic (sk-ant-admin…) — custos reais. */
  anthropicAdminKey: string;
  /** Project ID OPCIONAL da OpenAI (proj_…) — filtra o custo real só desse
   *  projeto (atribuição). Use um projeto dedicado pro plugin pra ver só o gasto
   *  dele em vez da org inteira. v0.1.172 */
  openaiProjectId: string;
  /** Workspace ID OPCIONAL da Anthropic — filtra o custo real só desse
   *  workspace (atribuição), análogo ao project da OpenAI. v0.1.173 */
  anthropicWorkspaceId: string;
  /** Âncora de saldo por provider (v0.1.171): { amount, date(ISO) }. O saldo é
   *  estimado/real = âncora − gasto desde a data. Crédito é separado por provider. */
  balanceAnchors: Record<string, { amount: number; date: string }>;
  // ============ Plano / entitlements (v0.1.174) ============
  /** Entitlement REAL da conta: "free" | "pro" (futuro: billing). Default pro. */
  accountTier: string;
  /** Override de ADMIN pra testar planos: "auto" | "free" | "pro". */
  devTierOverride: string;
  /** Onboarding de 1º uso já foi visto/dispensado? (não mostra de novo). #4 */
  onboardingDone: boolean;
  /** License key (scaffold #15) — válida → desbloqueia o Pro. */
  licenseKey: string;
  /** Emblema "Founder" no rodapé da gaveta (acima de Premium/Free). v0.1.206 */
  founder: boolean;
}

const DEFAULT_SETTINGS: AxxaSettings = {
  openaiApiKey: "",
  anthropicApiKey: "",
  geminiApiKey: "",
  openrouterApiKey: "",
  nimApiKey: "",
  ollamaEndpoint: "http://localhost:11434",
  defaultProvider: "openai",
  defaultModel: "gpt-4o",
  anthropicModel: "claude-sonnet-4-6",
  geminiModel: "gemini-2.5-flash",
  openrouterModel: "anthropic/claude-3.5-sonnet",
  nimModel: "meta/llama-3.3-70b-instruct",
  ollamaModel: "llama3.2",
  activeModels: {
    openai: ["gpt-4o", "gpt-4o-mini", "o1", "o3", "gpt-5"],
    anthropic: [
      "claude-opus-4-8",
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
    ],
    gemini: [
      // Chat / multimodal
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      // Image generation (Nano Banana + Imagen)
      "gemini-2.5-flash-image",
      "imagen-3.0-generate-002",
    ],
    openrouter: [
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o",
      "meta-llama/llama-3.3-70b-instruct",
      "google/gemini-2.0-flash-001",
    ],
    nim: [
      // Modelos confirmados como ativos no catálogo hosted (jun/2026).
      // Atualizar via webfetch periodicamente — catálogo muda com frequência.
      "meta/llama-3.3-70b-instruct",
      "meta/llama-3.1-70b-instruct",
      "meta/llama-3.1-8b-instruct",
      "nvidia/llama-3.1-nemotron-70b-instruct",
      "mistralai/mixtral-8x22b-instruct-v0.1",
      "deepseek-ai/deepseek-r1",
      "qwen/qwen2.5-72b-instruct",
      "microsoft/phi-4",
      // Image generation (NIM Visual GenAI)
      "stabilityai/stable-diffusion-3-medium",
      "black-forest-labs/flux.1-schnell",
    ],
    ollama: ["llama3.2", "qwen2.5", "deepseek-r1", "mistral"],
  },
  discoveredEmbeddings: {},
  defaultMode: "chat",
  defaultEffort: "med",
  chatsPath: "axxa-ai/chats",
  skillsPath: "axxa-ai/skills",
  language: "pt-br",
  background: "none",
  density: "normal",
  motion: "wave",
  reduceMotion: false,
  reducedMotionMobile: false,
  recordingsPath: "axxa-ai/recordings",
  notesPath: "axxa-ai/notes",
  responseStyle: "normal",
  projects: [],
  voiceURI: "",
  voiceRate: 1,
  voiceIntroDone: false,
  generationPath: "axxa-ai/generation",
  ragIndexPath: "axxa-ai/index",
  ragEmbeddingProvider: "openai",
  ragEmbeddingModel: "text-embedding-3-small",
  ragQuantProfile: "balanced",
  ragStreamShards: false,
  ragAutoReindex: false,
  codeWrap: false,
  agentPermissionLevel: "ask",
  agentDiffApproval: true,
  // Defaults slim — user pode adicionar mais via Settings → Outros → Chips
  composerChips: ["model", "effort", "speed", "in", "out"],
  listChips: ["mode", "model", "date"],
  // Vazio = usa DEFAULT_EFFORT_CONFIGS sem overrides. User edita via Settings.
  effortConfigs: {},
  mobileFullscreen: false,
  openaiDataSharing: false,
  openaiUsageTier: 1,
  openaiAdminKey: "",
  anthropicAdminKey: "",
  openaiProjectId: "",
  anthropicWorkspaceId: "",
  balanceAnchors: {},
  accountTier: "pro",
  devTierOverride: "auto",
  founder: false,
  onboardingDone: false,
  licenseKey: "",
};

export default class AxxaPlugin extends Plugin {
  settings!: AxxaSettings;
  /** Índice vetorial RAG carregado em memória — compartilhado entre Settings
   *  (indexação) e AxxaApp (busca). null = ainda não foi carregado/indexado. */
  vectorIndex: VectorIndex | null = null;
  /** Listeners avisados a cada saveSettings — usados pra re-renderizar o
   *  React tree quando o user troca idioma ou outro setting reativo. */
  private settingsListeners = new Set<() => void>();
  /** Debounce + cancelamento do auto-reindex do RAG (opt-in). */
  private autoReindexTimer: number | null = null;
  private autoReindexController: AbortController | null = null;

  /** Skills carregados da pasta (settings.skillsPath) — viram slash-commands. */
  skills: Skill[] = [];

  // ============================================================
  // Cache ÚNICO de summaries de conversa (v0.1.175) — UMA fonte da verdade
  // pra TODOS os consumidores (StarterScreen, Sidebar, ConversationsList,
  // Statistics, Usage, hot). Antes cada um fazia seu próprio listAllChats
  // (disk-walk) → várias passadas no abrir = lento. Agora: 1 walk, cacheado,
  // reusado, atualizado INCREMENTAL no save/rename/delete (sem re-walk).
  // ============================================================
  chatSummaries: ChatSummary[] | null = null;
  private chatSummariesPromise: Promise<ChatSummary[]> | null = null;
  private chatsListeners = new Set<() => void>();
  private reconcilingChats = false;
  private chatIndexWriteTimer: number | null = null;

  /** Inscreve um callback chamado quando o cache de conversas muda. */
  onChatsChange(cb: () => void): () => void {
    this.chatsListeners.add(cb);
    return () => this.chatsListeners.delete(cb);
  }
  private notifyChats(): void {
    this.chatsListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error("[axxa] chats listener falhou:", err);
      }
    });
  }

  /** Índice persistido (JSON no diretório do plugin, fora do vault content). */
  private chatIndexPath(): string {
    const dir = this.manifest.dir ?? ".obsidian/plugins/axxa-os-ai-agent";
    return `${dir}/chatIndex.json`;
  }
  private async readChatIndex(): Promise<ChatSummary[] | null> {
    try {
      const p = this.chatIndexPath();
      if (!(await this.app.vault.adapter.exists(p))) return null;
      const parsed = JSON.parse(await this.app.vault.adapter.read(p));
      return Array.isArray(parsed) ? (parsed as ChatSummary[]) : null;
    } catch {
      return null;
    }
  }
  private async writeChatIndex(arr: ChatSummary[]): Promise<void> {
    try {
      await this.app.vault.adapter.write(this.chatIndexPath(), JSON.stringify(arr));
    } catch (err) {
      console.error("[axxa] writeChatIndex falhou:", err);
    }
  }
  /** Persiste o índice debounced (após upsert/remove). */
  private scheduleChatIndexWrite(): void {
    if (this.chatIndexWriteTimer != null) {
      window.clearTimeout(this.chatIndexWriteTimer);
    }
    this.chatIndexWriteTimer = window.setTimeout(() => {
      if (this.chatSummaries) void this.writeChatIndex(this.chatSummaries);
    }, 800);
  }

  /**
   * Carrega os summaries com PINTURA INSTANTÂNEA (v0.1.176):
   *   1. Índice JSON persistido → cache na hora (sem disk-walk, sem cache frio).
   *   2. Reconcilia em BACKGROUND (walk) pra pegar mudanças externas.
   * Sem índice (1ª vez) ou `force` → walk completo + grava o índice.
   * Concorrentes compartilham a mesma Promise.
   */
  async loadChatSummaries(force = false): Promise<ChatSummary[]> {
    if (!force && this.chatSummaries) return this.chatSummaries;
    if (!force && this.chatSummariesPromise) return this.chatSummariesPromise;
    this.chatSummariesPromise = (async () => {
      try {
        if (!force) {
          const cached = await this.readChatIndex();
          if (cached) {
            this.chatSummaries = cached;
            this.notifyChats();
            void this.reconcileChatSummaries(); // background, não bloqueia
            return cached;
          }
        }
        const all = await listAllChats(this.app, this.settings.chatsPath, 100_000);
        this.chatSummaries = all;
        this.notifyChats();
        void this.writeChatIndex(all);
        return all;
      } catch (err) {
        console.error("[axxa] loadChatSummaries falhou:", err);
        return this.chatSummaries ?? [];
      } finally {
        this.chatSummariesPromise = null;
      }
    })();
    return this.chatSummariesPromise;
  }

  /** Walk em background: se o disco divergir do cache, atualiza + reescreve. */
  private async reconcileChatSummaries(): Promise<void> {
    if (this.reconcilingChats) return;
    this.reconcilingChats = true;
    try {
      const fresh = await listAllChats(this.app, this.settings.chatsPath, 100_000);
      const sig = (arr: ChatSummary[]) =>
        arr.length + ":" + arr.map((c) => c.id + c.date).join("|");
      if (!this.chatSummaries || sig(fresh) !== sig(this.chatSummaries)) {
        this.chatSummaries = fresh;
        this.notifyChats();
        void this.writeChatIndex(fresh);
      }
    } catch (err) {
      console.error("[axxa] reconcileChatSummaries falhou:", err);
    } finally {
      this.reconcilingChats = false;
    }
  }

  /** Upsert INCREMENTAL após salvar um chat — evita re-walk do disco. */
  upsertChatSummary(s: ChatSummary): void {
    if (!this.chatSummaries) return;
    const idx = this.chatSummaries.findIndex((c) => c.id === s.id);
    if (idx >= 0) this.chatSummaries[idx] = s;
    else this.chatSummaries.push(s);
    this.chatSummaries.sort((a, b) => b.date.localeCompare(a.date));
    this.notifyChats();
    this.scheduleChatIndexWrite();
  }

  /** Remove um chat do cache (após delete). */
  removeChatSummary(id: string): void {
    if (!this.chatSummaries) return;
    this.chatSummaries = this.chatSummaries.filter((c) => c.id !== id);
    this.notifyChats();
    this.scheduleChatIndexWrite();
  }

  /** Inscreve um callback chamado a cada saveSettings. Retorna unsubscribe. */
  onSettingsChange(cb: () => void): () => void {
    this.settingsListeners.add(cb);
    return () => this.settingsListeners.delete(cb);
  }

  /** Notifica os listeners (re-render do React tree). */
  private notifyListeners(): void {
    this.settingsListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error("[axxa] settings listener falhou:", err);
      }
    });
  }

  /**
   * Reconstrói o registro global de embeddings descobertos a partir dos ids
   * salvos em settings.discoveredEmbeddings (infere spec de cada um). Chamado
   * no load e após cada "Buscar da API". v0.1.151
   */
  refreshDiscoveredEmbeddings(): void {
    const specs: EmbeddingModelSpec[] = [];
    const map = this.settings.discoveredEmbeddings ?? {};
    for (const [provider, ids] of Object.entries(map)) {
      // Só providers que o RAG suporta como fonte de embedding.
      if (!["openai", "openrouter", "gemini", "nim"].includes(provider)) continue;
      for (const id of ids) {
        specs.push(inferEmbeddingSpec(provider as EmbeddingProvider, id));
      }
    }
    registerDiscoveredEmbeddings(specs);
  }

  /**
   * Coleta o uso LOCAL (nº de chats por modelo) e alimenta o "hot" do
   * dataCollect. Best-effort — nunca quebra o load. Sem telemetria: é só o
   * seu próprio histórico, no device. v0.1.152
   */
  async refreshLocalUsageHot(): Promise<void> {
    try {
      const chats = await this.loadChatSummaries();
      const byModel: Record<string, number> = {};
      for (const c of chats) {
        if (c.model) byModel[c.model] = (byModel[c.model] ?? 0) + 1;
      }
      registerLocalUsage(byModel);
    } catch (err) {
      console.error("[axxa] refreshLocalUsageHot falhou:", err);
    }
  }

  /** (Re)carrega os skills da pasta e re-renderiza. v0.1.139 */
  async reloadSkills(): Promise<void> {
    try {
      this.skills = await loadSkills(this.app, this.settings.skillsPath);
    } catch (err) {
      console.error("[axxa] reloadSkills falhou:", err);
      this.skills = [];
    }
    this.notifyListeners();
  }

  /** Cria os skills de exemplo (se faltarem) + recarrega. Retorna nº criados. */
  async seedExampleSkills(): Promise<number> {
    const n = await seedExampleSkills(this.app, this.settings.skillsPath);
    await this.reloadSkills();
    return n;
  }

  /** Caminho do cache de specs dos modelos (JSON no diretório do plugin). */
  private modelInfoCachePath(): string {
    const dir = this.manifest.dir ?? ".obsidian/plugins/axxa-os-ai-agent";
    return `${dir}/modelInfoCache.json`;
  }

  /** Lê o cache de specs do disco e hidrata o store em memória. v0.1.130 */
  private async loadModelInfoCache(): Promise<void> {
    try {
      const path = this.modelInfoCachePath();
      if (await this.app.vault.adapter.exists(path)) {
        const raw = await this.app.vault.adapter.read(path);
        hydrateModelInfoCache(JSON.parse(raw));
      }
    } catch (err) {
      console.error("[axxa] falha ao carregar modelInfoCache:", err);
    }
  }

  /** Persiste o cache de specs no disco (chamado após Fetch info). */
  async saveModelInfoCache(): Promise<void> {
    try {
      await this.app.vault.adapter.write(
        this.modelInfoCachePath(),
        JSON.stringify(getModelInfoCache(), null, 2)
      );
    } catch (err) {
      console.error("[axxa] falha ao salvar modelInfoCache:", err);
    }
  }

  /**
   * Busca specs do modelo via OpenRouter (Fetch info) e persiste no cache.
   * Retorna a info enriquecida ou null se não houve correspondência.
   */
  async fetchModelInfo(
    provider: string,
    model: string
  ): Promise<EnrichedModelInfo | null> {
    const info = await fetchAndCacheModelInfo(provider, model);
    if (info) await this.saveModelInfoCache();
    return info;
  }

  async onload() {
    await this.loadSettings();
    this.applyMotionPreference();

    // Registra os SVG marks dos providers (brand-openai/anthropic/etc).
    // Depois disso, setIcon(el, "brand-openai") funciona em qualquer lugar.
    registerBrandIcons();
    // Logos de marca coloridos (providers + modelos) — <Icon name="logo-openai" />
    registerBrandLogos();

    // Cache de specs dos modelos (Fetch info / OpenRouter) — hidrata o store.
    await this.loadModelInfoCache();

    // Embeddings descobertos (fetch anterior) → registro global do RAG.
    this.refreshDiscoveredEmbeddings();

    // "Hot" dos modelos a partir do uso local — fire-and-forget (não bloqueia).
    void this.refreshLocalUsageHot();

    // Skills (.md na pasta de skills) → slash-commands no composer.
    await this.reloadSkills();

    // Carrega índice RAG do disco se já existe. Falhas são silenciosas —
    // só significa que o user ainda não rodou "Indexar vault".
    // No MOBILE, gateia por tamanho: um índice grande estoura o heap do WebView
    // e derruba o Obsidian no parse (OOM). Acima do teto, pula → keyword. v0.1.198
    try {
      const mobileGuard = Platform.isMobile
        ? {
            maxBytes: 16 * 1024 * 1024,
            onSkip: (mb: number) => {
              const en = this.settings.language === "en-us";
              new Notice(
                en
                  ? `RAG index too large for mobile (${mb.toFixed(0)} MB) — semantic search is off here to avoid a crash. Use desktop or shrink the index.`
                  : `Índice RAG grande demais pro mobile (${mb.toFixed(0)} MB) — busca semântica desligada aqui pra evitar crash. Use no desktop ou reduza o índice.`
              );
            },
          }
        : undefined;
      this.vectorIndex = await loadIndex(
        this.app.vault.adapter,
        this.settings.ragIndexPath,
        mobileGuard
      );
    } catch (err) {
      console.error("[axxa] falha ao carregar índice RAG:", err);
    }

    // Registra a view na sidebar direita.
    // É como registrar um componente custom no design system — depois pode ser instanciado.
    this.registerView(
      VIEW_TYPE_AXXA,
      (leaf) => new AxxaView(leaf, this)
    );

    // Ícone na ribbon (sidebar esquerda do Obsidian).
    this.addRibbonIcon("bot", "AXXA OS", () => {
      this.activateView();
    });

    // Comando para abrir via Command Palette (Ctrl/Cmd + P).
    this.addCommand({
      id: "open-axxa-agent",
      name: "Abrir AI Agent",
      callback: () => this.activateView(),
    });

    // Settings tab — aparece em Settings -> Community Plugins -> AXXA OS.
    this.addSettingTab(new AxxaSettingsTab(this.app, this));

    // Mede a navbar mobile pra compensar layout (--axxa-status-bar-clearance)
    this.setupStatusBarClearance();

    // Auto-reindex do RAG (opt-in) — re-embeda notas modificadas em background
    this.setupAutoReindex();

    // Abre na sidebar direita quando o Obsidian termina de montar o layout.
    this.app.workspace.onLayoutReady(() => {
      this.activateView();
    });
  }

  onunload() {
    // Limpa a variável CSS pra não vazar entre reloads
    document.documentElement.style.removeProperty("--axxa-status-bar-clearance");
    document.body.classList.remove("axxa-reduce-motion");
  }

  /** Liga/desliga a classe `axxa-reduce-motion` no <body> conforme o TOGGLE do
   *  user — global (settings.reduceMotion) OU só no mobile
   *  (settings.reducedMotionMobile + Platform.isMobile). É a ÚNICA fonte da
   *  verdade pra reduzir movimento (não usamos mais @media do SO). v0.1.218 */
  applyMotionPreference() {
    const reduce =
      !!this.settings.reduceMotion ||
      (Platform.isMobile && !!this.settings.reducedMotionMobile);
    document.body.classList.toggle("axxa-reduce-motion", reduce);
  }

  /**
   * Mede a altura da mobile-navbar do Obsidian e expõe via CSS variable
   * `--axxa-status-bar-clearance`. O CSS usa essa variável pra compensar
   * o padding-bottom da view, evitando que conteúdo fique escondido
   * atrás de barras inferiores.
   *
   * Re-medido em mudanças de layout / resize (orientação, popout, etc).
   */
  private setupStatusBarClearance() {
    if (!Platform.isMobile) return;

    const update = () => {
      const navbar = document.querySelector(".mobile-navbar") as HTMLElement | null;
      const clearance = navbar?.offsetHeight ?? 0;
      document.documentElement.style.setProperty(
        "--axxa-status-bar-clearance",
        `${clearance}px`
      );
    };

    update();

    // Atualiza quando o layout muda (mostrar/esconder navbar, popout, etc)
    this.registerEvent(this.app.workspace.on("layout-change", update));
    this.registerEvent(this.app.workspace.on("resize", update));
  }

  /**
   * Auto-reindex do RAG (opt-in via settings.ragAutoReindex). Quando uma nota
   * .md muda / é criada / deletada / renomeada, agenda um reindex incremental
   * debounced (4s — só re-embeda o que mudou via hash). Só roda se JÁ existe
   * índice (não cria do nada). Desligado por padrão porque re-embed custa $.
   */
  private setupAutoReindex() {
    // Listeners ficam sempre registrados (leves — só checam um if); o `schedule`
    // consulta o setting em runtime → o toggle nas Settings vale na hora, sem
    // precisar reativar o plugin.
    const schedule = (file: TAbstractFile) => {
      if (!this.settings.ragAutoReindex) return;
      if (!this.vectorIndex || this.vectorIndex.size === 0) return;
      if (!file?.path || !file.path.endsWith(".md")) return;
      if (this.autoReindexTimer !== null) {
        window.clearTimeout(this.autoReindexTimer);
      }
      this.autoReindexTimer = window.setTimeout(
        () => this.runAutoReindex(),
        4000
      );
    };

    this.registerEvent(this.app.vault.on("modify", schedule));
    this.registerEvent(this.app.vault.on("create", schedule));
    this.registerEvent(this.app.vault.on("delete", schedule));
    this.registerEvent(this.app.vault.on("rename", schedule));
  }

  /** Reindex incremental em background (re-embeda só o que mudou via hash). */
  private async runAutoReindex() {
    this.autoReindexTimer = null;
    if (!this.settings.ragAutoReindex) return;
    if (!this.vectorIndex || this.vectorIndex.size === 0) return;

    // Cancela um reindex anterior ainda em andamento
    this.autoReindexController?.abort();
    this.autoReindexController = new AbortController();

    try {
      this.vectorIndex = await indexVault(this.vectorIndex, {
        app: this.app,
        openaiApiKey: this.settings.openaiApiKey,
        openrouterApiKey: this.settings.openrouterApiKey,
        geminiApiKey: this.settings.geminiApiKey,
        nimApiKey: this.settings.nimApiKey,
        model: this.settings.ragEmbeddingModel,
        profile: this.settings.ragQuantProfile,
        indexPath: this.settings.ragIndexPath,
        excludePaths: [
          this.settings.ragIndexPath,
          this.settings.chatsPath,
          this.settings.recordingsPath,
        ],
        shardSize: this.settings.ragStreamShards ? RAG_SHARD_SIZE : 0,
        signal: this.autoReindexController.signal,
      });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.error("[axxa] auto-reindex falhou:", err);
      }
    }
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_AXXA);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({ type: VIEW_TYPE_AXXA, active: true });
    }

    if (leaf) workspace.revealLeaf(leaf);
  }

  /** Campos de chave de API que NÃO ficam em plaintext no data.json — vão pro
   *  SecretStorage do SO (keychain), conforme guideline do Obsidian (1.11.4+).
   *  `ollamaEndpoint` NÃO entra aqui: é uma URL local, não um segredo. */
  private static readonly SECRET_FIELDS = [
    "openaiApiKey",
    "anthropicApiKey",
    "geminiApiKey",
    "openrouterApiKey",
    "nimApiKey",
  ] as const;

  /** ID do segredo no SecretStorage (lowercase + dashes). Ex: axxa-openai-key. */
  private secretId(field: string): string {
    return `axxa-${field.replace(/ApiKey$/, "")}-key`;
  }

  async loadSettings() {
    // loadData() lê do arquivo do plugin no vault — substitui localStorage.
    const saved = (await this.loadData()) ?? {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    // Object.assign é shallow — pra activeModels (Record por provider),
    // mescla por provider: providers não tocados pelo user mantêm defaults.
    this.settings.activeModels = {
      ...DEFAULT_SETTINGS.activeModels,
      ...(saved.activeModels ?? {}),
    };
    this.settings.discoveredEmbeddings = saved.discoveredEmbeddings ?? {};
    // Same pra effortConfigs — preserva overrides salvos do usuário.
    this.settings.effortConfigs = saved.effortConfigs ?? {};

    // Chaves de API: carrega do SecretStorage do SO (keychain), não do
    // data.json. Migra chaves legadas que ainda estejam em plaintext.
    this.loadSecrets(saved);
  }

  /** Popula as chaves em memória a partir do SecretStorage e migra o legado
   *  (chaves que ainda estavam em plaintext no data.json de versões antigas). */
  private loadSecrets(saved: Record<string, unknown>) {
    const ss = this.app.secretStorage;
    if (!ss) return; // runtime < 1.11.4 (sideload): mantém fallback no data.json
    let migrated = false;
    for (const f of AxxaPlugin.SECRET_FIELDS) {
      const id = this.secretId(f);
      const stored = ss.getSecret(id);
      if (stored) {
        this.settings[f] = stored;
      } else if (typeof saved[f] === "string" && saved[f]) {
        // Legado: chave em plaintext no data.json → move pro keychain do SO.
        ss.setSecret(id, saved[f] as string);
        this.settings[f] = saved[f] as string;
        migrated = true;
      }
    }
    // Reescreve o data.json já sem as chaves em plaintext.
    if (migrated) void this.saveData(this.persistableSettings());
  }

  /** Cópia das settings com as chaves zeradas — é isso que vai pro data.json
   *  (os valores reais vivem só em memória + no SecretStorage do SO). */
  private persistableSettings(): AxxaSettings {
    const copy = { ...this.settings };
    for (const f of AxxaPlugin.SECRET_FIELDS) copy[f] = "";
    return copy;
  }

  async saveSettings() {
    const ss = this.app.secretStorage;
    if (ss) {
      // Chaves vão pro SecretStorage; data.json é salvo sem elas.
      for (const f of AxxaPlugin.SECRET_FIELDS) {
        ss.setSecret(this.secretId(f), this.settings[f] ?? "");
      }
      await this.saveData(this.persistableSettings());
    } else {
      // Fallback (runtime sem SecretStorage): salva tudo no data.json.
      await this.saveData(this.settings);
    }
    // Reaplica a preferência de movimento (toggle reduce-motion → classe no body)
    this.applyMotionPreference();
    // Avisa quem tá escutando (ex.: AxxaApp pra re-renderizar com novo idioma)
    this.settingsListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error("[axxa] settings listener falhou:", err);
      }
    });
  }
}
