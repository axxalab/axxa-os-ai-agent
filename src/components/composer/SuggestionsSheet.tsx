// src/components/composer/SuggestionsSheet.tsx
// Conteúdo do sheet "See more" dos balões de sugestão — lista COMPLETA por modo
// (SUGGESTIONS, ~12 por modo). A casca é o BottomSheetModal NATIVO (o AxxaApp
// portala este conteúdo pro contentEl). Tap injeta o prompt e fecha.

import { Icon } from "../_shared/Icon";
import { SUGGESTIONS } from "./ComposerSuggestions";

const MODE_TITLE: Record<string, string> = {
  chat: "Chat ideas",
  agent: "Agent actions",
  "vault-qa": "Ask your vault",
};

interface SuggestionsSheetProps {
  mode: string;
  /** Injeta o prompt no editor do composer. */
  onPick: (text: string) => void;
  onClose: () => void;
}

export function SuggestionsSheet({ mode, onPick, onClose }: SuggestionsSheetProps) {
  const items = SUGGESTIONS[mode] ?? SUGGESTIONS.chat;
  const title = MODE_TITLE[mode] ?? "Suggestions";

  return (
    <div className="axxa-suggest-sheet-content">
      {/* TOPO — a casca nativa dá handle/X; aqui só o título centralizado. */}
      <div className="axxa-sheet-top">
        <div className="axxa-sheet-header">
          <span className="axxa-sheet-nav" aria-hidden="true" />
          <span className="axxa-sheet-title">{title}</span>
          <span className="axxa-sheet-nav" aria-hidden="true" />
        </div>
      </div>

      {/* CORPO — grid 2×2: cada sugestão é uma IDEIA, ganha card próprio. */}
      <div className="axxa-sheet-body">
        <div className="axxa-suggest-grid">
          {items.map((s, i) => (
            <button
              key={i}
              type="button"
              className="axxa-suggest-grid-card"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(s.prompt);
                onClose();
              }}
            >
              <span className="axxa-suggest-grid-ico">
                <Icon name={s.icon} />
              </span>
              <span className="axxa-suggest-grid-label">{s.label}</span>
              <span className="axxa-suggest-grid-hint">{s.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
