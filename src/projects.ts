// src/projects.ts
// Projetos (ref: ChatGPT iOS 182/187/189). Um projeto agrupa conversas +
// "fontes" (notas do vault que viram contexto). Persistido em
// plugin.settings.projects — NÃO mexe no schema das conversas: a associação
// chat↔projeto vive em project.chatIds, e as fontes são anexadas como notas
// quando o user começa uma conversa dentro do projeto.

export interface Project {
  id: string;
  name: string;
  /** Nome de ícone Lucide. */
  icon: string;
  /** Cor (hex ou "default"). */
  color: string;
  /** Caminhos de notas do vault pinadas como fontes/contexto. */
  sources: string[];
  /** IDs das conversas criadas dentro do projeto. */
  chatIds: string[];
  createdAt: string;
}

// Grade de ícones do picker (ref: ChatGPT iOS 189).
export const PROJECT_ICONS: string[] = [
  "folder", "dollar-sign", "book", "graduation-cap", "pencil", "feather",
  "braces", "terminal", "music", "trash-2", "scissors", "palette",
  "stethoscope", "flower", "leaf", "briefcase", "bar-chart-3", "dumbbell",
  "clipboard", "scale", "globe", "plane", "wrench", "paw-print",
  "flask-conical", "brain", "heart", "sprout",
];

// Swatches de cor (ref: ChatGPT iOS 189): default + 6 cores.
export const PROJECT_COLORS: string[] = [
  "default", "#e5484d", "#e5734d", "#e5b54d", "#46a758", "#4361ee", "#a370f7",
];

/** Resolve a cor de um projeto pra um valor CSS usável. */
export function projectColor(color: string): string {
  return color === "default" ? "var(--text-normal)" : color;
}

export function makeProjectId(): string {
  // Sem Date.now()/random colisão — id estável o suficiente pra settings.
  return "proj-" + Math.random().toString(36).slice(2, 10);
}

// ── O formulário ────────────────────────────────────────────────────────────
// Criar um projeto pedia só o nome, e o ícone e a cor eram sempre os
// primeiros da lista — ou seja: todo projeto nascia igual, e a grade de 28
// ícones que já existia aqui nunca chegava a aparecer. O rascunho abaixo é o
// que a folha coleta.

export interface ProjectDraft {
  name: string;
  icon: string;
  color: string;
}

export const PROJECT_DRAFT_VAZIO: ProjectDraft = {
  name: "",
  icon: PROJECT_ICONS[0],
  color: PROJECT_COLORS[0],
};

/**
 * O que impede de salvar — ou null quando está pronto.
 *
 * Nome repetido não é erro de arquivo (projeto mora nas settings, não no
 * vault): é erro de gente. Dois "Cliente" na lista e não há como saber em
 * qual deles está a nota que você pinou ontem.
 */
export function projectProblema(
  d: ProjectDraft,
  existentes: readonly Project[],
  /** O projeto sendo editado — ele não colide consigo mesmo. */
  atualId?: string
): string | null {
  const nome = d.name.trim();
  if (!nome) return "Give it a name.";
  const colide = existentes.some(
    (p) => p.id !== atualId && p.name.trim().toLowerCase() === nome.toLowerCase()
  );
  if (colide) return "There is already a project with that name.";
  return null;
}
