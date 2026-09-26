// src/ui/SkillSheet.tsx
// O FORMULÁRIO de um skill — o conteúdo, não a folha.
//
// Ele já foi uma folha própria. Deixou de ser quando Skills virou uma folha
// inteira (0.6.57): folha dentro de folha não funciona no nosso desenho (a de
// dentro é posicionada pelo painel da de fora e some junto com a rolagem
// dele), e mesmo que funcionasse seriam duas cascas empilhadas pro mesmo
// assunto. Agora ele é um NÍVEL da folha de Skills, como "escolher nota" é um
// nível da folha de projetos.
//
// A ordem das perguntas é a ordem da cabeça de quem cria: primeiro COMO SE
// CHAMA e O QUE ELE ESCREVE — que é o skill inteiro —, e só depois os
// enfeites. Quem parar de responder no meio já tem um skill que funciona.

import { CHAT_MODES } from "../core/session";
import { SKILL_ICONS, type SkillDraft } from "../skills/skillFile";
import { Icon } from "./Icon";
import { MODULES } from "./modules";
import {
  SheetChoices,
  SheetField,
  SheetIconGrid,
  SheetInput,
  SheetSubmit,
  SheetTextarea,
} from "./SheetForm";

export function SkillForm({
  editando,
  draft,
  problema,
  focar,
  onDraft,
  onSubmit,
}: {
  /** Editando um skill que já existe (muda o botão). */
  editando: boolean;
  draft: SkillDraft;
  problema: string | null;
  /** O campo do nome toma o foco (a folha acabou de abrir neste nível). */
  focar: boolean;
  onDraft: (d: SkillDraft) => void;
  onSubmit: () => void;
}) {
  const set = (campo: Partial<SkillDraft>) => onDraft({ ...draft, ...campo });

  return (
    <>
      {/* O skill como ele vai aparecer na lista. Não é enfeite: é o que faz o
          seletor de ícone e a descrição terem sentido antes de salvar —
          senão são dois campos que só se explicam depois. */}
      <div className="axxa-form-preview">
        <span className="axxa-thing-mark" aria-hidden="true">
          <Icon name={draft.icon || "sparkles"} size={20} />
        </span>
        <span className="axxa-thing-text">
          <span className="axxa-thing-name">
            {draft.name.trim() || "Untitled skill"}
          </span>
          <span className="axxa-thing-note">
            {draft.description.trim() ||
              (draft.body.trim()
                ? draft.body.trim().split("\n")[0]
                : "No prompt yet")}
          </span>
        </span>
      </div>

      <SheetField label="Name">
        <SheetInput
          value={draft.name}
          placeholder="Weekly review"
          autoFocus={focar}
          onChange={(name) => set({ name })}
        />
      </SheetField>

      {/* O campo que IMPORTA, e por isso vem antes dos enfeites: sem corpo o
          parser descarta a nota e o skill some da lista no mesmo segundo em
          que foi criado. */}
      <SheetField
        label="Prompt"
        hint="What gets written for you when you use the skill."
      >
        <SheetTextarea
          value={draft.body}
          rows={7}
          placeholder={
            "Go through this week's notes and tell me:\n- what moved\n- what stalled\n- what I should drop"
          }
          onChange={(body) => set({ body })}
        />
      </SheetField>

      <SheetField label="Description" hint="One line, shown in the list.">
        <SheetInput
          value={draft.description}
          placeholder="Optional"
          onChange={(description) => set({ description })}
        />
      </SheetField>

      {/* "Opens in" e não "Mode": o que a pessoa escolhe aqui é ONDE o skill
          vai cair quando ela tocar nele. */}
      <SheetField
        label="Opens in"
        hint="Using the skill switches to this mode."
      >
        <SheetChoices
          label="Mode"
          value={draft.mode}
          onPick={(mode) => set({ mode })}
          items={[
            { id: "", label: "Wherever I am" },
            ...CHAT_MODES.map((m) => ({
              id: m,
              label: MODULES[m].short,
              icon: MODULES[m].icon,
            })),
          ]}
        />
      </SheetField>

      <SheetField label="Icon">
        <SheetIconGrid
          icons={SKILL_ICONS}
          value={draft.icon}
          onPick={(icon) => set({ icon })}
        />
      </SheetField>

      <SheetSubmit
        label={editando ? "Save skill" : "Create skill"}
        problema={problema}
        onSubmit={onSubmit}
      />
    </>
  );
}
