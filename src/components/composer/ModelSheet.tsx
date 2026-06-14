// src/components/composer/ModelSheet.tsx
// Bottom sheet do seletor de modelo (DS 1.0, ref: prints do Claude).
// TRÊS ecrãs na MESMA folha (navegação interna):
//   1. "Select model" (FAVORITOS) — é AQUI que se favorita. Lista os favoritos
//      (estrela cheia, no topo) + os candidatos (added, estrela vazia). Ao chegar
//      a 5 favoritos, os OUTROS somem (fica só os 5). Sem favorito → "Add favorite"
//      em letra secondary, alinhado à esquerda. Tap na row seleciona; tap na
//      estrela (de)favorita. Sempre: "More models ›" e "Effort ›".
//   2. "Effort" — níveis low→max (Default badge no baseline, check no atual) +
//      toggle "Thinking" (só pra modelos com a capacidade).
//   3. "More models" — TODOS os modelos adicionados, SEM estrela, COM o seletor
//      segmentado (mesmo da sidebar) por categoria (+ Free quando houver). Tap
//      seleciona.
// Reaproveita o shell .axxa-plus-overlay/-sheet/-handle/-divider + o focus-trap.

import { useRef, useState } from "react";
import { Icon } from "../_shared/Icon";
import { SegmentedRow, type SegmentedItem } from "../_shared/SegmentedRow";
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

// Ícone por chip (o seletor segmentado é icon-céntrico, mostra o label só no ativo).
const CHIP_ICON: Record<string, string> = {
  all: "layers",
  free: "gift",
  "chat-vision": "image",
  "chat-text": "message-square",
  reasoning: "brain",
  agent: "bot",
  "image-gen": "image",
  "audio-gen": "audio-lines",
  "video-gen": "clapperboard",
  embedding: "boxes",
  other: "sparkles",
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

/** Encurta pra uma frase breve: corta na 1ª frase; se ainda longa, na 1ª vírgula.
 *  O texto secundário é sempre uma linha (nowrap+ellipsis no CSS). */
function briefen(s: string): string {
  let t = s.trim();
  const dot = t.indexOf(". ");
  if (dot > 0) t = t.slice(0, dot);
  t = t.replace(/\.$/, "");
  if (t.length > 46) {
    const comma = t.indexOf(", ");
    if (comma > 0) t = t.slice(0, comma);
  }
  return t.trim();
}

/** Nome + tagline (frase breve) de um modelo. */
function modelBits(
  provider: string,
  model: string,
  lang: string
): { name: string; tagline: string } {
  const info = getModelFullInfo(provider, model);
  const desc = localizedDescription(info, model, lang) || "";
  const m = desc.match(/^(.{1,26}?)\s+[—–-]\s+(.+)$/);
  if (m && m[1] && m[2]) {
    return { name: m[1].trim(), tagline: briefen(m[2]) };
  }
  return { name: prettyModelName(model), tagline: briefen(desc) };
}

interface ModelSheetProps {
  provider: string;
  /** IDs dos modelos ADICIONADOS do provider atual (activeModels). */
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
  /** Abre as Settings (quando não há modelo adicionado). */
  onOpenSettings?: () => void;
  /** Modelo atual suporta o toggle Thinking — esconde a linha quando não. */
  thinkingCapable?: boolean;
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
  thinkingCapable = false,
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
  // Candidatos = adicionados ainda não favoritados. Somem quando os 5 estão cheios.
  const candidates = models.filter((m) => !isFav(m));
  const atMax = favCount >= MAX_FAVORITES;

  const effortLabel =
    EFFORT_LABELS[currentEffort as EffortLevel] ?? currentEffort;

  // ── More: chips por categoria presente + Free, e lista filtrada. ──
  const grouped = groupModelsByCategory(provider, models);
  const presentCats = CATEGORY_ORDER.filter(
    (c) => (grouped.get(c)?.length ?? 0) > 0
  );
  const freeModels = models.filter(
    (m) => getModelCapabilities(provider, m).free
  );
  const chipItems: SegmentedItem[] = [
    { id: "all", icon: CHIP_ICON.all, label: "All", iconOnly: true },
    ...presentCats.map((c) => ({ id: c, icon: CHIP_ICON[c], label: CAT_LABELS_EN[c] })),
    ...(freeModels.length
      ? [{ id: "free", icon: CHIP_ICON.free, label: "Free" }]
      : []),
  ];
  const visibleModels =
    chip === "all"
      ? models
      : chip === "free"
        ? freeModels
        : grouped.get(chip as ModelCategory) ?? [];

  // Row com estrela (ecrã de favoritos): tap = seleciona, estrela = (de)favorita.
  function favRow(m: string) {
    const { name, tagline } = modelBits(provider, m, lang);
    const fav = isFav(m);
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
          {tagline && <span className="axxa-sheet-row-desc">{tagline}</span>}
        </span>
        <button
          type="button"
          className={"axxa-sheet-star" + (fav ? " axxa-sheet-star-on" : "")}
          aria-pressed={fav}
          aria-label={fav ? "Unfavorite" : "Favorite"}
          title={fav ? "Unfavorite" : "Favorite"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(m);
          }}
        >
          <Icon name="star" />
        </button>
      </div>
    );
  }

  // Row de seleção pura (More / Effort): tap = seleciona, check no ativo.
  function selectRow(m: string) {
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
        {selected && (
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

            {models.length === 0 && favModels.length === 0 ? (
              <button
                type="button"
                className="axxa-sheet-addfav"
                onClick={() => {
                  onOpenSettings?.();
                  onClose();
                }}
                disabled={!onOpenSettings}
              >
                Add favorite
              </button>
            ) : (
              <div className="axxa-sheet-list">
                {favCount === 0 && (
                  <span className="axxa-sheet-addfav-label">Add favorite</span>
                )}
                {favModels.map((m) => favRow(m))}
                {!atMax && candidates.map((m) => favRow(m))}
              </div>
            )}

            <div className="axxa-plus-divider" />
            <button
              type="button"
              className="axxa-sheet-row"
              onClick={() => setView("more")}
            >
              <span className="axxa-sheet-row-text">
                <span className="axxa-sheet-row-name">More models</span>
              </span>
              <span className="axxa-sheet-row-chevron">
                <Icon name="chevron-right" />
              </span>
            </button>

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

            {thinkingCapable && (
              <>
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
                className="axxa-sheet-addfav"
                onClick={() => {
                  onOpenSettings?.();
                  onClose();
                }}
                disabled={!onOpenSettings}
              >
                Add models in Settings
              </button>
            ) : (
              <>
                {chipItems.length > 1 && (
                  <div className="axxa-sheet-seg">
                    <SegmentedRow
                      items={chipItems}
                      activeId={chip}
                      onSelect={setChip}
                      showActiveLabel
                    />
                  </div>
                )}
                <div className="axxa-sheet-list axxa-sheet-list-compact">
                  {visibleModels.map((m) => selectRow(m))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
