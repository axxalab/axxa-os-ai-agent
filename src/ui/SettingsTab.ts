// src/ui/SettingsTab.ts
// Settings mínimas (Setting API nativa): chave + modelo dos 6 providers,
// defaults de sessão, pastas do vault, RAG (modelo de embedding + indexar) e
// permissões do agente. Nada além do que os modos precisam pra funcionar.

import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type AxxaPlugin from "../main";
import { PROVIDERS } from "../core/providersMeta";
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

export class AxxaSettingsTab extends PluginSettingTab {
  private indexing: AbortController | null = null;

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
    const s = this.plugin.settings;
    const save = () => this.plugin.saveSettings();

    // ── Providers ─────────────────────────────────────────────────────────
    new Setting(containerEl).setName("Providers").setHeading();
    for (const p of PROVIDERS) {
      const f = PROVIDER_FIELDS[p.id];
      if (!f) continue;
      if (f.key) {
        const key = f.key;
        new Setting(containerEl)
          .setName(`${p.name} API key`)
          .setDesc("Stored in the OS keychain (not in data.json).")
          .addText((t) => {
            t.inputEl.type = "password";
            t.setPlaceholder("key…")
              .setValue(s[key])
              .onChange(async (v) => {
                s[key] = v.trim();
                await save();
              });
          });
      } else {
        new Setting(containerEl)
          .setName("Ollama endpoint")
          .addText((t) =>
            t
              .setPlaceholder("http://localhost:11434")
              .setValue(s.ollamaEndpoint)
              .onChange(async (v) => {
                s.ollamaEndpoint = v.trim();
                await save();
              })
          );
      }
      const modelField = f.model;
      new Setting(containerEl)
        .setName(`${p.name} model`)
        .setDesc(
          `Model id used for new chats. Known: ${(s.activeModels[p.id] ?? []).join(", ") || "—"}`
        )
        .addText((t) =>
          t.setValue(s[modelField]).onChange(async (v) => {
            const m = v.trim();
            if (!m) return;
            s[modelField] = m;
            const list = s.activeModels[p.id] ?? [];
            if (!list.includes(m)) s.activeModels[p.id] = [m, ...list];
            await save();
          })
        );
    }

    // ── Defaults ──────────────────────────────────────────────────────────
    new Setting(containerEl).setName("Defaults for new chats").setHeading();
    new Setting(containerEl).setName("Provider").addDropdown((d) => {
      for (const p of PROVIDERS) d.addOption(p.id, p.name);
      d.setValue(s.defaultProvider).onChange(async (v) => {
        s.defaultProvider = v;
        await save();
      });
    });
    new Setting(containerEl).setName("Mode").addDropdown((d) => {
      for (const m of CHAT_MODES) d.addOption(m, m);
      d.setValue(s.defaultMode).onChange(async (v) => {
        s.defaultMode = v;
        await save();
      });
    });
    new Setting(containerEl).setName("Effort").addDropdown((d) => {
      for (const l of EFFORT_LEVELS) d.addOption(l, EFFORT_LABELS[l]);
      d.setValue(s.defaultEffort).onChange(async (v) => {
        s.defaultEffort = v;
        await save();
      });
    });

    // ── Vault ─────────────────────────────────────────────────────────────
    new Setting(containerEl).setName("Vault folders").setHeading();
    new Setting(containerEl)
      .setName("Chats folder")
      .setDesc("Each chat is a .md file under <folder>/<mode>/.")
      .addText((t) =>
        t.setValue(s.chatsPath).onChange(async (v) => {
          s.chatsPath = v.trim() || "axxa-ai/chats";
          await save();
          void this.plugin.loadChatSummaries(true);
        })
      );
    new Setting(containerEl)
      .setName("Skills folder")
      .setDesc("Each skill is a .md note (frontmatter + prompt body).")
      .addText((t) =>
        t.setValue(s.skillsPath).onChange(async (v) => {
          s.skillsPath = v.trim() || "axxa-ai/skills";
          await save();
          await this.plugin.reloadSkills();
        })
      );

    // ── Vault Q&A (RAG) ───────────────────────────────────────────────────
    new Setting(containerEl).setName("Vault Q&A (RAG)").setHeading();
    new Setting(containerEl)
      .setName("Embedding model")
      .setDesc("Needs the key of the model's provider. Without an index, Vault Q&A falls back to keyword search.")
      .addDropdown((d) => {
        for (const spec of getAllEmbeddingModels()) {
          d.addOption(spec.model, `${spec.provider} · ${spec.model}`);
        }
        d.setValue(s.ragEmbeddingModel).onChange(async (v) => {
          const spec = getAllEmbeddingModels().find((m) => m.model === v);
          s.ragEmbeddingModel = v;
          if (spec) s.ragEmbeddingProvider = spec.provider;
          await save();
        });
      });
    new Setting(containerEl)
      .setName("Auto re-index on note changes")
      .setDesc("Re-embeds only changed notes (costs tokens). Only runs once an index exists.")
      .addToggle((t) =>
        t.setValue(s.ragAutoReindex).onChange(async (v) => {
          s.ragAutoReindex = v;
          await save();
        })
      );
    const size = this.plugin.vectorIndex?.size ?? 0;
    new Setting(containerEl)
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

    // ── Agent ─────────────────────────────────────────────────────────────
    new Setting(containerEl).setName("Agent").setHeading();
    new Setting(containerEl)
      .setName("Permission level")
      .setDesc("ask = confirm every write · vault = only deletes ask · yolo = only irreversible actions ask.")
      .addDropdown((d) => {
        for (const [id, label] of Object.entries(PERMISSION_LABELS)) {
          d.addOption(id, label);
        }
        d.setValue(s.agentPermissionLevel).onChange(async (v) => {
          s.agentPermissionLevel = v as PermissionLevel;
          await save();
        });
      });
    new Setting(containerEl)
      .setName("Show diff before applying edits")
      .addToggle((t) =>
        t.setValue(s.agentDiffApproval).onChange(async (v) => {
          s.agentDiffApproval = v;
          await save();
        })
      );
  }

  private async runIndex(): Promise<void> {
    if (this.indexing) {
      this.indexing.abort();
      return;
    }
    const s = this.plugin.settings;
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
