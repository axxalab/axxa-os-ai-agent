// src/components/settings/AxxaSettingsTab.ts
// Settings tab do AXXA OS com UI tabbed:
//   - Providers — OpenAI + Anthropic (chave, modelo, fetch da lista de modelos)
//   - Outros — paths, language, appearance (em breve)
//
// O fetch de modelos filtra legacy/audio/embeddings e mantém só os modernos.

import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type AxxaPlugin from "../../main";
import { openaiProvider } from "../../providers/openai";
import { anthropicProvider } from "../../providers/anthropic";
import { openrouterProvider } from "../../providers/openrouter";
import { ollamaProvider } from "../../providers/ollama";

type TabId = "providers" | "outros";

export class AxxaSettingsTab extends PluginSettingTab {
  plugin: AxxaPlugin;
  private activeTab: TabId = "providers";

  constructor(app: App, plugin: AxxaPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("axxa-settings-root");

    containerEl.createEl("h2", { text: "AXXA OS — AI Agent" });

    // Tabs
    const tabsEl = containerEl.createDiv({ cls: "axxa-settings-tabs" });
    this.createTabButton(tabsEl, "providers", "Providers");
    this.createTabButton(tabsEl, "outros", "Outros");

    // Content
    const contentEl = containerEl.createDiv({ cls: "axxa-settings-content" });
    if (this.activeTab === "providers") {
      this.renderProviders(contentEl);
    } else {
      this.renderOutros(contentEl);
    }
  }

  private createTabButton(parent: HTMLElement, id: TabId, label: string) {
    const btn = parent.createEl("button", {
      cls: "axxa-tab-btn" + (this.activeTab === id ? " axxa-tab-active" : ""),
      text: label,
    });
    btn.onclick = () => {
      this.activeTab = id;
      this.display();
    };
  }

  // ============================================================
  // Tab: Providers
  // ============================================================
  private renderProviders(parent: HTMLElement) {
    parent.createEl("p", {
      text:
        "Escolha o provider padrão e configure a API key correspondente. " +
        "Use 'Buscar modelos' pra carregar a lista atual da API.",
      cls: "setting-item-description",
    });

    // Provider seletor
    new Setting(parent)
      .setName("Provider padrão")
      .setDesc("Qual API usar nas conversas")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("openai", "OpenAI")
          .addOption("anthropic", "Anthropic (Claude)")
          .addOption("openrouter", "OpenRouter")
          .addOption("ollama", "Ollama (local)")
          .setValue(this.plugin.settings.defaultProvider)
          .onChange(async (value) => {
            this.plugin.settings.defaultProvider = value;
            await this.plugin.saveSettings();
          })
      );

    // OpenAI
    parent.createEl("h3", { text: "OpenAI" });

    new Setting(parent)
      .setName("API Key")
      .setDesc("sk-... — armazenada localmente no vault.")
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

    this.createModelField(
      parent,
      "OpenAI",
      this.plugin.settings.defaultModel,
      async (value) => {
        this.plugin.settings.defaultModel = value || "gpt-4o";
        await this.plugin.saveSettings();
      },
      () => openaiProvider.listModels(this.plugin.settings.openaiApiKey),
      "gpt-4o"
    );

    // Anthropic
    parent.createEl("h3", { text: "Anthropic (Claude)" });

    new Setting(parent)
      .setName("API Key")
      .setDesc("sk-ant-... — armazenada localmente.")
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

    this.createModelField(
      parent,
      "Anthropic",
      this.plugin.settings.anthropicModel,
      async (value) => {
        this.plugin.settings.anthropicModel = value || "claude-sonnet-4-6";
        await this.plugin.saveSettings();
      },
      () => anthropicProvider.listModels(this.plugin.settings.anthropicApiKey),
      "claude-sonnet-4-6"
    );

    // ============================================================
    // OpenRouter
    // ============================================================
    parent.createEl("h3", { text: "OpenRouter" });
    parent.createEl("p", {
      text: "Proxy multi-modelo. Modelos prefixados por provider (ex: anthropic/claude-3.5-sonnet).",
      cls: "setting-item-description",
    });

    new Setting(parent)
      .setName("API Key")
      .setDesc("sk-or-... — armazenada localmente.")
      .addText((text) => {
        text
          .setPlaceholder("sk-or-...")
          .setValue(this.plugin.settings.openrouterApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openrouterApiKey = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
        text.inputEl.autocomplete = "off";
      });

    this.createModelField(
      parent,
      "OpenRouter",
      this.plugin.settings.openrouterModel,
      async (value) => {
        this.plugin.settings.openrouterModel =
          value || "anthropic/claude-3.5-sonnet";
        await this.plugin.saveSettings();
      },
      () => openrouterProvider.listModels(this.plugin.settings.openrouterApiKey),
      "anthropic/claude-3.5-sonnet"
    );

    // ============================================================
    // Ollama
    // ============================================================
    parent.createEl("h3", { text: "Ollama (local)" });
    parent.createEl("p", {
      text: "LLMs locais. Precisa do servidor Ollama rodando (https://ollama.com).",
      cls: "setting-item-description",
    });

    new Setting(parent)
      .setName("Endpoint")
      .setDesc("URL do servidor Ollama (default: http://localhost:11434)")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:11434")
          .setValue(this.plugin.settings.ollamaEndpoint)
          .onChange(async (value) => {
            this.plugin.settings.ollamaEndpoint =
              value.trim() || "http://localhost:11434";
            await this.plugin.saveSettings();
          })
      );

    this.createModelField(
      parent,
      "Ollama",
      this.plugin.settings.ollamaModel,
      async (value) => {
        this.plugin.settings.ollamaModel = value || "llama3.2";
        await this.plugin.saveSettings();
      },
      () => ollamaProvider.listModels(this.plugin.settings.ollamaEndpoint),
      "llama3.2"
    );
  }

  /**
   * Campo de modelo com botão "Buscar modelos" — fetch via API e abre dropdown.
   * Os modelos que aparecem são FILTRADOS (sem legacy / áudio / embeddings).
   */
  private createModelField(
    parent: HTMLElement,
    providerLabel: string,
    currentValue: string,
    onSave: (value: string) => Promise<void>,
    fetchModels: () => Promise<string[]>,
    placeholder: string
  ) {
    const setting = new Setting(parent)
      .setName("Modelo")
      .setDesc(`Modelo padrão do ${providerLabel}. Use 'Buscar' pra ver os disponíveis.`);

    setting.addText((text) => {
      text
        .setPlaceholder(placeholder)
        .setValue(currentValue)
        .onChange(async (value) => {
          await onSave(value.trim());
        });
    });

    setting.addButton((btn) =>
      btn
        .setIcon("refresh-cw")
        .setTooltip("Buscar modelos via API")
        .onClick(async () => {
          btn.setDisabled(true);
          new Notice(`Buscando modelos do ${providerLabel}...`);
          try {
            const models = await fetchModels();
            if (!models.length) {
              new Notice(`Nenhum modelo retornado pelo ${providerLabel}.`);
              return;
            }
            // Substitui o text input por um dropdown com os modelos
            setting.controlEl.empty();
            const dropdown = setting.controlEl.createEl("select", {
              cls: "dropdown",
            });
            for (const m of models) {
              const opt = dropdown.createEl("option", { value: m, text: m });
              if (m === currentValue) opt.selected = true;
            }
            dropdown.onchange = async () => {
              await onSave(dropdown.value);
              new Notice(`Modelo definido: ${dropdown.value}`);
            };
            new Notice(`${models.length} modelos carregados.`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Erro desconhecido";
            new Notice(`Falha ao buscar modelos: ${msg}`);
          } finally {
            btn.setDisabled(false);
          }
        })
    );
  }

  // ============================================================
  // Tab: Outros
  // ============================================================
  private renderOutros(parent: HTMLElement) {
    parent.createEl("p", {
      text: "Configurações gerais — paths, idioma, aparência.",
      cls: "setting-item-description",
    });

    new Setting(parent)
      .setName("Idioma")
      .setDesc("Linguagem do plugin (sistema de i18n vem no Módulo 4)")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("pt-br", "Português (Brasil)")
          .addOption("en-us", "English (US)")
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(parent)
      .setName("Pasta dos chats")
      .setDesc("Onde os chats serão salvos no Vault (sistema de chats vem no Módulo 4)")
      .addText((text) =>
        text
          .setPlaceholder(".axxa/chats")
          .setValue(this.plugin.settings.chatsPath)
          .onChange(async (value) => {
            this.plugin.settings.chatsPath = value || ".axxa/chats";
            await this.plugin.saveSettings();
          })
      );

    new Setting(parent)
      .setName("Pasta das skills")
      .setDesc("Onde as skills serão salvas no Vault (sistema de skills vem no Módulo 7)")
      .addText((text) =>
        text
          .setPlaceholder(".axxa/skills")
          .setValue(this.plugin.settings.skillsPath)
          .onChange(async (value) => {
            this.plugin.settings.skillsPath = value || ".axxa/skills";
            await this.plugin.saveSettings();
          })
      );

    parent.createEl("h3", { text: "Em breve" });
    const todo = parent.createEl("ul");
    todo.createEl("li", { text: "Appearance (background, balloon) — Módulo 3" });
    todo.createEl("li", { text: "Vault Q&A (RAG) — Módulo 4.3" });
    todo.createEl("li", { text: "Agent Mode (file ops) — Módulo 6" });
    todo.createEl("li", { text: "Skills management — Módulo 7" });
  }
}
