// src/components/composer/ComposerSuggestions.tsx
// "Balões" de sugestão da NOVA conversa — UM estilo por modo (ref prints):
//   chat     → linhas ícone+label, sem card        (ref ChatGPT)
//   agent    → cards horizontais ícone-em-cima      (ref Gemini)
//   vault-qa → balões simples (pill): borda+sombra, ícone+título (separados)
//
// O CONTEÚDO segue a FUNÇÃO real de cada modo (não é cópia de outro app):
//   chat     = conversa direta, sem tools/RAG → ajudas gerais de escrita/raciocínio
//   agent    = LÊ e EDITA o vault (tools vault_create/edit/move/search/…) → ações reais
//   vault-qa = responde usando suas NOTAS como contexto (RAG) → perguntas ao vault
// (mesma voz dos prompt-starters já existentes no i18n: en-us.ts → starter.suggestions)
//
// Tap injeta o prompt no editor (onPick) mantendo o foco/teclado. Quem gateia a
// visibilidade (chat vazio + editor vazio) é o AxxaApp.

import { Icon } from "../_shared/Icon";

interface Suggestion {
  /** Ícone Lucide. */
  icon: string;
  /** Título curto da ação. */
  label: string;
  /** Prefixo injetado no editor ao tocar (o user completa). */
  prompt: string;
}

const SUGGESTIONS: Record<string, Suggestion[]> = {
  // CHAT = conversa direta (sem tools/RAG): o modelo pensa/escreve com você.
  chat: [
    { icon: "align-left", label: "Summarize a text", prompt: "Summarize this text: " },
    { icon: "lightbulb", label: "Explain it simply", prompt: "Explain it simply: " },
    { icon: "pen-line", label: "Draft a plan", prompt: "Draft a plan for " },
  ],
  // AGENT = lê e edita o vault com tools reais (vault_create/move/edit/search…).
  agent: [
    { icon: "file-plus", label: "Create a note", prompt: "Create a note about " },
    { icon: "folder-tree", label: "Organize folder", prompt: "Organize the folder " },
    { icon: "list-todo", label: "List to-dos", prompt: "List the to-dos in " },
  ],
  // VAULT QA = responde a partir das suas notas (RAG): perguntas ao próprio vault.
  "vault-qa": [
    { icon: "search", label: "Ask my notes", prompt: "What do my notes say about " },
    { icon: "waypoints", label: "Connect ideas", prompt: "Connect ideas across " },
    { icon: "file-text", label: "Summarize notes", prompt: "Summarize my notes on " },
  ],
};

interface ComposerSuggestionsProps {
  mode: string;
  /** Injeta o prompt no editor (e mantém o foco). */
  onPick: (text: string) => void;
}

export function ComposerSuggestions({ mode, onPick }: ComposerSuggestionsProps) {
  const items = SUGGESTIONS[mode] ?? SUGGESTIONS.chat;
  if (!items.length) return null;

  // preventDefault no mousedown = não rouba o foco do editor → teclado fica de pé.
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

  // CHAT — linhas verticais (ícone + label), sem fundo de card.
  if (mode === "chat") {
    return (
      <div className="axxa-suggest axxa-suggest-rows" data-mode={mode}>
        {items.map((s, i) => (
          <button
            key={i}
            type="button"
            className="axxa-suggest-row"
            onMouseDown={keepFocus}
            onClick={() => onPick(s.prompt)}
          >
            <span className="axxa-suggest-row-ico">
              <Icon name={s.icon} />
            </span>
            <span className="axxa-suggest-row-label">{s.label}</span>
          </button>
        ))}
      </div>
    );
  }

  // VAULT QA — balões simples separados: pill com borda+sombra, ícone + título.
  if (mode === "vault-qa") {
    return (
      <div className="axxa-suggest axxa-suggest-bubbles" data-mode={mode}>
        {items.map((s, i) => (
          <button
            key={i}
            type="button"
            className="axxa-suggest-bubble"
            onMouseDown={keepFocus}
            onClick={() => onPick(s.prompt)}
          >
            <span className="axxa-suggest-bubble-ico">
              <Icon name={s.icon} />
            </span>
            <span className="axxa-suggest-bubble-label">{s.label}</span>
          </button>
        ))}
      </div>
    );
  }

  // AGENT (+ fallback) — cards horizontais (ícone em cima, label embaixo).
  return (
    <div className="axxa-suggest axxa-suggest-cards" data-mode={mode}>
      {items.map((s, i) => (
        <button
          key={i}
          type="button"
          className="axxa-suggest-card"
          onMouseDown={keepFocus}
          onClick={() => onPick(s.prompt)}
        >
          <span className="axxa-suggest-card-ico">
            <Icon name={s.icon} />
          </span>
          <span className="axxa-suggest-card-label">{s.label}</span>
        </button>
      ))}
    </div>
  );
}
