// src/ui/ProjectsView.tsx
// A tela de PROJETOS: um assunto que dura mais que uma conversa.
//
// Um projeto é duas coisas juntas — as NOTAS que entram como contexto toda
// vez que se começa uma conversa ali, e as CONVERSAS que nasceram dela. É a
// diferença entre anexar as mesmas três notas dez vezes e anexá-las uma vez.
//
// São duas telas: a lista e o projeto aberto. A lista existe pra escolher; o
// projeto aberto é onde se trabalha, e por isso o botão grudado na base dele
// é "New chat here" — o resto (notas, conversas velhas) é o que sustenta
// esse toque.
//
// Nada disso vive no vault: projeto é agrupamento, e mora nas settings. Apagar
// um projeto não apaga nota nem conversa nenhuma — some o agrupamento, e a
// confirmação diz isso com todas as letras.

import { useMemo, useReducer, useState } from "react";
import { Notice, TFile } from "obsidian";
import type AxxaPlugin from "../main";
import type { ChatSession } from "../core/session";
import type { ChatSummary } from "../core/chatPersistence";
import {
  makeProjectId,
  projectColor,
  projectProblema,
  PROJECT_DRAFT_VAZIO,
  type Project,
  type ProjectDraft,
} from "../projects";
import { ChatList, useChatSummaries } from "./ChatList";
import { ConfirmModal } from "./modals";
import { Icon } from "./Icon";
import { Sheet, SheetGroup, SheetNote, SheetRow, SheetSearch } from "./Sheet";
import { ProjectSheet } from "./ProjectSheet";
import { openActions } from "./menu";
import { rankNotes, vaultNotes } from "./notePicker";

export function ProjectsView({
  plugin,
  session,
  abertoId,
  onAbrir,
  onOpenChat,
  onBack,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  /** Qual projeto está aberto. Vem de fora (App) pra sobreviver à ida e volta
   *  de uma conversa — ver o comentário em App.tsx. */
  abertoId: string | null;
  onAbrir: (id: string | null) => void;
  onOpenChat: () => void;
  onBack: () => void;
}) {
  const [, force] = useReducer((n: number) => n + 1, 0);
  const setAbertoId = onAbrir;
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  /** Id do projeto em edição — null quando é criação. */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  /** A folha de escolher nota está aberta pra qual projeto. */
  const [anexandoEm, setAnexandoEm] = useState<string | null>(null);
  const [noteQuery, setNoteQuery] = useState("");

  const chats = useChatSummaries(plugin);
  const projects = plugin.settings.projects ?? [];
  const aberto = projects.find((p) => p.id === abertoId) ?? null;

  const update = async (fn: (prev: Project[]) => Project[]) => {
    await session.updateProjects(fn);
    force();
  };

  const criar = () => {
    setEditandoId(null);
    setDraft(PROJECT_DRAFT_VAZIO);
  };

  const editar = (p: Project) => {
    setEditandoId(p.id);
    setDraft({ name: p.name, icon: p.icon, color: p.color });
  };

  const problema = draft
    ? projectProblema(draft, projects, editandoId ?? undefined)
    : null;

  const salvar = async () => {
    if (!draft || problema) return;
    const nome = draft.name.trim();
    if (editandoId) {
      await update((prev) =>
        prev.map((x) =>
          x.id === editandoId
            ? { ...x, name: nome, icon: draft.icon, color: draft.color }
            : x
        )
      );
    } else {
      const p: Project = {
        id: makeProjectId(),
        name: nome,
        icon: draft.icon,
        color: draft.color,
        sources: [],
        chatIds: [],
        createdAt: new Date().toISOString(),
      };
      await update((prev) => [p, ...prev]);
      // Cai DENTRO do projeto recém-criado: criar é meio do caminho, não fim.
      // Quem acabou de nomear um projeto vai querer pôr as notas dele — e
      // voltar pra lista obrigaria a um toque só pra desfazer o nosso.
      setAbertoId(p.id);
    }
    setDraft(null);
    setEditandoId(null);
  };

  const apagar = async (p: Project) => {
    const ok = await new ConfirmModal(plugin.app, {
      title: `Delete project "${p.name}"?`,
      body: "The notes and chats stay where they are — only the grouping goes.",
      confirmLabel: "Delete",
      danger: true,
    }).openAndWait();
    if (!ok) return;
    await update((prev) => prev.filter((x) => x.id !== p.id));
    if (abertoId === p.id) setAbertoId(null);
  };

  const anexarNota = (p: Project, path: string) =>
    update((prev) =>
      prev.map((x) =>
        x.id === p.id && !x.sources.includes(path)
          ? { ...x, sources: [...x.sources, path] }
          : x
      )
    );

  const tirarNota = (p: Project, path: string) =>
    update((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? { ...x, sources: x.sources.filter((s) => s !== path) }
          : x
      )
    );

  const abrirNota = (path: string) => {
    const f = plugin.app.vault.getAbstractFileByPath(path);
    if (f instanceof TFile) void plugin.app.workspace.getLeaf(true).openFile(f);
    else new Notice(`Not found: ${path}`);
  };

  const notasAchadas = useMemo(() => {
    const p = projects.find((x) => x.id === anexandoEm);
    const todas = rankNotes(vaultNotes(plugin.app), noteQuery);
    // O que já é fonte não aparece: escolher de novo não faria nada, e uma
    // lista onde metade dos toques é no-op ensina a desconfiar dela.
    return p ? todas.filter((n) => !p.sources.includes(n.path)) : todas;
  }, [plugin, projects, anexandoEm, noteQuery]);

  const folhaDeNotas = (
    <Sheet
      title="Add a note"
      open={anexandoEm !== null}
      onClose={() => setAnexandoEm(null)}
      startFull
      focusOnOpen={false}
    >
      <SheetSearch
        value={noteQuery}
        placeholder="Search notes"
        found={notasAchadas.length}
        autoFocus={anexandoEm !== null}
        onChange={setNoteQuery}
      />
      <SheetGroup>
        {notasAchadas.map((n) => (
          <SheetRow
            key={n.path}
            dense
            icon="file-text"
            title={n.basename}
            note={n.path}
            onClick={() => {
              const p = projects.find((x) => x.id === anexandoEm);
              if (p) void anexarNota(p, n.path);
              setAnexandoEm(null);
              setNoteQuery("");
            }}
          />
        ))}
        {notasAchadas.length === 0 && (
          <SheetNote>No note matches that.</SheetNote>
        )}
      </SheetGroup>
    </Sheet>
  );

  // ── O projeto aberto ──────────────────────────────────────────────────────
  if (aberto) {
    const meus = chats.filter((c) => aberto.chatIds.includes(c.id));
    const cor = projectColor(aberto.color);
    return (
      <div className="axxa-chat">
        <header className="axxa-topbar is-bare">
          {/* Volta pra LISTA, não pra home: a seta desfaz o toque que trouxe
              você — e aqui o toque foi na lista. */}
          <button
            type="button"
            className="axxa-icon-btn"
            aria-label="Back to projects"
            onClick={() => setAbertoId(null)}
          >
            <Icon name="arrow-left" />
          </button>
          <span className="axxa-brand axxa-topbar-brand">{aberto.name}</span>
          <button
            type="button"
            className="axxa-icon-btn axxa-topbar-end"
            aria-label={`Actions for ${aberto.name}`}
            onClick={(e) =>
              openActions(e as unknown as MouseEvent, [
                { label: "Edit", icon: "pencil", run: () => editar(aberto) },
                {
                  label: "Delete",
                  icon: "trash-2",
                  danger: true,
                  run: () => void apagar(aberto),
                },
              ])
            }
          >
            <Icon name="more-horizontal" />
          </button>
        </header>

        <div className="axxa-messages axxa-home">
          <div className="axxa-project-head">
            <span className="axxa-thing-mark is-big" style={{ color: cor }}>
              <Icon name={aberto.icon} size={26} />
            </span>
            <p className="axxa-lead">
              {aberto.sources.length === 0
                ? "Add the notes this project is about — they go in as context every time you start a chat here."
                : `${aberto.sources.length} note${
                    aberto.sources.length === 1 ? "" : "s"
                  } go in as context on every new chat here.`}
            </p>
          </div>

          <div className="axxa-home-headrow">
            <span className="axxa-section-label">Notes</span>
            <button
              type="button"
              className="axxa-home-filter"
              onClick={() => {
                setNoteQuery("");
                setAnexandoEm(aberto.id);
              }}
            >
              <Icon name="plus" size={16} />
              <span>Add</span>
            </button>
          </div>

          {aberto.sources.length > 0 ? (
            <div className="axxa-things">
              {aberto.sources.map((path) => (
                <div key={path} className="axxa-thing-wrap">
                  <button
                    type="button"
                    className="axxa-thing is-dense"
                    onClick={() => abrirNota(path)}
                  >
                    <span className="axxa-thing-mark" aria-hidden="true">
                      <Icon name="file-text" size={18} />
                    </span>
                    <span className="axxa-thing-text">
                      <span className="axxa-thing-name">
                        {path.split("/").pop()?.replace(/\.md$/i, "") ?? path}
                      </span>
                      <span className="axxa-thing-note">{path}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="axxa-icon-btn axxa-history-more"
                    aria-label={`Remove ${path}`}
                    onClick={() => void tirarNota(aberto, path)}
                  >
                    <Icon name="x" size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <button
              type="button"
              className="axxa-home-pill"
              onClick={() => {
                setNoteQuery("");
                setAnexandoEm(aberto.id);
              }}
            >
              <Icon name="file-plus" size={18} />
              <span>Add the first note</span>
            </button>
          )}

          <span className="axxa-section-label">Chats</span>
          {meus.length > 0 ? (
            <ChatList
              plugin={plugin}
              session={session}
              chats={meus}
              onOpen={onOpenChat}
            />
          ) : (
            <div className="axxa-home-empty">
              <Icon name="message-circle" size={38} />
              <p>Nothing here yet. The first chat starts below.</p>
            </div>
          )}

          <button
            type="button"
            className="axxa-fab"
            onClick={() => {
              void session.newChatInProject(aberto);
              onOpenChat();
            }}
          >
            <Icon name="plus" size={20} />
            <span>New chat here</span>
          </button>
        </div>

        <ProjectSheet
          open={draft !== null}
          editando={editandoId !== null}
          draft={draft ?? PROJECT_DRAFT_VAZIO}
          problema={problema}
          onDraft={setDraft}
          onClose={() => {
            setDraft(null);
            setEditandoId(null);
          }}
          onSubmit={() => void salvar()}
        />
        {folhaDeNotas}
      </div>
    );
  }

  // ── A lista ───────────────────────────────────────────────────────────────
  return (
    <div className="axxa-chat">
      <header className="axxa-topbar is-bare">
        <button
          type="button"
          className="axxa-icon-btn"
          aria-label="Back"
          onClick={onBack}
        >
          <Icon name="arrow-left" />
        </button>
        <span className="axxa-brand axxa-topbar-brand">Projects</span>
      </header>

      <div className="axxa-messages axxa-home">
        {projects.length > 0 && (
          <p className="axxa-lead">
            Notes and chats that belong to the same thing.
          </p>
        )}

        {projects.length > 0 ? (
          <div className="axxa-things">
            {projects.map((p) => (
              <div key={p.id} className="axxa-thing-wrap">
                <button
                  type="button"
                  className="axxa-thing"
                  onClick={() => setAbertoId(p.id)}
                >
                  <span
                    className="axxa-thing-mark"
                    style={{ color: projectColor(p.color) }}
                    aria-hidden="true"
                  >
                    <Icon name={p.icon} size={20} />
                  </span>
                  <span className="axxa-thing-text">
                    <span className="axxa-thing-name">{p.name}</span>
                    <span className="axxa-thing-note">
                      {p.sources.length} note{p.sources.length === 1 ? "" : "s"}{" "}
                      · {p.chatIds.length} chat
                      {p.chatIds.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <Icon
                    name="chevron-right"
                    size={18}
                    className="axxa-module-chev"
                  />
                </button>
                <button
                  type="button"
                  className="axxa-icon-btn axxa-history-more"
                  aria-label={`Actions for ${p.name}`}
                  onClick={(e) =>
                    openActions(e as unknown as MouseEvent, [
                      {
                        label: "Open",
                        icon: "folder-open",
                        run: () => setAbertoId(p.id),
                      },
                      { label: "Edit", icon: "pencil", run: () => editar(p) },
                      {
                        label: "Delete",
                        icon: "trash-2",
                        danger: true,
                        run: () => void apagar(p),
                      },
                    ])
                  }
                >
                  <Icon name="more-horizontal" size={18} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="axxa-home-empty">
            <Icon name="folder-open" size={42} />
            <p>
              A project keeps notes and chats about the same thing together. Its
              notes go in as context every time you start a chat there.
            </p>
          </div>
        )}

        <button type="button" className="axxa-fab" onClick={criar}>
          <Icon name="plus" size={20} />
          <span>New project</span>
        </button>
      </div>

      <ProjectSheet
        open={draft !== null}
        editando={editandoId !== null}
        draft={draft ?? PROJECT_DRAFT_VAZIO}
        problema={problema}
        onDraft={setDraft}
        onClose={() => {
          setDraft(null);
          setEditandoId(null);
        }}
        onSubmit={() => void salvar()}
      />
      {folhaDeNotas}
    </div>
  );
}
