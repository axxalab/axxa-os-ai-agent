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
  Menu,
  Modal,
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
import { formatTokens } from "../_shared/contextWindows";
import { AxxaConfirmModal } from "./ConfirmModal";
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
import {
  spentSinceFromRows,
  totalCredits,
  earliestCreditDate,
  type CreditEntry,
} from "../../usage/balance";
import { getModelCapabilities } from "../../providers/modelCapabilities";
import {
  getModelCard,
  CATEGORY_LABELS,
  prettyModelName,
} from "../../providers/modelDescriptions";
import {
  categoryToRole,
  ROLE_ORDER,
  ROLE_LABELS,
  ROLE_DESC,
  ROLE_ICONS,
  type RoleId,
  type RoleModelEntry,
} from "../../providers/modelRoles";
import { modelVendorLogoId, modelVendorLabel } from "../_shared/modelLogo";
import { getHotLevel, hotLabel } from "../../providers/dataCollect";
import {
  saveUsageMarkdown,
  saveUsageHtml,
  printUsageReport,
} from "../../usage/export";

export type TopTabId =
  | "connections"
  | "setup"
  | "agent"
  | "appearance"
  | "usage";
type ProviderTabId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "nim"
  | "ollama";
type AppearanceTabId = "background" | "chips" | "ui";
type ConnTabId = "providers" | "models";
/** Sub-tabs de Connections → Models (v0.1.240 — CRUD básico):
 *  "all" = catálogo por provider (fetch + seleciono o que quero);
 *  "favorites" = organizo o que selecionei (defaults por função, ordem). */
type ModelsSubTabId = "all" | "favorites";

/** Um modelo selecionado: par provider + id (sem dedup cross-provider —
 *  cada linha é do provider dela, CRUD simples). */
interface ModelPair {
  provider: string;
  model: string;
}

/** Logo de cada PROVIDER (registrado em registerBrandLogos). Usado no início de
 *  cada linha do editor de Models e no seletor de provider. v0.1.236 */
const PROVIDER_LOGOS: Record<string, string> = {
  openai: "logo-openai",
  anthropic: "logo-anthropic",
  gemini: "logo-gemini",
  openrouter: "logo-openrouter",
  nim: "logo-nvidia",
  ollama: "logo-ollama",
};

export class AxxaSettingsTab extends PluginSettingTab {
  plugin: AxxaPlugin;
  /** Top-level tab (Providers / Outros) */
  private activeTopTab: TopTabId = "connections";
  /** Sub-tab de Connections: Providers (conexão) | Models (seleção). */
  private activeConnTab: ConnTabId = "providers";
  /** Sub-tab de Models: All (catálogo) | Favorites (organização). v0.1.240 */
  private activeModelsSubTab: ModelsSubTabId = "all";
  /** Busca textual da lista All (não persiste entre displays de propósito —
   *  trocar de provider/tab limpa o filtro). */
  private modelsSearch = "";
  /** Sub-tab quando topTab = providers */
  private activeProviderTab: ProviderTabId = "openai";
  /** Cache dos modelos buscados por provider (sobrevive a re-render do tab,
   *  pra a lista de toggle não sumir a cada saveSettings). v0.1.148 */
  private modelCache: Record<string, string[]> = {};
  /** Sub-tab quando topTab = appearance (v0.1.107: Fundo / Chips / Interface) */
  private activeAppearanceTab: AppearanceTabId = "background";
  /** Nível de effort sendo editado na tab Agent. Semeado no constructor com o
   *  default do user — editar "o seu nível" é o caso comum, não o Max. */
  private activeEffortTab: EffortLevel = "med";
  private unsubscribe?: () => void;
  /** Período em dias do filtro do Usage tab. 0 = tudo. Persistido em memória. */
  private usagePeriodDays = 0;
  /** Cache do último aggregate computed pra evitar recomputar a cada render. */
  private cachedUsage: UsageAggregate | null = null;
  /** (P1-60) Referência do array de summaries usado no cachedUsage — como o
   *  upsert do cache é imutável (P1-12), referência nova = dados novos, e o
   *  aggregate congelado é invalidado. */
  private cachedUsageFor: unknown = null;
  /** Controller usado pra cancelar uma indexação em andamento. */
  private indexAbortController: AbortController | null = null;
  /** id do setTimeout que esconde o progress do RAG — limpo no hide(). v0.1.228 */
  private hideProgressTimer: number | null = null;

  constructor(app: App, plugin: AxxaPlugin) {
    super(app, plugin);
    this.plugin = plugin;

    const eff = plugin.settings.defaultEffort as EffortLevel;
    if (EFFORT_LEVELS.includes(eff)) this.activeEffortTab = eff;
  }


  /** (P1-69) Pré-seleciona a top-tab antes do próximo display() — usado por
   *  CTAs do app ("See details in Settings → Usage") pra aterrissar na aba
   *  certa em vez de largar o usuário em Connections. */
  presetTab(tab: TopTabId): void {
    this.activeTopTab = tab;
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
    this.createTopTabButton(topTabsEl, "connections", "Connections");
    this.createTopTabButton(topTabsEl, "setup", t.settings.topTabs.setup);
    this.createTopTabButton(topTabsEl, "agent", t.settings.topTabs.agent);
    this.createTopTabButton(topTabsEl, "appearance", t.settings.topTabs.appearance);
    this.createTopTabButton(topTabsEl, "usage", t.settings.topTabs.usage);

    // ============================================================
    // Conteúdo da top-tab ativa
    // ============================================================
    const contentEl = containerEl.createDiv({ cls: "axxa-settings-content" });

    switch (this.activeTopTab) {
      case "connections":
        this.renderConnectionsTab(contentEl, t);
        break;
      case "setup":
        this.renderSetupTab(contentEl, t);
        break;
      case "agent":
        this.renderAgentTab(contentEl, t);
        break;
      case "appearance":
        this.renderAppearanceTab(contentEl, t);
        break;
      case "usage":
        this.renderOutrosUsage(contentEl, t);
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
      // v0.1.228: Modal do Obsidian no lugar de window.confirm (não roda no mobile)
      if (!(await this.confirmAction(t.settings.effortResetConfirm, t))) return;
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
        // v0.1.237 (P1-01): clamp SÓ no blur/Enter. O clamp-por-keystroke da
        // v0.1.228 reescrevia o input no meio da digitação — com min alto
        // (Context reserve min=10) digitar "25" virava "10" → "105" → "95".
        // Digitando: salva apenas valores já dentro do range; ao sair do
        // campo, clampa, reflete e salva o resultado final.
        const commit = async (raw: string, reflect: boolean) => {
          const trimmed = raw.trim();
          if (trimmed === "") {
            // Vazio = volta ao default — remove o override
            await opts.onSave(undefined);
            return;
          }
          const num = Number(trimmed);
          if (!isFinite(num)) return;
          const clamped = Math.max(opts.min, Math.min(opts.max, num));
          if (reflect && clamped !== num) text.setValue(String(clamped));
          if (reflect || clamped === num) await opts.onSave(clamped);
        };
        text.onChange((raw) => void commit(raw, false));
        text.inputEl.addEventListener("blur", () =>
          void commit(text.inputEl.value, true)
        );
        text.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") void commit(text.inputEl.value, true);
        });
      });
  }

  hide() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    // v0.1.228: ao fechar as Settings, aborta indexação em andamento e limpa
    // o timer que esconde o progress — senão os callbacks escrevem em DOM já
    // destruído (memory leak / erro de elemento desconectado).
    this.indexAbortController?.abort();
    this.indexAbortController = null;
    if (this.hideProgressTimer !== null) {
      window.clearTimeout(this.hideProgressTimer);
      this.hideProgressTimer = null;
    }
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
    // Status de conexão do provider ativo (CRUD: o R de "tá salvo?").
    const meta = this.providerMeta(this.activeProviderTab);
    const status = subContentEl.createDiv({
      cls:
        "axxa-provider-status " +
        (meta.connected ? "is-connected" : "is-disconnected"),
    });
    setIcon(
      status.createSpan({ cls: "axxa-provider-status-ico" }),
      meta.connected ? "circle-check" : "circle-dashed"
    );
    status.createSpan({
      text: meta.connected
        ? meta.label + " connected"
        : meta.label + " not connected",
    });
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

    // Modelos moraram aqui até a v0.1.239 — agora vivem na aba ao lado.
    // Um CTA único (em vez de 6 cópias, uma por provider).
    const cta = subContentEl.createDiv({ cls: "axxa-provider-models-cta" });
    cta.createSpan({
      cls: "setting-item-description",
      text: "Models (fetch from API, pick what you use) live in the Models tab.",
    });
    const ctaBtn = cta.createEl("button", {
      text: "Open Models →",
      cls: "axxa-models-empty-btn",
      attr: { type: "button" },
    });
    ctaBtn.onclick = () => {
      this.activeConnTab = "models";
      this.activeModelsSubTab = "all";
      this.display();
    };
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
    // Logo + label curto (v0.1.237): icon-only obrigava a adivinhar o provider
    // e o estado ativo — mesmo padrão do segmented de Connections.
    const btn = parent.createEl("button", {
      cls:
        "axxa-subtab-btn axxa-conn-seg-btn" +
        (this.activeProviderTab === id ? " axxa-subtab-active" : ""),
      attr: { "aria-label": label, title: label, type: "button" },
    });
    setIcon(btn.createSpan({ cls: "axxa-conn-seg-ico" }), LOGO[id] ?? "");
    btn.createSpan({ text: label });
    btn.onclick = () => {
      hapticTick();
      this.activeProviderTab = id;
      this.display();
    };
  }

  // ============================================================
  // CONNECTIONS — wrapper com sub-tabs [Providers | Models]. v0.1.236
  //   Providers = conexão (key + status). Models = seleção por PAPEL,
  //   cross-provider, com ★ (default de cada função) + dedup de provider.
  // ============================================================
  private renderConnectionsTab(parent: HTMLElement, t: Translations) {
    const seg = parent.createDiv({
      cls: "axxa-settings-subtabs axxa-conn-seg",
    });
    const mk = (id: ConnTabId, label: string, icon: string) => {
      const btn = seg.createEl("button", {
        cls:
          "axxa-subtab-btn axxa-conn-seg-btn" +
          (this.activeConnTab === id ? " axxa-subtab-active" : ""),
        attr: { type: "button" },
      });
      setIcon(btn.createSpan({ cls: "axxa-conn-seg-ico" }), icon);
      btn.createSpan({ text: label });
      btn.onclick = () => {
        hapticTick();
        this.activeConnTab = id;
        this.display();
      };
    };
    mk("providers", "Providers", "plug");
    mk("models", "Models", "layers");

    const body = parent.createDiv({ cls: "axxa-conn-body" });
    if (this.activeConnTab === "providers") {
      this.renderProvidersTab(body, t);
    } else {
      this.renderModelsTab(body, t);
    }
  }

  /** Providers conectados = têm key (ou endpoint, no Ollama). */
  private connectedProviderIds(): string[] {
    const s = this.plugin.settings;
    const ids: string[] = [];
    if (s.openaiApiKey) ids.push("openai");
    if (s.anthropicApiKey) ids.push("anthropic");
    if (s.geminiApiKey) ids.push("gemini");
    if (s.openrouterApiKey) ids.push("openrouter");
    if (s.nimApiKey) ids.push("nim");
    if (s.ollamaEndpoint) ids.push("ollama");
    return ids;
  }

  /** ID normalizado pra dedup cross-provider: tira o namespace (openai/gpt-4o →
   *  gpt-4o, meta-llama/llama-3.3 → llama-3.3) e baixa pra minúsculo. */
  private normModelId(model: string): string {
    const leaf = model.includes("/")
      ? model.slice(model.lastIndexOf("/") + 1)
      : model;
    return leaf.toLowerCase();
  }

  /** Papel funcional de um modelo (pra montar os candidatos do "default por
   *  função" na aba Favorites). */
  private roleOfModel(provider: string, model: string): RoleId {
    if (/embed/i.test(model)) return "embedding";
    const caps = getModelCapabilities(provider, model);
    return categoryToRole(getModelCard(provider, model, caps).category);
  }

  /** (P1-21) Default legado de um papel quando roleModels não tem entrada —
   *  espelha o seedRoleModels do plugin (chat ← defaultProvider/modelo do
   *  provider; embedding ← ragEmbedding*). Reasoning não tem legado. */
  private roleLegacyFallback(role: RoleId): RoleModelEntry | undefined {
    const s = this.plugin.settings;
    if (role === "chat") {
      const prov = s.defaultProvider || "openai";
      const byProv: Record<string, string> = {
        openai: s.defaultModel,
        anthropic: s.anthropicModel,
        gemini: s.geminiModel,
        openrouter: s.openrouterModel,
        nim: s.nimModel,
        ollama: s.ollamaModel,
      };
      const model = byProv[prov];
      return model ? { model, provider: prov } : undefined;
    }
    if (role === "embedding" && s.ragEmbeddingModel) {
      return {
        model: s.ragEmbeddingModel,
        provider: s.ragEmbeddingProvider || "openai",
      };
    }
    return undefined;
  }

  /** Write-through do ★: grava nos campos legados que os consumidores JÁ leem
   *  hoje (chat → defaultProvider + modelo do provider; embedding →
   *  ragEmbeddingModel). image/video/tts são lidos via plugin.roleModel(). */
  private applyRoleSideEffects(role: RoleId, model: string, provider: string) {
    const s = this.plugin.settings;
    if (role === "chat") {
      s.defaultProvider = provider;
      switch (provider) {
        case "anthropic":
          s.anthropicModel = model;
          break;
        case "gemini":
          s.geminiModel = model;
          break;
        case "openrouter":
          s.openrouterModel = model;
          break;
        case "nim":
          s.nimModel = model;
          break;
        case "ollama":
          s.ollamaModel = model;
          break;
        default:
          s.defaultModel = model;
          break;
      }
    } else if (role === "embedding") {
      s.ragEmbeddingModel = model;
      s.ragEmbeddingProvider = provider;
      new Notice("Embedding model set — reindex the Vault (Setup → RAG) to apply.");
    }
  }

  // ============================================================
  // MODELS — CRUD básico em duas abas (v0.1.240, UI do zero):
  //   All       = catálogo por provider. Fetch from API + toggle nos que quero
  //               (+ add manual). Selecionado → aparece no seletor do composer.
  //   Favorites = organizo o que selecionei: default por FUNÇÃO (chat, image,
  //               tts, embedding…), favoritos do composer (com ordem) e remoção.
  // ============================================================
  private renderModelsTab(parent: HTMLElement, t: Translations) {
    const seg = parent.createDiv({
      cls: "axxa-settings-subtabs axxa-conn-seg",
    });
    const mk = (id: ModelsSubTabId, label: string, icon: string) => {
      const btn = seg.createEl("button", {
        cls:
          "axxa-subtab-btn axxa-conn-seg-btn" +
          (this.activeModelsSubTab === id ? " axxa-subtab-active" : ""),
        attr: { type: "button" },
      });
      setIcon(btn.createSpan({ cls: "axxa-conn-seg-ico" }), icon);
      btn.createSpan({ text: label });
      btn.onclick = () => {
        hapticTick();
        this.activeModelsSubTab = id;
        this.modelsSearch = "";
        this.display();
      };
    };
    mk("all", "All", "layers");
    mk("favorites", "Favorites", "bookmark");

    const body = parent.createDiv({ cls: "axxa-conn-body" });
    if (this.activeModelsSubTab === "all") {
      this.renderModelsAll(body, t);
    } else {
      this.renderModelsFavorites(body, t);
    }
  }

  /** Fetchers + label de cada provider (usados pela aba All). */
  private providerMeta(id: ProviderTabId): {
    label: string;
    placeholder: string;
    connected: boolean;
    fetchModels: () => Promise<string[]>;
    fetchEmbeddings?: () => Promise<string[]>;
  } {
    const s = this.plugin.settings;
    switch (id) {
      case "openai":
        return {
          label: "OpenAI",
          placeholder: "gpt-5",
          connected: Boolean(s.openaiApiKey),
          fetchModels: () => openaiProvider.listModels(s.openaiApiKey),
          fetchEmbeddings: () =>
            openaiProvider.listEmbeddingModels(s.openaiApiKey),
        };
      case "anthropic":
        return {
          label: "Anthropic",
          placeholder: "claude-sonnet-4-5",
          connected: Boolean(s.anthropicApiKey),
          fetchModels: () => anthropicProvider.listModels(s.anthropicApiKey),
        };
      case "gemini":
        return {
          label: "Gemini",
          placeholder: "gemini-2.5-pro",
          connected: Boolean(s.geminiApiKey),
          fetchModels: () => geminiProvider.listModels(s.geminiApiKey),
          fetchEmbeddings: () =>
            geminiProvider.listEmbeddingModels(s.geminiApiKey),
        };
      case "openrouter":
        return {
          label: "OpenRouter",
          placeholder: "openai/gpt-5",
          connected: Boolean(s.openrouterApiKey),
          fetchModels: () => openrouterProvider.listModels(s.openrouterApiKey),
          fetchEmbeddings: () =>
            openrouterProvider.listEmbeddingModels(s.openrouterApiKey),
        };
      case "nim":
        return {
          label: "Nvidia NIM",
          placeholder: "meta/llama-3.3-70b-instruct",
          connected: Boolean(s.nimApiKey),
          fetchModels: () => nimProvider.listModels(s.nimApiKey),
          fetchEmbeddings: () => nimProvider.listEmbeddingModels(s.nimApiKey),
        };
      case "ollama":
        return {
          label: "Ollama",
          placeholder: "llama3",
          connected: Boolean(s.ollamaEndpoint),
          fetchModels: () => ollamaProvider.listModels(s.ollamaEndpoint),
        };
    }
  }

  // ── ALL: catálogo por provider. Fetch + busca + toggle + add manual. ──
  private renderModelsAll(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      cls: "setting-item-description",
      text:
        "Every model each provider offers. Fetch from API, then turn on the ones you want — they show up in the composer's model selector and in Favorites.",
    });

    // Seletor de provider (mesmo segmented da aba Providers; estado partilhado
    // de propósito: vindo de Providers → OpenAI, cai aqui já no OpenAI).
    const subTabsEl = parent.createDiv({
      cls: "axxa-settings-subtabs axxa-provider-seg",
    });
    this.createProviderSubTab(subTabsEl, "openai", t.settings.tabs.openai);
    this.createProviderSubTab(subTabsEl, "anthropic", t.settings.tabs.anthropic);
    this.createProviderSubTab(subTabsEl, "gemini", t.settings.tabs.gemini);
    this.createProviderSubTab(subTabsEl, "openrouter", t.settings.tabs.openrouter);
    this.createProviderSubTab(subTabsEl, "nim", t.settings.tabs.nim);
    this.createProviderSubTab(subTabsEl, "ollama", t.settings.tabs.ollama);

    const providerId = this.activeProviderTab;
    const meta = this.providerMeta(providerId);
    const wrap = parent.createDiv({ cls: "axxa-models-all" });

    if (!meta.connected) {
      const empty = wrap.createDiv({ cls: "axxa-models-empty" });
      setIcon(empty.createSpan({ cls: "axxa-models-empty-ico" }), "plug-zap");
      empty.createEl("p", {
        text: meta.label + " is not connected yet — add the API key first.",
      });
      const btn = empty.createEl("button", {
        text: "Open Providers",
        cls: "axxa-models-empty-btn",
        attr: { type: "button" },
      });
      btn.onclick = () => {
        this.activeConnTab = "providers";
        this.display();
      };
      return;
    }

    // Toolbar: busca + Fetch from API.
    const toolbar = wrap.createDiv({ cls: "axxa-models-toolbar" });
    const search = toolbar.createEl("input", {
      type: "search",
      placeholder: "Search models…",
      cls: "axxa-models-search",
      value: this.modelsSearch,
    });
    const fetchBtn = toolbar.createEl("button", {
      text: t.settings.activeModelsFetchBtn,
      cls: "axxa-active-models-fetch-btn",
      attr: { type: "button" },
    });

    const listEl = wrap.createDiv({ cls: "axxa-model-toggle-list" });

    const allModels = (): string[] => {
      const active = this.plugin.settings.activeModels[providerId] ?? [];
      const cached = this.modelCache[providerId] ?? [];
      const def = this.getProviderDefault(providerId);
      return Array.from(new Set([...active, ...cached, def].filter(Boolean)));
    };

    const renderRows = () => {
      listEl.empty();
      const q = this.modelsSearch.trim().toLowerCase();
      const models = allModels().filter(
        (m) => !q || m.toLowerCase().includes(q)
      );
      if (models.length === 0) {
        listEl.createEl("p", {
          text: q
            ? "No model matches “" + this.modelsSearch + "”."
            : t.settings.activeModelsEmpty,
          cls: "axxa-active-models-empty",
        });
        return;
      }
      // Agrupa por categoria (Chat multimodal / Reasoning / Image…) — dá o
      // "tipo" do modelo sem poluir cada linha.
      const active = this.plugin.settings.activeModels[providerId] ?? [];
      const groups = new Map<string, string[]>();
      for (const m of models) {
        const cat = getModelCard(
          providerId,
          m,
          getModelCapabilities(providerId, m)
        ).category;
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
        for (const m of mods) this.renderAllModelRow(listEl, providerId, m);
      }
    };

    search.oninput = () => {
      this.modelsSearch = search.value;
      renderRows();
    };

    fetchBtn.onclick = async () => {
      fetchBtn.setAttr("disabled", "true");
      const originalText = fetchBtn.textContent ?? t.settings.activeModelsFetchBtn;
      fetchBtn.textContent = t.settings.activeModelsFetchingBtn;
      try {
        const [fetched, embeds] = await Promise.all([
          meta.fetchModels(),
          meta.fetchEmbeddings
            ? meta.fetchEmbeddings().catch(() => [])
            : Promise.resolve([]),
        ]);
        if (!fetched.length) {
          new Notice(t.settings.modelNoneNotice(meta.label));
          return;
        }
        this.modelCache[providerId] = Array.from(
          new Set([...(this.modelCache[providerId] ?? []), ...fetched])
        );
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

    renderRows();

    // Add manual (CRUD create) — pra modelo que a API não lista ainda.
    const addRow = wrap.createDiv({ cls: "axxa-active-models-add" });
    const input = addRow.createEl("input", {
      type: "text",
      placeholder: t.settings.activeModelsAddPlaceholder(meta.placeholder),
      cls: "axxa-active-models-input",
    });
    const addBtn = addRow.createEl("button", {
      text: t.settings.activeModelsAddBtn,
      cls: "axxa-active-models-add-btn",
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
  }

  /** Linha da aba All: logo + nome + FREE/PAID + 🔥 + switch on/off. */
  private renderAllModelRow(
    listEl: HTMLElement,
    providerId: string,
    model: string
  ) {
    const isActive = () =>
      (this.plugin.settings.activeModels[providerId] ?? []).includes(model);

    const row = listEl.createEl("button", {
      cls:
        "axxa-model-opt axxa-model-toggle-row" +
        (isActive() ? " axxa-model-opt-active" : ""),
      attr: { type: "button", "aria-pressed": String(isActive()) },
    });

    const logo = row.createSpan({ cls: "axxa-model-opt-logo" });
    const logoId = modelVendorLogoId(providerId, model);
    if (logoId) {
      setIcon(logo, logoId);
    } else {
      logo.addClass("axxa-logo-missing");
      logo.setText("🟣");
      logo.setAttr("title", modelVendorLabel(providerId, model));
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

    const ctrls = row.createSpan({ cls: "axxa-model-toggle-ctrls" });
    const sw = ctrls.createSpan({
      cls: "axxa-model-toggle-switch" + (isActive() ? " is-on" : ""),
    });

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

  /** Todos os pares provider+modelo SELECIONADOS (activeModels), na ordem dos
   *  providers conectados. */
  private selectedModelPairs(): ModelPair[] {
    const pairs: ModelPair[] = [];
    for (const prov of this.connectedProviderIds()) {
      for (const m of this.plugin.settings.activeModels[prov] ?? []) {
        pairs.push({ provider: prov, model: m });
      }
    }
    return pairs;
  }

  // ── FAVORITES: defaults por função + favoritos ordenados + seleção. ──
  private renderModelsFavorites(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      cls: "setting-item-description",
      text:
        "Organize what you picked in All: the default model for each function, and the composer quick-pick favorites (drag order = display order).",
    });

    const pairs = this.selectedModelPairs();
    if (pairs.length === 0) {
      const empty = parent.createDiv({ cls: "axxa-models-empty" });
      setIcon(empty.createSpan({ cls: "axxa-models-empty-ico" }), "layers");
      empty.createEl("p", { text: "Nothing selected yet." });
      const btn = empty.createEl("button", {
        text: "Pick models in All",
        cls: "axxa-models-empty-btn",
        attr: { type: "button" },
      });
      btn.onclick = () => {
        this.activeModelsSubTab = "all";
        this.display();
      };
      return;
    }

    // ── 1. Default por FUNÇÃO — um Menu por papel, só com candidatos capazes.
    parent.createEl("h3", { text: "Defaults by function" });
    parent.createEl("p", {
      cls: "setting-item-description",
      text:
        "Which model answers each job. Candidates come from your selection in All (embeddings come from the fetched embedding lists).",
    });
    for (const role of ROLE_ORDER) {
      if (role === "other") continue;
      const candidates = this.roleCandidates(role, pairs);
      // Papéis sem nenhum candidato E sem default ficam fora da lista — mostrar
      // "Video — none" sem nada pra escolher é só ruído.
      const cur =
        this.plugin.settings.roleModels[role] ?? this.roleLegacyFallback(role);
      if (candidates.length === 0 && !cur) continue;
      const row = new Setting(parent)
        .setName(ROLE_LABELS[role])
        .setDesc(ROLE_DESC[role]);
      setIcon(
        row.nameEl.createSpan({ cls: "axxa-roledef-ico" }),
        ROLE_ICONS[role]
      );
      row.addButton((btn) => {
        btn.setButtonText(
          cur ? prettyModelName(cur.model) + " · " + cur.provider : "Choose…"
        );
        btn.buttonEl.addClass("axxa-roledef-btn");
        btn.onClick((ev) => {
          const menu = new Menu();
          if (candidates.length === 0) {
            menu.addItem((item) =>
              item.setTitle("No candidate selected in All").setDisabled(true)
            );
          }
          for (const c of candidates) {
            const isCur =
              !!cur && cur.provider === c.provider && cur.model === c.model;
            menu.addItem((item) =>
              item
                .setTitle(
                  prettyModelName(c.model) +
                    " · " +
                    c.provider +
                    (isCur ? "  ✓" : "")
                )
                .setIcon(PROVIDER_LOGOS[c.provider] ?? "plug")
                .onClick(async () => {
                  this.plugin.settings.roleModels[role] = {
                    model: c.model,
                    provider: c.provider,
                  };
                  const list =
                    this.plugin.settings.activeModels[c.provider] ?? [];
                  if (!list.includes(c.model)) {
                    list.push(c.model);
                    this.plugin.settings.activeModels[c.provider] = list;
                  }
                  this.applyRoleSideEffects(role, c.model, c.provider);
                  await this.plugin.saveSettings();
                  this.display();
                })
            );
          }
          menu.showAtMouseEvent(ev as MouseEvent);
        });
      });
    }

    // ── 2. Favoritos do composer — ordenados (↑↓), bookmark tira. ──
    const favKeys = (this.plugin.settings.favoriteModels ?? []).filter((k) => {
      const [prov, model] = this.splitFavKey(k);
      return pairs.some((p) => p.provider === prov && p.model === model);
    });
    parent.createEl("h3", { text: "Favorites (composer quick-pick)" });
    parent.createEl("p", {
      cls: "setting-item-description",
      text:
        "Up to 5 per provider show on the composer's model sheet, in this order.",
    });
    const favList = parent.createDiv({ cls: "axxa-model-toggle-list" });
    if (favKeys.length === 0) {
      favList.createEl("p", {
        text: "No favorites yet — tap the bookmark on a model below.",
        cls: "axxa-active-models-empty",
      });
    }
    favKeys.forEach((key, i) => {
      const [prov, model] = this.splitFavKey(key);
      this.renderFavoriteRow(favList, { provider: prov, model }, {
        fav: true,
        canUp: i > 0,
        canDown: i < favKeys.length - 1,
        onMove: async (dir) => {
          const arr = this.plugin.settings.favoriteModels ?? [];
          const from = arr.indexOf(key);
          const to = from + dir;
          if (from < 0 || to < 0 || to >= arr.length) return;
          arr.splice(to, 0, arr.splice(from, 1)[0]);
          this.plugin.settings.favoriteModels = arr;
          await this.plugin.saveSettings();
          this.display();
        },
      });
    });

    // ── 3. Restante da seleção — bookmark adiciona, ✕ tira da seleção. ──
    const rest = pairs
      .filter(
        (p) =>
          !(this.plugin.settings.favoriteModels ?? []).includes(
            p.provider + "::" + p.model
          )
      )
      .sort((a, b) => a.model.localeCompare(b.model));
    parent.createEl("h3", { text: "Selected models" });
    const restList = parent.createDiv({ cls: "axxa-model-toggle-list" });
    if (rest.length === 0) {
      restList.createEl("p", {
        text: "Everything selected is already a favorite.",
        cls: "axxa-active-models-empty",
      });
    }
    for (const p of rest) {
      this.renderFavoriteRow(restList, p, { fav: false });
    }
  }

  private splitFavKey(key: string): [string, string] {
    const i = key.indexOf("::");
    return i < 0 ? [key, ""] : [key.slice(0, i), key.slice(i + 2)];
  }

  /** Candidatos de um papel: seleção (All) filtrada por capacidade + no caso
   *  de embedding, as listas descobertas via fetch (não vivem em activeModels). */
  private roleCandidates(role: RoleId, pairs: ModelPair[]): ModelPair[] {
    const out: ModelPair[] = [];
    const seen = new Set<string>();
    const push = (p: ModelPair) => {
      const k = p.provider + "::" + p.model;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(p);
      }
    };
    for (const p of pairs) {
      if (this.roleOfModel(p.provider, p.model) === role) push(p);
    }
    if (role === "embedding") {
      const s = this.plugin.settings;
      for (const prov of this.connectedProviderIds()) {
        for (const m of s.discoveredEmbeddings[prov] ?? []) {
          push({ provider: prov, model: m });
        }
      }
      if (s.ragEmbeddingModel) {
        push({
          provider: s.ragEmbeddingProvider || "openai",
          model: s.ragEmbeddingModel,
        });
      }
    }
    return out;
  }

  /** Linha da aba Favorites: logo + nome + badge do provider + papel-default
   *  (se for) + controles (↑↓ nos favoritos, bookmark, ✕ remove da seleção). */
  private renderFavoriteRow(
    parent: HTMLElement,
    p: ModelPair,
    opts: {
      fav: boolean;
      canUp?: boolean;
      canDown?: boolean;
      onMove?: (dir: -1 | 1) => void | Promise<void>;
    }
  ) {
    const favKey = p.provider + "::" + p.model;
    const row = parent.createDiv({
      cls: "axxa-model-opt axxa-model-toggle-row axxa-fav-row",
    });

    const logo = row.createSpan({ cls: "axxa-model-opt-logo" });
    const logoId = modelVendorLogoId(p.provider, p.model);
    if (logoId) {
      setIcon(logo, logoId);
    } else {
      logo.addClass("axxa-logo-missing");
      logo.setText("🟣");
    }

    const main = row.createSpan({ cls: "axxa-model-opt-main" });
    const nameRow = main.createSpan({ cls: "axxa-model-toggle-namerow" });
    nameRow.createSpan({
      text: prettyModelName(p.model),
      cls: "axxa-model-opt-name",
      attr: { title: p.model },
    });
    const pBadge = nameRow.createSpan({
      cls: "axxa-row-provbadge",
      attr: { title: "Served by " + p.provider },
    });
    const plogo = PROVIDER_LOGOS[p.provider];
    if (plogo) {
      setIcon(pBadge.createSpan({ cls: "axxa-row-provbadge-ico" }), plogo);
    }
    pBadge.createSpan({ text: p.provider, cls: "axxa-row-provbadge-txt" });
    // Badge "default de X" quando este par é o ★ de algum papel.
    for (const role of ROLE_ORDER) {
      const r = this.plugin.settings.roleModels[role];
      if (r && r.provider === p.provider && r.model === p.model) {
        const tag = nameRow.createSpan({
          cls: "axxa-model-default-tag",
          attr: { title: "Default for " + ROLE_LABELS[role] },
        });
        setIcon(tag.createSpan({ cls: "axxa-roledef-ico" }), ROLE_ICONS[role]);
        tag.createSpan({ text: ROLE_LABELS[role] });
      }
    }

    const ctrls = row.createSpan({ cls: "axxa-model-toggle-ctrls" });

    if (opts.fav && opts.onMove) {
      const up = ctrls.createEl("button", {
        cls: "axxa-fav-move",
        attr: { type: "button", "aria-label": "Move up", title: "Move up" },
      });
      setIcon(up, "chevron-up");
      if (!opts.canUp) up.setAttr("disabled", "true");
      up.onclick = () => void opts.onMove!(-1);
      const down = ctrls.createEl("button", {
        cls: "axxa-fav-move",
        attr: { type: "button", "aria-label": "Move down", title: "Move down" },
      });
      setIcon(down, "chevron-down");
      if (!opts.canDown) down.setAttr("disabled", "true");
      down.onclick = () => void opts.onMove!(1);
    }

    const fav = ctrls.createEl("button", {
      cls: "axxa-model-fav" + (opts.fav ? " is-fav" : ""),
      attr: {
        type: "button",
        title: opts.fav ? "Remove from favorites" : "Add to favorites",
        "aria-label": opts.fav ? "Remove from favorites" : "Add to favorites",
        "aria-pressed": String(opts.fav),
      },
    });
    setIcon(fav, "bookmark");
    fav.onclick = async () => {
      const arr = this.plugin.settings.favoriteModels ?? [];
      const i = arr.indexOf(favKey);
      if (i < 0) arr.push(favKey);
      else arr.splice(i, 1);
      this.plugin.settings.favoriteModels = arr;
      await this.plugin.saveSettings();
      this.display();
    };

    const rm = ctrls.createEl("button", {
      cls: "axxa-model-remove",
      attr: {
        type: "button",
        title: "Remove from selection",
        "aria-label": "Remove from selection",
      },
    });
    setIcon(rm, "x");
    rm.onclick = async () => {
      const list = this.plugin.settings.activeModels[p.provider] ?? [];
      const idx = list.indexOf(p.model);
      if (idx >= 0) list.splice(idx, 1);
      this.plugin.settings.activeModels[p.provider] = list;
      const favArr = this.plugin.settings.favoriteModels ?? [];
      const fi = favArr.indexOf(favKey);
      if (fi >= 0) favArr.splice(fi, 1);
      this.plugin.settings.favoriteModels = favArr;
      await this.plugin.saveSettings();
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

  // ============================================================
  // Tab: Outros — header + sub-tabs (Geral / UI / Agent / RAG)
  // ============================================================
  /**
   * Tab Agent (v0.1.237 — reorganização "fim do Other"): tudo que governa o
   * COMPORTAMENTO da IA num lugar só — permissões do Agent Mode + fine-tuning
   * dos níveis de effort. O antigo grab-bag "Other" morreu: idioma (uma opção
   * só) e override de plano (ferramenta de dev) saíram da UI; o roadmap
   * interno ("coming soon") não é assunto de Settings.
   */
  private renderAgentTab(parent: HTMLElement, t: Translations) {
    parent.createEl("p", {
      text: t.settings.outrosAgentIntro,
      cls: "setting-item-description",
    });
    this.renderAgentSection(parent, t);

    parent.createEl("h3", { text: t.settings.topTabs.effortSection });
    this.renderEffortTab(parent, t);
  }

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
    // v0.1.228: id garantidamente único (randomUUID) — slice de Math.random
    // podia colidir entre vários inputs. Remove datalist antigo do mesmo
    // parent antes de anexar pra não acumular em re-anexos.
    const id = `axxa-folder-list-${crypto.randomUUID()}`;
    inputEl.parentElement?.querySelector("datalist")?.remove();
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

  // ============================================================
  // Tab: Vault (ex "Setup & RAG") — pastas do vault + RAG.
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

    // Transcrição do áudio anexado — o que faz o modelo de fato "ouvir" a
    // gravação. Fica junto da pasta de gravações porque é o mesmo fluxo. v0.1.249
    new Setting(parent)
      .setName(t.settings.transcribeAudio)
      .setDesc(t.settings.transcribeAudioDesc)
      .addToggle((tg) =>
        tg
          .setValue(this.plugin.settings.transcribeAudio)
          .onChange(async (value) => {
            this.plugin.settings.transcribeAudio = value;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    if (this.plugin.settings.transcribeAudio) {
      new Setting(parent)
        .setName(t.settings.transcribeModel)
        .setDesc(t.settings.transcribeModelDesc)
        .addDropdown((dd) =>
          dd
            .addOption("gpt-4o-mini-transcribe", "gpt-4o-mini-transcribe")
            .addOption("gpt-4o-transcribe", "gpt-4o-transcribe")
            .addOption("whisper-1", "whisper-1")
            .setValue(
              this.plugin.settings.transcribeModel || "gpt-4o-mini-transcribe"
            )
            .onChange(async (value) => {
              this.plugin.settings.transcribeModel = value;
              await this.plugin.saveSettings();
            })
        );
    }

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
  /** Permissões e comportamento do Agent Mode (linhas da tab Agent). */
  private renderAgentSection(parent: HTMLElement, t: Translations) {
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
    // A status line do composer saiu em 0.1.253 — sobrou só a curadoria dos
    // chips dos cards de conversa. Checklist sem efeito é setting que engana.
    const LIST_IDS = ["mode", "model", "date", "messages", "tokens"] as const;

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
    settingKey: "listChips"
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
        hapticTick(); // v0.1.228: feedback consistente com o resto da UI
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
      openai: "OpenAI (text)",
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
      // v0.1.228: Modal do Obsidian no lugar de window.confirm (não roda no mobile)
      if (!(await this.confirmAction(t.settings.ragClearConfirm, t))) return;
      try {
        await deleteIndex(this.plugin.app.vault.adapter, this.plugin.settings.ragIndexPath);
        this.plugin.vectorIndex = null;
        this.renderRagStats(statsEl, t);
        new Notice(t.settings.ragClearDone);
      } catch (err) {
        const msg = err instanceof Error ? err.message : t.ai.unknownError;
        new Notice(t.settings.ragClearFailed(msg));
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
    // (P1-78) Valida a key do PROVIDER REAL do modelo de embedding: eram só
    // 2 ramos (openrouter/openai) pra um dropdown de 4 — usuário só-Gemini
    // recebia "OpenAI API key not configured" tendo tudo configurado.
    const s = this.plugin.settings;
    const embProvider =
      EMBEDDING_MODELS.find((m) => m.model === s.ragEmbeddingModel)?.provider ??
      s.ragEmbeddingProvider ??
      "openai";
    const KEY_BY_PROVIDER: Record<string, { key: string; label: string }> = {
      openai: { key: s.openaiApiKey, label: "OpenAI" },
      openrouter: { key: s.openrouterApiKey, label: "OpenRouter" },
      gemini: { key: s.geminiApiKey, label: "Gemini" },
      nim: { key: s.nimApiKey, label: "Nvidia NIM" },
    };
    const req = KEY_BY_PROVIDER[embProvider] ?? KEY_BY_PROVIDER.openai;
    if (!req.key.trim()) {
      new Notice(t.settings.ragNoProviderKey(req.label));
      return;
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
        const msg = err instanceof Error ? err.message : t.ai.unknownError;
        new Notice(t.settings.ragIndexingFailed(msg));
      }
    } finally {
      this.indexAbortController = null;
      indexBtn.disabled = false;
      reindexBtn.disabled = false;
      clearBtn.disabled = false;
      // Esconde progress depois de 2.5s pro user ler o status. v0.1.228:
      // guarda o id (limpo no hide()) e checa isConnected — se as Settings
      // fecharem nesse meio-tempo, o callback não toca em DOM destruído.
      if (this.hideProgressTimer !== null) {
        window.clearTimeout(this.hideProgressTimer);
      }
      this.hideProgressTimer = window.setTimeout(() => {
        this.hideProgressTimer = null;
        if (progressEl.isConnected) progressEl.style.display = "none";
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
      // (P1-60) Conversas novas invalidam o aggregate: sem isto os números
      // congelavam na primeira abertura da sessão de Settings.
      const summaries = await this.plugin.loadChatSummaries();
      if (this.cachedUsageFor !== summaries) this.cachedUsage = null;
      this.cachedUsageFor = summaries;
      const agg =
        this.cachedUsage ??
        aggregateFromSummaries(summaries, this.usagePeriodDays);
      this.cachedUsage = agg;
      // (P1-75) Aggregate completo pro saldo (independe do filtro de período).
      const aggAll =
        this.usagePeriodDays === 0 ? agg : aggregateFromSummaries(summaries, 0);
      contentEl.empty();
      this.renderUsageBody(contentEl, agg, t, aggAll);
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
    if (!this.plugin.settings.balanceCredits) this.plugin.settings.balanceCredits = {};
    const anchors = this.plugin.settings.balanceAnchors;
    const allCredits = this.plugin.settings.balanceCredits;

    // Lazy-migra a âncora única (legado) pra uma recarga só, na 1ª vez. v0.1.230
    const getCredits = (p: string): CreditEntry[] => {
      if (!allCredits[p]) {
        const old = anchors[p];
        allCredits[p] =
          old && (old.amount || old.date)
            ? [{ amount: old.amount, date: old.date }]
            : [];
      }
      return allCredits[p];
    };

    // saldo = Σ recargas − gasto desde a recarga MAIS ANTIGA.
    const recompute = (p: string) => {
      const cell = valueCells[p];
      if (!cell || p === "openrouter") return;
      const entries = getCredits(p);
      const earliest = earliestCreditDate(entries);
      if (earliest === null) {
        cell.setText(t.settings.balanceSetAnchor);
        cell.removeClass("is-real", "is-est");
        return;
      }
      const spent = spentSinceFromRows(agg.chats, p, earliest);
      cell.setText(
        `≈ ${formatUsd(totalCredits(entries) - spent)} · ${t.settings.balanceEstimate}`
      );
      cell.removeClass("is-real");
      cell.addClass("is-est");
    };

    for (const p of PROVS) {
      const block = list.createDiv({
        cls: "axxa-balance-block",
        attr: { "data-provider": p }, // cor de marca por provider (v0.1.231)
      });
      const head = block.createDiv({ cls: "axxa-balance-row" });
      head.createSpan({ text: p, cls: "axxa-balance-prov" });
      if (p === "openrouter") {
        head.createSpan({ text: t.settings.balanceLiveHint, cls: "axxa-balance-hint" });
        valueCells[p] = head.createSpan({ text: "—", cls: "axxa-balance-value" });
        continue; // OpenRouter expõe saldo nativo — sem ledger de recargas.
      }
      valueCells[p] = head.createSpan({ text: "—", cls: "axxa-balance-value" });

      // Ledger de recargas: cada linha = data + valor carregado, + botão remover.
      const ledger = block.createDiv({ cls: "axxa-balance-credits" });
      const renderLedger = () => {
        ledger.empty();
        const entries = getCredits(p);
        entries.forEach((entry, i) => {
          const crow = ledger.createDiv({ cls: "axxa-balance-credit-row" });
          const dt = crow.createEl("input", {
            cls: "axxa-balance-date",
            attr: { type: "date" },
          }) as HTMLInputElement;
          if (entry.date) dt.value = entry.date;
          const amt = crow.createEl("input", {
            cls: "axxa-balance-amt",
            attr: {
              type: "number",
              step: "0.01",
              min: "0",
              placeholder: t.settings.balanceCreditAmount,
            },
          }) as HTMLInputElement;
          if (entry.amount) amt.value = String(entry.amount);
          const saveEntry = async () => {
            entry.amount = Math.max(0, parseFloat(amt.value) || 0);
            entry.date =
              dt.value && Number.isFinite(Date.parse(dt.value)) ? dt.value : "";
            await this.plugin.saveSettings();
            recompute(p);
          };
          amt.onchange = saveEntry;
          dt.onchange = saveEntry;
          const del = crow.createEl("button", {
            cls: "axxa-balance-credit-del",
            text: "×",
            attr: { type: "button", "aria-label": t.settings.balanceRemoveCredit },
          });
          del.onclick = async () => {
            entries.splice(i, 1);
            await this.plugin.saveSettings();
            renderLedger();
            recompute(p);
          };
        });
        const add = ledger.createEl("button", {
          cls: "axxa-balance-add",
          text: t.settings.balanceAddCredit,
          attr: { type: "button" },
        });
        add.onclick = async () => {
          getCredits(p).push({ amount: 0, date: "" });
          await this.plugin.saveSettings();
          renderLedger();
        };
      };
      renderLedger();
      recompute(p);
    }

    sec.createDiv({ cls: "axxa-balance-note", text: t.settings.balanceNote });

    refresh.onclick = async () => {
      const orKey = this.plugin.settings.openrouterApiKey;
      const oaAdmin = this.adminKeyFor("openai");
      const antAdmin = this.adminKeyFor("anthropic");
      // v0.1.228: sem nenhuma fonte de saldo REAL, "Atualizar" era um dead-end
      // (não buscava nada). Avisa e sai, igual ao cross-check.
      if (!(orKey && orKey.trim()) && !oaAdmin && !antAdmin) {
        new Notice(t.settings.usageBillingNoLive);
        return;
      }
      refresh.disabled = true;
      refresh.setText(t.settings.usageBillingCrossing);
      const tasks: Promise<void>[] = [];
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
              valueCells["openrouter"].setText(t.settings.usageCellError);
            }
          })()
        );
      }
      // Saldo REAL = Σ recargas − gasto (Costs API) desde a recarga mais antiga.
      const oaEntries = getCredits("openai");
      const oaEarliest = earliestCreditDate(oaEntries);
      if (oaAdmin && oaEarliest) {
        tasks.push(
          (async () => {
            try {
              const start = Math.floor(Date.parse(oaEarliest) / 1000);
              const spent = await fetchOpenAICosts(
                oaAdmin,
                requestUrl,
                start,
                this.plugin.settings.openaiProjectId
              );
              valueCells["openai"].setText(
                `≈ ${formatUsd(totalCredits(oaEntries) - spent)} · ${t.settings.balanceReal}`
              );
              valueCells["openai"].removeClass("is-est");
              valueCells["openai"].addClass("is-real");
            } catch (err) {
              new Notice(`OpenAI: ${err instanceof Error ? err.message : String(err)}`);
            }
          })()
        );
      }
      const antEntries = getCredits("anthropic");
      const antEarliest = earliestCreditDate(antEntries);
      if (antAdmin && antEarliest) {
        tasks.push(
          (async () => {
            try {
              const spent = await fetchAnthropicCosts(
                antAdmin,
                requestUrl,
                antEarliest,
                this.plugin.settings.anthropicWorkspaceId
              );
              valueCells["anthropic"].setText(
                `≈ ${formatUsd(totalCredits(antEntries) - spent)} · ${t.settings.balanceRealExp}`
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
    // (P1-76) Estimated e Real cobrem JANELAS diferentes (estimado respeita o
    // filtro de período; o real vem do provider na janela dele) — sem o aviso
    // a comparação lado a lado sugeria números comparáveis.
    sec.createDiv({
      cls: "setting-item-description",
      text: t.settings.usageXcheckWindowNote(
        this.usagePeriodDays === 0
          ? t.settings.usagePeriodAll
          : `${this.usagePeriodDays}d`
      ),
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
        a.setAttr("rel", "noopener noreferrer"); // v0.1.228
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
            realCells["openrouter"].setText(t.settings.usageCellError);
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
            realCells["openai"].setText(t.settings.usageCellError);
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
            realCells["anthropic"].setText(t.settings.usageCellError);
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
    t: Translations,
    aggAll?: UsageAggregate
  ) {
    // Saldo por provider (âncora + gasto) — no topo, é a info mais acionável.
    // (P1-75) SALDO usa o aggregate SEM filtro de período: saldo = âncora −
    // gasto TOTAL desde a âncora; com o filtro ativo o gasto encolhia e o
    // saldo "inflava" — número errado se apresentando como real.
    this.renderBalancePanel(parent, aggAll ?? agg, t);

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
    // (P1-77, disclosure) Geração de mídia ainda não entra no aggregate — o
    // usuário que só gera imagens via $0.00 sem saber por quê. A contabilidade
    // real de geração entra quando o pipeline de custos de mídia existir.
    parent.createDiv({
      cls: "setting-item-description axxa-usage-gen-note",
      text: t.settings.usageNoGenCosts,
    });

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
    // v0.1.228: reduce em vez de Math.max(...spread) — robusto se a janela crescer.
    const maxCost = days.reduce((m, d) => Math.max(m, d.bucket.cost), 0.0001);
    for (const d of days) {
      const intensity = d.bucket.cost / maxCost;
      // v0.1.228: mesma string no aria-label (a11y) — o heatmap codificava
      // intensidade só por cor/opacidade, sem alternativa textual no DOM.
      const cellLabel = `${d.day}: ${formatUsd(d.bucket.cost)} · ${t.settings.usageHeatmapChats(d.bucket.chats)}`;
      const cell = heatRow.createDiv({
        cls: "axxa-usage-heatcell",
        attr: {
          title: cellLabel,
          "aria-label": cellLabel,
          role: "img",
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

  /**
   * Confirmação via Modal do Obsidian — substitui window.confirm, que BLOQUEIA
   * a UI e NÃO funciona no mobile do Obsidian (Capacitor). v0.1.228
   */
  private confirmAction(message: string, t: Translations): Promise<boolean> {
    return new AxxaConfirmModal(this.app, message, t).openAndWait();
  }
}
