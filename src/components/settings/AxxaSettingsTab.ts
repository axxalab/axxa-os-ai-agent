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

import {
  App,
  PluginSettingTab,
  Setting,
  Notice,
  TFolder,
  normalizePath,
  setIcon,
  requestUrl,
} from "obsidian";
import type AxxaPlugin from "../../main";
import { openaiProvider } from "../../providers/openai";
import { anthropicProvider } from "../../providers/anthropic";
import { geminiProvider } from "../../providers/gemini";
import { openrouterProvider } from "../../providers/openrouter";
import { nimProvider } from "../../providers/nim";
import { ollamaProvider } from "../../providers/ollama";
import { getTranslations, type Translations } from "../../i18n";
import { hapticTick } from "../_shared/haptics";
import {
  DEFAULT_EFFORT_CONFIGS,
  EFFORT_LEVELS,
  type EffortConfig,
  type EffortLevel,
} from "../_shared/effort";
import { indexVault, type IndexProgress } from "../../rag/indexer";
import { deleteIndex, RAG_SHARD_SIZE } from "../../rag/vectorIndex";
import {
  EMBEDDING_MODELS,
  getEmbeddingSpec,
  getAllEmbeddingModels,
} from "../../rag/types";
import {
  QUANT_PROFILE_IDS,
  QUANT_PROFILE_LABELS,
  QUANT_PROFILE_USES,
  getQuantProfile,
  recommendProfile,
} from "../../rag/quant";
import {
  aggregateFromSummaries,
  sortBucketEntries,
  lastNDays,
  type UsageAggregate,
  type UsageBucket,
} from "../../usage/aggregate";
import { formatUsd, getPricing } from "../../usage/pricing";
import { openaiFreeAllowance } from "../../usage/freeTokens";
import {
  computeBilledUsage,
  todayFreeStatus,
  type BilledUsage,
} from "../../usage/freeBilling";
import {
  billingCapabilityFor,
  fetchOpenRouterBilling,
  fetchOpenAICosts,
  fetchAnthropicCosts,
} from "../../usage/providerBilling";
import { detectKeyKind, type KeyKind } from "../../providers/keyFormat";
import { spentSinceFromRows } from "../../usage/balance";
import {
  getModelCapabilities,
  capabilityBadges,
} from "../../providers/modelCapabilities";
import {
  modelModalities,
  MODALITY_INFO,
  ALL_MODALITIES,
} from "../../providers/modelModality";
import { getModelCard, CATEGORY_LABELS } from "../../providers/modelDescriptions";
import {
  modelVendorLogoId,
  modelVendorLabel,
} from "../_shared/modelLogo";
import { getHotLevel, hotLabel } from "../../providers/dataCollect";
import {
  saveUsageMarkdown,
  saveUsageHtml,
  printUsageReport,
} from "../../usage/export";

type TopTabId =
  | "providers"
  | "setup"
  | "appearance"
  | "effort"
  | "usage"
  | "outros";
type ProviderTabId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "nim"
  | "ollama";
type OutrosTabId = "geral" | "ui" | "agent" | "rag" | "usage";
type AppearanceTabId = "background" | "chips" | "ui";

// Filtros da lista de modelos (Settings → Providers). v0.1.150
type ModelFilterId =
  | "all"
  | "vision"
  | "tools"
  | "free"
  | "stream"
  | "img-gen"
  | "audio-gen";
const MODEL_FILTERS: { id: ModelFilterId; label: string; icon: string }[] = [
  { id: "all", label: "Todos", icon: "layout-grid" },
  { id: "vision", label: "Vision", icon: "image" },
  { id: "tools", label: "Tools", icon: "wrench" },
  { id: "free", label: "Free", icon: "gift" },
  { id: "stream", label: "Stream", icon: "zap" },
  { id: "img-gen", label: "Imagem", icon: "image-plus" },
  { id: "audio-gen", label: "Áudio", icon: "volume-2" },
];

export class AxxaSettingsTab extends PluginSettingTab {
  plugin: AxxaPlugin;
  /** Top-level tab (Providers / Outros) */
  private activeTopTab: TopTabId = "providers";
  /** Sub-tab quando topTab = providers */
  private activeProviderTab: ProviderTabId = "openai";
  /** Cache dos modelos buscados por provider (sobrevive a re-render do tab,
   *  pra a lista de toggle não sumir a cada saveSettings). v0.1.148 */
  private modelCache: Record<string, string[]> = {};
  /** Filtro de capacidade ativo por provider na lista de modelos. v0.1.150 */
  private modelFilter: Record<string, ModelFilterId> = {};
  /** Sub-tab quando topTab = outros (v0.1.39 reorganização) */
  private activeOutrosTab: OutrosTabId = "geral";
  /** Sub-tab quando topTab = appearance (v0.1.107: Fundo / Chips / Interface) */
  private activeAppearanceTab: AppearanceTabId = "background";
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
    this.createTopTabButton(topTabsEl, "setup", t.settings.topTabs.setup);
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
      case "setup":
        this.renderSetupTab(contentEl, t);
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

  /** Top-tab Appearance — sub-tabs (Fundo / Chips / Interface), mesmo padrão
   *  segmented dos Providers (ícone + tooltip). v0.1.107 */
  private renderAppearanceTab(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.outrosUiIntro,
      cls: "setting-item-description",
    });

    // Sub-tabs icon-only (igual aos Providers)
    const subTabsEl = parent.createDiv({
      cls: "axxa-settings-subtabs axxa-provider-seg",
    });
    this.createAppearanceSubTab(
      subTabsEl,
      "background",
      "palette",
      t.settings.appearanceTabs.background
    );
    this.createAppearanceSubTab(
      subTabsEl,
      "chips",
      "tags",
      t.settings.appearanceTabs.chips
    );
    this.createAppearanceSubTab(
      subTabsEl,
      "ui",
      "sliders-horizontal",
      t.settings.appearanceTabs.ui
    );

    const subContentEl = parent.createDiv({ cls: "axxa-settings-subcontent" });
    switch (this.activeAppearanceTab) {
      case "background":
        this.renderAppearanceBackground(subContentEl, t);
        break;
      case "chips":
        this.renderAppearanceChips(subContentEl, t);
        break;
      case "ui":
        this.renderAppearanceUI(subContentEl, t);
        break;
    }
  }

  /** Botão de sub-tab de Appearance — ícone mono + tooltip (igual providers). */
  private createAppearanceSubTab(
    parent: HTMLElement,
    id: AppearanceTabId,
    icon: string,
    label: string
  ) {
    const btn = parent.createEl("button", {
      cls:
        "axxa-subtab-btn axxa-subtab-icon" +
        (this.activeAppearanceTab === id ? " axxa-subtab-active" : ""),
      attr: { "aria-label": label, title: label },
    });
    setIcon(btn, icon);
    btn.onclick = () => {
      hapticTick();
      this.activeAppearanceTab = id;
      this.display();
    };
  }

  /** Appearance → Fundo: picker de backgrounds (8 static + 8 live). */
  private renderAppearanceBackground(parent: HTMLElement, t: Translations) {
    parent.createEl("h3", { text: t.settings.appearance });
    parent.createEl("p", {
      text: t.settings.appearanceDesc,
      cls: "setting-item-description",
    });
    this.renderBackgroundPicker(parent, t);
  }

  /** Appearance → Chips: o que aparece nas listas e no status line. */
  private renderAppearanceChips(parent: HTMLElement, t: Translations) {
    parent.createEl("h3", { text: t.settings.chips });
    parent.createEl("p", {
      text: t.settings.chipsDesc,
      cls: "setting-item-description",
    });
    this.renderChipsSection(parent, t);
  }

  /** Appearance → Interface: toggles de exibição (code wrap). */
  private renderAppearanceUI(parent: HTMLElement, t: Translations) {
    // Densidade global — reescala todo o DS (listas, pílulas, segmento, cantos)
    // via data-axxa-density na .axxa-root. saveSettings() re-renderiza a view. */
    new Setting(parent)
      .setName(t.settings.density)
      .setDesc(t.settings.densityDesc)
      .addDropdown((dd) =>
        dd
          .addOption("large", t.settings.densityLarge)
          .addOption("normal", t.settings.densityNormal)
          .addOption("compact", t.settings.densityCompact)
          .setValue(this.plugin.settings.density || "normal")
          .onChange(async (v) => {
            hapticTick();
            this.plugin.settings.density = v;
            await this.plugin.saveSettings();
          })
      );

    // Motion global — personalidade das animações (soft/wave/intense/chaotic)
    // via data-axxa-motion na .axxa-root. Governa todo motion novo do DS.
    new Setting(parent)
      .setName(t.settings.motion)
      .setDesc(t.settings.motionDesc)
      .addDropdown((dd) =>
        dd
          .addOption("soft", t.settings.motionSoft)
          .addOption("wave", t.settings.motionWave)
          .addOption("intense", t.settings.motionIntense)
          .addOption("chaotic", t.settings.motionChaotic)
          .setValue(this.plugin.settings.motion || "wave")
          .onChange(async (v) => {
            hapticTick();
            this.plugin.settings.motion = v;
            await this.plugin.saveSettings();
          })
      );

    // Reduzir movimento GLOBAL — o user decide animado ou não (classe no body).
    // Fonte única da verdade; não dependemos mais do prefers-reduced-motion do SO.
    new Setting(parent)
      .setName(t.settings.reduceMotion)
      .setDesc(t.settings.reduceMotionDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.reduceMotion)
          .onChange(async (value) => {
            hapticTick();
            this.plugin.settings.reduceMotion = value;
            await this.plugin.saveSettings();
          })
      );

    // Reduzir movimento SÓ no mobile — mesma classe, gateada por Platform.isMobile.
    new Setting(parent)
      .setName(t.settings.reducedMotionMobile)
      .setDesc(t.settings.reducedMotionMobileDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.reducedMotionMobile)
          .onChange(async (value) => {
            hapticTick();
            this.plugin.settings.reducedMotionMobile = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(parent)
      .setName(t.settings.codeWrap)
      .setDesc(t.settings.codeWrapDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.codeWrap)
          .onChange(async (value) => {
            hapticTick();
            this.plugin.settings.codeWrap = value;
            await this.plugin.saveSettings();
          })
      );
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
      hapticTick();
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
      hapticTick();
      this.activeTopTab = id;
      this.display();
    };
  }

  // ============================================================
  // Tab "Providers" — header (default + intro) + sub-tabs
  // ============================================================
  private renderProvidersTab(parent: HTMLElement, t: Translations) {
    // Sub-tabs estilo segmented control (pill container)
    // Ordem: big labs (OpenAI · Anthropic · Gemini) → agregadores
    // (OpenRouter · NIM) → local (Ollama). flex-wrap quebra em mobile.
    const subTabsEl = parent.createDiv({
      cls: "axxa-settings-subtabs axxa-provider-seg",
    });
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

  /** Botão de sub-tab dos providers — só ícone mono (igual à StarterScreen). */
  private createProviderSubTab(
    parent: HTMLElement,
    id: ProviderTabId,
    label: string
  ) {
    const LOGO: Record<string, string> = {
      openai: "logo-openai",
      anthropic: "logo-anthropic",
      gemini: "logo-gemini",
      openrouter: "logo-openrouter",
      nim: "logo-nvidia",
      ollama: "logo-ollama",
    };
    const btn = parent.createEl("button", {
      cls:
        "axxa-subtab-btn axxa-subtab-icon" +
        (this.activeProviderTab === id ? " axxa-subtab-active" : ""),
      attr: { "aria-label": label, title: label },
    });
    setIcon(btn, LOGO[id] ?? "");
    btn.onclick = () => {
      hapticTick();
      this.activeProviderTab = id;
      this.display();
    };
  }

  // ============================================================
  // Tab: OpenAI
  // ============================================================
  /**
   * Badge VIVO sob o campo de API key: detecta projeto vs admin e explica o que
   * cada formato habilita. Um campo só — o plugin reconhece e propaga. v0.1.170
   */
  private renderKeyKindBadge(
    parent: HTMLElement,
    provider: string,
    t: Translations
  ): (key: string) => void {
    const el = parent.createDiv({ cls: "axxa-key-kind setting-item-description" });
    return (key: string) => {
      const kind: KeyKind = detectKeyKind(provider, key);
      el.removeClass("is-admin", "is-normal", "is-unknown", "is-empty");
      el.addClass("is-" + kind);
      el.setText(
        kind === "admin"
          ? t.settings.keyKindAdmin
          : kind === "normal"
            ? t.settings.keyKindNormal
            : kind === "unknown"
              ? t.settings.keyKindUnknown
              : ""
      );
    };
  }

  /** Resolve a admin key de um provider: campo dedicado, ou o campo principal
   *  se ele contiver uma admin key. "" se não há. v0.1.171 */
  private adminKeyFor(provider: string): string {
    if (provider === "openai") {
      const d = this.plugin.settings.openaiAdminKey?.trim();
      if (d) return d;
      const main = this.plugin.settings.openaiApiKey;
      return detectKeyKind("openai", main) === "admin" ? main : "";
    }
    if (provider === "anthropic") {
      const d = this.plugin.settings.anthropicAdminKey?.trim();
      if (d) return d;
      const main = this.plugin.settings.anthropicApiKey;
      return detectKeyKind("anthropic", main) === "admin" ? main : "";
    }
    return "";
  }

  /** Campo OPCIONAL de admin key (custos/saldo reais), sob o campo principal. */
  private renderAdminKeyField(
    parent: HTMLElement,
    t: Translations,
    get: () => string,
    set: (v: string) => void,
    placeholder: string
  ) {
    new Setting(parent)
      .setName(t.settings.adminKeyName)
      .setDesc(t.settings.adminKeyDesc)
      .addText((text) => {
        text
          .setPlaceholder(placeholder)
          .setValue(get())
          .onChange(async (value) => {
            set(value.trim());
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
        text.inputEl.autocomplete = "off";
      });
  }

  private renderOpenAI(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.providerIntro,
      cls: "setting-item-description",
    });

    let updateKeyBadge: (k: string) => void = () => {};
    new Setting(parent)
      .setName(t.settings.apiKey)
      .setDesc(t.settings.apiKeyDescOpenai)
      .addText((text) => {
        text
          .setPlaceholder("sk-... ou sk-admin-...")
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openaiApiKey = value.trim();
            await this.plugin.saveSettings();
            updateKeyBadge(value);
          });
        text.inputEl.type = "password";
        text.inputEl.autocomplete = "off";
      });
    updateKeyBadge = this.renderKeyKindBadge(parent, "openai", t);
    updateKeyBadge(this.plugin.settings.openaiApiKey);

    this.renderAdminKeyField(
      parent,
      t,
      () => this.plugin.settings.openaiAdminKey,
      (v) => (this.plugin.settings.openaiAdminKey = v),
      "sk-admin-... (opcional)"
    );

    // Project ID — atribui o custo real a UM projeto (controle por projeto).
    new Setting(parent)
      .setName(t.settings.openaiProjectName)
      .setDesc(t.settings.openaiProjectDesc)
      .addText((text) => {
        text
          .setPlaceholder("proj_... (opcional)")
          .setValue(this.plugin.settings.openaiProjectId)
          .onChange(async (value) => {
            this.plugin.settings.openaiProjectId = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.autocomplete = "off";
      });

    // Data-sharing + tier (v0.1.165) — define os tokens grátis diários (texto).
    let freeHintEl: HTMLElement;
    const updateFreeHint = () => {
      const allow = openaiFreeAllowance(
        this.plugin.settings.openaiUsageTier || 1,
        this.plugin.settings.openaiDataSharing
      );
      freeHintEl.setText(
        t.settings.openaiFreeHint(
          allow.eligible,
          Math.round(allow.bigPerDay / 1000),
          Math.round(allow.miniPerDay / 1_000_000)
        )
      );
    };

    new Setting(parent)
      .setName(t.settings.openaiDataSharing)
      .setDesc(t.settings.openaiDataSharingDesc)
      .addToggle((tg) =>
        tg
          .setValue(this.plugin.settings.openaiDataSharing)
          .onChange(async (v) => {
            this.plugin.settings.openaiDataSharing = v;
            await this.plugin.saveSettings();
            updateFreeHint();
          })
      );

    new Setting(parent)
      .setName(t.settings.openaiTier)
      .setDesc(t.settings.openaiTierDesc)
      .addDropdown((dd) => {
        for (let i = 1; i <= 5; i++) dd.addOption(String(i), `Tier ${i}`);
        dd.setValue(String(this.plugin.settings.openaiUsageTier || 1)).onChange(
          async (v) => {
            this.plugin.settings.openaiUsageTier = Number(v);
            await this.plugin.saveSettings();
            updateFreeHint();
          }
        );
      });

    freeHintEl = parent.createDiv({
      cls: "axxa-openai-free-hint setting-item-description",
    });
    updateFreeHint();

    this.createActiveModelsField(
      parent,
      t,
      "OpenAI",
      "openai",
      () => openaiProvider.listModels(this.plugin.settings.openaiApiKey),
      "gpt-3.5-turbo",
      () => openaiProvider.listEmbeddingModels(this.plugin.settings.openaiApiKey)
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

    let updateAntKeyBadge: (k: string) => void = () => {};
    new Setting(parent)
      .setName(t.settings.apiKey)
      .setDesc(t.settings.apiKeyDescAnthropic)
      .addText((text) => {
        text
          .setPlaceholder("sk-ant-... ou sk-ant-admin-...")
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async (value) => {
            this.plugin.settings.anthropicApiKey = value.trim();
            await this.plugin.saveSettings();
            updateAntKeyBadge(value);
          });
        text.inputEl.type = "password";
        text.inputEl.autocomplete = "off";
      });
    updateAntKeyBadge = this.renderKeyKindBadge(parent, "anthropic", t);
    updateAntKeyBadge(this.plugin.settings.anthropicApiKey);

    this.renderAdminKeyField(
      parent,
      t,
      () => this.plugin.settings.anthropicAdminKey,
      (v) => (this.plugin.settings.anthropicAdminKey = v),
      "sk-ant-admin-... (opcional)"
    );

    // Workspace ID — atribui o custo real a UM workspace (análogo ao project).
    new Setting(parent)
      .setName(t.settings.anthropicWorkspaceName)
      .setDesc(t.settings.anthropicWorkspaceDesc)
      .addText((text) => {
        text
          .setPlaceholder("wrkspc_... (opcional)")
          .setValue(this.plugin.settings.anthropicWorkspaceId)
          .onChange(async (value) => {
            this.plugin.settings.anthropicWorkspaceId = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.autocomplete = "off";
      });

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

    this.createActiveModelsField(
      parent,
      t,
      "Gemini",
      "gemini",
      () => geminiProvider.listModels(this.plugin.settings.geminiApiKey),
      "gemini-2.5-pro",
      () => geminiProvider.listEmbeddingModels(this.plugin.settings.geminiApiKey)
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

    this.createActiveModelsField(
      parent,
      t,
      "OpenRouter",
      "openrouter",
      () => openrouterProvider.listModels(this.plugin.settings.openrouterApiKey),
      "openai/gpt-3.5-turbo",
      () =>
        openrouterProvider.listEmbeddingModels(
          this.plugin.settings.openrouterApiKey
        )
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

    this.createActiveModelsField(
      parent,
      t,
      "Nvidia NIM",
      "nim",
      () => nimProvider.listModels(this.plugin.settings.nimApiKey),
      "meta/llama-3.3-70b-instruct",
      () => nimProvider.listEmbeddingModels(this.plugin.settings.nimApiKey)
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
  // Modelos ativos — LISTA DE TOGGLE v2 (v0.1.150)
  // Filtro por capacidade (vision/free/stream/…) + agrupado por categoria.
  // Cada linha: logo do VENDOR (🟣 quando falta o SVG) + nome + tier FREE/PAID
  // + badges + ★ (define o modelo PADRÃO do provider) + switch on/off.
  // O ★ substituiu o card "Modelo padrão" (removido). Persiste via modelCache.
  // ============================================================
  private getProviderDefault(providerId: string): string {
    const s = this.plugin.settings;
    switch (providerId) {
      case "anthropic": return s.anthropicModel;
      case "gemini": return s.geminiModel;
      case "openrouter": return s.openrouterModel;
      case "nim": return s.nimModel;
      case "ollama": return s.ollamaModel;
      default: return s.defaultModel;
    }
  }

  private async setProviderDefault(providerId: string, model: string): Promise<void> {
    const s = this.plugin.settings;
    switch (providerId) {
      case "anthropic": s.anthropicModel = model; break;
      case "gemini": s.geminiModel = model; break;
      case "openrouter": s.openrouterModel = model; break;
      case "nim": s.nimModel = model; break;
      case "ollama": s.ollamaModel = model; break;
      default: s.defaultModel = model; break;
    }
    await this.plugin.saveSettings();
  }

  private modelPassesFilter(providerId: string, model: string, f: ModelFilterId): boolean {
    if (f === "all") return true;
    const caps = getModelCapabilities(providerId, model);
    switch (f) {
      case "vision": return !!caps.vision;
      case "tools": return !!caps.tools;
      case "stream": return !!caps.streaming;
      case "img-gen": return !!caps.imageGen;
      case "audio-gen": return !!caps.audioGen;
      case "free":
        return getPricing(providerId, model).tier === "free" || !!caps.free;
      default: return true;
    }
  }

  private createActiveModelsField(
    parent: HTMLElement,
    t: Translations,
    providerLabel: string,
    providerId: string,
    fetchModels: () => Promise<string[]>,
    placeholderExample: string,
    /** Busca os modelos de EMBEDDING do provider (RAG). Só os 4 com /models. */
    fetchEmbeddings?: () => Promise<string[]>
  ) {
    const section = parent.createDiv({ cls: "axxa-active-models-section" });

    new Setting(section)
      .setName(t.settings.activeModels)
      .setDesc(t.settings.activeModelsDesc(providerLabel));

    const filterRow = section.createDiv({ cls: "axxa-model-filter-row" });
    this.renderModalityLegend(section);
    const listEl = section.createDiv({ cls: "axxa-model-toggle-list" });

    const allModels = (): string[] => {
      const active = this.plugin.settings.activeModels[providerId] ?? [];
      const cached = this.modelCache[providerId] ?? [];
      // O default sempre aparece, mesmo que não esteja no cache/ativos.
      const def = this.getProviderDefault(providerId);
      return Array.from(new Set([...active, ...cached, def].filter(Boolean)));
    };

    const renderRows = () => {
      listEl.empty();
      const filter = this.modelFilter[providerId] ?? "all";
      const models = allModels().filter((m) =>
        this.modelPassesFilter(providerId, m, filter)
      );
      if (models.length === 0) {
        listEl.createEl("p", {
          text: t.settings.activeModelsEmpty,
          cls: "axxa-active-models-empty",
        });
        return;
      }
      // Agrupa por categoria do modelo (Chat multimodal / Raciocínio / Imagem…)
      const active = this.plugin.settings.activeModels[providerId] ?? [];
      const groups = new Map<string, string[]>();
      for (const m of models) {
        const cat = getModelCard(providerId, m, getModelCapabilities(providerId, m)).category;
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat)!.push(m);
      }
      for (const [cat, mods] of groups) {
        listEl.createEl("div", {
          text: CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat,
          cls: "axxa-model-cat-head",
        });
        mods.sort((a, b) => {
          const d = Number(active.includes(b)) - Number(active.includes(a));
          return d !== 0 ? d : a.localeCompare(b);
        });
        for (const m of mods) {
          this.renderModelToggleRow(listEl, t, providerId, m, renderRows);
        }
      }
    };

    // Chips de filtro por capacidade — compactos, numa linha (no-wrap), com a
    // CONTAGEM de modelos que casam cada filtro. v0.1.152
    const all = allModels();
    for (const f of MODEL_FILTERS) {
      const active = (this.modelFilter[providerId] ?? "all") === f.id;
      const count =
        f.id === "all"
          ? all.length
          : all.filter((m) => this.modelPassesFilter(providerId, m, f.id)).length;
      const chip = filterRow.createEl("button", {
        cls:
          "axxa-model-filter-chip" +
          (active ? " is-active" : "") +
          (count === 0 ? " is-empty" : ""),
        attr: { type: "button", title: `${f.label} · ${count}` },
      });
      setIcon(chip.createSpan({ cls: "axxa-model-filter-ico" }), f.icon);
      chip.createSpan({ text: f.label, cls: "axxa-model-filter-lbl" });
      chip.createSpan({ text: String(count), cls: "axxa-model-filter-count" });
      chip.onclick = () => {
        this.modelFilter[providerId] = f.id;
        filterRow
          .findAll(".axxa-model-filter-chip")
          .forEach((c) => c.removeClass("is-active"));
        chip.addClass("is-active");
        renderRows();
      };
    }

    renderRows();

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
      if (!list.includes(v)) {
        list.push(v);
        this.plugin.settings.activeModels[providerId] = list;
      }
      const cache = this.modelCache[providerId] ?? [];
      if (!cache.includes(v)) cache.push(v);
      this.modelCache[providerId] = cache;
      await this.plugin.saveSettings();
      input.value = "";
      renderRows();
    };
    addBtn.onclick = doAdd;
    input.onkeydown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doAdd();
      }
    };

    fetchBtn.onclick = async () => {
      fetchBtn.setAttr("disabled", "true");
      const originalText = fetchBtn.textContent ?? t.settings.activeModelsFetchBtn;
      fetchBtn.textContent = t.settings.activeModelsFetchingBtn;
      try {
        // Busca chat + embeddings em paralelo. Embeddings nunca derrubam o
        // fetch principal (catch → []).
        const [fetched, embeds] = await Promise.all([
          fetchModels(),
          fetchEmbeddings ? fetchEmbeddings().catch(() => []) : Promise.resolve([]),
        ]);
        if (!fetched.length) {
          new Notice(t.settings.modelNoneNotice(providerLabel));
          return;
        }
        this.modelCache[providerId] = Array.from(
          new Set([...(this.modelCache[providerId] ?? []), ...fetched])
        );
        // Embeddings descobertos → settings + registro global do RAG. v0.1.151
        if (embeds.length > 0) {
          const prev = this.plugin.settings.discoveredEmbeddings[providerId] ?? [];
          this.plugin.settings.discoveredEmbeddings[providerId] = Array.from(
            new Set([...prev, ...embeds])
          );
          this.plugin.refreshDiscoveredEmbeddings();
        }
        await this.plugin.saveSettings();
        renderRows();
        new Notice(
          embeds.length > 0
            ? t.settings.modelsFetchedWithEmbeds(fetched.length, embeds.length)
            : t.settings.activeModelsAvailable(fetched.length)
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : t.ai.unknownError;
        new Notice(t.settings.modelFailedNotice(msg));
      } finally {
        fetchBtn.removeAttribute("disabled");
        fetchBtn.textContent = originalText;
      }
    };
  }

  /**
   * Linha de modelo: logo do vendor (🟣 se falta SVG) + nome + tier + badges +
   * ★ default + switch. ★ define o modelo padrão do provider (e ativa). Toggle
   * liga/desliga a visibilidade no seletor.
   */
  /**
   * Legenda colapsável da modalidade I/O — lista TODOS os tipos (TXT2TXT,
   * TXT2IMG, IMG2IMG…) com a explicação de cada um. Fechada por padrão pra não
   * poluir; o tooltip de cada chip já dá o resumo. v0.1.164
   */
  private renderModalityLegend(parent: HTMLElement) {
    const wrap = parent.createDiv({ cls: "axxa-modality-legend-wrap" });
    const toggle = wrap.createEl("button", {
      cls: "axxa-modality-legend-toggle",
      attr: { type: "button" },
    });
    setIcon(toggle.createSpan({ cls: "axxa-modality-legend-ico" }), "help-circle");
    toggle.createSpan({ text: "Tipos de modelo (modalidade I/O)" });
    const list = wrap.createDiv({ cls: "axxa-modality-legend axxa-hidden" });
    for (const code of ALL_MODALITIES) {
      const info = MODALITY_INFO[code];
      const row = list.createDiv({ cls: "axxa-modality-legend-row" });
      row.createSpan({ text: code, cls: "axxa-model-modality-chip" });
      const txt = row.createSpan({ cls: "axxa-modality-legend-txt" });
      txt.createSpan({ text: info.label, cls: "axxa-modality-legend-lbl" });
      txt.createSpan({ text: info.description, cls: "axxa-modality-legend-desc" });
    }
    toggle.onclick = () => {
      const open = list.hasClass("axxa-hidden");
      list.toggleClass("axxa-hidden", !open);
      toggle.toggleClass("is-open", open);
    };
  }

  private renderModelToggleRow(
    listEl: HTMLElement,
    t: Translations,
    providerId: string,
    model: string,
    refresh: () => void
  ) {
    const isActive = () =>
      (this.plugin.settings.activeModels[providerId] ?? []).includes(model);
    const isDefault = () => this.getProviderDefault(providerId) === model;

    const row = listEl.createEl("button", {
      cls:
        "axxa-model-opt axxa-model-toggle-row" +
        (isActive() ? " axxa-model-opt-active" : "") +
        (isDefault() ? " is-default" : ""),
      attr: { type: "button", "aria-pressed": String(isActive()) },
    });

    // Logo do VENDOR do modelo, ou 🟣 quando ainda falta o SVG.
    const logo = row.createSpan({ cls: "axxa-model-opt-logo" });
    const logoId = modelVendorLogoId(providerId, model);
    if (logoId) {
      setIcon(logo, logoId);
    } else {
      logo.addClass("axxa-logo-missing");
      logo.setText("🟣");
      logo.setAttr("title", `logo ausente: ${modelVendorLabel(providerId, model)}`);
    }

    const main = row.createSpan({ cls: "axxa-model-opt-main" });
    const nameRow = main.createSpan({ cls: "axxa-model-toggle-namerow" });
    nameRow.createSpan({ text: model, cls: "axxa-model-opt-name" });

    const caps = getModelCapabilities(providerId, model);
    const pricing = getPricing(providerId, model);
    const tier =
      pricing.tier && pricing.tier !== "unknown"
        ? pricing.tier
        : caps.free
          ? "free"
          : "unknown";
    nameRow.createSpan({
      text: tier === "free" ? "FREE" : tier === "paid" ? "PAID" : "?",
      cls: "axxa-model-tier axxa-model-tier-" + tier,
    });
    // "Hot" — popularidade (baseline curado + seu uso local). 🔥 por nível.
    const hot = getHotLevel(providerId, model);
    if (hot.level > 0) {
      nameRow.createSpan({
        text: "🔥".repeat(hot.level),
        cls:
          "axxa-model-hot axxa-model-hot-" +
          hot.level +
          (hot.usedLocally ? " is-local" : ""),
        attr: { title: hotLabel(hot) },
      });
    }
    if (isDefault()) {
      nameRow.createSpan({
        text: t.settings.modelDefaultTag,
        cls: "axxa-model-default-tag",
      });
    }

    // Modalidade I/O (TXT2TXT, TXT2IMG, IMG2IMG…) — o "tipo" do modelo, com
    // tooltip explicando. Substitui os ícones de vision/img-gen/etc (que já
    // estão expressos no par I/O). v0.1.164
    const mods = modelModalities(caps, model);
    if (mods.length > 0) {
      const modRow = main.createSpan({ cls: "axxa-model-modality-row" });
      for (const code of mods) {
        const info = MODALITY_INFO[code];
        modRow.createSpan({
          cls: "axxa-model-modality-chip",
          text: code,
          attr: {
            title: `${info.label} — ${info.description}`,
            "aria-label": info.label,
          },
        });
      }
    }

    // Caps ORTOGONAIS à modalidade: tools + streaming (vision/gen já viraram
    // modalidade; free vira o tag FREE/PAID). Ícones discretos.
    const badges = capabilityBadges(caps).filter(
      (b) => b.id === "tools" || b.id === "stream"
    );
    if (badges.length > 0) {
      const badgeRow = main.createSpan({ cls: "axxa-model-toggle-badges" });
      for (const b of badges) {
        const chip = badgeRow.createSpan({
          cls: "axxa-model-toggle-badge",
          attr: { title: b.label, "aria-label": b.label },
        });
        setIcon(chip, b.icon);
      }
    }

    const ctrls = row.createSpan({ cls: "axxa-model-toggle-ctrls" });
    const star = ctrls.createSpan({
      cls: "axxa-model-star" + (isDefault() ? " is-default" : ""),
      attr: { title: t.settings.modelSetDefault, "aria-label": t.settings.modelSetDefault },
    });
    setIcon(star, "star");
    const sw = ctrls.createSpan({
      cls: "axxa-model-toggle-switch" + (isActive() ? " is-on" : ""),
    });

    // ★ — define como padrão (e garante ativo). Re-renderiza pra mover o badge.
    star.onclick = async (e: MouseEvent) => {
      e.stopPropagation();
      await this.setProviderDefault(providerId, model);
      const list = this.plugin.settings.activeModels[providerId] ?? [];
      if (!list.includes(model)) {
        list.push(model);
        this.plugin.settings.activeModels[providerId] = list;
        await this.plugin.saveSettings();
      }
      refresh();
    };

    // Resto da linha (incl. switch) — liga/desliga visibilidade no seletor.
    row.onclick = async () => {
      const list = this.plugin.settings.activeModels[providerId] ?? [];
      const idx = list.indexOf(model);
      const nowOn = idx < 0;
      if (nowOn) list.push(model);
      else list.splice(idx, 1);
      this.plugin.settings.activeModels[providerId] = list;
      await this.plugin.saveSettings();
      row.toggleClass("axxa-model-opt-active", nowOn);
      sw.toggleClass("is-on", nowOn);
      row.setAttr("aria-pressed", String(nowOn));
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

    // RAG migrou pra top-tab "Setup & RAG" (v0.1.152). State legado → geral.
    if (
      this.activeOutrosTab === "ui" ||
      this.activeOutrosTab === "usage" ||
      this.activeOutrosTab === "rag"
    ) {
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
      hapticTick();
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

    // Plano (admin) — testar free vs pro sem mexer no entitlement real. v0.1.174
    new Setting(parent)
      .setName(t.settings.planOverrideName)
      .setDesc(t.settings.planOverrideDesc)
      .addDropdown((dd) =>
        dd
          .addOption("auto", t.settings.planAuto)
          .addOption("pro", "Pro")
          .addOption("free", "Free")
          .setValue(this.plugin.settings.devTierOverride || "auto")
          .onChange(async (value) => {
            this.plugin.settings.devTierOverride = value;
            await this.plugin.saveSettings();
          })
      );

    parent.createEl("h3", { text: t.settings.comingSoon });
    const todo = parent.createEl("ul");
    t.settings.comingSoonItems.forEach((item) => {
      todo.createEl("li", { text: item });
    });
  }

  // ============================================================
  // Tab: Setup & RAG (v0.1.152) — pastas do vault + RAG, ao lado de Providers.
  // ============================================================
  private renderSetupTab(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.setupIntro,
      cls: "setting-item-description",
    });

    parent.createEl("h3", { text: t.settings.setupFoldersTitle });
    this.renderFolderPaths(parent, t);

    parent.createEl("h3", { text: t.settings.setupRagTitle });
    parent.createEl("p", {
      text: t.settings.ragDesc,
      cls: "setting-item-description",
    });
    this.renderRagSection(parent, t);
  }

  /** Config das pastas do vault + gestão de skills. Reusado pela tab Setup. */
  private renderFolderPaths(parent: HTMLElement, t: Translations) {
    new Setting(parent)
      .setName(t.settings.chatsPath)
      .setDesc(t.settings.chatsPathDesc)
      .addText((text) => {
        text
          .setPlaceholder("axxa-ai/chats")
          .setValue(this.plugin.settings.chatsPath)
          .onChange(async (value) => {
            this.plugin.settings.chatsPath = normalizePath(value || "axxa-ai/chats");
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
            this.plugin.settings.skillsPath = normalizePath(value || "axxa-ai/skills");
            await this.plugin.saveSettings();
            await this.plugin.reloadSkills();
          });
        this.attachFolderAutocomplete(text.inputEl);
      });

    // Skills — gestão (v0.1.139): criar exemplos + recarregar. Skills são notas
    // .md na pasta acima; viram /comandos no composer.
    new Setting(parent)
      .setName(t.settings.skillsManage)
      .setDesc(t.settings.skillsManageDesc(this.plugin.skills.length))
      .addButton((b) =>
        b
          .setButtonText(t.settings.skillsCreateExamples)
          .setCta()
          .onClick(async () => {
            const n = await this.plugin.seedExampleSkills();
            new Notice(t.settings.skillsSeeded(n));
            this.display();
          })
      )
      .addExtraButton((b) =>
        b
          .setIcon("refresh-cw")
          .setTooltip(t.settings.skillsReload)
          .onClick(async () => {
            await this.plugin.reloadSkills();
            new Notice(t.settings.skillsReloaded(this.plugin.skills.length));
            this.display();
          })
      );

    new Setting(parent)
      .setName(t.settings.recordingsPath)
      .setDesc(t.settings.recordingsPathDesc)
      .addText((text) => {
        text
          .setPlaceholder("axxa-ai/recordings")
          .setValue(this.plugin.settings.recordingsPath)
          .onChange(async (value) => {
            this.plugin.settings.recordingsPath = normalizePath(
              value || "axxa-ai/recordings"
            );
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
            this.plugin.settings.generationPath = normalizePath(
              value || "axxa-ai/generation"
            );
            await this.plugin.saveSettings();
          });
        this.attachFolderAutocomplete(text.inputEl);
      });
  }

  /** Sub-tab Interface — chips, aparência, code wrap */
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

    new Setting(parent)
      .setName(t.agent.diffApproval)
      .setDesc(t.agent.diffApprovalDesc)
      .addToggle((tg) =>
        tg
          .setValue(this.plugin.settings.agentDiffApproval !== false)
          .onChange(async (value) => {
            this.plugin.settings.agentDiffApproval = value;
            await this.plugin.saveSettings();
          })
      );
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

    // Providers que têm modelos de embedding (curados + descobertos via fetch).
    const EMB_PROVIDER_LABEL: Record<string, string> = {
      openai: "OpenAI (texto)",
      openrouter: "OpenRouter (multimodal)",
      gemini: "Gemini",
      nim: "Nvidia NIM",
    };
    const ORDER = ["openai", "openrouter", "gemini", "nim"];
    const availProviders = ORDER.filter((p) =>
      getAllEmbeddingModels().some((m) => m.provider === p)
    );

    // ---- Provider dropdown ----
    new Setting(section)
      .setName(t.settings.ragProvider)
      .setDesc(t.settings.ragProviderDesc)
      .addDropdown((dd) => {
        for (const p of availProviders) {
          dd.addOption(p, EMB_PROVIDER_LABEL[p] ?? p);
        }
        dd.setValue(this.plugin.settings.ragEmbeddingProvider).onChange(
          async (value) => {
            this.plugin.settings.ragEmbeddingProvider = value;
            // Troca de provider → 1º model dele (senão fica par inválido)
            const firstModel = getAllEmbeddingModels().find(
              (m) => m.provider === value
            );
            if (firstModel) {
              this.plugin.settings.ragEmbeddingModel = firstModel.model;
            }
            await this.plugin.saveSettings();
            this.display();
          }
        );
      });

    // ---- Model dropdown (curados + descobertos, com info) ----
    new Setting(section)
      .setName(t.settings.ragModel)
      .setDesc(t.settings.ragModelDesc)
      .addDropdown((dd) => {
        getAllEmbeddingModels()
          .filter(
            (m) => m.provider === this.plugin.settings.ragEmbeddingProvider
          )
          .forEach((m) => {
            const badges: string[] = [];
            if (m.free) badges.push("FREE");
            if (m.supportsImage) badges.push("🖼️");
            if (m.discovered) badges.push("novo");
            const badgeStr = badges.length > 0 ? ` [${badges.join(" ")}]` : "";
            const priceStr =
              m.pricePerMillion === 0 ? "" : ` · $${m.pricePerMillion}/M`;
            dd.addOption(m.model, `${m.model} (${m.dim}d${priceStr})${badgeStr}`);
          });
        dd.setValue(this.plugin.settings.ragEmbeddingModel).onChange(
          async (value) => {
            this.plugin.settings.ragEmbeddingModel = value;
            await this.plugin.saveSettings();
            this.display();
          }
        );
      });

    // ---- Card de info do modelo de embedding (espelha os cards de chat):
    //      logo + dimensão + imagem + custo + contexto + tamanho/trecho. Amarra
    //      a escolha ao impacto no índice (e no teto do mobile). v0.1.199 ----
    {
      const spec = getEmbeddingSpec(this.plugin.settings.ragEmbeddingModel);
      const prof = getQuantProfile(this.plugin.settings.ragQuantProfile);
      const bytesPerComp = prof.precision === "int8" ? 1 : 4;
      const effDim =
        prof.targetDim > 0 && spec.supportsDimensions ? prof.targetDim : spec.dim;
      const bytesPerChunk = effDim * bytesPerComp;

      const card = section.createDiv({ cls: "axxa-emb-card" });
      const head = card.createDiv({ cls: "axxa-emb-card-head" });
      setIcon(
        head.createSpan({ cls: "axxa-emb-card-logo" }),
        modelVendorLogoId(spec.provider, spec.model) ?? "box"
      );
      const titles = head.createDiv({ cls: "axxa-emb-card-titles" });
      titles.createSpan({ cls: "axxa-emb-card-name", text: spec.model });
      titles.createSpan({ cls: "axxa-emb-card-prov", text: spec.provider });

      const specs = card.createDiv({ cls: "axxa-emb-card-specs" });
      const specRow = (icon: string, label: string, value: string) => {
        const r = specs.createDiv({ cls: "axxa-emb-spec" });
        setIcon(r.createSpan({ cls: "axxa-emb-spec-ico" }), icon);
        r.createSpan({ cls: "axxa-emb-spec-label", text: label });
        r.createSpan({ cls: "axxa-emb-spec-val", text: value });
      };
      specRow("ruler", t.settings.ragEmbDim, `${spec.dim}d`);
      specRow(
        "image",
        t.settings.ragEmbImage,
        spec.supportsImage ? t.settings.ragEmbYes : t.settings.ragEmbNo
      );
      specRow(
        "circle-dollar-sign",
        t.settings.ragEmbCost,
        spec.free || spec.pricePerMillion === 0
          ? "FREE"
          : `$${spec.pricePerMillion}/M`
      );
      specRow(
        "file-text",
        t.settings.ragEmbCtx,
        `${spec.maxInputTokens.toLocaleString()} tok`
      );
      specRow(
        "hard-drive",
        t.settings.ragEmbPerChunk,
        `~${bytesPerChunk} B (${effDim}d ${prof.precision})`
      );

      card.createDiv({
        cls: "axxa-emb-card-note",
        text: t.settings.ragEmbMobileNote,
      });
    }

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
            this.plugin.settings.ragIndexPath = normalizePath(value || "axxa-ai/index");
            await this.plugin.saveSettings();
          });
        this.attachFolderAutocomplete(text.inputEl);
      });

    // ---- Índice em pedaços (stream) — bound de memória pra vaults grandes ----
    new Setting(section)
      .setName(t.settings.ragStreamShardsLabel)
      .setDesc(t.settings.ragStreamShardsDesc)
      .addToggle((tg) =>
        tg
          .setValue(this.plugin.settings.ragStreamShards)
          .onChange(async (value) => {
            this.plugin.settings.ragStreamShards = value;
            await this.plugin.saveSettings();
            this.display();
          })
      );
    if (this.plugin.settings.ragStreamShards) {
      section.createDiv({
        cls: "axxa-rag-profile-desc",
        text: t.settings.ragStreamShardsHint(RAG_SHARD_SIZE),
      });
    }

    // ---- Auto-reindex (opt-in) ----
    new Setting(section)
      .setName(t.settings.ragAutoReindexLabel)
      .setDesc(t.settings.ragAutoReindexDesc)
      .addToggle((tg) =>
        tg
          .setValue(this.plugin.settings.ragAutoReindex)
          .onChange(async (value) => {
            this.plugin.settings.ragAutoReindex = value;
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
    // Formato do índice no disco (streamed/single) + aviso se ≠ do toggle —
    // o toggle só vale após REINDEXAR. v0.1.200
    const onDisk = idx.streamed;
    const wanted = this.plugin.settings.ragStreamShards;
    el.createEl("br");
    el.createSpan({
      text: t.settings.ragStatsFormat(
        onDisk ? t.settings.ragFormatStreamed : t.settings.ragFormatSingle
      ),
      cls: "axxa-rag-stats-line",
    });
    if (onDisk !== wanted) {
      el.createEl("br");
      el.createSpan({
        text: t.settings.ragStatsFormatMismatch,
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
        geminiApiKey: this.plugin.settings.geminiApiKey,
        nimApiKey: this.plugin.settings.nimApiKey,
        model: this.plugin.settings.ragEmbeddingModel,
        profile: this.plugin.settings.ragQuantProfile,
        indexPath: this.plugin.settings.ragIndexPath,
        // Não indexa pastas internas do AXXA pra não poluir o vetor
        excludePaths: [
          this.plugin.settings.ragIndexPath,
          this.plugin.settings.chatsPath,
          this.plugin.settings.recordingsPath,
        ],
        shardSize: this.plugin.settings.ragStreamShards ? RAG_SHARD_SIZE : 0,
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
    // v0.1.106: novo conjunto — 8 estáticos + 8 live (animados). Os swatches
    // renderizam o preset REAL (mesma classe axxa-bg-<id>), não um mock.
    const ids: Array<keyof typeof t.settings.backgroundLabels> = [
      "none",
      // === Static (8) ===
      "dawn",
      "ocean",
      "forest",
      "violet",
      "rose",
      "amber",
      "slate",
      "mono",
      // === Live (8) ===
      "aurora",
      "nebula",
      "pulse",
      "flow",
      "tide",
      "ember",
      "spectrum",
      "lagoon",
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
      // Swatch = preset real (sizing .axxa-bg-swatch + classe axxa-bg-<id>)
      btn.createDiv({ cls: "axxa-bg-swatch axxa-bg-" + id });
      btn.createSpan({
        cls: "axxa-bg-option-label",
        text: t.settings.backgroundLabels[id],
      });
      btn.onclick = async () => {
        hapticTick();
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

    // Skeleton loader enquanto computa (estilo premium, ref print #187).
    const contentEl = parent.createDiv({ cls: "axxa-usage-content" });
    const skel = contentEl.createDiv({
      cls: "axxa-usage-loading",
      attr: { "aria-label": t.settings.usageLoading, role: "status" },
    });
    const cards = skel.createDiv({ cls: "axxa-skeleton-cards" });
    for (let i = 0; i < 3; i++) {
      cards.createDiv({ cls: "axxa-skeleton axxa-skeleton-card" });
    }
    const barW = ["75%", "55%", "85%", "60%"];
    for (let i = 0; i < barW.length; i++) {
      const b = skel.createDiv({ cls: "axxa-skeleton axxa-skeleton-bar" });
      b.style.width = barW[i];
    }

    try {
      // Reusa o cache ÚNICO de summaries (v0.1.175) — sem disk-walk próprio.
      const agg =
        this.cachedUsage ??
        aggregateFromSummaries(
          await this.plugin.loadChatSummaries(),
          this.usagePeriodDays
        );
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

  /**
   * Painel de SALDO (v0.1.171) — o workaround pro fato de não haver API de saldo.
   * O user ancora ("tenho $X em DD/MM") e o plugin mostra saldo = âncora − gasto.
   * "Atualizar" busca o gasto REAL (OpenAI/Anthropic admin · OpenRouter nativo);
   * sem isso, o saldo é ESTIMADO pelos chats do vault.
   */
  private renderBalancePanel(
    parent: HTMLElement,
    agg: UsageAggregate,
    t: Translations
  ) {
    const sec = parent.createDiv({ cls: "axxa-balance" });
    const head = sec.createDiv({ cls: "axxa-balance-head" });
    head.createEl("h4", { text: t.settings.balanceTitle });
    const refresh = head.createEl("button", {
      text: t.settings.balanceRefresh,
      cls: "axxa-usage-xcheck-btn",
    });

    const list = sec.createDiv({ cls: "axxa-balance-list" });
    const PROVS = ["openai", "anthropic", "gemini", "openrouter", "nim"];
    const valueCells: Record<string, HTMLElement> = {};
    if (!this.plugin.settings.balanceAnchors) this.plugin.settings.balanceAnchors = {};
    const anchors = this.plugin.settings.balanceAnchors;

    const recompute = (p: string) => {
      const cell = valueCells[p];
      if (!cell || p === "openrouter") return;
      const a = anchors[p];
      if (!a || typeof a.amount !== "number" || !a.date) {
        cell.setText(t.settings.balanceSetAnchor);
        cell.removeClass("is-real", "is-est");
        return;
      }
      const spent = spentSinceFromRows(agg.chats, p, a.date);
      cell.setText(`≈ ${formatUsd(a.amount - spent)} · ${t.settings.balanceEstimate}`);
      cell.removeClass("is-real");
      cell.addClass("is-est");
    };

    for (const p of PROVS) {
      const row = list.createDiv({ cls: "axxa-balance-row" });
      row.createSpan({ text: p, cls: "axxa-balance-prov" });
      if (p === "openrouter") {
        row.createSpan({ text: t.settings.balanceLiveHint, cls: "axxa-balance-hint" });
      } else {
        const a = anchors[p] ?? { amount: 0, date: "" };
        const amt = row.createEl("input", {
          cls: "axxa-balance-amt",
          attr: { type: "number", step: "0.01", placeholder: "$ âncora" },
        }) as HTMLInputElement;
        if (a.amount) amt.value = String(a.amount);
        const dt = row.createEl("input", {
          cls: "axxa-balance-date",
          attr: { type: "date" },
        }) as HTMLInputElement;
        if (a.date) dt.value = a.date;
        const save = async () => {
          anchors[p] = { amount: parseFloat(amt.value) || 0, date: dt.value };
          await this.plugin.saveSettings();
          recompute(p);
        };
        amt.onchange = save;
        dt.onchange = save;
      }
      valueCells[p] = row.createSpan({ text: "—", cls: "axxa-balance-value" });
      recompute(p);
    }

    sec.createDiv({ cls: "axxa-balance-note", text: t.settings.balanceNote });

    refresh.onclick = async () => {
      refresh.disabled = true;
      refresh.setText(t.settings.usageBillingCrossing);
      const tasks: Promise<void>[] = [];
      const orKey = this.plugin.settings.openrouterApiKey;
      if (orKey && orKey.trim()) {
        tasks.push(
          (async () => {
            try {
              const b = await fetchOpenRouterBilling(orKey, requestUrl);
              valueCells["openrouter"].setText(
                `${b.remainingUsd != null ? formatUsd(b.remainingUsd) : "∞"} · ${t.settings.balanceReal}`
              );
              valueCells["openrouter"].addClass("is-real");
            } catch {
              valueCells["openrouter"].setText("erro");
            }
          })()
        );
      }
      const oaAdmin = this.adminKeyFor("openai");
      const oaA = anchors["openai"];
      if (oaAdmin && oaA?.date && typeof oaA.amount === "number") {
        tasks.push(
          (async () => {
            try {
              const start = Math.floor(Date.parse(oaA.date) / 1000);
              const spent = await fetchOpenAICosts(
                oaAdmin,
                requestUrl,
                start,
                this.plugin.settings.openaiProjectId
              );
              valueCells["openai"].setText(
                `≈ ${formatUsd(oaA.amount - spent)} · ${t.settings.balanceReal}`
              );
              valueCells["openai"].removeClass("is-est");
              valueCells["openai"].addClass("is-real");
            } catch (err) {
              new Notice(`OpenAI: ${err instanceof Error ? err.message : String(err)}`);
            }
          })()
        );
      }
      const antAdmin = this.adminKeyFor("anthropic");
      const antA = anchors["anthropic"];
      if (antAdmin && antA?.date && typeof antA.amount === "number") {
        tasks.push(
          (async () => {
            try {
              const spent = await fetchAnthropicCosts(
                antAdmin,
                requestUrl,
                antA.date,
                this.plugin.settings.anthropicWorkspaceId
              );
              valueCells["anthropic"].setText(
                `≈ ${formatUsd(antA.amount - spent)} · ${t.settings.balanceRealExp}`
              );
              valueCells["anthropic"].removeClass("is-est");
              valueCells["anthropic"].addClass("is-real");
            } catch (err) {
              new Notice(`Anthropic: ${err instanceof Error ? err.message : String(err)}`);
            }
          })()
        );
      }
      await Promise.all(tasks);
      refresh.disabled = false;
      refresh.setText(t.settings.balanceRefresh);
    };
  }

  /**
   * Cross-check do billing real: estimativa do plugin vs o que o provider
   * reporta. OpenRouter dá real com a chave normal (botão "Cruzar"); os demais
   * mostram a capacidade (admin key / console / local). v0.1.169
   */
  private renderBillingCrossCheck(
    parent: HTMLElement,
    agg: UsageAggregate,
    t: Translations
  ) {
    const sec = parent.createDiv({ cls: "axxa-usage-xcheck" });
    const head = sec.createDiv({ cls: "axxa-usage-xcheck-head" });
    head.createEl("h4", { text: t.settings.usageBillingTitle });
    const btn = head.createEl("button", {
      text: t.settings.usageBillingCross,
      cls: "axxa-usage-xcheck-btn",
    });

    const table = sec.createDiv({ cls: "axxa-usage-xcheck-list" });
    const header = table.createDiv({ cls: "axxa-usage-xcheck-row is-head" });
    header.createSpan({ text: t.settings.usageColProvider });
    header.createSpan({ text: t.settings.usageBillingEstimate });
    header.createSpan({ text: t.settings.usageBillingReal });
    header.createSpan({ text: t.settings.usageBillingStatusCol });

    const realCells: Record<string, HTMLElement> = {};
    for (const [p] of sortBucketEntries(agg.byProvider)) {
      if (!p || p === "(desconhecido)") continue;
      const cap = billingCapabilityFor(p);
      const bucket = agg.byProvider[p];
      const row = table.createDiv({
        cls: "axxa-usage-xcheck-row axxa-usage-xcheck-cap-" + cap.capability,
      });
      row.createSpan({ text: p, cls: "axxa-usage-xcheck-prov" });
      row.createSpan({ text: formatUsd(bucket.cost), cls: "axxa-usage-num" });
      realCells[p] = row.createSpan({
        text: "—",
        cls: "axxa-usage-num axxa-usage-xcheck-real",
      });
      // Status dinâmico: se o campo já tem uma ADMIN key, o custo real fica
      // disponível (OpenAI agora; Anthropic em breve).
      let note = cap.note;
      if (cap.capability === "admin-key" && this.adminKeyFor(p)) {
        note = p === "anthropic" ? t.settings.keyAdminAntExp : t.settings.keyAdminReady;
      }
      const status = row.createSpan({ cls: "axxa-usage-xcheck-status" });
      status.createSpan({ text: note });
      if (cap.consoleUrl) {
        const a = status.createEl("a", {
          text: " ↗",
          href: cap.consoleUrl,
          cls: "axxa-usage-xcheck-link",
        });
        a.setAttr("target", "_blank");
      }
    }

    btn.onclick = async () => {
      const orKey = this.plugin.settings.openrouterApiKey;
      const oaAdmin = this.adminKeyFor("openai");
      const antAdmin = this.adminKeyFor("anthropic");
      const canOR = realCells["openrouter"] && orKey && orKey.trim();
      const canOA = realCells["openai"] && oaAdmin;
      const canANT = realCells["anthropic"] && antAdmin;
      if (!canOR && !canOA && !canANT) {
        new Notice(t.settings.usageBillingNoLive);
        return;
      }
      btn.disabled = true;
      btn.setText(t.settings.usageBillingCrossing);
      const periodDays = this.usagePeriodDays > 0 ? this.usagePeriodDays : 30;
      const startMs = Date.now() - periodDays * 24 * 60 * 60 * 1000;
      const startUnix = Math.floor(startMs / 1000);
      const startIso = new Date(startMs).toISOString().slice(0, 10);
      await Promise.all([
        (async () => {
          if (!canOR) return;
          try {
            const b = await fetchOpenRouterBilling(orKey, requestUrl);
            const remain =
              b.remainingUsd != null
                ? ` (${formatUsd(b.remainingUsd)} ${t.settings.usageBillingLeft})`
                : "";
            realCells["openrouter"].setText(formatUsd(b.usageUsd) + remain);
            realCells["openrouter"].addClass("is-real");
          } catch (err) {
            realCells["openrouter"].setText("erro");
            new Notice(`OpenRouter: ${err instanceof Error ? err.message : String(err)}`);
          }
        })(),
        (async () => {
          if (!canOA) return;
          try {
            const cost = await fetchOpenAICosts(
              oaAdmin,
              requestUrl,
              startUnix,
              this.plugin.settings.openaiProjectId
            );
            realCells["openai"].setText(formatUsd(cost));
            realCells["openai"].addClass("is-real");
            realCells["openai"].setAttr(
              "title",
              this.plugin.settings.openaiProjectId
                ? t.settings.usageBillingProjNote
                : t.settings.usageBillingOrgNote
            );
          } catch (err) {
            realCells["openai"].setText("erro");
            new Notice(`OpenAI: ${err instanceof Error ? err.message : String(err)}`);
          }
        })(),
        (async () => {
          if (!canANT) return;
          try {
            const cost = await fetchAnthropicCosts(
              antAdmin,
              requestUrl,
              startIso,
              this.plugin.settings.anthropicWorkspaceId
            );
            realCells["anthropic"].setText(formatUsd(cost));
            realCells["anthropic"].addClass("is-real");
            realCells["anthropic"].setAttr("title", t.settings.usageBillingOrgNote);
          } catch (err) {
            realCells["anthropic"].setText("erro");
            new Notice(`Anthropic: ${err instanceof Error ? err.message : String(err)}`);
          }
        })(),
      ]);
      btn.disabled = false;
      btn.setText(t.settings.usageBillingCross);
    };
  }

  /** Painel data-sharing: bruto vs cobrado vs economia + cota grátis de HOJE. */
  private renderDataSharingPanel(
    parent: HTMLElement,
    agg: UsageAggregate,
    billed: BilledUsage,
    t: Translations
  ) {
    const tier = this.plugin.settings.openaiUsageTier || 1;
    const sec = parent.createDiv({ cls: "axxa-usage-ds" });
    sec.createEl("h4", { text: t.settings.usageDsTitle(tier) });

    const line = sec.createDiv({ cls: "axxa-usage-ds-line" });
    line.createSpan({ text: t.settings.usageDsGross(formatUsd(billed.grossCost)) });
    line.createSpan({
      text: t.settings.usageDsBilled(formatUsd(billed.billedCost)),
      cls: "axxa-usage-ds-billed",
    });
    line.createSpan({
      text: t.settings.usageDsSaved(formatUsd(billed.saved)),
      cls: "axxa-usage-ds-saved",
    });

    const today = new Date().toISOString().slice(0, 10);
    const st = todayFreeStatus(agg.chats, { tier, dataSharing: true }, today);
    this.freeBar(sec, t.settings.usageDsBig, st.big.used, st.big.allowance);
    this.freeBar(sec, t.settings.usageDsMini, st.mini.used, st.mini.allowance);

    sec.createDiv({ cls: "axxa-usage-ds-note", text: t.settings.usageDsNote });
  }

  /** Barra de progresso de uma cota grátis (usado / total) do dia. */
  private freeBar(
    parent: HTMLElement,
    label: string,
    used: number,
    allowance: number
  ) {
    const row = parent.createDiv({ cls: "axxa-usage-freebar-row" });
    row.createSpan({ text: label, cls: "axxa-usage-freebar-label" });
    const track = row.createDiv({ cls: "axxa-usage-freebar-track" });
    const pct = allowance > 0 ? Math.min(100, (used / allowance) * 100) : 0;
    const fill = track.createDiv({
      cls: "axxa-usage-freebar-fill" + (pct >= 100 ? " is-full" : ""),
    });
    fill.style.width = pct.toFixed(1) + "%";
    row.createSpan({
      text: `${formatTokens(used)} / ${formatTokens(allowance)}`,
      cls: "axxa-usage-freebar-num",
    });
  }

  private renderUsageBody(
    parent: HTMLElement,
    agg: UsageAggregate,
    t: Translations
  ) {
    // Saldo por provider (âncora + gasto) — no topo, é a info mais acionável.
    this.renderBalancePanel(parent, agg, t);

    // Data-sharing: cobra só o excedente da cota grátis (v0.1.168). O headline
    // de custo passa a refletir o COBRADO (out-of-pocket real).
    const billed: BilledUsage | null = this.plugin.settings.openaiDataSharing
      ? computeBilledUsage(agg.chats, {
          tier: this.plugin.settings.openaiUsageTier || 1,
          dataSharing: true,
        })
      : null;
    const headlineCost = billed ? billed.billedCost : agg.total.cost;

    // ===== Cards de resumo =====
    const summaryGrid = parent.createDiv({ cls: "axxa-usage-summary" });
    this.usageCard(
      summaryGrid,
      billed ? t.settings.usageCostBilledLabel : t.settings.usageCostLabel,
      formatUsd(headlineCost) + (agg.total.hasUnknownCost ? "*" : ""),
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

    // ===== Painel data-sharing (cota grátis aplicada) =====
    if (billed) this.renderDataSharingPanel(parent, agg, billed, t);

    // ===== Cross-check do billing real (OpenRouter ao vivo + status dos demais) =====
    this.renderBillingCrossCheck(parent, agg, t);

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
