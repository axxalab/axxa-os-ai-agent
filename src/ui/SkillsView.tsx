// src/ui/SkillsView.tsx
// CRUD cru de skills (.md na pasta settings.skillsPath): listar / usar (injeta
// o corpo no composer) / abrir a nota / criar / apagar / criar exemplos.

import { useEffect, useReducer } from "react";
import { Notice, TFile, normalizePath } from "obsidian";
import type AxxaPlugin from "../main";
import type { Skill } from "../skills/skills";
import { ensureFolder } from "../core/chatPersistence";
import { PromptModal, ConfirmModal } from "./modals";

export function SkillsView({
  plugin,
  onUse,
}: {
  plugin: AxxaPlugin;
  onUse: (skill: Skill) => void;
}) {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    void plugin.reloadSkills().then(() => force());
    return plugin.onSettingsChange(force);
  }, [plugin]);

  const skills = plugin.skills;
  const folder = plugin.settings.skillsPath || "axxa-ai/skills";

  const openNote = (path: string) => {
    const f = plugin.app.vault.getAbstractFileByPath(path);
    if (f instanceof TFile) void plugin.app.workspace.getLeaf(true).openFile(f);
    else new Notice(`Not found: ${path}`);
  };

  const create = async () => {
    const name = await new PromptModal(plugin.app, {
      title: "New skill",
      label: "Name (becomes the note name)",
      submitLabel: "Create",
    }).openAndWait();
    if (!name) return;
    const safe = name.replace(/[\\/:*?"<>|]+/g, "-").trim();
    const path = normalizePath(`${folder}/${safe}.md`);
    if (plugin.app.vault.getAbstractFileByPath(path)) {
      new Notice("A skill with that name already exists.");
      return;
    }
    const content =
      `---\nname: ${name}\ndescription: \nmode: chat\n---\n\n` +
      "Write the prompt/template here. It is injected into the composer when you use the skill.\n";
    try {
      await ensureFolder(plugin.app.vault.adapter, folder);
      const f = await plugin.app.vault.create(path, content);
      await plugin.reloadSkills();
      force();
      void plugin.app.workspace.getLeaf(true).openFile(f);
    } catch (err) {
      new Notice(
        `Could not create skill: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const remove = async (s: Skill) => {
    const ok = await new ConfirmModal(plugin.app, {
      title: `Delete skill "${s.name}"?`,
      body: "The note goes to the system trash (recoverable).",
      confirmLabel: "Delete",
      danger: true,
    }).openAndWait();
    if (!ok) return;
    const f = plugin.app.vault.getAbstractFileByPath(s.path);
    if (f) await plugin.app.vault.trash(f, true);
    await plugin.reloadSkills();
    force();
  };

  const seed = async () => {
    const n = await plugin.seedExampleSkills();
    new Notice(`${n} example skill(s) created.`);
    force();
  };

  return (
    <div className="axxa-skills">
      <div className="axxa-row">
        <button type="button" onClick={() => void create()}>
          New skill
        </button>
        <button type="button" onClick={() => void seed()}>
          Create example skills
        </button>
        <button
          type="button"
          onClick={() => void plugin.reloadSkills().then(() => force())}
        >
          Reload
        </button>
        <small>folder: {folder}</small>
      </div>
      <ul>
        {skills.map((s) => (
          <li key={s.id}>
            <strong>{s.name}</strong>
            {s.mode && <small> [{s.mode}]</small>}
            {s.description && <div>{s.description}</div>}
            <small>{s.path}</small>
            <div>
              <button type="button" onClick={() => onUse(s)}>
                Use
              </button>{" "}
              <button type="button" onClick={() => openNote(s.path)}>
                Open note
              </button>{" "}
              <button type="button" onClick={() => void remove(s)}>
                Delete
              </button>
            </div>
          </li>
        ))}
        {skills.length === 0 && (
          <li>
            <em>No skills yet — create one or the examples.</em>
          </li>
        )}
      </ul>
    </div>
  );
}
