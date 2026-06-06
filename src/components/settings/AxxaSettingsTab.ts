// src/components/settings/AxxaSettingsTab.ts
// Settings tab do AXXA OS — aba que aparece em Settings → Community Plugins → AXXA OS.
// Por enquanto só os campos críticos pro Módulo 1.3 (OpenAI key + model).
// O Módulo 2 vai expandir pra todos os providers + multi-modelo + appearance.

import { App, PluginSettingTab, Setting } from "obsidian";
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
      text:
        "Configure pelo menos a OpenAI API Key pra começar a conversar. " +
        "O Módulo 2 vai adicionar Anthropic, OpenRouter e Ollama.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("OpenAI API Key")
      .setDesc("Cole sua chave (sk-...). Fica armazenada localmente no vault, não vai pra lugar nenhum.")
      .addText((text) => {
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openaiApiKey = value.trim();
            await this.plugin.saveSettings();
          });
        // Esconde os caracteres da chave (estilo password)
        text.inputEl.type = "password";
        text.inputEl.autocomplete = "off";
      });

    new Setting(containerEl)
      .setName("Modelo padrão")
      .setDesc("Modelo da OpenAI usado nas conversas. Recomendados: gpt-4o (mais inteligente) ou gpt-4o-mini (mais barato).")
      .addText((text) =>
        text
          .setPlaceholder("gpt-4o")
          .setValue(this.plugin.settings.defaultModel)
          .onChange(async (value) => {
            this.plugin.settings.defaultModel = value.trim() || "gpt-4o";
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", { text: "Em breve" });
    const todo = containerEl.createEl("ul");
    todo.createEl("li", { text: "Anthropic / OpenRouter / Ollama (Módulo 2)" });
    todo.createEl("li", { text: "Effort selector (Low → Max) (Módulo 2)" });
    todo.createEl("li", { text: "Vault paths (chats, skills) (Módulo 4)" });
    todo.createEl("li", { text: "Appearance (background, balloon) (Módulo 3)" });
  }
}
