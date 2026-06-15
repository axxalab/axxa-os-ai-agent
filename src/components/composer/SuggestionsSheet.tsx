// src/components/composer/SuggestionsSheet.tsx
// Bottom sheet "See more" dos balões de sugestão — lista COMPLETA por modo
// (SUGGESTIONS, ~12 por modo). Reaproveita o shell .axxa-plus-sheet + as rows
// .axxa-sheet-row (ícone + título + hint) e o hook useBottomSheet (2 estados,
// arrasta, segue a UX LAW dos bottom sheets). Tap injeta o prompt e fecha.

import { useRef } from "react";
import { Icon } from "../_shared/Icon";
import { useFocusTrap } from "../_shared/useFocusTrap";
import { useBottomSheet } from "../_shared/useBottomSheet";
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
  const sheetRef = useRef<HTMLDivElement>(null);
  // autoFocus:false → não rouba o foco do editor (teclado segue, volta ao fechar).
  useFocusTrap(sheetRef, { onEscape: onClose, autoFocus: false });
  const sheet = useBottomSheet(onClose);

  const title = MODE_TITLE[mode] ?? "Suggestions";

  return (
    <div className="axxa-plus-overlay" onClick={onClose}>
      <div
        ref={sheetRef}
        className={"axxa-plus-sheet axxa-sheet" + sheet.sheetClass}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={title}
      >
        {/* TOPO FIXO (handle + header) — toggle: tap/drag alterna opened↔full. */}
        <div className="axxa-sheet-top" {...sheet.topProps}>
          <div className="axxa-plus-handle" />
          <div className="axxa-sheet-header">
            <button
              type="button"
              className="axxa-sheet-nav"
              onClick={onClose}
              aria-label="Close"
            >
              <Icon name="x" />
            </button>
            <span className="axxa-sheet-title">{title}</span>
            <span className="axxa-sheet-nav" aria-hidden="true" />
          </div>
        </div>

        {/* CORPO ROLÁVEL — overscroll nas 2 pontas (touch, via bodyRef). */}
        <div className="axxa-sheet-body" ref={sheet.bodyRef}>
          <div className="axxa-sheet-list axxa-sheet-list-compact">
            {items.map((s, i) => (
              <button
                key={i}
                type="button"
                className="axxa-sheet-row"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(s.prompt);
                  onClose();
                }}
              >
                <span className="axxa-suggest-sheet-ico">
                  <Icon name={s.icon} />
                </span>
                <span className="axxa-sheet-row-text">
                  <span className="axxa-sheet-row-name">{s.label}</span>
                  <span className="axxa-sheet-row-desc">{s.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
