// src/main.ts
// Entry point do plugin. O Obsidian instancia AxxaPlugin ao carregar o plugin.
// É como o "componente raiz" no Figma — todo o resto é montado a partir daqui.

import { Plugin, WorkspaceLeaf } from "obsidian";
import { AxxaView, VIEW_TYPE_AXXA } from "./views/AxxaView";
import { AxxaSettingsTab } from "./components/settings/AxxaSettingsTab";

interface AxxaSettings {
  openaiApiKey: string;
  anthropicApiKey: string;
  openrouterApiKey: string;
  ollamaEndpoint: string;
  defaultProvider: string;
  defaultModel: string;
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
  defaultMode: "chat",
  defaultEffort: "med",
  chatsPath: ".axxa/chats",
  skillsPath: ".axxa/skills",
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

    // Abre na sidebar direita quando o Obsidian termina de montar o layout.
    this.app.workspace.onLayoutReady(() => {
      this.activateView();
    });
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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
