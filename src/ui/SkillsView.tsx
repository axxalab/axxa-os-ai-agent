// src/ui/SkillsView.tsx
// SKILLS — os prompts que você guardou, numa FOLHA.
//
// Era uma página inteira, com barra e botão de voltar. Virou folha (0.6.57)
// pelo mesmo motivo que projetos: skill não é um LUGAR do app, é uma gaveta
// que se abre por cima do que você está fazendo e se fecha quando acabou.
// Página tem endereço e história; gaveta tem um gesto. E o gesto aqui é o
// certo: você pega um prompt e volta pra onde estava — quase sempre pra
// escrever com ele.
//
// A folha tem DOIS níveis, e não folhas empilhadas: a galeria e o formulário.
// Folha dentro de folha não funciona no nosso desenho — a de dentro é
// posicionada pelo painel da de fora e rola junto com ele.
//
// Um skill continua sendo uma nota .md na pasta de skills: é por isso que ele
// se compartilha, se versiona e se edita no Obsidian como qualquer outra nota.
// O ARQUIVO é a implementação, não a tela.

import { useEffect, useMemo, useReducer, useState } from "react";
import { Notice, TFile, normalizePath } from "obsidian";
import type AxxaPlugin from "../main";
import type { Skill } from "../skills/skills";
import {
  SKILL_DRAFT_VAZIO,
  skillFileName,
  skillMarkdown,
  skillProblema,
  type SkillDraft,
} from "../skills/skillFile";
import { ensureFolder } from "../core/chatPersistence";
import { ConfirmModal } from "./modals";
import { Icon } from "./Icon";
import { Sheet, SheetSearch, SheetTabs } from "./Sheet";
import { SkillForm } from "./SkillSheet";
import { openActions } from "./menu";
import { MODULES, relativeShort } from "./modules";
import { CHAT_MODES, isChatMode } from "../core/session";

/** As abas da galeria: o modo em que o skill abre. É a única divisão que um
 *  skill tem — o resto (nome, prompt) é assunto da busca. */
const ABAS: Array<{ id: string; label: string }> = [
  { id: "all", label: "All" },
  ...CHAT_MODES.map((m) => ({ id: m, label: MODULES[m].short })),
];

export function SkillsView({
  plugin,
  open,
  onUse,
  onClose,
}: {
  plugin: AxxaPlugin;
  open: boolean;
  onUse: (skill: Skill) => void;
  onClose: () => void;
}) {
  const [, force] = useReducer((n: number) => n + 1, 0);
  const [query, setQuery] = useState("");
  const [aba, setAba] = useState("all");
  const [draft, setDraft] = useState<SkillDraft | null>(null);
  /** Caminho do skill em edição — null quando é criação. */
  const [editandoPath, setEditandoPath] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void plugin.reloadSkills().then(() => force());
    return plugin.onSettingsChange(force);
  }, [plugin, open]);

  const skills = plugin.skills;
  const folder = plugin.settings.skillsPath || "axxa-ai/skills";

  /** Quantos skills cada aba tem — a contagem aparece na própria aba, que é
   *  o que evita tocar numa pra descobrir que está vazia. */
  const porModo = useMemo(() => {
    const m = new Map<string, number>([["all", skills.length]]);
    for (const s of skills) {
      const k = s.mode ?? "";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [skills]);

  const visiveis = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Modo primeiro, busca depois: a busca procura DENTRO do que está sendo
    // mostrado, senão a aba viraria mentira na tela.
    const noModo =
      aba === "all" ? skills : skills.filter((s) => (s.mode ?? "") === aba);
    if (!q) return noModo;
    return noModo.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.body.toLowerCase().includes(q)
    );
  }, [skills, query, aba]);

  const problema = draft
    ? skillProblema(
        draft,
        skills.map((s) => s.path),
        editandoPath ?? undefined
      )
    : null;

  const abrirNota = (path: string) => {
    const f = plugin.app.vault.getAbstractFileByPath(path);
    if (f instanceof TFile) void plugin.app.workspace.getLeaf(true).openFile(f);
    else new Notice(`Not found: ${path}`);
  };

  const criar = () => {
    setEditandoPath(null);
    setDraft(SKILL_DRAFT_VAZIO);
  };

  const editar = (s: Skill) => {
    setEditandoPath(s.path);
    setDraft({
      name: s.name,
      description: s.description,
      icon: s.icon,
      mode: s.mode ?? "",
      body: s.body,
    });
  };

  const fecharNivel = () => {
    setDraft(null);
    setEditandoPath(null);
  };

  /** Grava o rascunho: cria a nota ou reescreve a que está sendo editada. */
  const salvar = async () => {
    if (!draft || problema) return;
    const alvo = normalizePath(`${folder}/${skillFileName(draft.name)}`);
    const conteudo = skillMarkdown(draft);
    try {
      await ensureFolder(plugin.app.vault.adapter, folder);
      const antigo = editandoPath
        ? plugin.app.vault.getAbstractFileByPath(editandoPath)
        : null;
      if (antigo instanceof TFile) {
        // Renomear ANTES de escrever: o nome do arquivo segue o nome do skill,
        // senão editar o nome deixaria a nota chamando-se como antes — e o
        // vault viraria um lugar onde o que está escrito não bate com o que
        // se lê na lista.
        if (antigo.path !== alvo) {
          await plugin.app.fileManager.renameFile(antigo, alvo);
        }
        await plugin.app.vault.modify(
          plugin.app.vault.getAbstractFileByPath(alvo) as TFile,
          conteudo
        );
      } else {
        await plugin.app.vault.create(alvo, conteudo);
      }
      await plugin.reloadSkills();
      fecharNivel();
      force();
    } catch (err) {
      new Notice(
        `Could not save the skill: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  };

  const apagar = async (s: Skill) => {
    const ok = await new ConfirmModal(plugin.app, {
      title: `Delete "${s.name}"?`,
      body: "The note goes to the trash — you can get it back from there.",
      confirmLabel: "Delete",
      danger: true,
    }).openAndWait();
    if (!ok) return;
    const f = plugin.app.vault.getAbstractFileByPath(s.path);
    if (f) await plugin.app.vault.trash(f, true);
    await plugin.reloadSkills();
    force();
  };

  const exemplos = async () => {
    const n = await plugin.seedExampleSkills();
    new Notice(
      n > 0 ? `${n} example skill(s) created.` : "The examples are already here."
    );
    force();
  };

  const noFormulario = draft !== null;

  return (
    <Sheet
      title={
        noFormulario ? (editandoPath ? "Edit skill" : "New skill") : "Skills"
      }
      open={open}
      onClose={() => {
        fecharNivel();
        onClose();
      }}
      onBack={noFormulario ? fecharNivel : undefined}
      // Nasce grande: é um acervo, e acervo pequeno mostra dois cartões.
      startFull
      // O painel não toma o foco: no formulário quem toma é o campo do nome, e
      // o efeito do pai roda depois do do filho (a mesma armadilha da busca).
      focusOnOpen={false}
    >
      {noFormulario ? (
        <SkillForm
          editando={editandoPath !== null}
          draft={draft ?? SKILL_DRAFT_VAZIO}
          problema={problema}
          focar={noFormulario}
          onDraft={setDraft}
          onSubmit={() => void salvar()}
        />
      ) : (
        <>
          {/* A busca fica no TOPO da folha, que é onde ela funciona: o campo
              encosta na borda de cima e a lista cresce contra o teclado. É a
              mesma peça (SheetSearch) da folha de notas e da de modelos. */}
          <SheetSearch
            value={query}
            placeholder="Search skills"
            found={visiveis.length}
            onChange={setQuery}
          />

          {skills.length > 0 && (
            <SheetTabs
              label="Filter skills by mode"
              activeId={aba}
              onPick={setAba}
              items={ABAS.map((a) => ({
                id: a.id,
                label: a.label,
                count: porModo.get(a.id === "all" ? "all" : a.id) ?? 0,
              }))}
            />
          )}

          {visiveis.length > 0 && (
            <div className="axxa-tiles">
              {visiveis.map((s) => (
                <div key={s.id} className="axxa-tile-wrap">
                  <button
                    type="button"
                    className="axxa-tile"
                    onClick={() => onUse(s)}
                  >
                    {/* O prompt, como ele é. A miniatura do cartão não é
                        ilustração: é o texto que vai cair no campo quando você
                        tocar — a única pergunta que se faz olhando uma lista
                        de skills é "qual deles escreve o quê". */}
                    <span className="axxa-tile-paper">
                      <span className="axxa-tile-text">{s.body}</span>
                    </span>
                    <span className="axxa-tile-name">{s.name}</span>
                    <span className="axxa-tile-meta">
                      <Icon
                        name={
                          isChatMode(s.mode) ? MODULES[s.mode].icon : "sparkles"
                        }
                        size={14}
                      />
                      <span>
                        {s.mtime
                          ? `Edited ${relativeShort(
                              new Date(s.mtime).toISOString()
                            )}`
                          : s.description || "Prompt"}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="axxa-icon-btn axxa-tile-more"
                    aria-label={`Actions for ${s.name}`}
                    onClick={(e) =>
                      openActions(e as unknown as MouseEvent, [
                        {
                          label: "Use",
                          icon: "corner-down-left",
                          run: () => onUse(s),
                        },
                        {
                          label: "Edit",
                          icon: "pencil",
                          run: () => editar(s),
                        },
                        {
                          label: "Open note",
                          icon: "file-text",
                          run: () => abrirNota(s.path),
                        },
                        {
                          label: "Delete",
                          icon: "trash-2",
                          danger: true,
                          run: () => void apagar(s),
                        },
                      ])
                    }
                  >
                    <Icon name="more-horizontal" size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {visiveis.length === 0 && (
            <div className="axxa-home-empty">
              <Icon name="sparkles" size={42} />
              <p>
                {skills.length > 0
                  ? "Nothing matches that."
                  : "A skill is a prompt you keep. Write it once, use it in one tap — here, in the composer’s +, or by typing / in any chat."}
              </p>
              {skills.length === 0 && (
                <button
                  type="button"
                  className="axxa-home-pill"
                  onClick={() => void exemplos()}
                >
                  <Icon name="wand" size={18} />
                  <span>Start with three examples</span>
                </button>
              )}
            </div>
          )}

          {/* Criar é a ação da folha, e mora no fim dela: numa folha não há
              canto onde um botão flutuante possa morar sem tapar conteúdo. */}
          <div className="axxa-form-foot">
            <button
              type="button"
              className="axxa-form-submit"
              onClick={criar}
            >
              <Icon name="plus" size={18} />
              <span>New skill</span>
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
