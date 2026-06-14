// src/components/composer/ModelSheet.tsx
// Bottom sheet do seletor de modelo + effort (DS 1.0, ref: prints do Claude).
// Dois "ecrãs" na MESMA folha (navegação interna):
//   1. "Select model" — X · lista de modelos (nome + tagline EN, selecionado =
//      accent + check) · linha "Effort ›" (abre o ecrã 2) · "More models ›".
//   2. "Effort" — ‹ voltar · níveis low→max (Default badge no baseline, check no
//      atual) · toggle "Thinking".
// Reaproveita o shell do bottom-sheet do PlusModal (overlay/sheet/handle/divider/
// switch) e o focus-trap; rows novas no tamanho de linha dos prints.

import { useRef, useState } from "react";
import { Icon } from "../_shared/Icon";
import { useFocusTrap } from "../_shared/useFocusTrap";
import {
  EFFORT_LEVELS,
  EFFORT_LABELS,
  type EffortLevel,
} from "../_shared/effort";
import {
  getModelFullInfo,
  localizedDescription,
} from "../../providers/modelDescriptions";

// Taglines limpas (estilo print) — uma frase por nível, sem jargão técnico.
const EFFORT_TAGLINES: Record<EffortLevel, string> = {
  low: "Quick replies to simple questions",
  med: "Balanced for everyday work",
  high: "Complex, detailed work",
  xhigh: "Deep, thorough analysis",
  max: "The hardest problems. Takes longest.",
};

// Nível marcado como "Default" — baseline fixo (fallback real do resolveEffortConfig),
// independente da seleção atual pra o badge não colidir com o check.
const DEFAULT_EFFORT: EffortLevel = "med";

/** Formata um id de modelo cru num nome apresentável (fallback). */
function prettyModelName(id: string): string {
  let s = id || "";
  if (s.includes("/")) s = s.slice(s.lastIndexOf("/") + 1);
  s = s.replace(/^(claude-|models-)/, "");
  s = s.replace(/(\d)-(\d)/g, "$1.$2"); // versões: 4-8 → 4.8
  s = s.replace(/[-_]/g, " ").trim();
  return s
    .split(/\s+/)
    .map((w) => {
      if (/^gpt$/i.test(w)) return "GPT";
      if (/^\d/.test(w)) return w; // números de versão / 4o
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/** Nome + tagline de um modelo: extrai do "Nome — desc" curado em EN, senão
 *  prettifica o id e usa a descrição inteira. */
function modelBits(
  provider: string,
  model: string,
  lang: string
): { name: string; tagline: string } {
  const info = getModelFullInfo(provider, model);
  const desc = localizedDescription(info, model, lang) || "";
  const m = desc.match(/^(.{1,26}?)\s+[—–-]\s+(.+)$/);
  if (m && m[1] && m[2]) {
    return { name: m[1].trim(), tagline: m[2].trim() };
  }
  return { name: prettyModelName(model), tagline: desc };
}

interface ModelSheetProps {
  provider: string;
  /** IDs dos modelos ativos do provider atual. */
  models: string[];
  currentModel: string;
  onSelectModel: (model: string) => void;
  currentEffort: string;
  onSelectEffort: (level: EffortLevel) => void;
  thinkingOn: boolean;
  onToggleThinking: (value: boolean) => void;
  onClose: () => void;
  /** Abre a gestão completa de modelos (Settings). */
  onMoreModels?: () => void;
  /** Locale pras descrições — app é EN-only hoje. */
  lang?: string;
}

export function ModelSheet({
  provider,
  models,
  currentModel,
  onSelectModel,
  currentEffort,
  onSelectEffort,
  thinkingOn,
  onToggleThinking,
  onClose,
  onMoreModels,
  lang = "en-US",
}: ModelSheetProps) {
  const [view, setView] = useState<"model" | "effort">("model");
  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusTrap(sheetRef, { onEscape: onClose });

  const effortLabel =
    EFFORT_LABELS[currentEffort as EffortLevel] ?? currentEffort;

  return (
    <div className="axxa-plus-overlay" onClick={onClose}>
      <div
        ref={sheetRef}
        className="axxa-plus-sheet axxa-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={view === "model" ? "Select model" : "Effort"}
      >
        <div className="axxa-plus-handle" />

        {view === "model" ? (
          <>
            <div className="axxa-sheet-header">
              <button
                type="button"
                className="axxa-sheet-nav"
                onClick={onClose}
                aria-label="Close"
              >
                <Icon name="x" />
              </button>
              <span className="axxa-sheet-title">Select model</span>
              <span className="axxa-sheet-nav" aria-hidden="true" />
            </div>

            <div className="axxa-sheet-list">
              {models.length === 0 && (
                <div className="axxa-sheet-empty">
                  No models for this provider yet.
                </div>
              )}
              {models.map((m) => {
                const { name, tagline } = modelBits(provider, m, lang);
                const selected = m === currentModel;
                return (
                  <button
                    key={m}
                    type="button"
                    className={
                      "axxa-sheet-row" +
                      (selected ? " axxa-sheet-row-on" : "")
                    }
                    onClick={() => {
                      onSelectModel(m);
                      onClose();
                    }}
                  >
                    <span className="axxa-sheet-row-text">
                      <span className="axxa-sheet-row-name">{name}</span>
                      {tagline && (
                        <span className="axxa-sheet-row-desc">{tagline}</span>
                      )}
                    </span>
                    {selected && (
                      <span className="axxa-sheet-row-check">
                        <Icon name="check" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="axxa-plus-divider" />
            <button
              type="button"
              className="axxa-sheet-row"
              onClick={() => setView("effort")}
            >
              <span className="axxa-sheet-row-text">
                <span className="axxa-sheet-row-name">Effort</span>
                <span className="axxa-sheet-row-desc">{effortLabel}</span>
              </span>
              <span className="axxa-sheet-row-chevron">
                <Icon name="chevron-right" />
              </span>
            </button>

            {onMoreModels && (
              <>
                <div className="axxa-plus-divider" />
                <button
                  type="button"
                  className="axxa-sheet-row"
                  onClick={() => {
                    onMoreModels();
                    onClose();
                  }}
                >
                  <span className="axxa-sheet-row-text">
                    <span className="axxa-sheet-row-name">More models</span>
                  </span>
                  <span className="axxa-sheet-row-chevron">
                    <Icon name="chevron-right" />
                  </span>
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <div className="axxa-sheet-header">
              <button
                type="button"
                className="axxa-sheet-nav"
                onClick={() => setView("model")}
                aria-label="Back"
              >
                <Icon name="arrow-left" />
              </button>
              <span className="axxa-sheet-title">Effort</span>
              <span className="axxa-sheet-nav" aria-hidden="true" />
            </div>

            <div className="axxa-sheet-list">
              {EFFORT_LEVELS.map((lvl) => {
                const selected = lvl === currentEffort;
                return (
                  <button
                    key={lvl}
                    type="button"
                    className={
                      "axxa-sheet-row" +
                      (selected ? " axxa-sheet-row-on" : "")
                    }
                    onClick={() => onSelectEffort(lvl)}
                  >
                    <span className="axxa-sheet-row-text">
                      <span className="axxa-sheet-row-name">
                        {EFFORT_LABELS[lvl]}
                        {lvl === DEFAULT_EFFORT && (
                          <span className="axxa-sheet-badge">Default</span>
                        )}
                      </span>
                      <span className="axxa-sheet-row-desc">
                        {EFFORT_TAGLINES[lvl]}
                      </span>
                    </span>
                    {selected && (
                      <span className="axxa-sheet-row-check">
                        <Icon name="check" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="axxa-plus-divider" />
            <div
              className="axxa-sheet-row"
              role="button"
              tabIndex={0}
              onClick={() => onToggleThinking(!thinkingOn)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggleThinking(!thinkingOn);
                }
              }}
            >
              <span className="axxa-sheet-row-text">
                <span className="axxa-sheet-row-name">Thinking</span>
                <span className="axxa-sheet-row-desc">
                  Can think for more complex tasks
                </span>
              </span>
              <span
                className={
                  "axxa-plus-row-switch" +
                  (thinkingOn ? " axxa-plus-row-switch-on" : "")
                }
                role="switch"
                aria-checked={thinkingOn}
              >
                <span className="axxa-plus-row-switch-thumb" />
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
