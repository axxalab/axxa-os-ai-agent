// src/ui/ProjectsView.tsx
// CRUD cru de projetos: criar / renomear / apagar; fontes (notas do vault)
// adicionar / remover / abrir; chats do projeto; "novo chat neste projeto"
// (as fontes viram contexto no 1º envio).

import { useReducer, useState } from "react";
import { Notice, TFile } from "obsidian";
import type AxxaPlugin from "../main";
import type { ChatSession } from "../core/session";
import {
  makeProjectId,
  PROJECT_COLORS,
  PROJECT_ICONS,
  type Project,
} from "../projects";
import { PromptModal, ConfirmModal, NotePickerModal } from "./modals";

export function ProjectsView({
  plugin,
  session,
  onOpenChat,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  onOpenChat: () => void;
}) {
  const [, force] = useReducer((n: number) => n + 1, 0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const projects = plugin.settings.projects ?? [];
  const selected = projects.find((p) => p.id === selectedId) ?? null;

  const update = async (fn: (prev: Project[]) => Project[]) => {
    await session.updateProjects(fn);
    force();
  };

  const create = async () => {
    const name = await new PromptModal(plugin.app, {
      title: "New project",
      label: "Name",
      submitLabel: "Create",
    }).openAndWait();
    if (!name) return;
    const p: Project = {
      id: makeProjectId(),
      name,
      icon: PROJECT_ICONS[0],
      color: PROJECT_COLORS[0],
      sources: [],
      chatIds: [],
      createdAt: new Date().toISOString(),
    };
    await update((prev) => [p, ...prev]);
    setSelectedId(p.id);
  };

  const rename = async (p: Project) => {
    const name = await new PromptModal(plugin.app, {
      title: "Rename project",
      label: "Name",
      initial: p.name,
      submitLabel: "Rename",
    }).openAndWait();
    if (!name || name === p.name) return;
    await update((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, name } : x))
    );
  };

  const remove = async (p: Project) => {
    const ok = await new ConfirmModal(plugin.app, {
      title: `Delete project "${p.name}"?`,
      body: "Chats and notes are NOT deleted — only the grouping.",
      confirmLabel: "Delete",
      danger: true,
    }).openAndWait();
    if (!ok) return;
    await update((prev) => prev.filter((x) => x.id !== p.id));
    if (selectedId === p.id) setSelectedId(null);
  };

  const addSource = async (p: Project) => {
    const path = await new NotePickerModal(plugin.app).openAndWait();
    if (!path) return;
    await update((prev) =>
      prev.map((x) =>
        x.id === p.id && !x.sources.includes(path)
          ? { ...x, sources: [...x.sources, path] }
          : x
      )
    );
  };

  const removeSource = (p: Project, path: string) =>
    update((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? { ...x, sources: x.sources.filter((s) => s !== path) }
          : x
      )
    );

  const openNote = (path: string) => {
    const f = plugin.app.vault.getAbstractFileByPath(path);
    if (f instanceof TFile) void plugin.app.workspace.getLeaf(true).openFile(f);
    else new Notice(`Not found: ${path}`);
  };

  const newChatIn = async (p: Project) => {
    await session.newChatInProject(p);
    onOpenChat();
  };

  const openChat = async (id: string) => {
    const s = (plugin.chatSummaries ?? []).find((c) => c.id === id);
    if (!s) {
      new Notice("Chat file not found (deleted or not indexed yet).");
      return;
    }
    await session.load(s);
    onOpenChat();
  };

  if (selected) {
    const chats = (plugin.chatSummaries ?? []).filter((c) =>
      selected.chatIds.includes(c.id)
    );
    return (
      <div className="axxa-projects">
        <div className="axxa-row">
          <button type="button" onClick={() => setSelectedId(null)}>
            ← Projects
          </button>
          <strong>{selected.name}</strong>
          <button type="button" onClick={() => void rename(selected)}>
            Rename
          </button>
          <button type="button" onClick={() => void remove(selected)}>
            Delete
          </button>
        </div>
        <p>
          <button type="button" onClick={() => void newChatIn(selected)}>
            New chat in this project
          </button>{" "}
          <small>(sources are sent as context on the first message)</small>
        </p>
        <h4>Sources ({selected.sources.length})</h4>
        <ul>
          {selected.sources.map((path) => (
            <li key={path}>
              <button type="button" onClick={() => openNote(path)}>
                {path}
              </button>{" "}
              <button
                type="button"
                onClick={() => void removeSource(selected, path)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => void addSource(selected)}>
          Add source note
        </button>
        <h4>Chats ({chats.length})</h4>
        <ul>
          {chats.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => void openChat(c.id)}>
                {c.title || "Untitled"}
              </button>{" "}
              <small>
                {c.mode} · {c.date.slice(0, 10)}
              </small>
            </li>
          ))}
          {chats.length === 0 && (
            <li>
              <em>No chats in this project yet.</em>
            </li>
          )}
        </ul>
      </div>
    );
  }

  return (
    <div className="axxa-projects">
      <div className="axxa-row">
        <button type="button" onClick={() => void create()}>
          New project
        </button>
      </div>
      <ul>
        {projects.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => setSelectedId(p.id)}>
              {p.name}
            </button>{" "}
            <small>
              {p.sources.length} source(s) · {p.chatIds.length} chat(s) ·{" "}
              {p.createdAt.slice(0, 10)}
            </small>{" "}
            <button type="button" onClick={() => void rename(p)}>
              Rename
            </button>{" "}
            <button type="button" onClick={() => void remove(p)}>
              Delete
            </button>
          </li>
        ))}
        {projects.length === 0 && (
          <li>
            <em>No projects yet.</em>
          </li>
        )}
      </ul>
    </div>
  );
}
