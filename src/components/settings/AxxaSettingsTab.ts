// src/components/settings/AxxaSettingsTab.ts
// Settings tab do AXXA OS com 5 sub-tabs:
//   OpenAI · Anthropic · OpenRouter · Ollama · Outros
//
// Provider padrão fica no topo, sempre visível (acima das tabs) — é um setting
// global que escolhe qual API é usada por default nas conversas.
//
// Toda string vem do i18n (getTranslations) — quando user troca idioma na tab
// Outros, plugin.saveSettings() dispara o listener e a Settings re-renderiza.

import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type AxxaPlugin from "../../main";
import { openaiProvider } from "../../providers/openai";
import { anthropicProvider } from "../../providers/anthropic";
import { openrouterProvider } from "../../providers/openrouter";
import { ollamaProvider } from "../../providers/ollama";
import { getTranslations, type Translations } from "../../i18n";

type ProviderTabId = "openai" | "anthropic" | "openrouter" | "ollama";
type TabId = ProviderTabId | "outros";

export class AxxaSettingsTab extends PluginSettingTab {
  plugin: AxxaPlugin;
  private activeTab: TabId = "openai";
  private unsubscribe?: () => void;

  constructor(app: App, plugin: AxxaPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const t = getTranslations(this.plugin.settings.language);
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("axxa-settings-root");

    containerEl.createEl("h2", { text: t.settings.title });

    // ============================================================
    // Provider padrão — sempre visível no topo, acima das tabs
    // ============================================================
    new Setting(containerEl)
      .setName(t.settings.defaultProvider)
      .setDesc(t.settings.defaultProviderDesc)
      .addDropdown((dd) =>
        dd
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

    // ============================================================
    // Tabs (5 sub-tabs)
    // ============================================================
    const tabsEl = containerEl.createDiv({ cls: "axxa-settings-tabs" });
    this.createTabButton(tabsEl, "openai", t.settings.tabs.openai);
    this.createTabButton(tabsEl, "anthropic", t.settings.tabs.anthropic);
    this.createTabButton(tabsEl, "openrouter", t.settings.tabs.openrouter);
    this.createTabButton(tabsEl, "ollama", t.settings.tabs.ollama);
    this.createTabButton(tabsEl, "outros", t.settings.tabs.outros);

    // ============================================================
    // Conteúdo da tab ativa
    // ============================================================
    const contentEl = containerEl.createDiv({ cls: "axxa-settings-content" });

    switch (this.activeTab) {
      case "openai":
        this.renderOpenAI(contentEl, t);
        break;
      case "anthropic":
        this.renderAnthropic(contentEl, t);
        break;
      case "openrouter":
        this.renderOpenRouter(contentEl, t);
        break;
      case "ollama":
        this.renderOllama(contentEl, t);
        break;
      case "outros":
        this.renderOutros(contentEl, t);
        break;
    }
  }

  hide() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  private createTabButton(parent: HTMLElement, id: TabId, label: string) {
    const isDefault =
      id !== "outros" && id === this.plugin.settings.defaultProvider;
    const btn = parent.createEl("button", {
      cls:
        "axxa-tab-btn" +
        (this.activeTab === id ? " axxa-tab-active" : "") +
        (isDefault ? " axxa-tab-default" : ""),
      text: label,
    });
    btn.onclick = () => {
      this.activeTab = id;
      this.display();
    };
  }

  // ============================================================
  // Tab: OpenAI
  // ============================================================
  private renderOpenAI(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.providerIntro,
      cls: "setting-item-description",
    });

    new Setting(parent)
      .setName(t.settings.apiKey)
      .setDesc(t.settings.apiKeyDescOpenai)
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
      t,
      "OpenAI",
      this.plugin.settings.defaultModel,
      async (value) => {
        this.plugin.settings.defaultModel = value || "gpt-4o";
        await this.plugin.saveSettings();
      },
      () => openaiProvider.listModels(this.plugin.settings.openaiApiKey),
      "gpt-4o"
    );

    this.createActiveModelsField(
      parent,
      t,
      "OpenAI",
      "openai",
      () => openaiProvider.listModels(this.plugin.settings.openaiApiKey),
      "gpt-3.5-turbo"
    );
  }

  // ============================================================
  // Tab: Anthropic
  // ============================================================
  private renderAnthropic(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.providerIntro,
      cls: "setting-item-description",
    });

    new Setting(parent)
      .setName(t.settings.apiKey)
      .setDesc(t.settings.apiKeyDescAnthropic)
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
      t,
      "Anthropic",
      this.plugin.settings.anthropicModel,
      async (value) => {
        this.plugin.settings.anthropicModel = value || "claude-sonnet-4-6";
        await this.plugin.saveSettings();
      },
      () => anthropicProvider.listModels(this.plugin.settings.anthropicApiKey),
      "claude-sonnet-4-6"
    );

    this.createActiveModelsField(
      parent,
      t,
      "Anthropic",
      "anthropic",
      () => anthropicProvider.listModels(this.plugin.settings.anthropicApiKey),
      "claude-2.1"
    );
  }

  // ============================================================
  // Tab: OpenRouter
  // ============================================================
  private renderOpenRouter(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.openrouterIntro,
      cls: "setting-item-description",
    });

    new Setting(parent)
      .setName(t.settings.apiKey)
      .setDesc(t.settings.apiKeyDescOpenrouter)
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
      t,
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

    this.createActiveModelsField(
      parent,
      t,
      "OpenRouter",
      "openrouter",
      () => openrouterProvider.listModels(this.plugin.settings.openrouterApiKey),
      "openai/gpt-3.5-turbo"
    );
  }

  // ============================================================
  // Tab: Ollama
  // ============================================================
  private renderOllama(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.ollamaIntro,
      cls: "setting-item-description",
    });

    new Setting(parent)
      .setName(t.settings.ollamaEndpoint)
      .setDesc(t.settings.ollamaEndpointDesc)
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
      t,
      "Ollama",
      this.plugin.settings.ollamaModel,
      async (value) => {
        this.plugin.settings.ollamaModel = value || "llama3.2";
        await this.plugin.saveSettings();
      },
      () => ollamaProvider.listModels(this.plugin.settings.ollamaEndpoint),
      "llama3.2"
    );

    this.createActiveModelsField(
      parent,
      t,
      "Ollama",
      "ollama",
      () => ollamaProvider.listModels(this.plugin.settings.ollamaEndpoint),
      "llama2"
    );
  }

  // ============================================================
  // Modelo padrão — input + Buscar
  // ============================================================
  private createModelField(
    parent: HTMLElement,
    t: Translations,
    providerLabel: string,
    currentValue: string,
    onSave: (value: string) => Promise<void>,
    fetchModels: () => Promise<string[]>,
    placeholder: string
  ) {
    const setting = new Setting(parent)
      .setName(t.settings.model)
      .setDesc(t.settings.modelDesc(providerLabel));

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
        .setTooltip(t.settings.modelFetchTooltip)
        .onClick(async () => {
          btn.setDisabled(true);
          new Notice(t.settings.modelSearchingNotice(providerLabel));
          try {
            const models = await fetchModels();
            if (!models.length) {
              new Notice(t.settings.modelNoneNotice(providerLabel));
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
              new Notice(t.settings.modelSetNotice(dropdown.value));
            };
            new Notice(t.settings.modelLoadedNotice(models.length));
          } catch (err) {
            const msg = err instanceof Error ? err.message : t.ai.unknownError;
            new Notice(t.settings.modelFailedNotice(msg));
          } finally {
            btn.setDisabled(false);
          }
        })
    );
  }

  // ============================================================
  // Modelos ativos — pills removíveis + input + Buscar (checkboxes)
  // ============================================================
  private createActiveModelsField(
    parent: HTMLElement,
    t: Translations,
    providerLabel: string,
    providerId: string,
    fetchModels: () => Promise<string[]>,
    placeholderExample: string
  ) {
    const section = parent.createDiv({ cls: "axxa-active-models-section" });

    new Setting(section)
      .setName(t.settings.activeModels)
      .setDesc(t.settings.activeModelsDesc(providerLabel));

    const listEl = section.createDiv({ cls: "axxa-active-models-list" });

    const renderList = () => {
      listEl.empty();
      const models = this.plugin.settings.activeModels[providerId] ?? [];
      if (models.length === 0) {
        listEl.createEl("p", {
          text: t.settings.activeModelsEmpty,
          cls: "axxa-active-models-empty",
        });
        return;
      }
      models.forEach((m) => {
        const pill = listEl.createDiv({ cls: "axxa-active-model-pill" });
        pill.createSpan({ text: m, cls: "axxa-active-model-name" });
        const removeBtn = pill.createEl("button", {
          cls: "axxa-active-model-remove",
          text: "×",
          attr: {
            "aria-label": `${t.settings.activeModelsRemoveTitle} ${m}`,
            title: t.settings.activeModelsRemoveTitle,
            type: "button",
          },
        });
        removeBtn.onclick = async () => {
          const list = this.plugin.settings.activeModels[providerId] ?? [];
          const idx = list.indexOf(m);
          if (idx >= 0) {
            list.splice(idx, 1);
            this.plugin.settings.activeModels[providerId] = list;
            await this.plugin.saveSettings();
            renderList();
          }
        };
      });
    };
    renderList();

    const addRow = section.createDiv({ cls: "axxa-active-models-add" });
    const input = addRow.createEl("input", {
      type: "text",
      placeholder: t.settings.activeModelsAddPlaceholder(placeholderExample),
      cls: "axxa-active-models-input",
    });
    const addBtn = addRow.createEl("button", {
      text: t.settings.activeModelsAddBtn,
      cls: "axxa-active-models-add-btn",
      attr: { type: "button" },
    });
    const fetchBtn = addRow.createEl("button", {
      text: t.settings.activeModelsFetchBtn,
      cls: "axxa-active-models-fetch-btn",
      attr: { type: "button" },
    });

    const doAdd = async () => {
      const v = input.value.trim();
      if (!v) return;
      const list = this.plugin.settings.activeModels[providerId] ?? [];
      if (list.includes(v)) {
        new Notice(t.settings.activeModelsAlready(v));
        return;
      }
      list.push(v);
      this.plugin.settings.activeModels[providerId] = list;
      await this.plugin.saveSettings();
      input.value = "";
      renderList();
      new Notice(t.settings.activeModelsAdded(v));
    };
    addBtn.onclick = doAdd;
    input.onkeydown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doAdd();
      }
    };

    const checkboxesEl = section.createDiv({ cls: "axxa-active-models-checkboxes" });

    fetchBtn.onclick = async () => {
      fetchBtn.setAttr("disabled", "true");
      const originalText = fetchBtn.textContent ?? t.settings.activeModelsFetchBtn;
      fetchBtn.textContent = t.settings.activeModelsFetchingBtn;
      try {
        const fetched = await fetchModels();
        if (!fetched.length) {
          new Notice(t.settings.modelNoneNotice(providerLabel));
          return;
        }
        checkboxesEl.empty();
        checkboxesEl.createEl("p", {
          text: t.settings.activeModelsAvailable(fetched.length),
          cls: "axxa-active-models-checkboxes-head",
        });
        fetched.forEach((m) => {
          const row = checkboxesEl.createDiv({
            cls: "axxa-active-models-checkbox-row",
          });
          const cb = row.createEl("input", {
            type: "checkbox",
            cls: "axxa-active-models-checkbox",
          });
          cb.checked = (
            this.plugin.settings.activeModels[providerId] ?? []
          ).includes(m);
          row.createSpan({ text: m });
          cb.onchange = async () => {
            const current =
              this.plugin.settings.activeModels[providerId] ?? [];
            if (cb.checked && !current.includes(m)) {
              current.push(m);
            } else if (!cb.checked) {
              const idx = current.indexOf(m);
              if (idx >= 0) current.splice(idx, 1);
            }
            this.plugin.settings.activeModels[providerId] = current;
            await this.plugin.saveSettings();
            renderList();
          };
          row.onclick = (e: MouseEvent) => {
            if (e.target !== cb) {
              cb.checked = !cb.checked;
              cb.dispatchEvent(new Event("change"));
            }
          };
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : t.ai.unknownError;
        new Notice(t.settings.modelFailedNotice(msg));
      } finally {
        fetchBtn.removeAttribute("disabled");
        fetchBtn.textContent = originalText;
      }
    };
  }

  // ============================================================
  // Tab: Outros (idioma, paths, em breve)
  // ============================================================
  private renderOutros(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.outrosIntro,
      cls: "setting-item-description",
    });

    new Setting(parent)
      .setName(t.settings.language)
      .setDesc(t.settings.languageDesc)
      .addDropdown((dropdown) =>
        dropdown
          .addOption("pt-br", t.settings.languagePtBr)
          .addOption("en-us", t.settings.languageEnUs)
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value;
            await this.plugin.saveSettings();
            // Re-render Settings em si pra refletir o novo idioma na hora
            this.display();
          })
      );

    new Setting(parent)
      .setName(t.settings.chatsPath)
      .setDesc(t.settings.chatsPathDesc)
      .addText((text) =>
        text
          .setPlaceholder("axxa-ai/chats")
          .setValue(this.plugin.settings.chatsPath)
          .onChange(async (value) => {
            this.plugin.settings.chatsPath = value || "axxa-ai/chats";
            await this.plugin.saveSettings();
          })
      );

    new Setting(parent)
      .setName(t.settings.skillsPath)
      .setDesc(t.settings.skillsPathDesc)
      .addText((text) =>
        text
          .setPlaceholder("axxa-ai/skills")
          .setValue(this.plugin.settings.skillsPath)
          .onChange(async (value) => {
            this.plugin.settings.skillsPath = value || "axxa-ai/skills";
            await this.plugin.saveSettings();
          })
      );

    new Setting(parent)
      .setName(t.settings.recordingsPath)
      .setDesc(t.settings.recordingsPathDesc)
      .addText((text) =>
        text
          .setPlaceholder("axxa-ai/recordings")
          .setValue(this.plugin.settings.recordingsPath)
          .onChange(async (value) => {
            this.plugin.settings.recordingsPath =
              value || "axxa-ai/recordings";
            await this.plugin.saveSettings();
          })
      );

    // ============================================================
    // Aparência — grid de swatches (5 presets + None)
    // ============================================================
    parent.createEl("h3", { text: t.settings.appearance });
    parent.createEl("p", {
      text: t.settings.appearanceDesc,
      cls: "setting-item-description",
    });
    this.renderBackgroundPicker(parent, t);

    parent.createEl("h3", { text: t.settings.comingSoon });
    const todo = parent.createEl("ul");
    t.settings.comingSoonItems.forEach((item) => {
      todo.createEl("li", { text: item });
    });
  }

  // ============================================================
  // Background picker — grid de swatches com preview do gradient
  // ============================================================
  private renderBackgroundPicker(parent: HTMLElement, t: Translations) {
    const ids: Array<keyof typeof t.settings.backgroundLabels> = [
      "none",
      "sunset",
      "ocean",
      "forest",
      "violet",
      "mono",
    ];
    const current = this.plugin.settings.background || "none";
    const grid = parent.createDiv({ cls: "axxa-bg-grid" });

    ids.forEach((id) => {
      const isActive = id === current;
      const btn = grid.createEl("button", {
        cls:
          "axxa-bg-option" + (isActive ? " axxa-bg-option-active" : ""),
        attr: {
          type: "button",
          "aria-label": t.settings.backgroundLabels[id],
          "aria-pressed": String(isActive),
        },
      });
      btn.createDiv({ cls: "axxa-bg-preview axxa-bg-preview-" + id });
      btn.createSpan({
        cls: "axxa-bg-option-label",
        text: t.settings.backgroundLabels[id],
      });
      btn.onclick = async () => {
        this.plugin.settings.background = id;
        await this.plugin.saveSettings();
        // Re-render Settings pra atualizar qual swatch tá ativo
        this.display();
      };
    });
  }
}
