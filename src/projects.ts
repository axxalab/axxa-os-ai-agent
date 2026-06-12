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
