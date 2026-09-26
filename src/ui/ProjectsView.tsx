// src/ui/ProjectsView.tsx
// PROJETOS — um assunto que dura mais que uma conversa, numa FOLHA.
//
// Um projeto é duas coisas juntas: as NOTAS que entram como contexto toda vez
// que se começa uma conversa ali, e as CONVERSAS que nasceram dele. É a
// diferença entre anexar as mesmas três notas dez vezes e anexá-las uma vez.
//
// Era uma página inteira; virou folha na 0.6.57. Projeto não é um LUGAR do
// app — é uma gaveta que se abre por cima do que você está fazendo, entrega o
// que você foi buscar (uma conversa naquele assunto) e se fecha.
//
// A folha tem NÍVEIS, e não folhas empilhadas: lista → projeto → (notas,
// instruções, formulário). Folha dentro de folha não funciona no nosso
// desenho — a de dentro é posicionada pelo painel da de fora e rola junto com
// ele. O nível também dá de graça a regra de navegação da casa: a seta
// desfaz o toque que trouxe você.
//
// Nada disso vive no vault: projeto é agrupamento, e mora nas settings. Apagar
// um projeto não apaga nota nem conversa nenhuma — some o agrupamento, e a
// confirmação diz isso com todas as letras.

import { useMemo, useReducer, useState } from "react";
import { Notice, TFile } from "obsidian";
import type AxxaPlugin from "../main";
import type { ChatSession } from "../core/session";
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
import { ProjectForm } from "./ProjectSheet";
import { SheetField, SheetSubmit, SheetTextarea } from "./SheetForm";
import { openActions } from "./menu";
import { rankNotes, vaultNotes } from "./notePicker";

export function ProjectsView({
  plugin,
  session,
  open,
  abertoId,
  onAbrir,
  onOpenChat,
  onClose,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  open: boolean;
  /** Qual projeto está aberto. Vem de fora (App) pra sobreviver à ida e volta
   *  de uma conversa: entrar numa conversa fecha a folha, e voltar reabre
   *  no projeto de onde se saiu. */
  abertoId: string | null;
  onAbrir: (id: string | null) => void;
  onOpenChat: () => void;
  onClose: () => void;
}) {
  const [, force] = useReducer((n: number) => n + 1, 0);
  const setAbertoId = onAbrir;
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  /** Id do projeto em edição — null quando é criação. */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  /** Está no nível das notas? E, dentro dele, escolhendo uma do vault? */
  const [vendoNotas, setVendoNotas] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);
  const [noteQuery, setNoteQuery] = useState("");
  /** O texto das instruções em edição (null = fora desse nível; "" é válido). */
  const [instrucoes, setInstrucoes] = useState<string | null>(null);

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
    const todas = rankNotes(vaultNotes(plugin.app), noteQuery);
    // O que já é fonte não aparece: escolher de novo não faria nada, e uma
    // lista onde metade dos toques é no-op ensina a desconfiar dela.
    return aberto ? todas.filter((n) => !aberto.sources.includes(n.path)) : todas;
  }, [plugin, aberto, noteQuery]);

  // ── Qual nível está à vista ───────────────────────────────────────────────
  // A ordem importa: o formulário e as instruções são abertos DE DENTRO de um
  // projeto, então eles vêm antes dele na conta.
  const nivel = draft
    ? "form"
    : instrucoes !== null
      ? "instrucoes"
      : escolhendo
        ? "escolher"
        : vendoNotas
          ? "notas"
          : aberto
            ? "projeto"
            : "lista";

  const TITULOS: Record<string, string> = {
    form: editandoId ? "Edit project" : "New project",
    instrucoes: "Custom instructions",
    escolher: "Add a note",
    notas: "Project notes",
    projeto: aberto?.name ?? "Project",
    lista: "Projects",
  };

  /** A seta de voltar de cada nível — ela desfaz o toque que trouxe você. */
  const voltar: Record<string, (() => void) | undefined> = {
    form: () => {
      setDraft(null);
      setEditandoId(null);
    },
    instrucoes: () => setInstrucoes(null),
    escolher: () => setEscolhendo(false),
    notas: () => setVendoNotas(false),
    projeto: () => setAbertoId(null),
    lista: undefined,
  };

  const fecharTudo = () => {
    setDraft(null);
    setEditandoId(null);
    setInstrucoes(null);
    setEscolhendo(false);
    setVendoNotas(false);
    setNoteQuery("");
    onClose();
  };

  return (
    <Sheet
      title={TITULOS[nivel]}
      open={open}
      onClose={fecharTudo}
      onBack={voltar[nivel]}
      startFull
      focusOnOpen={false}
    >
      {nivel === "form" && (
        <ProjectForm
          editando={editandoId !== null}
          draft={draft ?? PROJECT_DRAFT_VAZIO}
          problema={problema}
          focar={nivel === "form"}
          onDraft={setDraft}
          onSubmit={() => void salvar()}
        />
      )}

      {nivel === "instrucoes" && (
        <>
          <SheetField
            label="Instructions"
            hint="Sent with every new chat in this project — it adds to how the app already works, it does not replace it."
          >
            <SheetTextarea
              value={instrucoes ?? ""}
              rows={9}
              placeholder={
                "Answer in Portuguese.\nCite the note you took it from.\nShort paragraphs, no bullet lists."
              }
              onChange={setInstrucoes}
            />
          </SheetField>
          <SheetSubmit
            label="Save instructions"
            onSubmit={() => {
              const alvo = aberto;
              const texto = (instrucoes ?? "").trim();
              if (alvo) {
                void update((prev) =>
                  prev.map((x) =>
                    x.id === alvo.id
                      ? { ...x, instructions: texto || undefined }
                      : x
                  )
                );
              }
              setInstrucoes(null);
            }}
          />
        </>
      )}

      {nivel === "escolher" && (
        <>
          <SheetSearch
            value={noteQuery}
            placeholder="Search notes"
            found={notasAchadas.length}
            autoFocus={nivel === "escolher"}
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
                  if (aberto) void anexarNota(aberto, n.path);
                  // Volta pra lista do projeto em vez de fechar: quem veio pôr
                  // notas quase sempre põe mais de uma, e ver a que acabou de
                  // entrar é a confirmação de que entrou.
                  setEscolhendo(false);
                  setNoteQuery("");
                }}
              />
            ))}
            {notasAchadas.length === 0 && (
              <SheetNote>No note matches that.</SheetNote>
            )}
          </SheetGroup>
        </>
      )}

      {nivel === "notas" && (
        <SheetGroup>
          {(aberto?.sources ?? []).map((path) => (
            <SheetRow
              key={path}
              dense
              icon="file-text"
              title={path.split("/").pop()?.replace(/\.md$/i, "") ?? path}
              note={path}
              action={{
                icon: "x",
                label: `Remove ${path}`,
                onClick: () => {
                  if (aberto) void tirarNota(aberto, path);
                },
              }}
              onClick={() => abrirNota(path)}
            />
          ))}
          {(aberto?.sources ?? []).length === 0 && (
            <SheetNote>
              No notes yet. What you add here goes in as context on every new
              chat in this project.
            </SheetNote>
          )}
          <SheetRow
            icon="plus"
            badge
            chevron
            title="Add a note"
            onClick={() => {
              setNoteQuery("");
              setEscolhendo(true);
            }}
          />
        </SheetGroup>
      )}

      {nivel === "projeto" && aberto && (
        <>
          {/* As pílulas dizem ONDE isto mora — o projeto é agrupamento e vive
              nos dados do plugin, dentro do vault, não num serviço nosso. Não
              dizem "privado": as notas daqui vão como contexto pro modelo
              quando você conversa, e uma pílula que promete o contrário
              mentiria. */}
          <div className="axxa-pills">
            <span
              className="axxa-pill is-mark"
              style={{ color: projectColor(aberto.color) }}
            >
              <Icon name={aberto.icon} size={14} />
              <span>{aberto.name}</span>
            </span>
            <span className="axxa-pill">
              <Icon name="hard-drive" size={14} />
              <span>Lives in this vault</span>
            </span>
          </div>

          {/* A caixa de cima responde "o que este projeto faz por mim" — e a
              resposta muda conforme ele tem ou não notas, porque a pergunta de
              quem tem zero não é a mesma de quem tem seis. */}
          <p className="axxa-boxnote">
            {aberto.sources.length === 0
              ? "Pick the notes this project is about. They go in as context every time you start a chat here."
              : aberto.sources.length === 1
                ? "1 note goes in as context on every new chat here."
                : `${aberto.sources.length} notes go in as context on every new chat here.`}
          </p>

          {/* Os dois lados do projeto, lado a lado: o que ele SABE e como ele
              deve responder. */}
          <div className="axxa-duo">
            <button
              type="button"
              className="axxa-duo-card"
              onClick={() => setVendoNotas(true)}
            >
              <span className="axxa-duo-title">Project notes</span>
              <span className="axxa-duo-note">
                {aberto.sources.length === 0
                  ? "Nothing yet"
                  : `${aberto.sources.length} note${
                      aberto.sources.length === 1 ? "" : "s"
                    }`}
              </span>
              <span className="axxa-duo-action">
                {aberto.sources.length === 0 ? "Add notes" : "See notes"}
              </span>
            </button>
            <button
              type="button"
              className="axxa-duo-card"
              onClick={() => setInstrucoes(aberto.instructions ?? "")}
            >
              <span className="axxa-duo-title">Custom instructions</span>
              <span className="axxa-duo-note">
                {aberto.instructions?.trim()
                  ? aberto.instructions.trim().split("\n")[0]
                  : "Nothing yet"}
              </span>
              <span className="axxa-duo-action">
                {aberto.instructions?.trim() ? "Edit" : "Add instructions"}
              </span>
            </button>
          </div>

          {chats.filter((c) => aberto.chatIds.includes(c.id)).length > 0 ? (
            <>
              {/* Rótulo DA FOLHA, não da home: dentro dela o versalete
                  miúdo é a letra de grupo, e o da home é palavra normal. */}
              <span className="axxa-sheet-group-label">Chats</span>
              <ChatList
                plugin={plugin}
                session={session}
                chats={chats.filter((c) => aberto.chatIds.includes(c.id))}
                onOpen={onOpenChat}
              />
            </>
          ) : (
            <div className="axxa-home-empty">
              <Icon name="message-circle" size={42} />
              <p>Ask anything. Chats in this project show up here.</p>
            </div>
          )}

          <div className="axxa-sheet-foot">
            {/* Editar e apagar ficam AQUI, à esquerda e em texto, e não num ⋯
                da barra: a folha já usa o canto direito da barra pro X, e um
                menu escondido atrás de um ícone que divide espaço com o de
                fechar é convite pra fechar sem querer. */}
            <button
              type="button"
              className="axxa-home-filter"
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
              <Icon name="settings-2" size={16} />
              <span>Project settings</span>
            </button>
            <button
              type="button"
              className="axxa-sheet-cta"
              onClick={() => {
                void session.newChatInProject(aberto);
                onOpenChat();
              }}
            >
              <Icon name="plus" size={20} />
              <span>New chat here</span>
            </button>
          </div>
        </>
      )}

      {nivel === "lista" && (
        <>
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
                        {p.sources.length} note
                        {p.sources.length === 1 ? "" : "s"} · {p.chatIds.length}{" "}
                        chat{p.chatIds.length === 1 ? "" : "s"}
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
                A project keeps notes and chats about the same thing together.
                Its notes go in as context every time you start a chat there.
              </p>
            </div>
          )}

          <div className="axxa-sheet-foot">
            <button type="button" className="axxa-sheet-cta" onClick={criar}>
              <Icon name="plus" size={20} />
              <span>New project</span>
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
