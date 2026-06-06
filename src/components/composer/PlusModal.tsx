// src/components/composer/PlusModal.tsx
// Modal estilo ChatGPT mobile — bottom sheet que sobe do rodapé.
// Por enquanto só tem Effort selector. Futuras opções: attach file, screenshot, etc.

import { useEffect } from "react";
import { Icon } from "../_shared/Icon";
import {
  EFFORT_LEVELS,
  EFFORT_LABELS,
  EFFORT_DESCRIPTIONS,
  type EffortLevel,
} from "../_shared/effort";

interface PlusModalProps {
  currentEffort: string;
  onSelectEffort: (level: EffortLevel) => void;
  onClose: () => void;
}

export function PlusModal({ currentEffort, onSelectEffort, onClose }: PlusModalProps) {
  // Fecha com Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="axxa-plus-overlay" onClick={onClose}>
      <div
        className="axxa-plus-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Opções da conversa"
      >
        <div className="axxa-plus-handle" />

        <h3 className="axxa-plus-title">Opções da conversa</h3>

        <div className="axxa-plus-section">
          <div className="axxa-plus-section-head">
            <Icon name="zap" className="axxa-plus-section-icon" />
            <div>
              <div className="axxa-plus-section-title">Effort</div>
              <div className="axxa-plus-section-sub">
                Intensidade do processamento — afeta max_tokens
              </div>
            </div>
          </div>

          <div className="axxa-effort-grid">
            {EFFORT_LEVELS.map((level) => {
              const active = level === currentEffort;
              return (
                <button
                  key={level}
                  type="button"
                  className={
                    "axxa-effort-btn" + (active ? " axxa-effort-active" : "")
                  }
                  onClick={() => {
                    onSelectEffort(level);
                    onClose();
                  }}
                >
                  <span className="axxa-effort-label">{EFFORT_LABELS[level]}</span>
                  <span className="axxa-effort-sub">
                    {EFFORT_DESCRIPTIONS[level]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
