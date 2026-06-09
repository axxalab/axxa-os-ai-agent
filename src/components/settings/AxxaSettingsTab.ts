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

import { App, PluginSettingTab, Setting, Notice, TFolder } from "obsidian";
import type AxxaPlugin from "../../main";
import { openaiProvider } from "../../providers/openai";
import { anthropicProvider } from "../../providers/anthropic";
import { geminiProvider } from "../../providers/gemini";
import { openrouterProvider } from "../../providers/openrouter";
import { nimProvider } from "../../providers/nim";
import { ollamaProvider } from "../../providers/ollama";
import { getTranslations, type Translations } from "../../i18n";
import {
  DEFAULT_EFFORT_CONFIGS,
  EFFORT_LEVELS,
  type EffortConfig,
  type EffortLevel,
} from "../_shared/effort";
import { indexVault, type IndexProgress } from "../../rag/indexer";
import { deleteIndex } from "../../rag/vectorIndex";
import { EMBEDDING_MODELS, getEmbeddingSpec } from "../../rag/types";
import {
  QUANT_PROFILE_IDS,
  QUANT_PROFILE_LABELS,
  QUANT_PROFILE_USES,
  getQuantProfile,
  recommendProfile,
} from "../../rag/quant";
import {
  aggregateUsage,
  sortBucketEntries,
  lastNDays,
  type UsageAggregate,
  type UsageBucket,
} from "../../usage/aggregate";
import { formatUsd } from "../../usage/pricing";
import {
  saveUsageMarkdown,
  saveUsageHtml,
  printUsageReport,
} from "../../usage/export";

type TopTabId = "providers" | "appearance" | "effort" | "usage" | "outros";
type ProviderTabId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "nim"
  | "ollama";
type OutrosTabId = "geral" | "ui" | "agent" | "rag" | "usage";

export class AxxaSettingsTab extends PluginSettingTab {
  plugin: AxxaPlugin;
  /** Top-level tab (Providers / Outros) */
  private activeTopTab: TopTabId = "providers";
  /** Sub-tab quando topTab = providers */
  private activeProviderTab: ProviderTabId = "openai";
  /** Sub-tab quando topTab = outros (v0.1.39 reorganização) */
  private activeOutrosTab: OutrosTabId = "geral";
  /** Sub-tab quando topTab = effort — qual nível está sendo editado */
  private activeEffortTab: EffortLevel = "max";
  private unsubscribe?: () => void;
  /** Período em dias do filtro do Usage tab. 0 = tudo. Persistido em memória. */
  private usagePeriodDays = 0;
  /** Cache do último aggregate computed pra evitar recomputar a cada render. */
  private cachedUsage: UsageAggregate | null = null;
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
    this.createTopTabButton(topTabsEl, "appearance", t.settings.topTabs.appearance);
    this.createTopTabButton(topTabsEl, "effort", t.settings.topTabs.effort);
    this.createTopTabButton(topTabsEl, "usage", t.settings.topTabs.usage);
    this.createTopTabButton(topTabsEl, "outros", t.settings.topTabs.outros);

    // ============================================================
    // Conteúdo da top-tab ativa
    // ============================================================
    const contentEl = containerEl.createDiv({ cls: "axxa-settings-content" });

    switch (this.activeTopTab) {
      case "providers":
        this.renderProvidersTab(contentEl, t);
        break;
      case "appearance":
        this.renderAppearanceTab(contentEl, t);
        break;
      case "effort":
        this.renderEffortTab(contentEl, t);
        break;
      case "usage":
        this.renderOutrosUsage(contentEl, t);
        break;
      case "outros":
        this.renderOutros(contentEl, t);
        break;
    }
  }

  /** Top-tab Appearance — só backgrounds + chips + code wrap (movido de Outros → UI) */
  private renderAppearanceTab(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.outrosUiIntro,
      cls: "setting-item-description",
    });
    this.renderOutrosUI(parent, t);
  }

  // ============================================================
  // Top-tab Effort — sub-tabs por nível (Low / Med / High / xHigh / Max)
  // Cada sub-tab edita TODOS os params do EffortConfig pra aquele nível.
  // Vazio = usa default built-in (DEFAULT_EFFORT_CONFIGS).
  // ============================================================
  private renderEffortTab(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.effortIntro,
      cls: "setting-item-description",
    });

    // Sub-tabs como segmented control — cada nível tem sua aba.
    const subTabsEl = parent.createDiv({ cls: "axxa-settings-subtabs" });
    const tabLabels = t.settings.effortTabs;
    for (const lvl of EFFORT_LEVELS) {
      this.createEffortSubTab(subTabsEl, lvl, tabLabels[lvl]);
    }

    // Conteúdo da sub-tab do nível selecionado
    const subContentEl = parent.createDiv({ cls: "axxa-settings-subcontent" });
    this.renderEffortLevelEditor(subContentEl, t, this.activeEffortTab);
  }

  /** Botão de sub-tab por nível de effort. Marca como default-bolinha o
   *  nível atual do plugin (defaultEffort), igual aos providers. */
  private createEffortSubTab(
    parent: HTMLElement,
    id: EffortLevel,
    label: string
  ) {
    const isDefault = id === this.plugin.settings.defaultEffort;
    const btn = parent.createEl("button", {
      cls:
        "axxa-subtab-btn" +
        (this.activeEffortTab === id ? " axxa-subtab-active" : "") +
        (isDefault ? " axxa-subtab-default" : ""),
      text: label,
    });
    btn.onclick = () => {
      this.activeEffortTab = id;
      this.display();
    };
  }

  /** Editor de UM nível de effort — todos os campos do EffortConfig.
   *  Cada campo usa o override do user se existir, senão mostra o default
   *  como placeholder e salva null quando o user limpa (volta ao default). */
  private renderEffortLevelEditor(
    parent: HTMLElement,
    t: Translations,
    level: EffortLevel
  ) {
    const fields = t.settings.effortFields;
    const defaults = DEFAULT_EFFORT_CONFIGS[level];

    // Helpers pra ler/escrever um campo do override do user. Quando o user
    // limpa o input, removemos a chave (cai pro default automaticamente).
    const readOverride = (): Partial<EffortConfig> =>
      this.plugin.settings.effortConfigs[level] ?? {};
    const writeOverride = async (patch: Partial<EffortConfig>) => {
      const current = readOverride();
      const next = { ...current, ...patch };
      // Limpa chaves undefined pra não poluir o JSON salvo
      for (const k of Object.keys(next) as Array<keyof EffortConfig>) {
        if (next[k] === undefined) delete next[k];
      }
      this.plugin.settings.effortConfigs[level] = next;
      await this.plugin.saveSettings();
    };

    // Header com resumo + botão de restaurar defaults
    const header = parent.createDiv({ cls: "axxa-effort-header" });
    header.createEl("h3", {
      text: `${t.settings.effortTabs[level]}`,
      cls: "axxa-effort-title",
    });
    const resetBtn = header.createEl("button", {
      cls: "axxa-effort-reset",
      text: t.settings.effortReset,
      attr: { type: "button" },
    });
    resetBtn.onclick = async () => {
      if (!confirm(t.settings.effortResetConfirm)) return;
      delete this.plugin.settings.effortConfigs[level];
      await this.plugin.saveSettings();
      new Notice(t.settings.effortResetDone);
      this.display();
    };

    // === Campo: max_tokens ===
    this.addEffortNumberField(parent, {
      name: fields.maxTokens,
      desc: fields.maxTokensDesc,
      placeholder: String(defaults.maxTokens),
      min: 0,
      max: 200000,
      step: 256,
      current: readOverride().maxTokens,
      onSave: (v) => writeOverride({ maxTokens: v }),
    });

    // === Campo: agentMaxTurns ===
    this.addEffortNumberField(parent, {
      name: fields.agentMaxTurns,
      desc: fields.agentMaxTurnsDesc,
      placeholder: String(defaults.agentMaxTurns),
      min: 0,
      max: 1000,
      step: 1,
      current: readOverride().agentMaxTurns,
      onSave: (v) => writeOverride({ agentMaxTurns: v }),
    });

    // === Campo: temperature ===
    this.addEffortNumberField(parent, {
      name: fields.temperature,
      desc: fields.temperatureDesc,
      placeholder: String(defaults.temperature),
      min: -1,
      max: 2,
      step: 0.1,
      current: readOverride().temperature,
      onSave: (v) => writeOverride({ temperature: v }),
    });

    // === Campo: vaultTopK ===
    this.addEffortNumberField(parent, {
      name: fields.vaultTopK,
      desc: fields.vaultTopKDesc,
      placeholder: String(defaults.vaultTopK),
      min: 1,
      max: 100,
      step: 1,
      current: readOverride().vaultTopK,
      onSave: (v) => writeOverride({ vaultTopK: v }),
    });

    // === Campo: vaultExcerptChars ===
    this.addEffortNumberField(parent, {
      name: fields.vaultExcerptChars,
      desc: fields.vaultExcerptCharsDesc,
      placeholder: String(defaults.vaultExcerptChars),
      min: 100,
      max: 10000,
      step: 100,
      current: readOverride().vaultExcerptChars,
      onSave: (v) => writeOverride({ vaultExcerptChars: v }),
    });

    // === Campo: parallelToolCalls (toggle) ===
    new Setting(parent)
      .setName(fields.parallelToolCalls)
      .setDesc(fields.parallelToolCallsDesc)
      .addToggle((tog) =>
        tog
          .setValue(readOverride().parallelToolCalls ?? defaults.parallelToolCalls)
          .onChange(async (val) => {
            await writeOverride({ parallelToolCalls: val });
          })
      );

    // === Campo: toolRetryOnError ===
    this.addEffortNumberField(parent, {
      name: fields.toolRetryOnError,
      desc: fields.toolRetryOnErrorDesc,
      placeholder: String(defaults.toolRetryOnError),
      min: 0,
      max: 20,
      step: 1,
      current: readOverride().toolRetryOnError,
      onSave: (v) => writeOverride({ toolRetryOnError: v }),
    });

    // === Campo: contextReservePercent ===
    this.addEffortNumberField(parent, {
      name: fields.contextReservePercent,
      desc: fields.contextReservePercentDesc,
      placeholder: String(defaults.contextReservePercent),
      min: 10,
      max: 95,
      step: 5,
      current: readOverride().contextReservePercent,
      onSave: (v) => writeOverride({ contextReservePercent: v }),
    });

    // === Campo: loopDetectionWindow ===
    this.addEffortNumberField(parent, {
      name: fields.loopDetectionWindow,
      desc: fields.loopDetectionWindowDesc,
      placeholder: String(defaults.loopDetectionWindow),
      min: 0,
      max: 20,
      step: 1,
      current: readOverride().loopDetectionWindow,
      onSave: (v) => writeOverride({ loopDetectionWindow: v }),
    });
  }

  /** Helper: campo numérico com placeholder=default. Limpar = remover override. */
  private addEffortNumberField(
    parent: HTMLElement,
    opts: {
      name: string;
      desc: string;
      placeholder: string;
      min: number;
      max: number;
      step: number;
      current: number | undefined;
      onSave: (value: number | undefined) => Promise<void>;
    }
  ) {
    new Setting(parent)
      .setName(opts.name)
      .setDesc(opts.desc)
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = String(opts.min);
        text.inputEl.max = String(opts.max);
        text.inputEl.step = String(opts.step);
        text.setPlaceholder(opts.placeholder);
        if (opts.current !== undefined) {
          text.setValue(String(opts.current));
        }
        text.onChange(async (raw) => {
          const trimmed = raw.trim();
          if (trimmed === "") {
            // Vazio = volta ao default — remove o override
            await opts.onSave(undefined);
            return;
          }
          const num = Number(trimmed);
          if (!isFinite(num)) return;
          // Clamp aos limites pra evitar valores absurdos
          const clamped = Math.max(opts.min, Math.min(opts.max, num));
          await opts.onSave(clamped);
        });
      });
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
  // Tab: Outros — header + sub-tabs (Geral / UI / Agent / RAG)
  // ============================================================
  private renderOutros(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.outrosIntro,
      cls: "setting-item-description",
    });

    // Sub-tabs (Geral / Agent / RAG) — Appearance e Usage agora são
    // top-tabs separadas (v0.1.56).
    const subTabsEl = parent.createDiv({ cls: "axxa-settings-subtabs" });
    this.createOutrosSubTab(subTabsEl, "geral", t.settings.outrosTabs.geral);
    this.createOutrosSubTab(subTabsEl, "agent", t.settings.outrosTabs.agent);
    this.createOutrosSubTab(subTabsEl, "rag", t.settings.outrosTabs.rag);

    // Se activeOutrosTab for "ui" ou "usage" (state legado), redireciona pra geral
    if (this.activeOutrosTab === "ui" || this.activeOutrosTab === "usage") {
      this.activeOutrosTab = "geral";
    }

    const subContentEl = parent.createDiv({ cls: "axxa-settings-subcontent" });
    switch (this.activeOutrosTab) {
      case "geral":
        this.renderOutrosGeral(subContentEl, t);
        break;
      case "agent":
        this.renderOutrosAgent(subContentEl, t);
        break;
      case "rag":
        this.renderOutrosRAG(subContentEl, t);
        break;
    }
  }

  /** Botão de sub-tab de Outros */
  private createOutrosSubTab(
    parent: HTMLElement,
    id: OutrosTabId,
    label: string
  ) {
    const btn = parent.createEl("button", {
      cls:
        "axxa-subtab-btn" +
        (this.activeOutrosTab === id ? " axxa-subtab-active" : ""),
      text: label,
    });
    btn.onclick = () => {
      this.activeOutrosTab = id;
      this.display();
    };
  }

  /** Sub-tab Geral — idioma + paths */
  /**
   * Anexa um <datalist> nativo HTML ao input pra autocomplete de pastas.
   * Lista todas as pastas do vault (TFolder) e bind via `list=` attribute.
   *
   * Vantagem do datalist: zero deps externas, type-ahead nativo do browser,
   * funciona em mobile (Android sugere conforme digita).
   */
  private attachFolderAutocomplete(inputEl: HTMLInputElement) {
    const folders: string[] = [];
    const walk = (folder: TFolder, path: string) => {
      if (path) folders.push(path);
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          walk(child, child.path);
        }
      }
    };
    walk(this.app.vault.getRoot(), "");
    folders.sort();

    const doc = inputEl.ownerDocument;
    const id = `axxa-folder-list-${Math.random().toString(36).slice(2, 8)}`;
    const datalist = doc.createElement("datalist");
    datalist.id = id;
    for (const path of folders) {
      const option = doc.createElement("option");
      option.value = path;
      datalist.appendChild(option);
    }
    inputEl.parentElement?.appendChild(datalist);
    inputEl.setAttribute("list", id);
    inputEl.setAttribute("autocomplete", "off");
  }

  private renderOutrosGeral(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.outrosGeralIntro,
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
            this.display();
          })
      );

    new Setting(parent)
      .setName(t.settings.chatsPath)
      .setDesc(t.settings.chatsPathDesc)
      .addText((text) => {
        text
          .setPlaceholder("axxa-ai/chats")
          .setValue(this.plugin.settings.chatsPath)
          .onChange(async (value) => {
            this.plugin.settings.chatsPath = value || "axxa-ai/chats";
            await this.plugin.saveSettings();
          });
        this.attachFolderAutocomplete(text.inputEl);
      });

    new Setting(parent)
      .setName(t.settings.skillsPath)
      .setDesc(t.settings.skillsPathDesc)
      .addText((text) => {
        text
          .setPlaceholder("axxa-ai/skills")
          .setValue(this.plugin.settings.skillsPath)
          .onChange(async (value) => {
            this.plugin.settings.skillsPath = value || "axxa-ai/skills";
            await this.plugin.saveSettings();
          });
        this.attachFolderAutocomplete(text.inputEl);
      });

    new Setting(parent)
      .setName(t.settings.recordingsPath)
      .setDesc(t.settings.recordingsPathDesc)
      .addText((text) => {
        text
          .setPlaceholder("axxa-ai/recordings")
          .setValue(this.plugin.settings.recordingsPath)
          .onChange(async (value) => {
            this.plugin.settings.recordingsPath =
              value || "axxa-ai/recordings";
            await this.plugin.saveSettings();
          });
        this.attachFolderAutocomplete(text.inputEl);
      });

    new Setting(parent)
      .setName(t.settings.generationPath)
      .setDesc(t.settings.generationPathDesc)
      .addText((text) => {
        text
          .setPlaceholder("axxa-ai/generation")
          .setValue(this.plugin.settings.generationPath)
          .onChange(async (value) => {
            this.plugin.settings.generationPath =
              value || "axxa-ai/generation";
            await this.plugin.saveSettings();
          });
        this.attachFolderAutocomplete(text.inputEl);
      });

    parent.createEl("h3", { text: t.settings.comingSoon });
    const todo = parent.createEl("ul");
    t.settings.comingSoonItems.forEach((item) => {
      todo.createEl("li", { text: item });
    });
  }

  /** Sub-tab Interface — chips, aparência, code wrap */
  private renderOutrosUI(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.outrosUiIntro,
      cls: "setting-item-description",
    });

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

    parent.createEl("h3", { text: t.settings.chips });
    parent.createEl("p", {
      text: t.settings.chipsDesc,
      cls: "setting-item-description",
    });
    this.renderChipsSection(parent, t);

    parent.createEl("h3", { text: t.settings.appearance });
    parent.createEl("p", {
      text: t.settings.appearanceDesc,
      cls: "setting-item-description",
    });
    this.renderBackgroundPicker(parent, t);
  }

  /** Sub-tab Agent — permissão */
  private renderOutrosAgent(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.outrosAgentIntro,
      cls: "setting-item-description",
    });

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
  }

  /** Sub-tab RAG — embeddings + indexação */
  private renderOutrosRAG(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.outrosRagIntro,
      cls: "setting-item-description",
    });
    parent.createEl("p", {
      text: t.settings.ragDesc,
      cls: "setting-item-description",
    });
    this.renderRagSection(parent, t);
  }

  // ============================================================
  // Chips section — toggles pro composer + listas
  // ============================================================
  private renderChipsSection(parent: HTMLElement, t: Translations) {
    const COMPOSER_IDS = [
      "mode",
      "model",
      "effort",
      "context",
      "in",
      "out",
      "total",
      "speed",
    ] as const;
    const LIST_IDS = ["mode", "model", "date", "messages", "tokens"] as const;

    const composerSection = parent.createDiv({ cls: "axxa-chips-section" });
    composerSection.createEl("h4", { text: t.settings.chipsComposer });
    composerSection.createEl("p", {
      text: t.settings.chipsComposerDesc,
      cls: "setting-item-description",
    });
    this.renderChipChecklist(
      composerSection,
      t,
      COMPOSER_IDS as readonly string[],
      "composerChips"
    );

    const listSection = parent.createDiv({ cls: "axxa-chips-section" });
    listSection.createEl("h4", { text: t.settings.chipsList });
    listSection.createEl("p", {
      text: t.settings.chipsListDesc,
      cls: "setting-item-description",
    });
    this.renderChipChecklist(
      listSection,
      t,
      LIST_IDS as readonly string[],
      "listChips"
    );
  }

  /** Lista de checkboxes pra escolher quais chips aparecem. */
  private renderChipChecklist(
    parent: HTMLElement,
    t: Translations,
    chipIds: readonly string[],
    settingKey: "composerChips" | "listChips"
  ) {
    const grid = parent.createDiv({ cls: "axxa-chips-grid" });
    const labels = t.settings.chipsLabels as Record<string, string>;

    for (const id of chipIds) {
      const row = grid.createDiv({ cls: "axxa-chips-row" });
      const cb = row.createEl("input", {
        type: "checkbox",
        cls: "axxa-chips-checkbox",
      });
      const current = this.plugin.settings[settingKey] ?? [];
      cb.checked = current.includes(id);

      const label = row.createEl("label", {
        cls: "axxa-chips-label",
        text: labels[id] ?? id,
      });

      const toggle = async () => {
        const list = (this.plugin.settings[settingKey] ?? []).slice();
        const idx = list.indexOf(id);
        if (cb.checked && idx < 0) {
          list.push(id);
        } else if (!cb.checked && idx >= 0) {
          list.splice(idx, 1);
        }
        this.plugin.settings[settingKey] = list;
        await this.plugin.saveSettings();
      };

      cb.onchange = toggle;
      label.onclick = () => {
        cb.checked = !cb.checked;
        toggle();
      };
      row.onclick = (e: MouseEvent) => {
        if (e.target === row) {
          cb.checked = !cb.checked;
          toggle();
        }
      };
    }
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

    // ---- Perfil de quantização (estilo Effort): recomenda pelo tamanho do vault ----
    const noteCount = this.plugin.app.vault.getMarkdownFiles().length;
    const recommended = recommendProfile(noteCount);
    const embSpec = getEmbeddingSpec(this.plugin.settings.ragEmbeddingModel);
    new Setting(section)
      .setName(t.settings.ragProfileLabel)
      .setDesc(
        t.settings.ragProfileRecommend(
          noteCount,
          QUANT_PROFILE_LABELS[recommended] ?? recommended
        )
      )
      .addDropdown((dd) => {
        QUANT_PROFILE_IDS.forEach((id) => {
          const p = getQuantProfile(id);
          const star = id === recommended ? " ⭐" : "";
          dd.addOption(id, `${p.emoji} ${QUANT_PROFILE_LABELS[id]}${star}`);
        });
        dd.setValue(this.plugin.settings.ragQuantProfile).onChange(
          async (value) => {
            this.plugin.settings.ragQuantProfile = value;
            await this.plugin.saveSettings();
            this.display(); // re-render pra atualizar a descrição do "melhor uso"
          }
        );
      });
    // "Melhor uso" do perfil + aviso quando o modelo não suporta dim reduzida
    const profDescEl = section.createDiv({ cls: "axxa-rag-profile-desc" });
    profDescEl.createSpan({
      text: QUANT_PROFILE_USES[this.plugin.settings.ragQuantProfile] ?? "",
    });
    if (
      getQuantProfile(this.plugin.settings.ragQuantProfile).targetDim > 0 &&
      !embSpec.supportsDimensions
    ) {
      profDescEl.createEl("br");
      profDescEl.createSpan({
        text: t.settings.ragProfileNoDim,
        cls: "axxa-rag-stats-warning",
      });
    }

    // ---- Index path ----
    new Setting(section)
      .setName(t.settings.ragIndexPath)
      .setDesc(t.settings.ragIndexPathDesc)
      .addText((text) => {
        text
          .setPlaceholder("axxa-ai/index")
          .setValue(this.plugin.settings.ragIndexPath)
          .onChange(async (value) => {
            this.plugin.settings.ragIndexPath = value || "axxa-ai/index";
            await this.plugin.saveSettings();
          });
        this.attachFolderAutocomplete(text.inputEl);
      });

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
    // Linha do perfil/precisão/dim com que o índice foi construído
    el.createEl("br");
    el.createSpan({
      text: `${QUANT_PROFILE_LABELS[idx.profile] ?? idx.profile} · ${idx.precision} · ${idx.dim}d`,
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
        profile: this.plugin.settings.ragQuantProfile,
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

  // ============================================================
  // Sub-tab Usage — contabilidade de tokens (K.4.2)
  //
  // Layout:
  //   1. Cards de resumo (gasto / tokens in / tokens out / conversas)
  //   2. Filtro de período (7d/30d/90d/todos) em pills
  //   3. Tabela por provider
  //   4. Tabela por modelo (top 10)
  //   5. Tabela por modo
  //   6. Heatmap dos últimos 30 dias
  //   7. Top 10 conversas mais caras
  //   8. Botões de export (PDF + Markdown)
  // ============================================================
  private async renderOutrosUsage(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.outrosUsageIntro,
      cls: "setting-item-description",
    });

    // Filtro de período
    const periodEl = parent.createDiv({ cls: "axxa-usage-period" });
    const periodLabelEl = periodEl.createSpan({
      cls: "axxa-usage-period-label",
      text: t.settings.usagePeriodLabel,
    });
    void periodLabelEl;
    const periods: Array<{ days: number; label: string }> = [
      { days: 7, label: t.settings.usagePeriod7d },
      { days: 30, label: t.settings.usagePeriod30d },
      { days: 90, label: t.settings.usagePeriod90d },
      { days: 0, label: t.settings.usagePeriodAll },
    ];
    const pillsRow = periodEl.createDiv({ cls: "axxa-usage-period-pills" });
    for (const p of periods) {
      const btn = pillsRow.createEl("button", {
        cls:
          "axxa-usage-period-pill" +
          (this.usagePeriodDays === p.days
            ? " axxa-usage-period-pill-active"
            : ""),
        text: p.label,
      });
      btn.onclick = async () => {
        this.usagePeriodDays = p.days;
        this.cachedUsage = null;
        this.display();
      };
    }

    // Loading placeholder enquanto computa
    const contentEl = parent.createDiv({ cls: "axxa-usage-content" });
    contentEl.createDiv({
      cls: "axxa-usage-loading",
      text: t.settings.usageLoading,
    });

    try {
      const agg =
        this.cachedUsage ??
        (await aggregateUsage(
          this.plugin.app,
          this.plugin.settings.chatsPath,
          this.usagePeriodDays
        ));
      this.cachedUsage = agg;
      contentEl.empty();
      this.renderUsageBody(contentEl, agg, t);
    } catch (err) {
      contentEl.empty();
      contentEl.createDiv({
        cls: "axxa-usage-error",
        text: `${t.settings.usageError}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  private renderUsageBody(
    parent: HTMLElement,
    agg: UsageAggregate,
    t: Translations
  ) {
    // ===== Cards de resumo =====
    const summaryGrid = parent.createDiv({ cls: "axxa-usage-summary" });
    this.usageCard(
      summaryGrid,
      t.settings.usageCostLabel,
      formatUsd(agg.total.cost) + (agg.total.hasUnknownCost ? "*" : ""),
      "dollar-sign",
      "var(--color-green, #06d6a0)"
    );
    this.usageCard(
      summaryGrid,
      t.settings.usageTokensInLabel,
      formatTokens(agg.total.tokensIn),
      "arrow-down",
      "var(--color-blue, #4361ee)"
    );
    this.usageCard(
      summaryGrid,
      t.settings.usageTokensOutLabel,
      formatTokens(agg.total.tokensOut),
      "arrow-up",
      "var(--color-green, #06d6a0)"
    );
    this.usageCard(
      summaryGrid,
      t.settings.usageChatsLabel,
      String(agg.total.chats),
      "message-square",
      "var(--color-purple, #a370f7)"
    );

    if (agg.total.chats === 0) {
      parent.createDiv({
        cls: "axxa-usage-empty",
        text: t.settings.usageEmpty,
      });
      return;
    }

    // ===== Tabela por provider =====
    this.usageTable(
      parent,
      t.settings.usageByProvider,
      sortBucketEntries(agg.byProvider),
      t.settings.usageColProvider,
      t
    );

    // ===== Tabela por modelo (top 10) =====
    this.usageTable(
      parent,
      t.settings.usageByModel,
      sortBucketEntries(agg.byModel).slice(0, 10),
      t.settings.usageColModel,
      t,
      true // code-style pro nome
    );

    // ===== Tabela por modo =====
    this.usageTable(
      parent,
      t.settings.usageByMode,
      sortBucketEntries(agg.byMode),
      t.settings.usageColMode,
      t
    );

    // ===== Heatmap dos últimos 30 dias =====
    const heatSection = parent.createEl("h4", { text: t.settings.usageHeatmap });
    void heatSection;
    const heatRow = parent.createDiv({ cls: "axxa-usage-heatmap" });
    const days = lastNDays(agg.byDay, 30);
    const maxCost = Math.max(...days.map((d) => d.bucket.cost), 0.0001);
    for (const d of days) {
      const intensity = d.bucket.cost / maxCost;
      const cell = heatRow.createDiv({
        cls: "axxa-usage-heatcell",
        attr: {
          title:
            `${d.day}: ${formatUsd(d.bucket.cost)} · ${d.bucket.chats} conversa${d.bucket.chats === 1 ? "" : "s"}`,
        },
      });
      // Opacidade visual baseada em intensidade
      cell.style.opacity = String(0.1 + 0.9 * intensity);
      cell.style.background =
        d.bucket.chats > 0
          ? "var(--color-green, #06d6a0)"
          : "var(--background-modifier-border)";
    }

    // ===== Top 10 conversas =====
    if (agg.chats.length > 0) {
      const topSection = parent.createEl("h4", {
        text: t.settings.usageTopChats,
      });
      void topSection;
      const topTable = parent.createEl("table", { cls: "axxa-usage-table" });
      const thead = topTable.createEl("thead");
      const headRow = thead.createEl("tr");
      [
        t.settings.usageColTitle,
        t.settings.usageColMode,
        t.settings.usageColModel,
        t.settings.usageColTokens,
        t.settings.usageColCost,
      ].forEach((h) => headRow.createEl("th", { text: h }));
      const tbody = topTable.createEl("tbody");
      for (const c of agg.chats.slice(0, 10)) {
        const row = tbody.createEl("tr");
        const titleTd = row.createEl("td");
        titleTd.setText(
          c.title.length > 40 ? c.title.slice(0, 37) + "…" : c.title
        );
        row.createEl("td", { text: c.mode });
        const modelTd = row.createEl("td");
        modelTd.createEl("code", { text: c.model });
        row.createEl("td", {
          text: `${formatTokens(c.tokensIn)} / ${formatTokens(c.tokensOut)}`,
          cls: "axxa-usage-num",
        });
        row.createEl("td", {
          text: c.cost == null ? "—" : formatUsd(c.cost),
          cls: "axxa-usage-num axxa-usage-cost",
        });
      }
    }

    if (agg.total.hasUnknownCost) {
      parent.createDiv({
        cls: "axxa-usage-footnote",
        text: t.settings.usagePartialFootnote,
      });
    }

    // ===== Export buttons =====
    parent.createEl("h4", { text: t.settings.usageExport });
    const exportRow = parent.createDiv({ cls: "axxa-usage-export-row" });

    const pdfBtn = exportRow.createEl("button", {
      text: t.settings.usageExportPdf,
      cls: "mod-cta",
    });
    pdfBtn.onclick = () => {
      try {
        printUsageReport(
          agg,
          this.usagePeriodDays,
          this.plugin.settings.chatsPath
        );
      } catch (err) {
        new Notice(
          `${t.settings.usageExportFailed}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    };

    const mdBtn = exportRow.createEl("button", {
      text: t.settings.usageExportMarkdown,
    });
    mdBtn.onclick = async () => {
      try {
        const result = await saveUsageMarkdown(
          this.plugin.app,
          agg,
          this.usagePeriodDays,
          this.plugin.settings.chatsPath
        );
        new Notice(t.settings.usageExportSuccess(result.path));
      } catch (err) {
        new Notice(
          `${t.settings.usageExportFailed}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    };

    const htmlBtn = exportRow.createEl("button", {
      text: t.settings.usageExportHtml,
    });
    htmlBtn.onclick = async () => {
      try {
        const result = await saveUsageHtml(
          this.plugin.app,
          agg,
          this.usagePeriodDays,
          this.plugin.settings.chatsPath
        );
        new Notice(t.settings.usageExportSuccess(result.path));
      } catch (err) {
        new Notice(
          `${t.settings.usageExportFailed}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    };
  }

  /** Card de resumo no Usage tab */
  private usageCard(
    parent: HTMLElement,
    label: string,
    value: string,
    icon: string,
    color: string
  ) {
    const card = parent.createDiv({ cls: "axxa-usage-card" });
    const iconEl = card.createDiv({ cls: "axxa-usage-card-icon" });
    iconEl.style.color = color;
    void icon;
    card.createDiv({ cls: "axxa-usage-card-label", text: label });
    card.createDiv({ cls: "axxa-usage-card-value", text: value });
  }

  /** Tabela genérica do Usage tab */
  private usageTable(
    parent: HTMLElement,
    title: string,
    rows: Array<[string, UsageBucket]>,
    headerName: string,
    t: Translations,
    nameIsCode = false
  ) {
    if (rows.length === 0) return;
    parent.createEl("h4", { text: title });
    const table = parent.createEl("table", { cls: "axxa-usage-table" });
    const thead = table.createEl("thead");
    const headRow = thead.createEl("tr");
    [
      headerName,
      t.settings.usageColChats,
      t.settings.usageColIn,
      t.settings.usageColOut,
      t.settings.usageColCost,
    ].forEach((h) => headRow.createEl("th", { text: h }));
    const tbody = table.createEl("tbody");
    for (const [name, b] of rows) {
      const row = tbody.createEl("tr");
      const nameTd = row.createEl("td");
      if (nameIsCode) nameTd.createEl("code", { text: name });
      else nameTd.setText(name);
      row.createEl("td", { text: String(b.chats), cls: "axxa-usage-num" });
      row.createEl("td", {
        text: formatTokens(b.tokensIn),
        cls: "axxa-usage-num",
      });
      row.createEl("td", {
        text: formatTokens(b.tokensOut),
        cls: "axxa-usage-num",
      });
      row.createEl("td", {
        text: (b.hasUnknownCost ? formatUsd(b.cost) + "*" : formatUsd(b.cost)),
        cls: "axxa-usage-num axxa-usage-cost",
      });
    }
  }
}

/** Helper local — formato compacto de tokens. Duplica formatTokens do _shared. */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "k";
  return String(n);
}
