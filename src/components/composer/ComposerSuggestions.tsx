// src/components/composer/ComposerSuggestions.tsx
// "Balões" de sugestão da NOVA conversa — UM estilo por modo:
//   chat → linhas ícone+label · agent → cards horizontais · vault-qa → pills.
//
// Cada modo mostra as PRIMEIRAS sugestões (VISIBLE_COUNT) + um "See more" que
// abre um bottom sheet com a lista completa (SUGGESTIONS, 10+ por modo). O
// conteúdo segue a FUNÇÃO real de cada modo neste plugin (não é cópia):
//   chat     = conversa direta, sem tools/RAG → escrita/raciocínio
//   agent    = LÊ e EDITA o vault (tools vault_create/edit/move/search…) → ações
//   vault-qa = responde a partir das NOTAS (RAG) → perguntas ao vault
// Tap injeta o prompt no editor (onPick) mantendo o foco/teclado.

import { Icon } from "../_shared/Icon";

export interface Suggestion {
  /** Ícone Lucide. */
  icon: string;
  /** Título curto da ação. */
  label: string;
  /** Prefixo injetado no editor ao tocar (o user completa). */
  prompt: string;
  /** Linha de apoio (só no bottom sheet) — desperta a ideia. */
  hint: string;
}

/** Lista COMPLETA por modo (as 3 primeiras aparecem no corpo; todas no sheet). */
export const SUGGESTIONS: Record<string, Suggestion[]> = {
  // CHAT — conversa direta: o modelo pensa/escreve com você (sem tocar no vault).
  chat: [
    { icon: "align-left", label: "Summarize a text", prompt: "Summarize this text:\n", hint: "Condense anything you paste" },
    { icon: "lightbulb", label: "Explain it simply", prompt: "Explain it simply: ", hint: "Plain-language breakdown" },
    { icon: "pen-line", label: "Draft a plan", prompt: "Draft a plan for ", hint: "Step-by-step for any goal" },
    { icon: "sparkles", label: "Brainstorm ideas", prompt: "Brainstorm ideas for ", hint: "Spark new directions" },
    { icon: "list", label: "Make an outline", prompt: "Make an outline for ", hint: "Structure before you write" },
    { icon: "wand", label: "Improve my writing", prompt: "Improve this writing:\n", hint: "Tighter, clearer prose" },
    { icon: "globe", label: "Translate a passage", prompt: "Translate this: ", hint: "Into any language" },
    { icon: "scissors", label: "Make it concise", prompt: "Rewrite this more concisely:\n", hint: "Cut the fluff" },
    { icon: "scale", label: "Pros and cons", prompt: "Give me the pros and cons of ", hint: "Weigh a decision" },
    { icon: "graduation-cap", label: "Teach me a topic", prompt: "Teach me about ", hint: "Learn something new" },
    { icon: "help-circle", label: "Questions to explore", prompt: "What questions should I explore about ", hint: "Find the angles" },
    { icon: "mail", label: "Draft an email", prompt: "Draft an email about ", hint: "Professional or casual" },
  ],
  // AGENT — lê e edita o vault com ferramentas reais (vault_create/move/edit/search).
  agent: [
    { icon: "file-plus", label: "Create a note", prompt: "Create a note about ", hint: "New note from a topic" },
    { icon: "folder-tree", label: "Organize a folder", prompt: "Organize the folder ", hint: "Tidy and structure files" },
    { icon: "list-todo", label: "List to-dos", prompt: "List the open to-dos in ", hint: "Collect tasks across notes" },
    { icon: "git-merge", label: "Merge duplicates", prompt: "Find and merge duplicate notes about ", hint: "Dedupe your vault" },
    { icon: "tags", label: "Tag a note", prompt: "Suggest and add tags to ", hint: "Consistent tagging" },
    { icon: "calendar", label: "Daily note", prompt: "Create today's daily note with ", hint: "Start the day" },
    { icon: "network", label: "Build a map of content", prompt: "Build a map of content (MOC) for ", hint: "Index a topic" },
    { icon: "link", label: "Link related notes", prompt: "Find and link notes related to ", hint: "Weave your graph" },
    { icon: "list-checks", label: "Extract action items", prompt: "Extract the action items from ", hint: "Into a task list" },
    { icon: "pencil", label: "Rewrite a note", prompt: "Rewrite the note ", hint: "Edit it in place" },
    { icon: "eraser", label: "Clean up formatting", prompt: "Clean up the formatting of ", hint: "Fix headings & lists" },
    { icon: "folder-plus", label: "Scaffold a project", prompt: "Set up a project folder for ", hint: "Notes & structure ready" },
  ],
  // VAULT QA — responde a partir das suas notas (RAG): perguntas ao próprio vault.
  "vault-qa": [
    { icon: "search", label: "Ask my notes", prompt: "What do my notes say about ", hint: "Answers from your vault" },
    { icon: "waypoints", label: "Connect ideas", prompt: "Connect ideas across my notes on ", hint: "Find hidden links" },
    { icon: "file-text", label: "Summarize notes", prompt: "Summarize my notes on ", hint: "The gist of a topic" },
    { icon: "git-compare", label: "Compare topics", prompt: "Compare what my notes say about ", hint: "Two ideas side by side" },
    { icon: "history", label: "Recap recent notes", prompt: "Recap what I wrote recently about ", hint: "Catch up fast" },
    { icon: "help-circle", label: "My open questions", prompt: "What open questions remain in my notes about ", hint: "Surface the gaps" },
    { icon: "quote", label: "Find a passage", prompt: "Find where my notes mention ", hint: "Locate a quote" },
    { icon: "trending-up", label: "Key takeaways", prompt: "What are the key takeaways from my notes on ", hint: "The essentials" },
    { icon: "alert-triangle", label: "Find contradictions", prompt: "Find contradictions in my notes about ", hint: "Spot conflicts" },
    { icon: "lightbulb", label: "Rediscover notes", prompt: "Surface forgotten notes related to ", hint: "Old ideas, resurfaced" },
    { icon: "calendar", label: "Timeline of a topic", prompt: "Build a timeline from my notes on ", hint: "How it evolved" },
    { icon: "check-circle", label: "Find evidence", prompt: "Find evidence in my notes for ", hint: "Back up a claim" },
  ],
};

/** Quantas aparecem direto no corpo (o resto fica no "See more"). */
const VISIBLE_COUNT = 3;

interface ComposerSuggestionsProps {
  mode: string;
  /** Injeta o prompt no editor (e mantém o foco). */
  onPick: (text: string) => void;
  /** Abre o bottom sheet com a lista completa do modo. */
  onSeeMore: () => void;
}

export function ComposerSuggestions({ mode, onPick, onSeeMore }: ComposerSuggestionsProps) {
  const all = SUGGESTIONS[mode] ?? SUGGESTIONS.chat;
  const items = all.slice(0, VISIBLE_COUNT);
  if (!items.length) return null;

  // preventDefault no mousedown = não rouba o foco do editor → teclado fica de pé.
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

  // CHAT — linhas verticais (ícone + label), sem fundo de card.
  if (mode === "chat") {
    return (
      <div className="axxa-suggest axxa-suggest-rows" data-mode={mode}>
        {items.map((s, i) => (
          <button key={i} type="button" className="axxa-suggest-row" onMouseDown={keepFocus} onClick={() => onPick(s.prompt)}>
            <span className="axxa-suggest-row-ico"><Icon name={s.icon} /></span>
            <span className="axxa-suggest-row-label">{s.label}</span>
          </button>
        ))}
        <button type="button" className="axxa-suggest-row axxa-suggest-more" onMouseDown={keepFocus} onClick={onSeeMore}>
          <span className="axxa-suggest-row-ico"><Icon name="chevron-down" /></span>
          <span className="axxa-suggest-row-label">See more</span>
        </button>
      </div>
    );
  }

  // VAULT QA — pills simples (borda + sombra, ícone + título), separados.
  if (mode === "vault-qa") {
    return (
      <div className="axxa-suggest axxa-suggest-bubbles" data-mode={mode}>
        {items.map((s, i) => (
          <button key={i} type="button" className="axxa-suggest-bubble" onMouseDown={keepFocus} onClick={() => onPick(s.prompt)}>
            <span className="axxa-suggest-bubble-ico"><Icon name={s.icon} /></span>
            <span className="axxa-suggest-bubble-label">{s.label}</span>
          </button>
        ))}
        <button type="button" className="axxa-suggest-bubble axxa-suggest-more" onMouseDown={keepFocus} onClick={onSeeMore}>
          <span className="axxa-suggest-bubble-ico"><Icon name="chevron-down" /></span>
          <span className="axxa-suggest-bubble-label">See more</span>
        </button>
      </div>
    );
  }

  // AGENT (+ fallback) — cards horizontais (ícone em cima, label embaixo).
  return (
    <div className="axxa-suggest axxa-suggest-cards" data-mode={mode}>
      {items.map((s, i) => (
        <button key={i} type="button" className="axxa-suggest-card" onMouseDown={keepFocus} onClick={() => onPick(s.prompt)}>
          <span className="axxa-suggest-card-ico"><Icon name={s.icon} /></span>
          <span className="axxa-suggest-card-label">{s.label}</span>
        </button>
      ))}
      <button type="button" className="axxa-suggest-card axxa-suggest-more" onMouseDown={keepFocus} onClick={onSeeMore}>
        <span className="axxa-suggest-card-ico"><Icon name="chevron-down" /></span>
        <span className="axxa-suggest-card-label">See more</span>
      </button>
    </div>
  );
}
