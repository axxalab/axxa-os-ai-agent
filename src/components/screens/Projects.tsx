// src/components/screens/Projects.tsx
// Telas de Projetos (refs: ChatGPT iOS 182 lista, 187 detalhe, 189 picker).
//   - ProjectsListScreen: lista de projetos (ícone+cor) + "Novo projeto"
//   - ProjectEditor: overlay de criar/editar (nome + grade de ícones + cores)
//   - ProjectDetailScreen: header + abas Conversas|Fontes + "Nova conversa"

import { useState } from "react";
import { Icon } from "../_shared/Icon";
import { useT } from "../../i18n";
import {
  PROJECT_ICONS,
  PROJECT_COLORS,
  projectColor,
  type Project,
} from "../../projects";
import type { ChatSummary } from "../_shared/chatPersistence";

// ── Lista ──────────────────────────────────────────────────
export function ProjectsListScreen({
  projects,
  onOpen,
  onCreate,
  onClose,
}: {
  projects: Project[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <div className="axxa-screen axxa-proj">
      <div className="axxa-screen-head">
        <button
          type="button"
          className="axxa-screen-back"
          onClick={onClose}
          aria-label={t.projects.back}
        >
          <Icon name="arrow-left" />
        </button>
        <span className="axxa-screen-title">
          <Icon name="folder-kanban" />
          {t.projects.title}
        </span>
      </div>
      <div className="axxa-screen-body">
        <button
          type="button"
          className="axxa-proj-new-row"
          onClick={onCreate}
        >
          <span className="axxa-proj-new-icon">
            <Icon name="folder-plus" />
          </span>
          <span className="axxa-proj-new-label">{t.projects.newProject}</span>
        </button>

        {projects.length === 0 ? (
          <div className="axxa-screen-empty">
            <Icon name="folder-kanban" />
            <p className="axxa-screen-empty-title">{t.projects.emptyTitle}</p>
            <p className="axxa-screen-empty-sub">{t.projects.emptySub}</p>
          </div>
        ) : (
          <div className="axxa-proj-list">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                className="axxa-proj-row"
                onClick={() => onOpen(p.id)}
              >
                <span
                  className="axxa-proj-row-icon"
                  style={{
                    color: projectColor(p.color),
                    background: `color-mix(in srgb, ${projectColor(
                      p.color
                    )} 16%, transparent)`,
                  }}
                >
                  <Icon name={p.icon} />
                </span>
                <span className="axxa-proj-row-main">
                  <span className="axxa-proj-row-name">{p.name}</span>
                  <span className="axxa-proj-row-meta">
                    {t.projects.rowMeta(p.chatIds.length, p.sources.length)}
                  </span>
                </span>
                <Icon name="chevron-right" className="axxa-proj-row-chev" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Editor (criar/editar) ──────────────────────────────────
export function ProjectEditor({
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  initial?: Project;
  onSave: (data: { name: string; icon: string; color: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? PROJECT_ICONS[0]);
  const [color, setColor] = useState(initial?.color ?? PROJECT_COLORS[0]);

  const canSave = name.trim().length > 0;

  return (
    <div className="axxa-proj-editor" role="dialog" aria-label={t.projects.chooseIcon}>
      <div className="axxa-proj-editor-head">
        <button
          type="button"
          className="axxa-proj-editor-cancel"
          onClick={onClose}
        >
          {t.projects.cancel}
        </button>
        <span className="axxa-proj-editor-title">
          {initial ? t.projects.editorEditTitle : t.projects.editorNewTitle}
        </span>
        <button
          type="button"
          className="axxa-proj-editor-done"
          disabled={!canSave}
          onClick={() => onSave({ name: name.trim(), icon, color })}
        >
          {t.projects.done}
        </button>
      </div>

      <div className="axxa-proj-editor-body">
        {/* Preview do ícone na cor escolhida */}
        <div className="axxa-proj-editor-preview">
          <span
            className="axxa-proj-preview-circle"
            style={{
              color: projectColor(color),
              background: `color-mix(in srgb, ${projectColor(
                color
              )} 16%, transparent)`,
            }}
          >
            <Icon name={icon} />
          </span>
        </div>

        {/* Nome */}
        <input
          type="text"
          className="axxa-proj-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.projects.namePlaceholder}
          aria-label={t.projects.nameLabel}
        />

        {/* Swatches de cor */}
        <div className="axxa-proj-swatches" role="radiogroup" aria-label={t.projects.chooseColor}>
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === color}
              className={
                "axxa-proj-swatch" + (c === color ? " axxa-proj-swatch-active" : "")
              }
              style={{ background: projectColor(c) }}
              onClick={() => setColor(c)}
              aria-label={c}
            />
          ))}
        </div>

        {/* Grade de ícones */}
        <div className="axxa-proj-icongrid">
          {PROJECT_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              className={
                "axxa-proj-iconcell" + (ic === icon ? " axxa-proj-iconcell-active" : "")
              }
              onClick={() => setIcon(ic)}
              aria-label={ic}
              style={ic === icon ? { color: projectColor(color) } : undefined}
            >
              <Icon name={ic} />
            </button>
          ))}
        </div>

        {initial && onDelete && (
          <button
            type="button"
            className="axxa-proj-delete"
            onClick={onDelete}
          >
            <Icon name="trash-2" />
            {t.projects.deleteProject}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Detalhe ────────────────────────────────────────────────
export function ProjectDetailScreen({
  project,
  chats,
  onBack,
  onEdit,
  onNewChat,
  onOpenChat,
  onAddSource,
  onRemoveSource,
  onOpenSource,
}: {
  project: Project;
  chats: ChatSummary[];
  onBack: () => void;
  onEdit: () => void;
  onNewChat: () => void;
  onOpenChat: (id: string) => void;
  onAddSource: () => void;
  onRemoveSource: (path: string) => void;
  onOpenSource: (path: string) => void;
}) {
  const t = useT();
  const [tab, setTab] = useState<"chats" | "sources">("chats");

  return (
    <div className="axxa-screen axxa-proj-detail">
      <div className="axxa-screen-head">
        <button
          type="button"
          className="axxa-screen-back"
          onClick={onBack}
          aria-label={t.projects.back}
        >
          <Icon name="arrow-left" />
        </button>
        <span className="axxa-screen-title axxa-proj-detail-title">
          <span
            className="axxa-proj-detail-icon"
            style={{ color: projectColor(project.color) }}
          >
            <Icon name={project.icon} />
          </span>
          {project.name}
        </span>
        <button
          type="button"
          className="axxa-proj-detail-edit"
          onClick={onEdit}
          aria-label={t.projects.editorEditTitle}
          title={t.projects.editorEditTitle}
        >
          <Icon name="settings-2" />
        </button>
      </div>

      <div className="axxa-proj-tabs">
        <button
          type="button"
          className={"axxa-proj-tab" + (tab === "chats" ? " axxa-proj-tab-active" : "")}
          onClick={() => setTab("chats")}
        >
          {t.projects.tabChats}
        </button>
        <button
          type="button"
          className={"axxa-proj-tab" + (tab === "sources" ? " axxa-proj-tab-active" : "")}
          onClick={() => setTab("sources")}
        >
          {t.projects.tabSources}
        </button>
      </div>

      <div className="axxa-screen-body axxa-proj-detail-body">
        {tab === "chats" ? (
          chats.length === 0 ? (
            <div className="axxa-screen-empty">
              <Icon name="message-square" />
              <p className="axxa-screen-empty-sub">{t.projects.chatsEmpty}</p>
            </div>
          ) : (
            <div className="axxa-proj-chats">
              {chats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="axxa-recent-item"
                  onClick={() => onOpenChat(c.id)}
                >
                  <span className="axxa-recent-logo">
                    <Icon name="message-square" />
                  </span>
                  <span className="axxa-recent-main">
                    <span className="axxa-recent-top">
                      <span className="axxa-recent-title">{c.title}</span>
                    </span>
                  </span>
                  <span className="axxa-recent-chevron">
                    <Icon name="chevron-right" />
                  </span>
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="axxa-proj-sources">
            <button
              type="button"
              className="axxa-proj-addsource"
              onClick={onAddSource}
            >
              <Icon name="plus" />
              {t.projects.addSource}
            </button>
            {project.sources.length === 0 ? (
              <div className="axxa-screen-empty">
                <Icon name="file-text" />
                <p className="axxa-screen-empty-sub">{t.projects.sourcesEmpty}</p>
              </div>
            ) : (
              project.sources.map((src) => (
                <div key={src} className="axxa-proj-source-row">
                  <span
                    className="axxa-proj-source-main"
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenSource(src)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onOpenSource(src);
                    }}
                  >
                    <Icon name="file-text" />
                    <span className="axxa-proj-source-name">
                      {src.split("/").pop() ?? src}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="axxa-proj-source-remove"
                    onClick={() => onRemoveSource(src)}
                    aria-label={t.projects.removeSource}
                    title={t.projects.removeSource}
                  >
                    <Icon name="x" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        className="axxa-proj-newchat"
        onClick={onNewChat}
      >
        <Icon name="message-square-plus" />
        {t.projects.newChatInProject}
      </button>
    </div>
  );
}
