// src/ui/SkillsView.tsx
// A tela de SKILLS: os prompts que você guardou.
//
// Um skill é uma nota .md na pasta de skills — e é por isso que ele se
// compartilha, se versiona e se edita no Obsidian como qualquer outra nota.
// Só que o ARQUIVO é a implementação, não a tela: quem chega aqui quer um
// prompt guardado, não um bloco de YAML. A nota continua a um toque (o ⋯ abre
// ela), mas ninguém mais é obrigado a passar por lá pra criar.
//
// O toque na linha USA o skill: cai no campo de texto já escrito, que é o
// único motivo de um skill existir. Editar, abrir a nota e apagar moram no ⋯,
// onde moram as ações de uma conversa — mesma gramática, mesmo lugar.

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
import { SearchField } from "./SearchField";
import { SkillSheet } from "./SkillSheet";
import { openActions } from "./menu";
import { MODULES, relativeShort } from "./modules";
import { CHAT_MODES, isChatMode } from "../core/session";

/** O filtro da galeria: o modo em que o skill abre. É a única divisão que um
 *  skill tem — o resto (nome, prompt) é assunto da busca. */
const FILTROS: Array<{ id: string; label: string }> = [
  { id: "all", label: "All" },
  ...CHAT_MODES.map((m) => ({ id: m, label: MODULES[m].short })),
];

export function SkillsView({
  plugin,
  onUse,
  onBack,
}: {
  plugin: AxxaPlugin;
  onUse: (skill: Skill) => void;
  onBack: () => void;
}) {
  const [, force] = useReducer((n: number) => n + 1, 0);
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState(FILTROS[0]);
  const [draft, setDraft] = useState<SkillDraft | null>(null);
  /** Caminho do skill em edição — null quando é criação. */
  const [editandoPath, setEditandoPath] = useState<string | null>(null);

  useEffect(() => {
    void plugin.reloadSkills().then(() => force());
    return plugin.onSettingsChange(force);
  }, [plugin]);

  const skills = plugin.skills;
  const folder = plugin.settings.skillsPath || "axxa-ai/skills";

  const visiveis = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Modo primeiro, busca depois: a busca procura DENTRO do que está sendo
    // mostrado, senão o filtro viraria mentira na tela.
    const noModo =
      filtro.id === "all"
        ? skills
        : skills.filter((s) => (s.mode ?? "") === filtro.id);
    if (!q) return noModo;
    return noModo.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.body.toLowerCase().includes(q)
    );
  }, [skills, query, filtro]);

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
      setDraft(null);
      setEditandoPath(null);
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
        <span className="axxa-brand axxa-topbar-brand">Skills</span>
      </header>

      <div className="axxa-messages axxa-home">
        {/* A busca fica SEMPRE, e não a partir de oito: numa galeria de
            cartões a fileira de cima é a barra de ferramentas da tela — ela
            aparecendo e sumindo conforme a contagem faria a página trocar de
            forma sozinha. O filtro ao lado dela é por modo, que é a única
            divisão que um skill tem. */}
        <div className="axxa-toolrow">
          <SearchField
            value={query}
            placeholder="Search skills"
            label="Search skills"
            found={visiveis.length}
            onChange={setQuery}
          />
          <button
            type="button"
            className="axxa-home-filter"
            aria-label="Filter skills by mode"
            onClick={(e) =>
              openActions(
                e as unknown as MouseEvent,
                FILTROS.map((f) => ({
                  label: f.label,
                  checked: f.id === filtro.id,
                  run: () => setFiltro(f),
                }))
              )
            }
          >
            <span>{filtro.label}</span>
            <Icon name="chevron-down" size={16} />
          </button>
        </div>

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
                      tocar — a única pergunta que se faz olhando uma lista de
                      skills é "qual deles escreve o quê". */}
                  <span className="axxa-tile-paper">
                    <span className="axxa-tile-text">{s.body}</span>
                  </span>
                  <span className="axxa-tile-name">{s.name}</span>
                  <span className="axxa-tile-meta">
                    <Icon
                      name={isChatMode(s.mode) ? MODULES[s.mode].icon : "sparkles"}
                      size={14}
                    />
                    <span>
                      {s.mtime
                        ? `Edited ${relativeShort(new Date(s.mtime).toISOString())}`
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
                      { label: "Edit", icon: "pencil", run: () => editar(s) },
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
          <div className="axxa-home-empty is-tall">
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

        {/* Grudado na base DENTRO do scroller, como nas outras telas: fora
            dele precisaria de um ancestral posicionado, e `.axxa-chat` não é. */}
        <button type="button" className="axxa-fab" onClick={criar}>
          <Icon name="plus" size={20} />
          <span>New skill</span>
        </button>
      </div>

      <SkillSheet
        open={draft !== null}
        editando={editandoPath !== null}
        draft={draft ?? SKILL_DRAFT_VAZIO}
        problema={problema}
        onDraft={setDraft}
        onClose={() => {
          setDraft(null);
          setEditandoPath(null);
        }}
        onSubmit={() => void salvar()}
      />
    </div>
  );
}
