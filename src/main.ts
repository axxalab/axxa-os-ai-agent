// src/main.ts
// Entry point do plugin. O Obsidian instancia AxxaPlugin ao carregar o plugin.
// É como o "componente raiz" no Figma — todo o resto é montado a partir daqui.

import { Plugin, WorkspaceLeaf, Platform, Notice, type TAbstractFile } from "obsidian";
import { getProvider } from "./providers";
import { AxxaView, VIEW_TYPE_AXXA } from "./ui/AxxaView";
import { AxxaSettingsTab } from "./ui/SettingsTab";
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
} from "./core/chatPersistence";
import {
  hydrateModelInfoCache,
  getModelInfoCache,
  fetchAndCacheModelInfo,
  type EnrichedModelInfo,
} from "./providers/modelInfoStore";
import {
  loadSkills,
  seedExampleSkills,
  isSkillFilePath,
  type Skill,
} from "./skills/skills";
import type { Project } from "./projects";
import type {
  EffortConfig,
  EffortLevel,
} from "./core/effort";
import type { RoleId, RoleModelEntry } from "./providers/modelRoles";

export interface AxxaSettings {
  // ---- Providers (BYOK). As chaves vivem no SecretStorage do SO; aqui só em
  // memória (persistableSettings() zera antes de gravar o data.json).
  openaiApiKey: string;
  anthropicApiKey: string;
  geminiApiKey: string;
  openrouterApiKey: string;
  nimApiKey: string;
  ollamaEndpoint: string;
  /** Provider pré-selecionado num chat novo. */
  defaultProvider: string;
  /** Modelo por provider (o que a casca usa ao selecionar o provider). */
  defaultModel: string;
  anthropicModel: string;
  geminiModel: string;
  openrouterModel: string;
  nimModel: string;
  ollamaModel: string;
  /** Modelos conhecidos por provider — opções do seletor de modelo. */
  activeModels: Record<string, string[]>;
  /** Modelo-padrão por PAPEL (chat/reasoning/image/video/tts/embedding/other). */
  roleModels: Partial<Record<RoleId, RoleModelEntry>>;
  /** Provider preferido quando o MESMO modelo existe em 2+ providers. */
  modelProvider: Record<string, string>;
  /** Modelos de embedding descobertos via API, por provider (RAG). */
  discoveredEmbeddings: Record<string, string[]>;
  // ---- Sessão
  /** chat | vault-qa | agent */
  defaultMode: string;
  /** low | med | high | xhigh | max */
  defaultEffort: string;
  /** Overrides do usuário por nível de effort (ausente = DEFAULT_EFFORT_CONFIGS). */
  effortConfigs: Partial<Record<EffortLevel, Partial<EffortConfig>>>;
  /** Só "en-us" por enquanto. */
  language: string;
  // ---- Vault
  chatsPath: string;
  skillsPath: string;
  /** Projetos (agrupam chats + notas-fonte). */
  projects: Project[];
  // ---- RAG (Vault Q&A)
  ragIndexPath: string;
  ragEmbeddingProvider: string;
  ragEmbeddingModel: string;
  /** precision | balanced | light | minimal */
  ragQuantProfile: string;
  /** Índice em shards (memória limitada; busca lê do disco). */
  ragStreamShards: boolean;
  /** Reindexa sozinho quando notas mudam (opt-in — custa tokens). */
  ragAutoReindex: boolean;
  /** Já avisamos uma vez que o índice é grande demais pro mobile. */
  ragMobileSkipNoticeShown?: boolean;
  // ---- Agent
  /** ask | vault | yolo */
  agentPermissionLevel: string;
  /** Preview/diff antes de gravar qualquer escrita do agente. */
  agentDiffApproval: boolean;
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
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
    ],
    openrouter: [
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o",
      "meta-llama/llama-3.3-70b-instruct",
      "google/gemini-2.0-flash-001",
    ],
    nim: [
      "meta/llama-3.3-70b-instruct",
      "meta/llama-3.1-70b-instruct",
      "meta/llama-3.1-8b-instruct",
      "nvidia/llama-3.1-nemotron-70b-instruct",
      "mistralai/mixtral-8x22b-instruct-v0.1",
      "deepseek-ai/deepseek-r1",
      "qwen/qwen2.5-72b-instruct",
      "microsoft/phi-4",
    ],
    ollama: ["llama3.2", "qwen2.5", "deepseek-r1", "mistral"],
  },
  roleModels: {},
  modelProvider: {},
  discoveredEmbeddings: {},
  defaultMode: "chat",
  defaultEffort: "med",
  effortConfigs: {},
  language: "en-us",
  chatsPath: "axxa-ai/chats",
  skillsPath: "axxa-ai/skills",
  projects: [],
  ragIndexPath: "axxa-ai/index",
  ragEmbeddingProvider: "openai",
  ragEmbeddingModel: "text-embedding-3-small",
  ragQuantProfile: "balanced",
  ragStreamShards: false,
  ragAutoReindex: false,
  ragMobileSkipNoticeShown: false,
  agentPermissionLevel: "ask",
  agentDiffApproval: true,
};

export default class AxxaPlugin extends Plugin {
  settings!: AxxaSettings;
  /** Índice vetorial RAG carregado em memória — compartilhado entre Settings
   *  (indexação) e AxxaApp (busca). null = ainda não foi carregado/indexado. */
  vectorIndex: VectorIndex | null = null;
  /** (P1-69) Ref da settings tab — permite abrir numa aba específica. */
  settingsTab: AxxaSettingsTab | null = null;
  /** Listeners avisados a cada saveSettings — usados pra re-renderizar o
   *  React tree quando o user troca idioma ou outro setting reativo. */
  private settingsListeners = new Set<() => void>();
  /** Debounce + cancelamento do auto-reindex do RAG (opt-in). */
  private autoReindexTimer: number | null = null;
  private autoReindexController: AbortController | null = null;

  /** Skills carregados da pasta (settings.skillsPath) — viram slash-commands. */
  skills: Skill[] = [];
  /** Debounce do hot reload das skills (watcher do vault). v0.1.247 */
  private skillsReloadTimer: number | null = null;

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
  /** Versão do schema do índice persistido. Caches de versão desconhecida são
   *  descartados (cai pro walk, que reescreve no formato atual). v0.1.228 */
  private static readonly CHAT_INDEX_VERSION = 1;
  private async readChatIndex(): Promise<ChatSummary[] | null> {
    try {
      const p = this.chatIndexPath();
      if (!(await this.app.vault.adapter.exists(p))) return null;
      const parsed = JSON.parse(await this.app.vault.adapter.read(p));
      // Aceita o envelope versionado { v, items } e, por retrocompat, o array
      // cru de versões antigas. Versão desconhecida → descarta (volta pro walk).
      let items: unknown;
      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (
        parsed &&
        typeof parsed === "object" &&
        parsed.v === AxxaPlugin.CHAT_INDEX_VERSION
      ) {
        items = parsed.items;
      } else {
        return null;
      }
      if (!Array.isArray(items)) return null;
      // Valida o shape mínimo de cada item — descarta o cache se algo destoar
      // (JSON corrompido / formato antigo) e força o walk pra reconstruir.
      const valid = items.every(
        (it): it is ChatSummary =>
          !!it &&
          typeof it === "object" &&
          typeof (it as ChatSummary).id === "string" &&
          typeof (it as ChatSummary).date === "string"
      );
      if (!valid) return null;
      // Normaliza o `starred` — caches gravados antes do campo existir não o
      // trazem, e um undefined vazaria pro tipo (que promete boolean).
      return (items as ChatSummary[]).map((it) => ({
        ...it,
        starred: it.starred === true,
      }));
    } catch (err) {
      console.error("[axxa] readChatIndex falhou:", err);
      return null;
    }
  }
  private async writeChatIndex(arr: ChatSummary[]): Promise<void> {
    // Toda escrita do índice passa por aqui — cancela um write debounced ainda
    // pendente pra não disparar dois adapter.write concorrentes no mesmo path
    // (o snapshot que escrevemos agora já é o mais fresco). v0.1.228
    if (this.chatIndexWriteTimer !== null) {
      window.clearTimeout(this.chatIndexWriteTimer);
      this.chatIndexWriteTimer = null;
    }
    try {
      // Envelope versionado pra detectar/descartar caches de schema antigo.
      const envelope = { v: AxxaPlugin.CHAT_INDEX_VERSION, items: arr };
      await this.app.vault.adapter.write(
        this.chatIndexPath(),
        JSON.stringify(envelope)
      );
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
      this.chatIndexWriteTimer = null;
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
      // Assinatura inclui os campos que aparecem na UI (não só id+date), senão
      // uma edição externa de título/tokens/model com a mesma data passa batido
      // e o cache nunca reconcilia. v0.1.228
      const sig = (arr: ChatSummary[]) =>
        arr.length +
        ":" +
        arr
          .map(
            (c) =>
              c.id +
              "\x1f" +
              c.date +
              "\x1f" +
              c.title +
              "\x1f" +
              c.messageCount +
              "\x1f" +
              c.tokensIn +
              "\x1f" +
              c.tokensOut +
              "\x1f" +
              c.model
          )
          .join("|");
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
    // IMUTÁVEL (auditoria jul/2026): mutar in place mantinha a MESMA referência
    // de array — consumidores React que comparam referência (useEffect deps,
    // memo) nunca viam a mudança e as listas ficavam stale a sessão inteira.
    this.chatSummaries = [
      ...this.chatSummaries.filter((c) => c.id !== s.id),
      s,
    ].sort((a, b) => b.date.localeCompare(a.date));
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

  /** Credencial (key/endpoint) do provider — pro SCAN do seletor de modelo. */
  providerCredential(id: string): string {
    const s = this.settings;
    switch (id) {
      case "anthropic":
        return s.anthropicApiKey ?? "";
      case "gemini":
        return s.geminiApiKey ?? "";
      case "openrouter":
        return s.openrouterApiKey ?? "";
      case "nim":
        return s.nimApiKey ?? "";
      case "ollama":
        return s.ollamaEndpoint ?? "";
      default:
        return s.openaiApiKey ?? "";
    }
  }
  /** "SCAN" — lista os modelos do catálogo do provider (pode lançar). v0.1.223 */
  async scanModels(providerId: string): Promise<string[]> {
    const p = getProvider(providerId);
    if (!p.listModels) return [];
    return p.listModels(this.providerCredential(providerId));
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
              // Só avisa UMA vez por dispositivo — senão o Notice volta a cada
              // onload enquanto o índice continuar grande. v0.1.228
              if (this.settings.ragMobileSkipNoticeShown) return;
              const en = this.settings.language === "en-us";
              new Notice(
                en
                  ? `RAG index too large for mobile (${mb.toFixed(0)} MB) — semantic search is off here to avoid a crash. Use desktop or shrink the index.`
                  : `Índice RAG grande demais pro mobile (${mb.toFixed(0)} MB) — busca semântica desligada aqui pra evitar crash. Use no desktop ou reduza o índice.`
              );
              this.settings.ragMobileSkipNoticeShown = true;
              void this.saveSettings().catch((err) =>
                console.error("[axxa] não consegui persistir o flag do Notice RAG mobile:", err)
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
      name: "Open AI Agent",
      callback: () => this.activateView(),
    });

    // Settings tab — aparece em Settings -> Community Plugins -> AXXA OS.
    this.settingsTab = new AxxaSettingsTab(this.app, this);
    this.addSettingTab(this.settingsTab);

    // Mede a navbar mobile pra compensar layout (--axxa-status-bar-clearance)
    this.setupStatusBarClearance();

    // Auto-reindex do RAG (opt-in) — re-embeda notas modificadas em background
    this.setupAutoReindex();

    // Skills editadas no vault recarregam sozinhas (SKL-03)
    this.setupSkillsWatcher();

    // NÃO auto-abrimos o painel no startup — o Obsidian abre "normal". O AI
    // Agent abre sob demanda pela ribbon (ícone do robô) ou pelo comando
    // "Abrir AI Agent". Se o painel estava aberto ao fechar o Obsidian, o
    // próprio Obsidian restaura o layout — respeitando o que o usuário deixou.
  }

  onunload() {
    // Limpa a variável CSS pra não vazar entre reloads
    document.documentElement.style.removeProperty("--axxa-status-bar-clearance");
    // Cancela timers/abort pendentes pra não vazar entre reloads (v0.1.228)
    if (this.autoReindexTimer !== null) {
      window.clearTimeout(this.autoReindexTimer);
      this.autoReindexTimer = null;
    }
    if (this.chatIndexWriteTimer !== null) {
      window.clearTimeout(this.chatIndexWriteTimer);
      this.chatIndexWriteTimer = null;
    }
    if (this.skillsReloadTimer !== null) {
      window.clearTimeout(this.skillsReloadTimer);
      this.skillsReloadTimer = null;
    }
    this.autoReindexController?.abort();
    this.autoReindexController = null;
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
    // ...e quando um setting muda: ligar/desligar o fullscreen esconde/mostra a
    // navbar, e sem esta medida a var guardava a altura ANTIGA — o sheet do
    // Vault Q&A ficava boiando acima da borda. O toggle roda no mesmo tick que
    // aplica as classes, então medimos no frame seguinte. v0.1.254
    this.settingsListeners.add(() =>
      window.requestAnimationFrame(() => update())
    );
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

  /**
   * Hot reload das skills (SKL-03). Criar/editar/renomear/apagar um .md dentro
   * de settings.skillsPath recarrega a lista sozinho — antes o autor editava a
   * skill e o /comando continuava com o corpo velho até reabrir o Obsidian.
   *
   * Debounce de 600ms: salvar no Obsidian dispara `modify` em rajada, e ler a
   * pasta inteira a cada tecla seria desperdício. O rename entrega o caminho
   * ANTIGO no 2º argumento — checa os dois pra pegar a saída da pasta também.
   */
  private setupSkillsWatcher() {
    const schedule = (file: TAbstractFile, oldPath?: string) => {
      const path = file?.path ?? "";
      const inFolder =
        isSkillFilePath(path, this.settings.skillsPath) ||
        (!!oldPath && isSkillFilePath(oldPath, this.settings.skillsPath));
      if (!inFolder) return;
      if (this.skillsReloadTimer !== null) {
        window.clearTimeout(this.skillsReloadTimer);
      }
      this.skillsReloadTimer = window.setTimeout(() => {
        this.skillsReloadTimer = null;
        void this.reloadSkills();
      }, 600);
    };

    this.registerEvent(this.app.vault.on("modify", (f) => schedule(f)));
    this.registerEvent(this.app.vault.on("create", (f) => schedule(f)));
    this.registerEvent(this.app.vault.on("delete", (f) => schedule(f)));
    this.registerEvent(
      this.app.vault.on("rename", (f, oldPath) => schedule(f, oldPath))
    );
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
      // getRightLeaf(false) pode retornar null (sem split direito disponível);
      // força a criação como fallback pra view não falhar em silêncio. v0.1.228
      leaf = workspace.getRightLeaf(false) ?? workspace.getRightLeaf(true);
      await leaf?.setViewState({ type: VIEW_TYPE_AXXA, active: true });
    }

    if (leaf) workspace.revealLeaf(leaf);
    else {
      const en = this.settings.language === "en-us";
      new Notice(
        en
          ? "Couldn't open the AXXA panel — try toggling the right sidebar."
          : "Não consegui abrir o painel do AXXA — tente abrir a barra lateral direita."
      );
    }
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
    // PT-BR removido (base 1.0) — força en-us e migra quem estava salvo em pt-br.
    this.settings.language = "en-us";
    // Object.assign é shallow — pra activeModels (Record por provider),
    // mescla por provider: providers não tocados pelo user mantêm defaults.
    this.settings.activeModels = {
      ...DEFAULT_SETTINGS.activeModels,
      ...(saved.activeModels ?? {}),
    };
    this.settings.discoveredEmbeddings = saved.discoveredEmbeddings ?? {};
    // roleModels: ★ por papel (chat/reasoning/image/video/tts/embedding). Quando
    // ainda não há nada salvo, semeia dos defaults espalhados (default do provider
    // ativo → chat; ragEmbeddingModel → embedding). Migração única. v0.1.236
    this.settings.modelProvider = saved.modelProvider ?? {};
    this.settings.roleModels =
      saved.roleModels && Object.keys(saved.roleModels).length
        ? saved.roleModels
        : this.seedRoleModels();
    // Same pra effortConfigs — preserva overrides salvos do usuário.
    this.settings.effortConfigs = saved.effortConfigs ?? {};

    // Chaves de API: carrega do SecretStorage do SO (keychain), não do
    // data.json. Migra chaves legadas que ainda estejam em plaintext.
    this.loadSecrets(saved);
  }

  /** Semeia roleModels a partir dos defaults legados (migração única): o default
   *  do provider ativo vira o ★ de chat; o modelo do RAG vira o ★ de embedding. */
  private seedRoleModels(): Partial<Record<RoleId, RoleModelEntry>> {
    const s = this.settings;
    const roles: Partial<Record<RoleId, RoleModelEntry>> = {};
    const prov = s.defaultProvider || "openai";
    const chat = this.providerDefaultModel(prov);
    if (chat) roles.chat = { model: chat, provider: prov };
    if (s.ragEmbeddingModel) {
      roles.embedding = {
        model: s.ragEmbeddingModel,
        provider: s.ragEmbeddingProvider || "openai",
      };
    }
    return roles;
  }

  /** Modelo escolhido pra um PAPEL (Connections → Models). Consumidores novos
   *  (geração de imagem/vídeo, cloud TTS) leem o ★ por aqui. v0.1.236 */
  roleModel(role: RoleId): RoleModelEntry | undefined {
    return this.settings.roleModels?.[role];
  }

  /** Modelo-padrão atual de um provider (lê os campos legados por provider). */
  private providerDefaultModel(provider: string): string {
    const s = this.settings;
    switch (provider) {
      case "anthropic":
        return s.anthropicModel;
      case "gemini":
        return s.geminiModel;
      case "openrouter":
        return s.openrouterModel;
      case "nim":
        return s.nimModel;
      case "ollama":
        return s.ollamaModel;
      default:
        return s.defaultModel;
    }
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
    // Reescreve o data.json já sem as chaves em plaintext. Fire-and-forget
    // (não dá pra await aqui — loadSecrets é chamado no fim do loadSettings),
    // mas encadeia um .catch pra não engolir falha de IO em silêncio. v0.1.228
    if (migrated) {
      void this.saveData(this.persistableSettings()).catch((err) =>
        console.error("[axxa] migração de secrets (saveData) falhou:", err)
      );
    }
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
