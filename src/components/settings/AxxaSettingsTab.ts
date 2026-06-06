// src/components/settings/AxxaSettingsTab.ts
// Settings tab do AXXA OS — aba que aparece em Settings → Community Plugins → AXXA OS.
// Suporte a multi-provider (OpenAI + Anthropic). OpenRouter/Ollama vêm depois.

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
        "Escolha o provider, configure a API key correspondente e ajuste o modelo padrão.",
      cls: "setting-item-description",
    });

    // ============================================================
    // Provider seletor
    // ============================================================
    new Setting(containerEl)
      .setName("Provider padrão")
      .setDesc("Qual API usar nas conversas")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("openai", "OpenAI")
          .addOption("anthropic", "Anthropic (Claude)")
          .setValue(this.plugin.settings.defaultProvider)
          .onChange(async (value) => {
            this.plugin.settings.defaultProvider = value;
            await this.plugin.saveSettings();
          })
      );

    // ============================================================
    // OpenAI
    // ============================================================
    containerEl.createEl("h3", { text: "OpenAI" });

    new Setting(containerEl)
      .setName("OpenAI API Key")
      .setDesc("Cole sua chave (sk-...). Fica armazenada localmente no vault.")
      .addText((text) => {
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openaiApiKey = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
        text.inputEl.autocomplete = "off";
      });

    new Setting(containerEl)
      .setName("Modelo OpenAI")
      .setDesc("Recomendados: gpt-4o (mais inteligente) ou gpt-4o-mini (mais barato).")
      .addText((text) =>
        text
          .setPlaceholder("gpt-4o")
          .setValue(this.plugin.settings.defaultModel)
          .onChange(async (value) => {
            this.plugin.settings.defaultModel = value.trim() || "gpt-4o";
            await this.plugin.saveSettings();
          })
      );

    // ============================================================
    // Anthropic
    // ============================================================
    containerEl.createEl("h3", { text: "Anthropic (Claude)" });

    new Setting(containerEl)
      .setName("Anthropic API Key")
      .setDesc("Cole sua chave (sk-ant-...). Fica armazenada localmente.")
      .addText((text) => {
        text
          .setPlaceholder("sk-ant-...")
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async (value) => {
            this.plugin.settings.anthropicApiKey = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
        text.inputEl.autocomplete = "off";
      });

    new Setting(containerEl)
      .setName("Modelo Anthropic")
      .setDesc(
        "Modelos atuais: claude-opus-4-8 (mais inteligente), claude-sonnet-4-6 (balanceado), claude-haiku-4-5-20251001 (rápido e barato)."
      )
      .addText((text) =>
        text
          .setPlaceholder("claude-sonnet-4-6")
          .setValue(this.plugin.settings.anthropicModel)
          .onChange(async (value) => {
            this.plugin.settings.anthropicModel = value.trim() || "claude-sonnet-4-6";
            await this.plugin.saveSettings();
          })
      );

    // ============================================================
    // Em breve
    // ============================================================
    containerEl.createEl("h3", { text: "Em breve" });
    const todo = containerEl.createEl("ul");
    todo.createEl("li", { text: "OpenRouter (multi-modelo)" });
    todo.createEl("li", { text: "Ollama (LLMs locais)" });
    todo.createEl("li", { text: "Effort selector (Low → Max)" });
    todo.createEl("li", { text: "Status line com tokens / contexto / conexão" });
    todo.createEl("li", { text: "Vault paths (chats, skills)" });
    todo.createEl("li", { text: "Appearance (background, balloon)" });
  }
}
