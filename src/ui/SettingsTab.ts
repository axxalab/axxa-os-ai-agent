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
import type AxxaPlugin from "../main";
import { PROVIDERS, providerConfigured } from "../core/providersMeta";
import { EFFORT_LEVELS, EFFORT_LABELS } from "../core/effort";
import { CHAT_MODES } from "../core/session";
import { getAllEmbeddingModels } from "../rag/types";
import { indexVault } from "../rag/indexer";
import { deleteIndex, RAG_SHARD_SIZE } from "../rag/vectorIndex";
import { getModelCapabilities } from "../providers/modelCapabilities";
import { prettyModelName } from "../providers/modelDescriptions";
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

/** Favoritos aparecem na tela inicial; mais que isso vira lista, não atalho. */
const FAVORITE_LIMIT = 5;

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
  private fetching = false;

  constructor(
    app: App,
    private readonly plugin: AxxaPlugin
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("axxa-settings-root");

    const tabs = TABS.filter((t) => !t.mobileOnly || Platform.isMobile);
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
      btn.onclick = () => {
        this.tab = t.id;
        this.display();
      };
    }
    this.placeThumb(nav);

    const current = tabs.find((t) => t.id === this.tab);
    if (current) {
      containerEl.createEl("p", {
        text: current.blurb,
        cls: "axxa-settings-blurb",
      });
    }

    const body = containerEl.createDiv({ cls: "axxa-settings-body" });
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
      btn.setAttribute("aria-label", p.name);
      btn.setAttribute("title", p.name);
      btn.onclick = () => {
        this.provider = p.id;
        this.display();
      };
    }
    this.placeThumb(sub);

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
      new Setting(el)
        .setName("API key")
        .setDesc("Stored in the OS keychain (not in data.json).")
        .addText((t) => {
          t.inputEl.type = "password";
          t.setPlaceholder("key…")
            .setValue(s[key])
            .onChange(async (v) => {
              s[key] = v.trim();
              await this.save();
            });
        });
    } else {
      new Setting(el)
        .setName("Endpoint")
        .setDesc("Local server address. Ollama needs no key.")
        .addText((t) =>
          t
            .setPlaceholder("http://localhost:11434")
            .setValue(s.ollamaEndpoint)
            .onChange(async (v) => {
              s.ollamaEndpoint = v.trim();
              await this.save();
            })
        );
    }

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
      .addButton((b) =>
        b
          .setButtonText(this.fetching ? "Fetching…" : "Fetch models")
          .setCta()
          .setDisabled(this.fetching)
          .onClick(() => void this.fetchModels(p.id))
      );

    // A lista é o catálogo buscado UNIDO ao que já está marcado — sem fetch,
    // o usuário ainda vê e desmarca o que configurou antes.
    const shown = s.activeModels[p.id] ?? [];
    const favs = s.favoriteModels?.[p.id] ?? [];
    const models = Array.from(
      new Set([...(this.catalog[p.id] ?? []), ...shown, ...favs])
    ).sort();

    const list = el.createDiv({ cls: "axxa-models" });
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

    for (const m of models) {
      const row = list.createDiv({ cls: "axxa-model-row" });
      const info = row.createDiv({ cls: "axxa-model-info" });
      const title = info.createDiv({ cls: "axxa-model-name" });
      title.createSpan({ text: prettyModelName(m) });
      // Tag FREE: vem das capabilities do motor (inclui o overlay do sufixo
      // `:free` do OpenRouter), não de uma lista escrita à mão aqui.
      if (getModelCapabilities(p.id, m).free) {
        title.createSpan({ cls: "axxa-tag is-free", text: "free" });
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
        this.toggleInList("activeModels", p.id, m);
        await this.save();
        this.display();
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
        const list = this.s.favoriteModels?.[p.id] ?? [];
        if (!list.includes(m) && list.length >= FAVORITE_LIMIT) {
          new Notice(
            `${FAVORITE_LIMIT} favorites per provider is the limit — unstar one first.`
          );
          return;
        }
        this.toggleInList("favoriteModels", p.id, m);
        // Favoritar implica aparecer na lista: senão o atalho existiria sem o
        // modelo estar disponível pra escolher.
        if (this.s.favoriteModels[p.id]?.includes(m)) {
          this.addToList("activeModels", p.id, m);
        }
        await this.save();
        this.display();
      };
    }
  }

  /** Busca o catálogo do provider (o motor já tem: plugin.scanModels). */
  private async fetchModels(providerId: string): Promise<void> {
    if (this.fetching) return;
    this.fetching = true;
    this.display();
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
      this.display();
    }
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
            this.display();
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
    this.display();
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
      this.display();
    }
  }
}
