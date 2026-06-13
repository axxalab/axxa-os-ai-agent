// src/views/useProjectActions.ts
// Ações de CRUD de projetos extraídas do AxxaApp (Frente 2 — base 1.0). Fábrica
// de handlers: NÃO guarda estado (a fonte da verdade é plugin.settings.projects);
// o estado de UI (editor/seleção) vive no componente e é injetado. Retorna
// persistProjects também porque handleSend e a edição de mensagem o reusam.
// Comportamento idêntico ao inline anterior.

import { Notice } from "obsidian";
import type AxxaPlugin from "../main";
import { makeProjectId, type Project } from "../projects";
import { openVaultNotePicker } from "../components/composer/PlusModal";
import { getTranslations } from "../i18n";

interface ProjectActionsUI {
  projectEditor: null | { project?: Project };
  setProjects: (next: Project[]) => void;
  setProjectEditor: (v: null | { project?: Project }) => void;
  setSelectedProjectId: (v: string | null) => void;
}

export function useProjectActions(
  plugin: AxxaPlugin,
  t: ReturnType<typeof getTranslations>,
  ui: ProjectActionsUI
) {
  const { projectEditor, setProjects, setProjectEditor, setSelectedProjectId } = ui;

  const persistProjects = async (update: (prev: Project[]) => Project[]) => {
    const next = update(plugin.settings.projects ?? []);
    plugin.settings.projects = next;
    setProjects(next);
    await plugin.saveSettings();
  };

  const handleSaveProject = async (data: {
    name: string;
    icon: string;
    color: string;
  }) => {
    const editing = projectEditor?.project;
    if (editing) {
      await persistProjects((prev) =>
        prev.map((p) => (p.id === editing.id ? { ...p, ...data } : p))
      );
    } else {
      const proj: Project = {
        id: makeProjectId(),
        name: data.name,
        icon: data.icon,
        color: data.color,
        sources: [],
        chatIds: [],
        createdAt: new Date().toISOString(),
      };
      await persistProjects((prev) => [proj, ...prev]);
      setSelectedProjectId(proj.id);
      new Notice(t.projects.created(proj.name));
    }
    setProjectEditor(null);
  };

  const handleDeleteProject = async () => {
    const editing = projectEditor?.project;
    if (!editing) return;
    await persistProjects((prev) => prev.filter((p) => p.id !== editing.id));
    setProjectEditor(null);
    setSelectedProjectId(null);
    new Notice(t.projects.deleted);
  };

  const handleAddProjectSource = async (projectId: string) => {
    const path = await openVaultNotePicker(plugin.app, t);
    if (!path) return;
    await persistProjects((prev) =>
      prev.map((p) =>
        p.id === projectId && !p.sources.includes(path)
          ? { ...p, sources: [...p.sources, path] }
          : p
      )
    );
    new Notice(t.projects.sourceAdded);
  };

  const handleRemoveProjectSource = async (projectId: string, path: string) => {
    await persistProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, sources: p.sources.filter((s) => s !== path) }
          : p
      )
    );
  };

  return {
    persistProjects,
    handleSaveProject,
    handleDeleteProject,
    handleAddProjectSource,
    handleRemoveProjectSource,
  };
}
