// src/components/settings/AxxaSettingsTab.ts
// Settings tab do AXXA OS com TABS ANINHADAS (Sprint v0.1.26 → v0.1.33):
//
//   Top-level: Providers · Outros
//   ↳ Providers tem sub-tabs estilo segmented control:
//      OpenAI · Anthropic · Gemini · OpenRouter · Nvidia NIM · Ollama
//
// Provider padrão fica DENTRO da aba Providers (não global) — assim a aba
// Outros não fica com setting sobrando que não é do tema dela.
//
// Background do user é aplicado também aqui (.axxa-settings-root.axxa-bg-X)
// pra ficar consistente com a view principal.

import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type AxxaPlugin from "../../main";
import { openaiProvider } from "../../providers/openai";
import { anthropicProvider } from "../../providers/anthropic";
import { geminiProvider } from "../../providers/gemini";
import { openrouterProvider } from "../../providers/openrouter";
import { nimProvider } from "../../providers/nim";
import { ollamaProvider } from "../../providers/ollama";
import { getTranslations, type Translations } from "../../i18n";
import { indexVault, type IndexProgress } from "../../rag/indexer";
import { deleteIndex } from "../../rag/vectorIndex";
import { EMBEDDING_MODELS } from "../../rag/types";

type TopTabId = "providers" | "outros";
type ProviderTabId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "nim"
  | "ollama";

export class AxxaSettingsTab extends PluginSettingTab {
  plugin: AxxaPlugin;
  /** Top-level tab (Providers / Outros) */
  private activeTopTab: TopTabId = "providers";
  /** Sub-tab quando topTab = providers */
  private activeProviderTab: ProviderTabId = "openai";
  private unsubscribe?: () => void;
  /** Controller usado pra cancelar uma indexação em andamento. */
  private indexAbortController: AbortController | null = null;

  constructor(app: App, plugin: AxxaPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const t = getTranslations(this.plugin.settings.language);
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("axxa-settings-root");

    // Aplica background do user (Sprint D + fix v0.1.26): permite ver o tema
    // tanto na view principal quanto nas Settings.
    Array.from(containerEl.classList).forEach((c) => {
      if (c.startsWith("axxa-bg-")) containerEl.removeClass(c);
    });
    containerEl.addClass(
      "axxa-bg-" + (this.plugin.settings.background || "none")
    );

    containerEl.createEl("h2", { text: t.settings.title });

    // ============================================================
    // Top-level tabs (Providers / Outros)
    // ============================================================
    const topTabsEl = containerEl.createDiv({ cls: "axxa-settings-tabs" });
    this.createTopTabButton(topTabsEl, "providers", t.settings.topTabs.providers);
    this.createTopTabButton(topTabsEl, "outros", t.settings.topTabs.outros);

    // ============================================================
    // Conteúdo da top-tab ativa
    // ============================================================
    const contentEl = containerEl.createDiv({ cls: "axxa-settings-content" });

    if (this.activeTopTab === "providers") {
      this.renderProvidersTab(contentEl, t);
    } else {
      this.renderOutros(contentEl, t);
    }
  }

  hide() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  /** Botão de top-tab (Providers / Outros) */
  private createTopTabButton(
    parent: HTMLElement,
    id: TopTabId,
    label: string
  ) {
    const btn = parent.createEl("button", {
      cls:
        "axxa-tab-btn" + (this.activeTopTab === id ? " axxa-tab-active" : ""),
      text: label,
    });
    btn.onclick = () => {
      this.activeTopTab = id;
      this.display();
    };
  }

  // ============================================================
  // Tab "Providers" — header (default + intro) + sub-tabs
  // ============================================================
  private renderProvidersTab(parent: HTMLElement, t: Translations) {
    // Provider padrão — vive dentro do tema "Providers"
    new Setting(parent)
      .setName(t.settings.defaultProvider)
      .setDesc(t.settings.defaultProviderDesc)
      .addDropdown((dd) =>
        dd
          .addOption("openai", "OpenAI")
          .addOption("anthropic", "Anthropic (Claude)")
          .addOption("gemini", "Google Gemini")
          .addOption("openrouter", "OpenRouter")
          .addOption("nim", "Nvidia NIM")
          .addOption("ollama", "Ollama (local)")
          .setValue(this.plugin.settings.defaultProvider)
          .onChange(async (value) => {
            this.plugin.settings.defaultProvider = value;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    // Sub-tabs estilo segmented control (pill container)
    // Ordem: big labs (OpenAI · Anthropic · Gemini) → agregadores
    // (OpenRouter · NIM) → local (Ollama). flex-wrap quebra em mobile.
    const subTabsEl = parent.createDiv({ cls: "axxa-settings-subtabs" });
    this.createProviderSubTab(subTabsEl, "openai", t.settings.tabs.openai);
    this.createProviderSubTab(subTabsEl, "anthropic", t.settings.tabs.anthropic);
    this.createProviderSubTab(subTabsEl, "gemini", t.settings.tabs.gemini);
    this.createProviderSubTab(subTabsEl, "openrouter", t.settings.tabs.openrouter);
    this.createProviderSubTab(subTabsEl, "nim", t.settings.tabs.nim);
    this.createProviderSubTab(subTabsEl, "ollama", t.settings.tabs.ollama);

    // Conteúdo da sub-tab
    const subContentEl = parent.createDiv({ cls: "axxa-settings-subcontent" });
    switch (this.activeProviderTab) {
      case "openai":
        this.renderOpenAI(subContentEl, t);
        break;
      case "anthropic":
        this.renderAnthropic(subContentEl, t);
        break;
      case "gemini":
        this.renderGemini(subContentEl, t);
        break;
      case "openrouter":
        this.renderOpenRouter(subContentEl, t);
        break;
      case "nim":
        this.renderNim(subContentEl, t);
        break;
      case "ollama":
        this.renderOllama(subContentEl, t);
        break;
    }
  }

  /** Botão de sub-tab dos providers (com bolinha pro default) */
  private createProviderSubTab(
    parent: HTMLElement,
    id: ProviderTabId,
    label: string
  ) {
    const isDefault = id === this.plugin.settings.defaultProvider;
    const btn = parent.createEl("button", {
      cls:
        "axxa-subtab-btn" +
        (this.activeProviderTab === id ? " axxa-subtab-active" : "") +
        (isDefault ? " axxa-subtab-default" : ""),
      text: label,
    });
    btn.onclick = () => {
      this.activeProviderTab = id;
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
  // Tab: Gemini (Google) — via endpoint OpenAI-compat
  // ============================================================
  private renderGemini(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.geminiIntro,
      cls: "setting-item-description",
    });

    new Setting(parent)
      .setName(t.settings.apiKey)
      .setDesc(t.settings.apiKeyDescGemini)
      .addText((text) => {
        text
          .setPlaceholder("AIza...")
          .setValue(this.plugin.settings.geminiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.geminiApiKey = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
        text.inputEl.autocomplete = "off";
      });

    this.createModelField(
      parent,
      t,
      "Gemini",
      this.plugin.settings.geminiModel,
      async (value) => {
        this.plugin.settings.geminiModel = value || "gemini-2.5-flash";
        await this.plugin.saveSettings();
      },
      () => geminiProvider.listModels(this.plugin.settings.geminiApiKey),
      "gemini-2.5-flash"
    );

    this.createActiveModelsField(
      parent,
      t,
      "Gemini",
      "gemini",
      () => geminiProvider.listModels(this.plugin.settings.geminiApiKey),
      "gemini-2.5-pro"
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
  // Tab: Nvidia NIM (hospedado em integrate.api.nvidia.com)
  // ============================================================
  private renderNim(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.nimIntro,
      cls: "setting-item-description",
    });

    new Setting(parent)
      .setName(t.settings.apiKey)
      .setDesc(t.settings.apiKeyDescNim)
      .addText((text) => {
        text
          .setPlaceholder("nvapi-...")
          .setValue(this.plugin.settings.nimApiKey)
          .onChange(async (value) => {
            this.plugin.settings.nimApiKey = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
        text.inputEl.autocomplete = "off";
      });

    this.createModelField(
      parent,
      t,
      "Nvidia NIM",
      this.plugin.settings.nimModel,
      async (value) => {
        this.plugin.settings.nimModel =
          value || "nvidia/llama-3.3-nemotron-super-49b-v1.5";
        await this.plugin.saveSettings();
      },
      () => nimProvider.listModels(this.plugin.settings.nimApiKey),
      "nvidia/llama-3.3-nemotron-super-49b-v1.5"
    );

    this.createActiveModelsField(
      parent,
      t,
      "Nvidia NIM",
      "nim",
      () => nimProvider.listModels(this.plugin.settings.nimApiKey),
      "meta/llama-3.3-70b-instruct"
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

    // Code wrap toggle — quando true, code blocks quebram linhas em vez
    // de scrollar (útil em mobile / sidebars estreitos)
    new Setting(parent)
      .setName(t.settings.codeWrap)
      .setDesc(t.settings.codeWrapDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.codeWrap)
          .onChange(async (value) => {
            this.plugin.settings.codeWrap = value;
            await this.plugin.saveSettings();
          })
      );

    // Agent Mode permission level (Sprint G — v0.1.28)
    new Setting(parent)
      .setName(t.agent.permissionLevel)
      .setDesc(t.agent.permissionLevelDesc)
      .addDropdown((dd) =>
        dd
          .addOption("ask", t.agent.permissionAsk)
          .addOption("vault", t.agent.permissionVault)
          .addOption("yolo", t.agent.permissionYolo)
          .setValue(this.plugin.settings.agentPermissionLevel || "ask")
          .onChange(async (value) => {
            this.plugin.settings.agentPermissionLevel = value;
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

    // ============================================================
    // RAG — Vault Q&A com embeddings
    // ============================================================
    parent.createEl("h3", { text: t.settings.rag });
    parent.createEl("p", {
      text: t.settings.ragDesc,
      cls: "setting-item-description",
    });
    this.renderRagSection(parent, t);

    parent.createEl("h3", { text: t.settings.comingSoon });
    const todo = parent.createEl("ul");
    t.settings.comingSoonItems.forEach((item) => {
      todo.createEl("li", { text: item });
    });
  }

  // ============================================================
  // RAG section — stats + indexing controls
  // ============================================================
  private renderRagSection(parent: HTMLElement, t: Translations) {
    const section = parent.createDiv({ cls: "axxa-rag-section" });

    // ---- Provider dropdown ----
    new Setting(section)
      .setName(t.settings.ragProvider)
      .setDesc(t.settings.ragProviderDesc)
      .addDropdown((dd) =>
        dd
          .addOption("openai", "OpenAI (texto)")
          .addOption("openrouter", "OpenRouter (multimodal free)")
          .setValue(this.plugin.settings.ragEmbeddingProvider)
          .onChange(async (value) => {
            this.plugin.settings.ragEmbeddingProvider = value;
            // Quando troca provider, escolhe automaticamente o 1º model dele
            // (senão fica modelo openai com provider openrouter — inválido)
            const firstModel = EMBEDDING_MODELS.find(
              (m) => m.provider === value
            );
            if (firstModel) {
              this.plugin.settings.ragEmbeddingModel = firstModel.model;
            }
            await this.plugin.saveSettings();
            this.display();
          })
      );

    // ---- Model dropdown ----
    new Setting(section)
      .setName(t.settings.ragModel)
      .setDesc(t.settings.ragModelDesc)
      .addDropdown((dd) => {
        EMBEDDING_MODELS.filter(
          (m) => m.provider === this.plugin.settings.ragEmbeddingProvider
        ).forEach((m) => {
          // Label: model + dim + price + badges (free / multimodal)
          const badges: string[] = [];
          if (m.free) badges.push("FREE");
          if (m.supportsImage) badges.push("🖼️");
          const badgeStr = badges.length > 0 ? ` [${badges.join(" ")}]` : "";
          const priceStr =
            m.pricePerMillion === 0
              ? ""
              : ` · $${m.pricePerMillion}/M`;
          dd.addOption(
            m.model,
            `${m.model} (${m.dim}d${priceStr})${badgeStr}`
          );
        });
        dd.setValue(this.plugin.settings.ragEmbeddingModel).onChange(
          async (value) => {
            this.plugin.settings.ragEmbeddingModel = value;
            await this.plugin.saveSettings();
            this.display();
          }
        );
      });

    // ---- Index path ----
    new Setting(section)
      .setName(t.settings.ragIndexPath)
      .setDesc(t.settings.ragIndexPathDesc)
      .addText((text) =>
        text
          .setPlaceholder("axxa-ai/index")
          .setValue(this.plugin.settings.ragIndexPath)
          .onChange(async (value) => {
            this.plugin.settings.ragIndexPath = value || "axxa-ai/index";
            await this.plugin.saveSettings();
          })
      );

    // ---- Stats line ----
    const statsEl = section.createDiv({ cls: "axxa-rag-stats" });
    this.renderRagStats(statsEl, t);

    // ---- Action buttons ----
    const actionsEl = section.createDiv({ cls: "axxa-rag-actions" });

    const indexBtn = actionsEl.createEl("button", {
      cls: "axxa-rag-btn axxa-rag-btn-primary",
      text: t.settings.ragIndexBtn,
      attr: { type: "button" },
    });
    const reindexBtn = actionsEl.createEl("button", {
      cls: "axxa-rag-btn",
      text: t.settings.ragReindexBtn,
      attr: { type: "button" },
    });
    const clearBtn = actionsEl.createEl("button", {
      cls: "axxa-rag-btn axxa-rag-btn-danger",
      text: t.settings.ragClearBtn,
      attr: { type: "button" },
    });

    // ---- Progress area (escondido até começar) ----
    const progressEl = section.createDiv({ cls: "axxa-rag-progress" });
    progressEl.style.display = "none";

    indexBtn.onclick = () => this.runIndex(false, indexBtn, reindexBtn, clearBtn, progressEl, statsEl, t);
    reindexBtn.onclick = () => this.runIndex(true, indexBtn, reindexBtn, clearBtn, progressEl, statsEl, t);
    clearBtn.onclick = async () => {
      if (!confirm(t.settings.ragClearConfirm)) return;
      try {
        await deleteIndex(this.plugin.app.vault.adapter, this.plugin.settings.ragIndexPath);
        this.plugin.vectorIndex = null;
        this.renderRagStats(statsEl, t);
        new Notice("Índice removido.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro";
        new Notice(`Falha: ${msg}`);
      }
    };
  }

  /** Renderiza o estado atual do índice (chunks/files/data ou empty) */
  private renderRagStats(el: HTMLElement, t: Translations) {
    el.empty();
    const idx = this.plugin.vectorIndex;
    if (!idx || idx.size === 0) {
      el.createSpan({
        text: t.settings.ragStatsEmpty,
        cls: "axxa-rag-stats-empty",
      });
      return;
    }
    const date = idx.lastIndexedAt
      ? new Date(idx.lastIndexedAt).toLocaleString()
      : "—";
    el.createSpan({
      text: t.settings.ragStats(idx.size, idx.fileCount, date),
      cls: "axxa-rag-stats-line",
    });
    // Aviso se modelo do índice ≠ modelo configurado
    if (idx.model !== this.plugin.settings.ragEmbeddingModel) {
      el.createEl("br");
      el.createSpan({
        text: t.settings.ragStatsMismatch,
        cls: "axxa-rag-stats-warning",
      });
    }
  }

  /** Roda a indexação. fresh=true → começa do zero (ignora índice prévio) */
  private async runIndex(
    fresh: boolean,
    indexBtn: HTMLButtonElement,
    reindexBtn: HTMLButtonElement,
    clearBtn: HTMLButtonElement,
    progressEl: HTMLElement,
    statsEl: HTMLElement,
    t: Translations
  ) {
    // Valida API key correta com base no provider do modelo escolhido
    const modelSpec = EMBEDDING_MODELS.find(
      (m) => m.model === this.plugin.settings.ragEmbeddingModel
    );
    if (modelSpec?.provider === "openrouter") {
      if (!this.plugin.settings.openrouterApiKey.trim()) {
        new Notice(t.settings.ragNoOpenRouterKey);
        return;
      }
    } else {
      if (!this.plugin.settings.openaiApiKey.trim()) {
        new Notice(t.settings.ragNoApiKey);
        return;
      }
    }

    // Desabilita botões durante indexação, habilita cancelamento
    indexBtn.disabled = true;
    reindexBtn.disabled = true;
    clearBtn.disabled = true;

    progressEl.empty();
    progressEl.style.display = "flex";

    const progressBar = progressEl.createDiv({ cls: "axxa-rag-progress-bar" });
    const progressFill = progressBar.createDiv({ cls: "axxa-rag-progress-fill" });
    const progressLabel = progressEl.createDiv({ cls: "axxa-rag-progress-label" });
    const cancelBtn = progressEl.createEl("button", {
      cls: "axxa-rag-btn axxa-rag-btn-cancel",
      text: t.settings.ragIndexingCancel,
      attr: { type: "button" },
    });

    this.indexAbortController = new AbortController();
    cancelBtn.onclick = () => this.indexAbortController?.abort();

    const handleProgress = (p: IndexProgress) => {
      if (p.phase === "scanning") {
        progressLabel.textContent = t.settings.ragIndexingPhaseScanning(
          p.filesScanned,
          p.filesTotal
        );
        const pct = p.filesTotal > 0 ? (p.filesScanned / p.filesTotal) * 50 : 0;
        progressFill.style.width = `${pct}%`;
      } else if (p.phase === "embedding") {
        // Mostra imagens separadas pra ficar claro o que tá rolando
        const imgPart =
          p.imagesEmbedded > 0 ? ` · 🖼️ ${p.imagesEmbedded}` : "";
        progressLabel.textContent =
          t.settings.ragIndexingPhaseEmbedding(
            p.filesEmbedded,
            p.filesToEmbed,
            p.chunksEmbedded
          ) + imgPart;
        const pct =
          p.filesToEmbed > 0
            ? 50 + (p.filesEmbedded / p.filesToEmbed) * 50
            : 100;
        progressFill.style.width = `${pct}%`;
      } else if (p.phase === "done") {
        const extras: string[] = [];
        if (p.imagesEmbedded > 0)
          extras.push(`🖼️ ${p.imagesEmbedded} imagens`);
        if (p.audioSkipped > 0)
          extras.push(`🎙️ ${p.audioSkipped} áudios pulados`);
        const extra = extras.length > 0 ? ` · ${extras.join(" · ")}` : "";
        progressLabel.textContent =
          t.settings.ragIndexingPhaseDone(p.chunksEmbedded, p.tokensUsed) +
          extra;
        progressFill.style.width = "100%";
      }
    };

    try {
      const prev = fresh ? null : this.plugin.vectorIndex;
      const newIndex = await indexVault(prev, {
        app: this.plugin.app,
        openaiApiKey: this.plugin.settings.openaiApiKey,
        openrouterApiKey: this.plugin.settings.openrouterApiKey,
        model: this.plugin.settings.ragEmbeddingModel,
        indexPath: this.plugin.settings.ragIndexPath,
        // Não indexa pastas internas do AXXA pra não poluir o vetor
        excludePaths: [
          this.plugin.settings.ragIndexPath,
          this.plugin.settings.chatsPath,
          this.plugin.settings.recordingsPath,
        ],
        onProgress: handleProgress,
        signal: this.indexAbortController.signal,
      });
      this.plugin.vectorIndex = newIndex;
      this.renderRagStats(statsEl, t);
      new Notice(
        t.settings.ragIndexingPhaseDone(newIndex.size, 0).replace(/~\d+ /, "")
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        new Notice(t.settings.ragIndexingCancelled);
      } else {
        const msg = err instanceof Error ? err.message : "Erro";
        new Notice(t.settings.ragIndexingFailed(msg));
      }
    } finally {
      this.indexAbortController = null;
      indexBtn.disabled = false;
      reindexBtn.disabled = false;
      clearBtn.disabled = false;
      // Esconde progress depois de 2.5s pro user ler o status
      window.setTimeout(() => {
        progressEl.style.display = "none";
      }, 2500);
    }
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
      "aurora",
      "spotlight",
      "nebula",
      "pulse",
      "flow",
      "aurora-live",
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
