// src/components/composer/PlusModal.tsx
// Modal estilo ChatGPT mobile — bottom sheet que sobe do rodapé.
// Seções:
//   - Anexar arquivo (em breve — placeholder visual, funcional no Módulo 5)
//   - Effort (intensidade do processamento)
// Futuras: screenshot, voice note, etc.

import { useEffect } from "react";
import { Notice } from "obsidian";
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

        {/* Anexar arquivo — UI placeholder, funcional no Módulo 5 */}
        <div className="axxa-plus-section axxa-plus-section-soon">
          <div className="axxa-plus-section-head">
            <Icon name="paperclip" className="axxa-plus-section-icon" />
            <div>
              <div className="axxa-plus-section-title">
                Anexar arquivo
                <span className="axxa-plus-soon-badge">em breve</span>
              </div>
              <div className="axxa-plus-section-sub">
                PDFs, imagens, notas do vault — virão no Módulo 5
              </div>
            </div>
          </div>
          <div className="axxa-plus-attach-grid">
            <button
              type="button"
              className="axxa-plus-attach-btn"
              disabled
              title="Em breve — anexar PDF"
              onClick={() => new Notice("Anexar PDF vem no Módulo 5")}
            >
              <Icon name="file-text" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              className="axxa-plus-attach-btn"
              disabled
              title="Em breve — anexar imagem"
              onClick={() => new Notice("Anexar imagem vem no Módulo 5")}
            >
              <Icon name="image" />
              <span>Imagem</span>
            </button>
            <button
              type="button"
              className="axxa-plus-attach-btn"
              disabled
              title="Em breve — referenciar nota do vault"
              onClick={() => new Notice("Referenciar nota vem no Módulo 5")}
            >
              <Icon name="file" />
              <span>Nota</span>
            </button>
          </div>
        </div>

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
