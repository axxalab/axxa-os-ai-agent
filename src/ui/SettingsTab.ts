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

import { App, Notice, Platform, PluginSettingTab, Setting } from "obsidian";
import type AxxaPlugin from "../main";
import { PROVIDERS, providerConfigured } from "../core/providersMeta";
import { EFFORT_LEVELS, EFFORT_LABELS } from "../core/effort";
import { CHAT_MODES } from "../core/session";
import { getAllEmbeddingModels } from "../rag/types";
import { indexVault } from "../rag/indexer";
import { deleteIndex, RAG_SHARD_SIZE } from "../rag/vectorIndex";
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
    label: "Vault Q&A",
    blurb: "The local index that grounds answers in your notes.",
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

    const nav = containerEl.createDiv({ cls: "axxa-settings-nav" });
    for (const t of tabs) {
      const btn = nav.createEl("button", {
        text: t.label,
        cls: t.id === this.tab ? "axxa-stab is-active" : "axxa-stab",
      });
      btn.setAttribute("type", "button");
      btn.setAttribute("aria-pressed", String(t.id === this.tab));
      btn.onclick = () => {
        this.tab = t.id;
        this.display();
      };
    }

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

  private get s() {
    return this.plugin.settings;
  }
  private save = () => this.plugin.saveSettings();

  // ── Providers (com sub-abas) ──────────────────────────────────────────────

  private renderProviders(el: HTMLElement): void {
    if (!PROVIDER_FIELDS[this.provider]) this.provider = PROVIDERS[0].id;

    // Sub-abas: o ponto ao lado do nome diz se aquele provider já está pronto,
    // então dá pra ver o estado dos seis sem abrir um por um.
    const sub = el.createDiv({ cls: "axxa-settings-subnav" });
    for (const p of PROVIDERS) {
      const ready = providerConfigured(this.plugin, p.id);
      const btn = sub.createEl("button", {
        cls:
          "axxa-ssub" +
          (p.id === this.provider ? " is-active" : "") +
          (ready ? " is-ready" : ""),
      });
      btn.setAttribute("type", "button");
      btn.setAttribute("aria-pressed", String(p.id === this.provider));
      btn.createSpan({ cls: "axxa-ssub-dot" });
      btn.createSpan({ text: p.name });
      btn.onclick = () => {
        this.provider = p.id;
        this.display();
      };
    }

    const p = PROVIDERS.find((x) => x.id === this.provider);
    const f = PROVIDER_FIELDS[this.provider];
    if (!p || !f) return;
    const s = this.s;

    if (f.key) {
      const key = f.key;
      new Setting(el)
        .setName(`${p.name} API key`)
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
        .setName("Ollama endpoint")
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
      .setDesc(
        `Model id used when this provider is selected. Known: ${
          (s.activeModels[p.id] ?? []).join(", ") || "—"
        }`
      )
      .addText((t) =>
        t.setValue(s[modelField]).onChange(async (v) => {
          const m = v.trim();
          if (!m) return;
          s[modelField] = m;
          const list = s.activeModels[p.id] ?? [];
          if (!list.includes(m)) s.activeModels[p.id] = [m, ...list];
          await this.save();
        })
      );
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
