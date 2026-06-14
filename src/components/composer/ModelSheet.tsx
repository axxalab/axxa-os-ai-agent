// src/components/composer/ModelSheet.tsx
// Bottom sheet do seletor de modelo (DS 1.0, ref: prints do Claude).
// TRÊS ecrãs na MESMA folha (navegação interna):
//   1. "Select model"  — só os FAVORITOS (≤5) do provider. Sem favorito → mensagem
//      instrutiva (tap abre o ecrã 3). Com favorito → rows + "+ Add models" (ecrã 3).
//      Sempre: linha "Effort ›" (ecrã 2).
//   2. "Effort"        — níveis low→max (Default badge no baseline, check no atual)
//      + toggle "Thinking".
//   3. "More models"   — os modelos ADICIONADOS (activeModels) do provider, com
//      chips por categoria (+ aba Free quando houver, categorias vazias ocultas).
//      Cada row tem estrela: favoritar sobe pro topo; ao chegar a 5, trava o resto.
//      Tap na row (fora da estrela) seleciona o modelo.
// Reaproveita o shell .axxa-plus-overlay/-sheet/-handle/-divider + o focus-trap.

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
  groupModelsByCategory,
  CATEGORY_ORDER,
  type ModelCategory,
} from "../../providers/modelDescriptions";
import { getModelCapabilities } from "../../providers/modelCapabilities";

/** Máximo de favoritos por provider. */
const MAX_FAVORITES = 5;

// Taglines limpas (estilo print) — uma frase por nível, sem jargão técnico.
const EFFORT_TAGLINES: Record<EffortLevel, string> = {
  low: "Quick replies to simple questions",
  med: "Balanced for everyday work",
  high: "Complex, detailed work",
  xhigh: "Deep, thorough analysis",
  max: "The hardest problems. Takes longest.",
};

// Nível "Default" — baseline fixo (fallback do resolveEffortConfig), separado do
// check da seleção atual pra os dois não colidirem.
const DEFAULT_EFFORT: EffortLevel = "med";

// Labels EN das categorias (CATEGORY_LABELS no core ainda é PT) — chips do More.
const CAT_LABELS_EN: Record<ModelCategory, string> = {
  "chat-vision": "Multimodal",
  "chat-text": "Chat",
  reasoning: "Reasoning",
  agent: "Agent",
  "image-gen": "Image",
  "audio-gen": "Audio",
  "video-gen": "Video",
  embedding: "Embedding",
  other: "Other",
};

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
  /** IDs dos modelos ADICIONADOS do provider atual (activeModels) — usados no More. */
  models: string[];
  /** Favoritos globais — chaves "provider::model". */
  favorites: string[];
  /** Liga/desliga favorito do modelo no provider atual (respeita o teto de 5). */
  onToggleFavorite: (model: string) => void;
  currentModel: string;
  onSelectModel: (model: string) => void;
  currentEffort: string;
  onSelectEffort: (level: EffortLevel) => void;
  thinkingOn: boolean;
  onToggleThinking: (value: boolean) => void;
  onClose: () => void;
  /** Abre as Settings (quando não há modelo adicionado pra favoritar). */
  onOpenSettings?: () => void;
  /** Locale pras descrições — app é EN-only hoje. */
  lang?: string;
}

export function ModelSheet({
  provider,
  models,
  favorites,
  onToggleFavorite,
  currentModel,
  onSelectModel,
  currentEffort,
  onSelectEffort,
  thinkingOn,
  onToggleThinking,
  onClose,
  onOpenSettings,
  lang = "en-US",
}: ModelSheetProps) {
  const [view, setView] = useState<"model" | "effort" | "more">("model");
  const [chip, setChip] = useState<string>("all");
  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusTrap(sheetRef, { onEscape: onClose });

  const prefix = provider + "::";
  const isFav = (m: string) => favorites.includes(prefix + m);
  const favCount = favorites.filter((k) => k.startsWith(prefix)).length;
  const favModels = favorites
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length));

  const effortLabel =
    EFFORT_LABELS[currentEffort as EffortLevel] ?? currentEffort;

  // ── Ecrã 3 (More): chips por categoria presente + Free, e lista filtrada. ──
  const grouped = groupModelsByCategory(provider, models);
  const presentCats = CATEGORY_ORDER.filter(
    (c) => (grouped.get(c)?.length ?? 0) > 0
  );
  const freeModels = models.filter(
    (m) => getModelCapabilities(provider, m).free
  );
  const chips: { id: string; label: string }[] = [
    { id: "all", label: "All" },
    ...presentCats.map((c) => ({ id: c, label: CAT_LABELS_EN[c] })),
    ...(freeModels.length ? [{ id: "free", label: "Free" }] : []),
  ];
  const visibleModels =
    chip === "all"
      ? models
      : chip === "free"
        ? freeModels
        : grouped.get(chip as ModelCategory) ?? [];
  // Favoritos primeiro (sobem pro topo), resto na ordem original.
  const sortedModels = [...visibleModels].sort(
    (a, b) => (isFav(a) ? 0 : 1) - (isFav(b) ? 0 : 1)
  );

  function renderModelRow(m: string, withCheck: boolean) {
    const { name, tagline } = modelBits(provider, m, lang);
    const selected = m === currentModel;
    return (
      <button
        key={m}
        type="button"
        className={"axxa-sheet-row" + (selected ? " axxa-sheet-row-on" : "")}
        onClick={() => {
          onSelectModel(m);
          onClose();
        }}
      >
        <span className="axxa-sheet-row-text">
          <span className="axxa-sheet-row-name">{name}</span>
          {tagline && <span className="axxa-sheet-row-desc">{tagline}</span>}
        </span>
        {withCheck && selected && (
          <span className="axxa-sheet-row-check">
            <Icon name="check" />
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="axxa-plus-overlay" onClick={onClose}>
      <div
        ref={sheetRef}
        className="axxa-plus-sheet axxa-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label="Select model"
      >
        <div className="axxa-plus-handle" />

        {view === "model" && (
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

            {favModels.length === 0 ? (
              <button
                type="button"
                className="axxa-sheet-empty-btn"
                onClick={() => setView("more")}
              >
                <span className="axxa-sheet-empty-title">
                  No favorite models yet
                </span>
                <span className="axxa-sheet-empty-sub">
                  Tap to pick up to {MAX_FAVORITES} favorites
                </span>
              </button>
            ) : (
              <div className="axxa-sheet-list">
                {favModels.map((m) => renderModelRow(m, true))}
                <button
                  type="button"
                  className="axxa-sheet-row axxa-sheet-add"
                  onClick={() => setView("more")}
                >
                  <span className="axxa-sheet-add-icon">
                    <Icon name="plus" />
                  </span>
                  <span className="axxa-sheet-row-name">Add models</span>
                </button>
              </div>
            )}

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
          </>
        )}

        {view === "effort" && (
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
                      "axxa-sheet-row" + (selected ? " axxa-sheet-row-on" : "")
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

        {view === "more" && (
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
              <span className="axxa-sheet-title">More models</span>
              <span className="axxa-sheet-nav" aria-hidden="true" />
            </div>

            {models.length === 0 ? (
              <button
                type="button"
                className="axxa-sheet-empty-btn"
                onClick={() => {
                  onOpenSettings?.();
                  onClose();
                }}
                disabled={!onOpenSettings}
              >
                <span className="axxa-sheet-empty-title">
                  No models added yet
                </span>
                <span className="axxa-sheet-empty-sub">
                  Add models in Settings to favorite them here
                </span>
              </button>
            ) : (
              <>
                {chips.length > 1 && (
                  <div className="axxa-sheet-chips">
                    {chips.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={
                          "axxa-sheet-chip" +
                          (chip === c.id ? " axxa-sheet-chip-on" : "")
                        }
                        onClick={() => setChip(c.id)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="axxa-sheet-list">
                  {sortedModels.map((m) => {
                    const { name, tagline } = modelBits(provider, m, lang);
                    const fav = isFav(m);
                    const locked = !fav && favCount >= MAX_FAVORITES;
                    return (
                      <div
                        key={m}
                        className="axxa-sheet-row"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          onSelectModel(m);
                          onClose();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectModel(m);
                            onClose();
                          }
                        }}
                      >
                        <span className="axxa-sheet-row-text">
                          <span className="axxa-sheet-row-name">{name}</span>
                          {tagline && (
                            <span className="axxa-sheet-row-desc">
                              {tagline}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          className={
                            "axxa-sheet-star" + (fav ? " axxa-sheet-star-on" : "")
                          }
                          disabled={locked}
                          aria-pressed={fav}
                          aria-label={fav ? "Unfavorite" : "Favorite"}
                          title={
                            locked
                              ? `Max ${MAX_FAVORITES} favorites`
                              : fav
                                ? "Unfavorite"
                                : "Favorite"
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(m);
                          }}
                        >
                          <Icon name="star" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
