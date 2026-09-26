// src/ui/ProjectSheet.tsx
// O FORMULÁRIO de um projeto — o conteúdo, não a folha (ver SkillSheet.tsx
// pra por que isto deixou de ser uma folha própria na 0.6.57).
//
// Criar um projeto era um modal pedindo o nome, e pronto: ícone e cor eram
// sempre os primeiros da lista, então todo projeto nascia com a mesma cara e a
// grade de 28 ícones que já existia no código nunca chegava à tela. Numa lista
// de seis projetos idênticos, o nome vira a única pista — e a lista inteira
// passa a exigir leitura.
//
// Aqui o projeto se apresenta enquanto é feito: o cartão em cima muda conforme
// se escolhe, e é ele que vai aparecer na lista depois.

import {
  PROJECT_COLORS,
  PROJECT_ICONS,
  projectColor,
  type ProjectDraft,
} from "../projects";
import { Icon } from "./Icon";
import {
  SheetField,
  SheetIconGrid,
  SheetInput,
  SheetSubmit,
  SheetSwatches,
} from "./SheetForm";

export function ProjectForm({
  editando,
  draft,
  problema,
  focar,
  onDraft,
  onSubmit,
}: {
  editando: boolean;
  draft: ProjectDraft;
  problema: string | null;
  focar: boolean;
  onDraft: (d: ProjectDraft) => void;
  onSubmit: () => void;
}) {
  const set = (campo: Partial<ProjectDraft>) => onDraft({ ...draft, ...campo });
  const cor = projectColor(draft.color);

  return (
    <>
      <div className="axxa-form-preview">
        <span
          className="axxa-thing-mark"
          style={{ color: cor }}
          aria-hidden="true"
        >
          <Icon name={draft.icon} size={20} />
        </span>
        <span className="axxa-thing-text">
          <span className="axxa-thing-name">
            {draft.name.trim() || "Untitled project"}
          </span>
          <span className="axxa-thing-note">No notes yet · no chats yet</span>
        </span>
      </div>

      <SheetField label="Name">
        <SheetInput
          value={draft.name}
          placeholder="Thesis, Client X, Apartment…"
          autoFocus={focar}
          onChange={(name) => set({ name })}
        />
      </SheetField>

      <SheetField label="Color">
        <SheetSwatches
          colors={PROJECT_COLORS}
          value={draft.color}
          resolve={projectColor}
          onPick={(color) => set({ color })}
        />
      </SheetField>

      <SheetField label="Icon">
        <SheetIconGrid
          icons={PROJECT_ICONS}
          value={draft.icon}
          tint={cor}
          onPick={(icon) => set({ icon })}
        />
      </SheetField>

      <SheetSubmit
        label={editando ? "Save project" : "Create project"}
        problema={problema}
        onSubmit={onSubmit}
      />
    </>
  );
}
