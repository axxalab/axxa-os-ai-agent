// src/ui/SettingsTab.ts
// Settings em ABAS, por classe de configuração — a lista corrida ficava longa
// demais no mobile e misturava coisas de natureza diferente (credencial,
// default de sessão, pasta do vault, índice, permissão).
//
//   Providers  → uma SUB-ABA por provider (chave/endpoint + modelo). São seis;
//                é o único lugar onde a segunda camada se paga.
//   Chat       → o que vale pra toda conversa nova.
//   Vault      → onde as coisas são gravadas.
//   Vault Q&A  → o índice e o que o alimenta.
//   Agent      → o que o agente pode fazer sem perguntar.
//   Mobile     → só aparece no celular.
//
// A aba escolhida sobrevive ao re-render (indexar chama display() de novo).

import { App, Notice, Platform, PluginSettingTab, Setting, setIcon } from "obsidian";
import type { ButtonComponent } from "obsidian";
import type AxxaPlugin from "../main";
import {
  PROVIDERS,
  providerConfigured,
  providerHealth,
  type ProviderHealth,
} from "../core/providersMeta";
import { EFFORT_LEVELS, EFFORT_LABELS } from "../core/effort";
import { CHAT_MODES } from "../core/session";
import { getAllEmbeddingModels } from "../rag/types";
import { indexVault } from "../rag/indexer";
import { deleteIndex, RAG_SHARD_SIZE } from "../rag/vectorIndex";
import {
  getFreeDailyTokens,
  getModelCapabilities,
} from "../providers/modelCapabilities";
import { buildModelCatalog } from "./modelCatalog";
import { prettyModelName } from "../providers/modelDescriptions";
import {
  OPENAI_TTS_MODELS,
  OPENAI_VOICES,
  speak,
  STT_MODELS,
  TTS_PROVIDERS,
  ttsReady,
} from "./readAloud";
import { ELEVEN_MODELS, elevenVoices } from "../providers/elevenlabs";
import { hapticsOn, setHapticsEnabled, tap } from "./haptics";
import { PERMISSION_LABELS } from "../agent/permissions";
import type { PermissionLevel } from "../agent/types";

type KeyField =
  | "openaiApiKey"
  | "anthropicApiKey"
  | "geminiApiKey"
  | "openrouterApiKey"
  | "nimApiKey";
type ModelField =
  | "defaultModel"
  | "anthropicModel"
  | "geminiModel"
  | "openrouterModel"
  | "nimModel"
  | "ollamaModel";

const PROVIDER_FIELDS: Record<string, { key?: KeyField; model: ModelField }> = {
  openai: { key: "openaiApiKey", model: "defaultModel" },
  anthropic: { key: "anthropicApiKey", model: "anthropicModel" },
  gemini: { key: "geminiApiKey", model: "geminiModel" },
  openrouter: { key: "openrouterApiKey", model: "openrouterModel" },
  nim: { key: "nimApiKey", model: "nimModel" },
  ollama: { model: "ollamaModel" },
};

/** Idiomas oferecidos pro ditado. Vazio = deixa o modelo detectar. */
const SPEECH_LANGS: [string, string][] = [
  ["", "Auto (detect)"],
  ["pt", "Português"],
  ["en", "English"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["it", "Italiano"],
  ["ja", "日本語"],
];

/** Frase do botão Test — curta, pra não virar conta. */
const SAMPLE_LINE = "This is the voice that will read your answers out loud.";

/** Favoritos aparecem na tela inicial; mais que isso vira lista, não atalho. */
export const FAVORITE_LIMIT = 5;

/** O que a bolinha do trilho quer dizer (vai no tooltip do item). */
const HEALTH_TEXT: Record<ProviderHealth, string> = {
  off: "no credential",
  unknown: "not tested",
  ok: "connected",
  fail: "last test failed",
};

/** O que a linha de conexão diz em cada estado. */
const CONN_TEXT: Record<string, (detail?: string) => string> = {
  unknown: () => "Not tested yet — hit Test to check the credential.",
  testing: () => "Talking to the provider…",
  ok: (d) => `Connected. ${d ?? ""}`.trim(),
  fail: (d) => `Failed. ${d ?? ""}`.trim(),
};

/** Estado do teste de conexão. "unknown" = ainda não testou nesta sessão. */
interface ConnState {
  state: "unknown" | "testing" | "ok" | "fail";
  /** Quantos modelos o provider respondeu (ok) ou o erro (fail). */
  detail?: string;
}

type TabId = "providers" | "chat" | "vault" | "rag" | "agent" | "mobile";

interface TabDef {
  id: TabId;
  label: string;
  /** Uma linha explicando o que mora aqui. */
  blurb: string;
  mobileOnly?: boolean;
}

const TABS: TabDef[] = [
  {
    id: "providers",
    label: "Providers",
    blurb: "Your keys and the model each provider uses. Keys stay on this device.",
  },
  {
    id: "chat",
    label: "Chat",
    blurb: "What every new conversation starts with.",
  },
  { id: "vault", label: "Vault", blurb: "Where the plugin writes in your vault." },
  {
    id: "rag",
    label: "Q&A",
    blurb: "Vault Q&A: the local index that grounds answers in your notes.",
  },
  {
    id: "agent",
    label: "Agent",
    blurb: "What the agent may do to your notes without asking.",
  },
  {
    id: "mobile",
    label: "Mobile",
    blurb: "Options that only exist on the phone.",
    mobileOnly: true,
  },
];

export class AxxaSettingsTab extends PluginSettingTab {
  private indexing: AbortController | null = null;
  /** Sobrevivem ao display(): re-render não joga o usuário pra primeira aba. */
  private tab: TabId = "providers";
  private provider = "openai";
  /** Catálogo buscado no provider (não persiste — é sempre "o que há hoje"). */
  private catalog: Record<string, string[]> = {};
  /** Papel selecionado no filtro da lista de modelos ("all" = sem filtro). */
  private kind = "all";
  /** A ÚNICA seção de família aberta (`provider:papel:família`). Nascem todas
   *  fechadas: com sete classes abertas a lista volta a ser a rolagem sem fim
   *  que o agrupamento veio resolver. */
  private openFam: string | null = null;
  /** Resultado do último teste de conexão de cada provider (só na sessão). */
  private conn: Record<string, ConnState> = {};
  private fetching = false;
  private fetchingVoices = false;
  private hapticsOff: (() => void) | null = null;

  // Nós que o re-render PARCIAL reaproveita. Trocar de aba ou de provider
  // chamava display(), que esvazia o container inteiro: a tela piscava como se
  // recarregasse tudo (e recarregava mesmo — nav, blurb, todos os Setting).
  // Agora cada controle troca só a região que ele manda.
  private navEl: HTMLElement | null = null;
  private blurbEl: HTMLElement | null = null;
  private bodyEl: HTMLElement | null = null;
  private subnavEl: HTMLElement | null = null;
  private providerBodyEl: HTMLElement | null = null;
  private modelsEl: HTMLElement | null = null;
  private fetchBtn: ButtonComponent | null = null;

  constructor(
    app: App,
    private readonly plugin: AxxaPlugin
  ) {
    super(app, plugin);
  }

  /** Monta a casca UMA vez: nav + blurb + corpo. Só o corpo troca depois. */
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("axxa-settings-root");
    // Tato em tudo que se toca aqui dentro, sem precisar lembrar botão a botão.
    this.hapticsOff?.();
    this.hapticsOff = hapticsOn(containerEl);

    const tabs = this.tabs();
    if (!tabs.some((t) => t.id === this.tab)) this.tab = tabs[0].id;

    // Segmented control, igual ao da tela inicial: trilho + thumb que desliza
    // pelo índice ativo (--axxa-seg). Colunas iguais e nada de quebrar linha.
    const nav = containerEl.createDiv({ cls: "axxa-seg axxa-settings-nav" });
    for (const t of tabs) {
      const btn = nav.createEl("button", {
        text: t.label,
        cls: t.id === this.tab ? "axxa-seg-item is-active" : "axxa-seg-item",
      });
      btn.setAttribute("type", "button");
      btn.setAttribute("aria-pressed", String(t.id === this.tab));
      btn.dataset.tab = t.id;
      btn.onclick = () => this.setTab(t.id);
    }
    this.navEl = nav;
    this.placeThumb(nav);

    this.blurbEl = containerEl.createEl("p", { cls: "axxa-settings-blurb" });
    this.bodyEl = containerEl.createDiv({ cls: "axxa-settings-body" });
    this.renderBody();
  }

  private tabs(): TabDef[] {
    return TABS.filter((t) => !t.mobileOnly || Platform.isMobile);
  }

  /** Troca de aba SEM remontar a casca: só o estado do trilho e o corpo. */
  private setTab(id: TabId): void {
    if (id === this.tab) return;
    this.tab = id;
    if (this.navEl) {
      for (const btn of Array.from(
        this.navEl.querySelectorAll<HTMLElement>(".axxa-seg-item")
      )) {
        const active = btn.dataset.tab === id;
        btn.toggleClass("is-active", active);
        btn.setAttribute("aria-pressed", String(active));
      }
      this.placeThumb(this.navEl);
    }
    this.renderBody();
  }

  private renderBody(): void {
    const body = this.bodyEl;
    if (!body) return;
    body.empty();
    this.blurbEl?.setText(this.tabs().find((t) => t.id === this.tab)?.blurb ?? "");
    switch (this.tab) {
      case "providers":
        this.renderProviders(body);
        break;
      case "chat":
        this.renderChat(body);
        break;
      case "vault":
        this.renderVault(body);
        break;
      case "rag":
        this.renderRag(body);
        break;
      case "agent":
        this.renderAgent(body);
        break;
      case "mobile":
        this.renderMobile(body);
        break;
    }
  }

  /**
   * Posiciona o thumb do segmented sobre o item ativo. As colunas são do
   * tamanho do CONTEÚDO (colunas iguais cortavam "OpenRouter" e "Anthropic"
   * num painel de 375px), então o thumb não dá pra calcular só em CSS.
   */
  private placeThumb(row: HTMLElement): void {
    const put = () => {
      const active = row.querySelector<HTMLElement>(".axxa-seg-item.is-active");
      if (!active) return;
      row.style.setProperty("--axxa-seg-x", `${active.offsetLeft}px`);
      row.style.setProperty("--axxa-seg-w", `${active.offsetWidth}px`);
    };
    put();
    // De novo no frame seguinte: na primeira passada as fontes podem não ter
    // assentado e a medida sai errada por alguns píxeis.
    window.requestAnimationFrame(put);
  }

  private get s() {
    return this.plugin.settings;
  }
  private save = () => this.plugin.saveSettings();

  // ── Providers (com sub-abas) ──────────────────────────────────────────────

  private renderProviders(el: HTMLElement): void {
    if (!PROVIDER_FIELDS[this.provider]) this.provider = PROVIDERS[0].id;

    // Sub-abas: quem já tem credencial aparece em texto normal, quem não tem
    // fica apagado — dá pra ver o estado dos seis sem abrir um por um.
    const sub = el.createDiv({ cls: "axxa-seg axxa-settings-subnav" });
    for (const p of PROVIDERS) {
      const ready = providerConfigured(this.plugin, p.id);
      const btn = sub.createEl("button", {
        cls:
          "axxa-seg-item" +
          (p.id === this.provider ? " is-active" : "") +
          (ready ? " is-ready" : ""),
      });
      btn.setAttribute("type", "button");
      btn.setAttribute("aria-pressed", String(p.id === this.provider));
      // O LOGO no lugar do nome: com seis providers, nome + logo não cabem em
      // uma linha, e o logo identifica mais rápido. O nome fica no aria-label,
      // no tooltip e no conteúdo logo abaixo ("OpenAI API key").
      const mark = btn.createSpan({ cls: "axxa-seg-logo" });
      setIcon(mark, p.icon);
      // Bolinha de conexão: cinza vazado = sem credencial, cinza cheio = tem
      // mas nunca testou, verde = testou e respondeu, vermelho = recusou.
      mark.createSpan({ cls: "axxa-seg-dot" });
      btn.setAttribute("aria-label", p.name);
      btn.setAttribute("title", p.name);
      btn.dataset.provider = p.id;
      btn.onclick = () => this.setProvider(p.id);
    }
    this.subnavEl = sub;
    this.syncReady();
    this.placeThumb(sub);

    this.providerBodyEl = el.createDiv();
    this.renderProviderBody();
  }

  /** Troca de provider mexendo só no trilho e no corpo da sub-aba. */
  private setProvider(id: string): void {
    if (id === this.provider) return;
    this.provider = id;
    // Outro provider, outros papéis: um filtro herdado mostraria uma lista
    // vazia sem explicar por quê.
    this.kind = "all";
    if (this.subnavEl) {
      for (const btn of Array.from(
        this.subnavEl.querySelectorAll<HTMLElement>(".axxa-seg-item")
      )) {
        const active = btn.dataset.provider === id;
        btn.toggleClass("is-active", active);
        btn.setAttribute("aria-pressed", String(active));
      }
      this.placeThumb(this.subnavEl);
    }
    this.renderProviderBody();
  }

  /**
   * Botão "colar" no fim da linha, pro campo que está vazio. Lê o clipboard só
   * no clique — nunca sozinho — e não registra o conteúdo em lugar nenhum.
   */
  private addPasteButton(
    row: Setting,
    field: KeyField | "ollamaEndpoint" | "elevenApiKey"
  ): void {
    const btn = row.controlEl.createEl("button", { cls: "axxa-paste-btn" });
    btn.setAttribute("type", "button");
    btn.setAttribute("aria-label", "Paste from clipboard");
    btn.setAttribute("title", "Paste from clipboard");
    setIcon(btn, "clipboard-paste");
    btn.onclick = async () => {
      let text = "";
      try {
        text = (await navigator.clipboard.readText()).trim();
      } catch {
        new Notice("This device won't let the plugin read the clipboard — paste into the field by hand.");
        return;
      }
      if (!text) {
        new Notice("Clipboard is empty.");
        return;
      }
      this.s[field] = text;
      await this.save();
      // Some o botão, aparece a chave, e o trilho acende.
      this.renderProviderBody();
      this.syncReady();
      new Notice("Pasted.");
    };
  }

  /** Estado da conexão: o desta sessão, senão o último teste gravado. */
  private connOf(id: string): ConnState {
    const live = this.conn[id];
    if (live) return live;
    const saved = this.s.providerStatus?.[id];
    if (!saved) return { state: "unknown" };
    return { state: saved.ok ? "ok" : "fail", detail: saved.detail };
  }

  /**
   * Testa a credencial pedindo a lista de modelos ao provider. É o mesmo
   * caminho do "Fetch models" — e como a resposta JÁ é o catálogo, guardar ele
   * aqui evita uma segunda ida à rede pra pedir o que acabou de chegar.
   */
  private async testConnection(providerId: string): Promise<void> {
    if (this.conn[providerId]?.state === "testing") return;
    this.conn[providerId] = { state: "testing" };
    this.renderProviderBody();
    try {
      const models = await this.plugin.scanModels(providerId);
      if (models.length > 0) this.catalog[providerId] = models;
      this.conn[providerId] = {
        state: "ok",
        detail:
          models.length > 0
            ? `${models.length} models available.`
            : "The provider answered, but listed no models.",
      };
    } catch (err) {
      this.conn[providerId] = {
        state: "fail",
        detail: err instanceof Error ? err.message : String(err),
      };
    }
    // Grava: quem mais precisa do resultado é o CHAT, que não vai testar
    // sozinho na hora de abrir a folha de modelos.
    const now = this.conn[providerId];
    (this.s.providerStatus ??= {})[providerId] = {
      ok: now.state === "ok",
      at: Date.now(),
      detail: now.detail,
    };
    await this.save();
    this.renderProviderBody();
    this.syncReady();
  }

  /** Saúde mostrada na bolinha — o teste desta sessão manda na frente do
   *  gravado (acabou de testar e ainda não fechou as settings). */
  private healthOf(id: string): ProviderHealth {
    if (!providerConfigured(this.plugin, id)) return "off";
    const live = this.conn[id];
    if (live?.state === "ok") return "ok";
    if (live?.state === "fail") return "fail";
    return providerHealth(this.plugin, id);
  }

  /** Reacende os logos do trilho conforme quem tem credencial. */
  private syncReady(): void {
    if (!this.subnavEl) return;
    for (const btn of Array.from(
      this.subnavEl.querySelectorAll<HTMLElement>(".axxa-seg-item")
    )) {
      const id = btn.dataset.provider;
      if (!id) continue;
      btn.toggleClass("is-ready", providerConfigured(this.plugin, id));
      const health = this.healthOf(id);
      const dot = btn.querySelector<HTMLElement>(".axxa-seg-dot");
      if (dot) {
        dot.className = `axxa-seg-dot is-${health}`;
        dot.setAttribute("aria-hidden", "true");
      }
      btn.setAttribute("title", `${PROVIDERS.find((x) => x.id === id)?.name ?? id} · ${HEALTH_TEXT[health]}`);
    }
  }

  private renderProviderBody(): void {
    const el = this.providerBodyEl;
    if (!el) return;
    el.empty();

    const p = PROVIDERS.find((x) => x.id === this.provider);
    const f = PROVIDER_FIELDS[this.provider];
    if (!p || !f) return;
    const s = this.s;

    // O nome do provider vira CABEÇALHO (com o logo), não rótulo de linha:
    // "OpenRouter API key" na coluna estreita do setting-item trunca no
    // celular ("OpenR… API key"). Cabeçalho ocupa a largura toda.
    const brand = new Setting(el).setName(p.name).setHeading();
    const mark = brand.nameEl.createSpan({ cls: "axxa-settings-brand" });
    setIcon(mark, p.icon);
    brand.nameEl.prepend(mark);

    if (f.key) {
      const key = f.key;
      const row = new Setting(el)
        .setName("API key")
        .setDesc("Stored in the OS keychain (not in data.json).")
        .addText((t) => {
          t.inputEl.type = "password";
          t.setPlaceholder("key…")
            .setValue(s[key])
            .onChange(async (v) => {
              s[key] = v.trim();
              await this.save();
              // O trilho mostra quem já tem credencial: sem isto o logo só
              // acenderia na próxima vez que o corpo fosse remontado.
              this.syncReady();
            });
        });
      // Colar: só no campo VAZIO. Chave de API não se digita no celular — vem
      // colada do gerenciador de senhas, e o toque longo no campo de senha é
      // justamente onde o teclado do Android costuma não oferecer "colar".
      if (!s[key]) this.addPasteButton(row, key);
    } else {
      const row = new Setting(el)
        .setName("Endpoint")
        .setDesc("Local server address. Ollama needs no key.")
        .addText((t) =>
          t
            .setPlaceholder("http://localhost:11434")
            .setValue(s.ollamaEndpoint)
            .onChange(async (v) => {
              s.ollamaEndpoint = v.trim();
              await this.save();
              this.syncReady();
            })
        );
      if (!s.ollamaEndpoint) this.addPasteButton(row, "ollamaEndpoint");
    }

    // ── conexão ───────────────────────────────────────────────────────────
    // "Tem chave" e "a chave funciona" são coisas diferentes; o trilho mostra a
    // primeira, esta linha mostra a segunda. O teste é o listModels do próprio
    // provider (o motor já tem) — se ele responde, a credencial vale.
    const st = this.connOf(p.id);
    const conn = new Setting(el)
      .setName("Connection")
      .setDesc(CONN_TEXT[st.state](st.detail))
      .addButton((b) => {
        b.setButtonText(st.state === "testing" ? "Testing…" : "Test")
          .setDisabled(st.state === "testing" || !providerConfigured(this.plugin, p.id))
          .onClick(() => void this.testConnection(p.id));
      });
    conn.nameEl.addClass("axxa-conn-name");
    const dot = conn.nameEl.createSpan({ cls: `axxa-conn-dot is-${st.state}` });
    conn.nameEl.prepend(dot);
    conn.descEl.addClass(`axxa-conn-desc`, `is-${st.state}`);

    const modelField = f.model;
    new Setting(el)
      .setName("Model for new chats")
      .setDesc("Used when this provider is selected and nothing else was picked.")
      .addText((t) =>
        t.setValue(s[modelField]).onChange(async (v) => {
          const m = v.trim();
          if (!m) return;
          s[modelField] = m;
          this.addToList("activeModels", p.id, m);
          await this.save();
        })
      );

    // ── catálogo ──────────────────────────────────────────────────────────
    new Setting(el)
      .setName("Models")
      .setDesc(
        "Fetch what this provider offers today, then choose what shows up where."
      )
      .addButton((b) => {
        this.fetchBtn = b;
        b.setButtonText(this.fetching ? "Fetching…" : "Fetch models")
          .setCta()
          .setDisabled(this.fetching)
          .onClick(() => void this.fetchModels(p.id));
      });

    this.modelsEl = el.createDiv({ cls: "axxa-models" });
    this.renderModels();
  }

  /** A lista de modelos — o único pedaço que os toggles e o filtro remontam. */
  private renderModels(): void {
    const list = this.modelsEl;
    const p = PROVIDERS.find((x) => x.id === this.provider);
    if (!list || !p) return;
    list.empty();

    // A lista é o catálogo buscado UNIDO ao que já está marcado — sem fetch,
    // o usuário ainda vê e desmarca o que configurou antes.
    const shown = this.s.activeModels[p.id] ?? [];
    const favs = this.s.favoriteModels?.[p.id] ?? [];
    const models = Array.from(
      new Set([...(this.catalog[p.id] ?? []), ...shown, ...favs])
    ).sort();

    if (models.length === 0) {
      list.createEl("p", {
        cls: "axxa-models-empty",
        text: this.fetching
          ? "Fetching…"
          : "No models yet — fetch the catalog, or type one in the field above.",
      });
      return;
    }

    const head = list.createDiv({ cls: "axxa-models-head" });
    head.createSpan({ text: `${models.length} models` });
    head.createSpan({
      cls: "axxa-models-legend",
      text: `Show · Favorite (${favs.length}/${FAVORITE_LIMIT})`,
    });

    // PAPEL no filtro, FAMÍLIA nas seções — as duas coisas o motor já sabe
    // (ver src/ui/modelCatalog.ts). Um catálogo de provider vem com dezenas de
    // ids embaralhados; sem isso a lista é indigerível.
    const groups = buildModelCatalog(p.id, models);
    if (this.kind !== "all" && !groups.some((g) => g.id === this.kind)) {
      this.kind = "all";
    }

    if (groups.length > 1) {
      const filter = list.createDiv({ cls: "axxa-seg axxa-models-filter" });
      const items = [
        { id: "all", label: "All", icon: "layers" },
        ...groups.map((g) => ({ id: g.id, label: g.label, icon: g.icon })),
      ];
      for (const it of items) {
        const active = it.id === this.kind;
        const btn = filter.createEl("button", {
          cls: "axxa-seg-item" + (active ? " is-active" : ""),
        });
        btn.setAttribute("type", "button");
        btn.setAttribute("aria-pressed", String(active));
        btn.setAttribute("aria-label", it.label);
        btn.setAttribute("title", it.label);
        const mark = btn.createSpan({ cls: "axxa-seg-ico" });
        setIcon(mark, it.icon);
        // Só o ATIVO mostra o rótulo: sete papéis com nome não cabem numa
        // linha, e a regra do segmented aqui é nunca quebrar em duas.
        if (active) btn.createSpan({ cls: "axxa-seg-label", text: it.label });
        btn.onclick = () => {
          this.kind = it.id;
          this.renderModels();
        };
      }
      this.placeThumb(filter);
    }

    const visible =
      this.kind === "all" ? groups : groups.filter((g) => g.id === this.kind);
    // Acordeão: uma classe aberta por vez. Guardo os pares pra abrir/fechar só
    // trocando classe — remontar a lista seria o piscar que já tiramos daqui.
    const panes: { key: string; sec: HTMLElement; wrap: HTMLElement }[] = [];
    const applyOpen = () => {
      for (const pane of panes) {
        const closed = pane.key !== this.openFam;
        pane.sec.toggleClass("is-closed", closed);
        pane.wrap.toggleClass("is-closed", closed);
        pane.sec.setAttribute("aria-expanded", String(!closed));
      }
    };

    for (const g of visible) {
      for (const fam of g.families) {
        // Família sem linhagem conhecida ("Other") vira o próprio papel: uma
        // seção "OTHER · Text embedding" não informa nada.
        const orfa = fam.id === "other";
        const key = `${p.id}:${g.id}:${fam.id}`;
        const closed = key !== this.openFam;

        const sec = list.createEl("button", {
          cls: closed ? "axxa-model-section is-closed" : "axxa-model-section",
        });
        sec.setAttribute("type", "button");
        sec.setAttribute("aria-expanded", String(!closed));
        const mark = sec.createSpan({ cls: "axxa-model-section-ico" });
        setIcon(mark, orfa ? g.icon : fam.icon);
        sec.createSpan({
          cls: "axxa-model-section-name",
          text: orfa ? g.label : fam.label,
        });
        // Em "All" a família sozinha é ambígua (GPT-5 em chat e em reasoning),
        // então o papel vem junto.
        if (this.kind === "all" && !orfa) {
          sec.createSpan({ cls: "axxa-model-section-role", text: g.label });
        }
        sec.createSpan({
          cls: "axxa-model-section-count",
          text: String(fam.models.length),
        });
        const chev = sec.createSpan({ cls: "axxa-model-section-chev" });
        setIcon(chev, "chevron-down");

        const wrap = list.createDiv({
          cls: closed ? "axxa-model-fam is-closed" : "axxa-model-fam",
        });
        for (const m of fam.models) this.modelRow(wrap, p.id, m);

        panes.push({ key, sec, wrap });
        sec.onclick = () => {
          this.openFam = this.openFam === key ? null : key;
          applyOpen();
        };
      }
    }
  }

  /** Uma linha da lista de modelos: nome, tag free, id e os dois toggles. */
  private modelRow(host: HTMLElement, providerId: string, m: string): void {
    const shown = this.s.activeModels[providerId] ?? [];
    const favs = this.s.favoriteModels?.[providerId] ?? [];

    const row = host.createDiv({ cls: "axxa-model-row" });
    const info = row.createDiv({ cls: "axxa-model-info" });
    const title = info.createDiv({ cls: "axxa-model-name" });
    title.createSpan({ text: prettyModelName(m) });
    // Tag FREE: vem das capabilities do motor — tabela curada, overlay do
    // catálogo, sufixo `:free` do OpenRouter e a cota diária da OpenAI. Nada
    // de lista escrita à mão aqui.
    if (getModelCapabilities(providerId, m).free) {
      const tag = title.createSpan({ cls: "axxa-tag is-free", text: "free" });
      const daily = getFreeDailyTokens(providerId, m);
      if (daily) {
        // A cota da OpenAI tem condição: só vale compartilhando tráfego.
        tag.setAttribute(
          "title",
          `${(daily / 1000).toLocaleString()}k tokens/day free while you share traffic with OpenAI`
        );
      }
    }
    info.createDiv({ cls: "axxa-model-id", text: m });

    const actions = row.createDiv({ cls: "axxa-model-actions" });

    const isShown = shown.includes(m);
    const showBtn = actions.createEl("button", {
      cls: isShown ? "axxa-model-toggle is-on" : "axxa-model-toggle",
      text: "Show",
    });
    showBtn.setAttribute("type", "button");
    showBtn.setAttribute("aria-pressed", String(isShown));
    showBtn.setAttribute("title", "Appears in this provider's model list");
    showBtn.onclick = async () => {
      this.toggleInList("activeModels", providerId, m);
      await this.save();
      this.renderModels();
    };

    const isFav = favs.includes(m);
    const favBtn = actions.createEl("button", {
      cls: isFav ? "axxa-model-toggle is-fav" : "axxa-model-toggle",
    });
    favBtn.setAttribute("type", "button");
    favBtn.setAttribute("aria-pressed", String(isFav));
    favBtn.setAttribute(
      "title",
      `Appears on the new-chat screen (max ${FAVORITE_LIMIT})`
    );
    setIcon(favBtn, isFav ? "star" : "star-off");
    favBtn.onclick = async () => {
      const list = this.s.favoriteModels?.[providerId] ?? [];
      if (!list.includes(m) && list.length >= FAVORITE_LIMIT) {
        new Notice(
          `${FAVORITE_LIMIT} favorites per provider is the limit — unstar one first.`
        );
        return;
      }
      this.toggleInList("favoriteModels", providerId, m);
      // Favoritar implica aparecer na lista: senão o atalho existiria sem o
      // modelo estar disponível pra escolher.
      if (this.s.favoriteModels[providerId]?.includes(m)) {
        this.addToList("activeModels", providerId, m);
      }
      await this.save();
      this.renderModels();
    };
  }

  /** Busca o catálogo do provider (o motor já tem: plugin.scanModels). */
  private async fetchModels(providerId: string): Promise<void> {
    if (this.fetching) return;
    this.fetching = true;
    this.syncFetchBtn();
    this.renderModels();
    try {
      const models = await this.plugin.scanModels(providerId);
      this.catalog[providerId] = models;
      new Notice(
        models.length > 0
          ? `${models.length} models found.`
          : "No models returned — check the key or the endpoint."
      );
    } catch (err) {
      console.error("[axxa] scanModels falhou:", err);
      new Notice(
        `Fetch failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      this.fetching = false;
      this.syncFetchBtn();
      this.renderModels();
    }
  }

  /** O botão de fetch é a única coisa fora da lista que muda no fetch. */
  private syncFetchBtn(): void {
    this.fetchBtn
      ?.setButtonText(this.fetching ? "Fetching…" : "Fetch models")
      .setDisabled(this.fetching);
  }

  private addToList(
    field: "activeModels" | "favoriteModels",
    providerId: string,
    model: string
  ): void {
    const map = (this.s[field] ??= {});
    const list = map[providerId] ?? [];
    if (!list.includes(model)) map[providerId] = [model, ...list];
  }

  private toggleInList(
    field: "activeModels" | "favoriteModels",
    providerId: string,
    model: string
  ): void {
    const map = (this.s[field] ??= {});
    const list = map[providerId] ?? [];
    map[providerId] = list.includes(model)
      ? list.filter((x) => x !== model)
      : [model, ...list];
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  private renderChat(el: HTMLElement): void {
    const s = this.s;
    new Setting(el)
      .setName("Provider")
      .setDesc("Which provider a new chat opens with.")
      .addDropdown((d) => {
        for (const p of PROVIDERS) d.addOption(p.id, p.name);
        d.setValue(s.defaultProvider).onChange(async (v) => {
          s.defaultProvider = v;
          await this.save();
        });
      });
    new Setting(el)
      .setName("Mode")
      .setDesc("Chat, Vault Q&A or Agent. Locks on the first message.")
      .addDropdown((d) => {
        for (const m of CHAT_MODES) d.addOption(m, m);
        d.setValue(s.defaultMode).onChange(async (v) => {
          s.defaultMode = v;
          await this.save();
        });
      });
    new Setting(el)
      .setName("Effort")
      .setDesc("How hard the model works: length, agent turns, temperature.")
      .addDropdown((d) => {
        for (const l of EFFORT_LEVELS) d.addOption(l, EFFORT_LABELS[l]);
        d.setValue(s.defaultEffort).onChange(async (v) => {
          s.defaultEffort = v;
          await this.save();
        });
      });

    this.renderVoice(el);
  }

  // ── Voz ────────────────────────────────────────────────────────────────────
  // Duas coisas diferentes moram aqui, e a escrita tenta deixar isso claro:
  // FALAR COM o chat (ditado) e OUVIR o chat (leitura). Cada uma na ordem em
  // que a pessoa decide: ligo? por quem? com que voz?

  private renderVoice(el: HTMLElement): void {
    const s = this.s;

    const brand = new Setting(el).setName("Voice").setHeading();
    const mark = brand.nameEl.createSpan({ cls: "axxa-settings-brand" });
    setIcon(mark, "mic");
    brand.nameEl.prepend(mark);
    brand.setDesc("Talk to the chat, and let it talk back.");

    // ── ditado ─────────────────────────────────────────────────
    new Setting(el)
      .setName("Talk instead of typing")
      .setDesc(
        "Puts a microphone in the composer: you speak, the words land in the box, and you send when you are happy with them."
      )
      .addToggle((t) =>
        t.setValue(s.voiceEnabled).onChange(async (v) => {
          s.voiceEnabled = v;
          await this.save();
          this.renderBody();
        })
      );

    if (s.voiceEnabled) {
      if (!this.plugin.providerCredential("openai")) {
        this.hint(el, "Dictation runs on OpenAI — add that key in Providers.");
      }
      new Setting(el)
        .setName("Ears")
        .setDesc(
          "Mini is quick, cheap and gets normal speech right; the full one is better with names, accents and noise."
        )
        .addDropdown((d) => {
          for (const m of STT_MODELS) d.addOption(m, prettyModelName(m));
          d.setValue(s.voiceModel).onChange(async (v) => {
            s.voiceModel = v;
            await this.save();
          });
        });

      new Setting(el)
        .setName("What you speak")
        .setDesc(
          "Naming your language beats letting it guess — short takes are where guessing goes wrong."
        )
        .addDropdown((d) => {
          for (const [code, label] of SPEECH_LANGS) d.addOption(code, label);
          d.setValue(s.voiceLanguage).onChange(async (v) => {
            s.voiceLanguage = v;
            await this.save();
          });
        });
    }

    // ── leitura ────────────────────────────────────────────────
    new Setting(el)
      .setName("Read answers out loud")
      .setDesc("Adds a Listen button under every answer.")
      .addToggle((t) =>
        t.setValue(s.ttsEnabled).onChange(async (v) => {
          s.ttsEnabled = v;
          await this.save();
          this.renderBody();
        })
      );

    if (!s.ttsEnabled) return;

    new Setting(el)
      .setName("Who reads")
      .setDesc(
        "OpenAI voices are ready to use. ElevenLabs sounds better and is the only one that can read in YOUR voice — clone it in their app and it shows up in the list below."
      )
      .addDropdown((d) => {
        for (const p of TTS_PROVIDERS) {
          const ok = ttsReady(this.plugin, p.id);
          d.addOption(p.id, ok ? p.label : p.label + " (needs " + p.needs + ")");
        }
        d.setValue(s.ttsProvider).onChange(async (v) => {
          s.ttsProvider = v;
          await this.save();
          this.renderBody();
        });
      });

    if (s.ttsProvider === "eleven") this.renderEleven(el);
    else this.renderOpenAiTts(el);
  }

  /** Uma linha de recado — o que falta pra aquilo ali funcionar. */
  private hint(el: HTMLElement, text: string): void {
    el.createEl("p", { cls: "axxa-settings-hint", text });
  }

  private renderOpenAiTts(el: HTMLElement): void {
    const s = this.s;
    if (!this.plugin.providerCredential("openai")) {
      this.hint(el, "Add your OpenAI key in Providers to hear anything.");
    }
    new Setting(el)
      .setName("Voice")
      .setDesc("Eleven of them. Hit Play sample to hear the one you picked.")
      .addDropdown((d) => {
        for (const v of OPENAI_VOICES) d.addOption(v, v);
        d.setValue(s.ttsVoice).onChange(async (v) => {
          s.ttsVoice = v;
          await this.save();
        });
      });

    new Setting(el)
      .setName("Quality")
      .setDesc(
        "gpt-4o-mini-tts reads with intention; tts-1 is the cheap classic; the HD one is the same voice, cleaner."
      )
      .addDropdown((d) => {
        for (const m of OPENAI_TTS_MODELS) d.addOption(m, m);
        d.setValue(s.ttsModel).onChange(async (v) => {
          s.ttsModel = v;
          await this.save();
        });
      });

    this.testRow(el);
  }

  private renderEleven(el: HTMLElement): void {
    const s = this.s;
    const row = new Setting(el)
      .setName("ElevenLabs key")
      .setDesc("From elevenlabs.io › Profile › API key. Stays on this device.")
      .addText((t) => {
        t.inputEl.type = "password";
        t.setPlaceholder("key…")
          .setValue(s.elevenApiKey)
          .onChange(async (v) => {
            s.elevenApiKey = v.trim();
            await this.save();
          });
      });
    if (!s.elevenApiKey) this.addPasteButton(row, "elevenApiKey");

    new Setting(el)
      .setName("Your voices")
      .setDesc(
        "Fetch what your account has — the stock voices and any you cloned, including your own."
      )
      .addButton((b) =>
        b
          .setButtonText(this.fetchingVoices ? "Fetching…" : "Fetch voices")
          .setCta()
          // Sem trava por key vazia: digitar a chave não re-renderiza esta
          // linha (re-renderizar a cada tecla roubaria o foco do campo), então
          // o botão ficaria desabilitado depois de a key existir. Sem key, a
          // própria chamada avisa.
          .setDisabled(this.fetchingVoices)
          .onClick(() => void this.fetchVoices())
      );

    if (s.elevenVoices.length > 0) {
      new Setting(el)
        .setName("Voice")
        .setDesc("Cloned ones are marked — that is the one that sounds like you.")
        .addDropdown((d) => {
          for (const v of s.elevenVoices) {
            const own =
              v.category === "cloned" || v.category === "professional";
            d.addOption(v.id, own ? v.name + " · yours" : v.name);
          }
          d.setValue(s.elevenVoice || s.elevenVoices[0].id).onChange(
            async (v) => {
              s.elevenVoice = v;
              await this.save();
            }
          );
        });
    } else if (s.elevenApiKey) {
      this.hint(el, "No voices loaded yet — hit Fetch voices.");
    }

    new Setting(el)
      .setName("Quality")
      .setDesc("Multilingual sounds best; the faster ones answer sooner.")
      .addDropdown((d) => {
        for (const m of ELEVEN_MODELS) d.addOption(m.id, m.label);
        d.setValue(s.elevenModel).onChange(async (v) => {
          s.elevenModel = v;
          await this.save();
        });
      });

    this.testRow(el);
  }

  /** O botão que prova que a voz escolhida funciona. */
  private testRow(el: HTMLElement): void {
    new Setting(el)
      .setName("Test")
      .setDesc("Plays one short line with the settings above.")
      .addButton((b) =>
        b.setButtonText("Play sample").onClick(async () => {
          b.setButtonText("Playing…").setDisabled(true);
          // `speak` precisa começar DENTRO do clique: é lá que ele destrava o
          // áudio (o navegador recusa tocar fora do gesto).
          await speak(this.plugin, SAMPLE_LINE);
          b.setButtonText("Play sample").setDisabled(false);
        })
      );
  }

  private async fetchVoices(): Promise<void> {
    if (this.fetchingVoices) return;
    this.fetchingVoices = true;
    this.renderBody();
    try {
      const voices = await elevenVoices(this.s.elevenApiKey);
      this.s.elevenVoices = voices.map((v) => ({
        id: v.id,
        name: v.name,
        category: v.category,
      }));
      if (!this.s.elevenVoice && voices[0]) this.s.elevenVoice = voices[0].id;
      await this.save();
      const minhas = voices.filter(
        (v) => v.category === "cloned" || v.category === "professional"
      ).length;
      new Notice(
        voices.length + " voices" + (minhas > 0 ? " · " + minhas + " yours" : "") + "."
      );
    } catch (err) {
      new Notice(
        "Could not load voices: " +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      this.fetchingVoices = false;
      this.renderBody();
    }
  }

  // ── Vault ─────────────────────────────────────────────────────────────────

  private renderVault(el: HTMLElement): void {
    const s = this.s;
    new Setting(el)
      .setName("Chats folder")
      .setDesc("Each chat is a .md file under <folder>/<mode>/.")
      .addText((t) =>
        t.setValue(s.chatsPath).onChange(async (v) => {
          s.chatsPath = v.trim() || "axxa-ai/chats";
          await this.save();
          void this.plugin.loadChatSummaries(true);
        })
      );
    new Setting(el)
      .setName("Skills folder")
      .setDesc("Each skill is a .md note (frontmatter + prompt body).")
      .addText((t) =>
        t.setValue(s.skillsPath).onChange(async (v) => {
          s.skillsPath = v.trim() || "axxa-ai/skills";
          await this.save();
          await this.plugin.reloadSkills();
        })
      );
  }

  // ── Vault Q&A ─────────────────────────────────────────────────────────────

  private renderRag(el: HTMLElement): void {
    const s = this.s;
    new Setting(el)
      .setName("Embedding model")
      .setDesc(
        "Needs the key of that model's provider. Without an index, Vault Q&A falls back to keyword search."
      )
      .addDropdown((d) => {
        for (const spec of getAllEmbeddingModels()) {
          d.addOption(spec.model, `${spec.provider} · ${spec.model}`);
        }
        d.setValue(s.ragEmbeddingModel).onChange(async (v) => {
          const spec = getAllEmbeddingModels().find((m) => m.model === v);
          s.ragEmbeddingModel = v;
          if (spec) s.ragEmbeddingProvider = spec.provider;
          await this.save();
        });
      });
    new Setting(el)
      .setName("Auto re-index on note changes")
      .setDesc(
        "Re-embeds only changed notes (costs tokens). Only runs once an index exists."
      )
      .addToggle((t) =>
        t.setValue(s.ragAutoReindex).onChange(async (v) => {
          s.ragAutoReindex = v;
          await this.save();
        })
      );

    const size = this.plugin.vectorIndex?.size ?? 0;
    new Setting(el)
      .setName("Index")
      .setDesc(
        size > 0
          ? `Index loaded: ${size} chunks (folder: ${s.ragIndexPath}).`
          : `No index yet (folder: ${s.ragIndexPath}).`
      )
      .addButton((b) =>
        b
          .setButtonText(this.indexing ? "Cancel indexing" : "Index vault")
          .setCta()
          .onClick(() => void this.runIndex())
      )
      .addButton((b) =>
        b
          .setButtonText("Delete index")
          .setWarning()
          .setDisabled(size === 0 && !this.plugin.vectorIndex)
          .onClick(async () => {
            await deleteIndex(this.app.vault.adapter, s.ragIndexPath);
            this.plugin.vectorIndex = null;
            new Notice("Index deleted.");
            this.renderBody();
          })
      );
  }

  // ── Agent ─────────────────────────────────────────────────────────────────

  private renderAgent(el: HTMLElement): void {
    const s = this.s;
    new Setting(el)
      .setName("Permission level")
      .setDesc(
        "ask = confirm every write · vault = only deletes ask · yolo = only irreversible actions ask."
      )
      .addDropdown((d) => {
        for (const [id, label] of Object.entries(PERMISSION_LABELS)) {
          d.addOption(id, label);
        }
        d.setValue(s.agentPermissionLevel).onChange(async (v) => {
          s.agentPermissionLevel = v as PermissionLevel;
          await this.save();
        });
      });
    new Setting(el)
      .setName("Show diff before applying edits")
      .setDesc("Preview every change the agent wants to write.")
      .addToggle((t) =>
        t.setValue(s.agentDiffApproval).onChange(async (v) => {
          s.agentDiffApproval = v;
          await this.save();
        })
      );
  }

  // ── Mobile ────────────────────────────────────────────────────────────────

  private renderMobile(el: HTMLElement): void {
    const s = this.s;
    new Setting(el)
      .setName("Fullscreen")
      .setDesc(
        "Hides the drawer chrome and the global navbar while AXXA is the active tab. The menu button stays, so you are never stuck."
      )
      .addToggle((t) =>
        t.setValue(s.mobileFullscreen === true).onChange(async (v) => {
          s.mobileFullscreen = v;
          await this.save();
        })
      );

    new Setting(el)
      .setName("Haptics")
      .setDesc(
        "A short buzz on every tap. Android only — iPhone doesn't let a plugin touch the Taptic Engine."
      )
      .addToggle((t) =>
        t.setValue(s.hapticsEnabled !== false).onChange(async (v) => {
          s.hapticsEnabled = v;
          setHapticsEnabled(v);
          await this.save();
          // Sente na hora o que acabou de ligar.
          if (v) tap();
        })
      );
  }

  // ── ações ─────────────────────────────────────────────────────────────────

  private async runIndex(): Promise<void> {
    if (this.indexing) {
      this.indexing.abort();
      return;
    }
    const s = this.s;
    this.indexing = new AbortController();
    const notice = new Notice("Indexing vault…", 0);
    this.renderBody();
    try {
      this.plugin.vectorIndex = await indexVault(this.plugin.vectorIndex, {
        app: this.app,
        openaiApiKey: s.openaiApiKey,
        openrouterApiKey: s.openrouterApiKey,
        geminiApiKey: s.geminiApiKey,
        nimApiKey: s.nimApiKey,
        model: s.ragEmbeddingModel,
        profile: s.ragQuantProfile,
        indexPath: s.ragIndexPath,
        excludePaths: [s.ragIndexPath, s.chatsPath],
        shardSize: s.ragStreamShards ? RAG_SHARD_SIZE : 0,
        signal: this.indexing.signal,
        onProgress: (p) => {
          notice.setMessage(
            `Indexing (${p.phase}): ${p.filesEmbedded}/${p.filesToEmbed} files · ${p.chunksEmbedded} chunks`
          );
        },
      });
      notice.hide();
      new Notice(`Index ready: ${this.plugin.vectorIndex.size} chunks.`);
    } catch (err) {
      notice.hide();
      if (err instanceof DOMException && err.name === "AbortError") {
        new Notice("Indexing cancelled.");
      } else {
        console.error("[axxa] indexVault falhou:", err);
        new Notice(
          `Indexing failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    } finally {
      this.indexing = null;
      this.renderBody();
    }
  }
}
