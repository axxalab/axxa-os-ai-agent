// src/components/composer/ComposerSuggestions.tsx
// "Balões" de sugestão acima do composer, no estado de chat vazio (nova conversa).
// UM estilo POR MODO, fiel aos prints (2026-06-15, pasta print/):
//   chat     → linhas verticais ícone + label, sem card     (ref ChatGPT)
//   agent    → cards horizontais ícone-em-cima + label       (ref Gemini)
//   vault-qa → cards de 2 linhas título + subtítulo, sem ícone (ref ChatGPT)
// Tap injeta o prompt no editor (onPick, mantém o foco/teclado) ou dispara uma
// ação especial (ex.: abrir o modo Voz). Some assim que o editor deixa de estar
// vazio — quem gateia é o Composer (isEmpty interno).

import { Icon } from "../_shared/Icon";

interface Suggestion {
  /** Ícone Lucide (chat/agent). Vault-qa não usa. */
  icon?: string;
  /** Linha principal — label (chat/agent) ou título (vault-qa). */
  label: string;
  /** Subtítulo — só vault-qa (segunda linha, muted). */
  sub?: string;
  /** Texto injetado no editor ao tocar (prefixo pro user completar). */
  prompt?: string;
  /** Ação especial em vez de injetar texto. */
  action?: "voice";
}

// Conteúdo por modo. Prefixos curtos pro user completar; o foco aqui é o visual
// + o mapeamento de modo (cada print tem o nome do modo em azul).
const SUGGESTIONS: Record<string, Suggestion[]> = {
  chat: [
    { icon: "image", label: "Create an image", prompt: "Create an image of " },
    { icon: "pen-line", label: "Write or edit", prompt: "Help me write " },
    { icon: "globe", label: "Look something up", prompt: "Look up " },
  ],
  agent: [
    { icon: "images", label: "Create images", prompt: "Create an image of " },
    { icon: "pencil", label: "Edit a note", prompt: "Edit the note: " },
    { icon: "audio-lines", label: "Try voice mode", action: "voice" },
  ],
  "vault-qa": [
    {
      label: "Summarize a note",
      sub: "in three bullet points",
      prompt: "Summarize this note in three bullet points.",
    },
    {
      label: "Find related notes",
      sub: "on this topic",
      prompt: "Which notes in my vault relate to this topic?",
    },
  ],
};

interface ComposerSuggestionsProps {
  mode: string;
  /** Injeta o prompt no editor (e mantém o foco). */
  onPick: (text: string) => void;
  /** Abre o modo Voz (card "Try voice mode" do Agent). */
  onVoice?: () => void;
}

export function ComposerSuggestions({
  mode,
  onPick,
  onVoice,
}: ComposerSuggestionsProps) {
  const items = SUGGESTIONS[mode] ?? SUGGESTIONS.chat;
  if (!items.length) return null;

  const run = (s: Suggestion) => {
    if (s.action === "voice") {
      onVoice?.();
      return;
    }
    if (s.prompt) onPick(s.prompt);
  };

  // CHAT — linhas verticais (ícone + label), sem fundo de card.
  if (mode === "chat") {
    return (
      <div className="axxa-suggest axxa-suggest-rows" data-mode={mode}>
        {items.map((s, i) => (
          <button
            key={i}
            type="button"
            className="axxa-suggest-row"
            // preventDefault no mousedown = não rouba o foco do editor → teclado fica
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(s)}
          >
            {s.icon && (
              <span className="axxa-suggest-row-ico">
                <Icon name={s.icon} />
              </span>
            )}
            <span className="axxa-suggest-row-label">{s.label}</span>
          </button>
        ))}
      </div>
    );
  }

  // VAULT QA — cards de 2 linhas (título + subtítulo), sem ícone.
  if (mode === "vault-qa") {
    return (
      <div className="axxa-suggest axxa-suggest-cards2" data-mode={mode}>
        {items.map((s, i) => (
          <button
            key={i}
            type="button"
            className="axxa-suggest-card2"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(s)}
          >
            <span className="axxa-suggest-card2-title">{s.label}</span>
            {s.sub && <span className="axxa-suggest-card2-sub">{s.sub}</span>}
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
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run(s)}
        >
          {s.icon && (
            <span className="axxa-suggest-card-ico">
              <Icon name={s.icon} />
            </span>
          )}
          <span className="axxa-suggest-card-label">{s.label}</span>
        </button>
      ))}
    </div>
  );
}
