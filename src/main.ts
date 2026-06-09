// src/main.ts
// Entry point do plugin. O Obsidian instancia AxxaPlugin ao carregar o plugin.
// É como o "componente raiz" no Figma — todo o resto é montado a partir daqui.

import { Plugin, WorkspaceLeaf, Platform } from "obsidian";
import { AxxaView, VIEW_TYPE_AXXA } from "./views/AxxaView";
import { AxxaSettingsTab } from "./components/settings/AxxaSettingsTab";
import { VectorIndex, loadIndex } from "./rag/vectorIndex";
import { registerBrandIcons } from "./components/_shared/brandIcons";
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
  defaultMode: string;
  defaultEffort: string;
  chatsPath: string;
  skillsPath: string;
  language: string;
  /** ID do background preset (none / sunset / ocean / forest / violet / mono).
   *  Aplicado como classe `axxa-bg-<id>` na .axxa-root. */
  background: string;
  /** Pasta no Vault onde gravações de áudio (hold-mic) são salvas. */
  recordingsPath: string;
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
  /** Code wrap em blocos de código markdown. Default false (scroll horizontal).
   *  Quando true, aplica `.axxa-code-wrap` na .axxa-root → pre quebra linha. */
  codeWrap: boolean;
  // ============ Agent Mode (Sprint G — v0.1.28) ============
  /** Nível de permissão do Agent Mode: "ask" | "vault" | "yolo".
   *  Ask = confirma cada destrutiva. Vault = só delete pergunta. Yolo = só
   *  irreversível pergunta. Default "ask" (mais conservador). */
  agentPermissionLevel: string;
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
  defaultMode: "chat",
  defaultEffort: "med",
  chatsPath: "axxa-ai/chats",
  skillsPath: "axxa-ai/skills",
  language: "pt-br",
  background: "none",
  recordingsPath: "axxa-ai/recordings",
  generationPath: "axxa-ai/generation",
  ragIndexPath: "axxa-ai/index",
  ragEmbeddingProvider: "openai",
  ragEmbeddingModel: "text-embedding-3-small",
  codeWrap: false,
  agentPermissionLevel: "ask",
  // Defaults slim — user pode adicionar mais via Settings → Outros → Chips
  composerChips: ["model", "effort", "speed", "in", "out"],
  listChips: ["mode", "model", "date"],
  // Vazio = usa DEFAULT_EFFORT_CONFIGS sem overrides. User edita via Settings.
  effortConfigs: {},
};

export default class AxxaPlugin extends Plugin {
  settings!: AxxaSettings;
  /** Índice vetorial RAG carregado em memória — compartilhado entre Settings
   *  (indexação) e AxxaApp (busca). null = ainda não foi carregado/indexado. */
  vectorIndex: VectorIndex | null = null;
  /** Listeners avisados a cada saveSettings — usados pra re-renderizar o
   *  React tree quando o user troca idioma ou outro setting reativo. */
  private settingsListeners = new Set<() => void>();

  /** Inscreve um callback chamado a cada saveSettings. Retorna unsubscribe. */
  onSettingsChange(cb: () => void): () => void {
    this.settingsListeners.add(cb);
    return () => this.settingsListeners.delete(cb);
  }

  async onload() {
    await this.loadSettings();

    // Registra os SVG marks dos providers (brand-openai/anthropic/etc).
    // Depois disso, setIcon(el, "brand-openai") funciona em qualquer lugar.
    registerBrandIcons();

    // Carrega índice RAG do disco se já existe. Falhas são silenciosas —
    // só significa que o user ainda não rodou "Indexar vault".
    try {
      this.vectorIndex = await loadIndex(
        this.app.vault.adapter,
        this.settings.ragIndexPath
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

    // Abre na sidebar direita quando o Obsidian termina de montar o layout.
    this.app.workspace.onLayoutReady(() => {
      this.activateView();
    });
  }

  onunload() {
    // Limpa a variável CSS pra não vazar entre reloads
    document.documentElement.style.removeProperty("--axxa-status-bar-clearance");
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
    // Same pra effortConfigs — preserva overrides salvos do usuário.
    this.settings.effortConfigs = saved.effortConfigs ?? {};
  }

  async saveSettings() {
    await this.saveData(this.settings);
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
