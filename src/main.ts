// src/main.ts
// Entry point do plugin. O Obsidian instancia AxxaPlugin ao carregar o plugin.
// É como o "componente raiz" no Figma — todo o resto é montado a partir daqui.

import { Plugin, WorkspaceLeaf, Platform } from "obsidian";
import { AxxaView, VIEW_TYPE_AXXA } from "./views/AxxaView";
import { AxxaSettingsTab } from "./components/settings/AxxaSettingsTab";

interface AxxaSettings {
  openaiApiKey: string;
  anthropicApiKey: string;
  openrouterApiKey: string;
  ollamaEndpoint: string;
  defaultProvider: string;
  /** Modelo usado pelo provider OpenAI (ex: gpt-4o, gpt-4o-mini) */
  defaultModel: string;
  /** Modelo usado pelo provider Anthropic (ex: claude-sonnet-4-6, claude-opus-4-8) */
  anthropicModel: string;
  /** Modelo usado pelo OpenRouter (ex: anthropic/claude-3.5-sonnet) */
  openrouterModel: string;
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
}

const DEFAULT_SETTINGS: AxxaSettings = {
  openaiApiKey: "",
  anthropicApiKey: "",
  openrouterApiKey: "",
  ollamaEndpoint: "http://localhost:11434",
  defaultProvider: "openai",
  defaultModel: "gpt-4o",
  anthropicModel: "claude-sonnet-4-6",
  openrouterModel: "anthropic/claude-3.5-sonnet",
  ollamaModel: "llama3.2",
  activeModels: {
    openai: ["gpt-4o", "gpt-4o-mini", "o1", "o3", "gpt-5"],
    anthropic: [
      "claude-opus-4-8",
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
    ],
    openrouter: [
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o",
      "meta-llama/llama-3.3-70b-instruct",
      "google/gemini-2.0-flash-001",
    ],
    ollama: ["llama3.2", "qwen2.5", "deepseek-r1", "mistral"],
  },
  defaultMode: "chat",
  defaultEffort: "med",
  chatsPath: "axxa-ai/chats",
  skillsPath: "axxa-ai/skills",
  language: "pt-br",
};

export default class AxxaPlugin extends Plugin {
  settings!: AxxaSettings;

  async onload() {
    await this.loadSettings();

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
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
