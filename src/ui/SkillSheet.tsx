// src/ui/SkillSheet.tsx
// A folha de CRIAR (e editar) um skill.
//
// Um skill é uma nota com frontmatter — e até 0.6.48 criar um era isto:
// digitar um nome num modal e cair dentro do editor do Obsidian, com um bloco
// de YAML pela metade e nenhuma pista do que preencher. No telefone, com o
// teclado cobrindo metade da tela, isso não é criar: é ser abandonado.
//
// Aqui a pessoa responde perguntas e o arquivo é problema nosso. A ordem das
// perguntas é a ordem da cabeça de quem cria: primeiro COMO SE CHAMA e O QUE
// ELE ESCREVE — que é o skill inteiro —, e só depois os enfeites. Quem parar
// de responder no meio já tem um skill que funciona.

import { CHAT_MODES } from "../core/session";
import { SKILL_ICONS, type SkillDraft } from "../skills/skillFile";
import { Icon } from "./Icon";
import { MODULES } from "./modules";
import { Sheet } from "./Sheet";
import {
  SheetChoices,
  SheetField,
  SheetIconGrid,
  SheetInput,
  SheetSubmit,
  SheetTextarea,
} from "./SheetForm";

export function SkillSheet({
  open,
  editando,
  draft,
  problema,
  onDraft,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** Editando um skill que já existe (muda título e botão). */
  editando: boolean;
  draft: SkillDraft;
  problema: string | null;
  onDraft: (d: SkillDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const set = (campo: Partial<SkillDraft>) => onDraft({ ...draft, ...campo });

  return (
    <Sheet
      title={editando ? "Edit skill" : "New skill"}
      open={open}
      onClose={onClose}
      // Nasce grande: ela abre com o teclado (o nome pega o foco), e o teclado
      // já come metade da tela — pequena, sobraria um campo à vista.
      startFull
      // O painel não toma o foco: ele roda DEPOIS do campo e apagaria o
      // cursor de dentro do nome (a mesma armadilha da busca).
      focusOnOpen={false}
    >
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
          autoFocus={open}
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
    </Sheet>
  );
}
