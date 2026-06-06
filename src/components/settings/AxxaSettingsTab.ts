// src/components/settings/AxxaSettingsTab.ts
// Stub das Settings — só pra registrar a aba sem quebrar o import do main.ts.
// O conteúdo real será implementado no Módulo 2 (Multi-Provider + Settings).

import { App, PluginSettingTab } from "obsidian";
import type AxxaPlugin from "../../main";

export class AxxaSettingsTab extends PluginSettingTab {
  plugin: AxxaPlugin;

  constructor(app: App, plugin: AxxaPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "AXXA OS — AI Agent" });
    containerEl.createEl("p", {
      text: "Configurações detalhadas serão adicionadas no Módulo 2 (Multi-Provider + Settings).",
    });
  }
}
