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
// A CASCA é o Modal NATIVO do Obsidian (ModelSheetModal.ts) — sobe de baixo como
// bottom sheet, com backdrop/animação/foco de fábrica. Aqui renderizamos só o
// CONTEÚDO interno (header + corpo rolável); o AxxaApp portala isto pro contentEl
// do modal. Reaproveita as classes .axxa-sheet-* / .axxa-plus-divider.

import { useState } from "react";
import { Icon } from "../_shared/Icon";
import {
  EFFORT_LEVELS,
  EFFORT_LABELS,
  type EffortLevel,
} from "../_shared/effort";
import {
  getModelFullInfo,
  localizedDescription,
  groupModelsByCategory,
  prettyModelName,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
} from "../../providers/modelDescriptions";
import { modelVendorLogoId, PROVIDER_LOGO } from "../_shared/modelLogo";

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
  /** (P1-36) Sessão travada (após 1ª msg): escolher outro modelo abre uma
   *  conversa NOVA — o sheet avisa antes, em vez de só descartar a tela. */
  locked?: boolean;
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
  locked = false,
}: ModelSheetProps) {
  const [view, setView] = useState<"model" | "effort" | "more">("model");

  const prefix = provider + "::";
  const isFav = (m: string) => favorites.includes(prefix + m);
  const favCount = favorites.filter((k) => k.startsWith(prefix)).length;
  const favModels = favorites
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length));
  // Candidatos = adicionados ainda não favoritados. No ecrã de favoritos só
  // aparecem o suficiente pra completar 5 slots (somem quando os 5 estão cheios).
  const candidates = models.filter((m) => !isFav(m));

  const effortLabel =
    EFFORT_LABELS[currentEffort as EffortLevel] ?? currentEffort;
  // Slider de effort (estilo Claude Code desktop): índice do nível atual + % do
  // preenchimento do trilho. Clamp em 0 pra effort desconhecido não sumir o thumb.
  const effortIdx = Math.max(0, EFFORT_LEVELS.indexOf(currentEffort as EffortLevel));
  const effortPct =
    EFFORT_LEVELS.length > 1
      ? (effortIdx / (EFFORT_LEVELS.length - 1)) * 100
      : 0;

  // ── More: UMA lista contínua com todos os modelos, agrupada por categoria.
  // A categoria é HOOK (cabeçalho de seção), não uma aba-filtro (era "uma lista
  // por tabela"). presentCats = categorias com pelo menos 1 modelo, na ordem. ──
  const grouped = groupModelsByCategory(provider, models);
  const presentCats = CATEGORY_ORDER.filter(
    (c) => (grouped.get(c)?.length ?? 0) > 0
  );

  // Logo do VENDOR do modelo (claude/gpt/gemini/...) à esquerda da linha. Sem SVG
  // do vendor → cai no logo do provider; sem esse → ícone genérico.
  const rowLogo = (m: string) => (
    <span className="axxa-sheet-row-logo">
      <Icon
        name={modelVendorLogoId(provider, m) ?? PROVIDER_LOGO[provider] ?? "sparkles"}
      />
    </span>
  );

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
        {rowLogo(m)}
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
          {/* (P1-61) bookmark = favorito nos DOIS lugares (Settings usa
              bookmark); star fica exclusivo pra "default" — antes o mesmo
              ícone significava coisas diferentes e um mis-tap nas Settings
              trocava o modelo default global. */}
          <Icon name="bookmark" />
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
        {rowLogo(m)}
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
    <div className="axxa-model-sheet">
        {/* TOPO FIXO (header) — a casca nativa dá o handle/drag; aqui só o header. */}
        <div className="axxa-sheet-top">
          {view === "model" && (
            <div className="axxa-sheet-header">
              {/* Sem X próprio — quem fecha é o X NATIVO do Obsidian (top-right).
                  Espaçadores mantêm o título centralizado. */}
              <span className="axxa-sheet-nav" aria-hidden="true" />
              <span className="axxa-sheet-title">Select model</span>
              <span className="axxa-sheet-nav" aria-hidden="true" />
            </div>
          )}
          {/* (P1-36) Mesmo aviso do header: com sessão travada, trocar de
              modelo abre conversa nova — nada de troca silenciosa. */}
          {view === "model" && locked && (
            <div className="axxa-sheet-locked-hint">
              <Icon name="lock" />
              <span>Choosing another model opens a new conversation.</span>
            </div>
          )}
          {view === "effort" && (
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
          )}
          {view === "more" && (
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
          )}
        </div>

        {/* CORPO ROLÁVEL — rola dentro do modal nativo. */}
        <div className="axxa-sheet-body">
          {view === "model" && (
            <>
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
                <div className="axxa-sheet-list axxa-sheet-list-compact">
                  {favCount === 0 && (
                    <span className="axxa-sheet-addfav-label">Add favorite</span>
                  )}
                  {favModels.map((m) => favRow(m))}
                  {/* completa até no máx 5 slots com candidatos (estrela vazia) */}
                  {candidates
                    .slice(0, Math.max(0, MAX_FAVORITES - favModels.length))
                    .map((m) => favRow(m))}
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
              {/* Slider de effort (ref Claude Code desktop): trilho accent até o
                  thumb, 5 níveis como marcações tocáveis, nome+descrição do nível
                  atual em destaque. Arrasta o thumb OU toca no label. */}
              <div className="axxa-effort-slider">
                <div className="axxa-effort-slider-head">
                  <span className="axxa-effort-slider-name">
                    {effortLabel}
                    {currentEffort === DEFAULT_EFFORT && (
                      <span className="axxa-sheet-badge">Default</span>
                    )}
                  </span>
                  <span className="axxa-effort-slider-desc">
                    {EFFORT_TAGLINES[currentEffort as EffortLevel] ?? ""}
                  </span>
                </div>
                <input
                  type="range"
                  className="axxa-effort-range"
                  min={0}
                  max={EFFORT_LEVELS.length - 1}
                  step={1}
                  value={effortIdx}
                  style={{ ["--axxa-effort-pct" as string]: `${effortPct}%` }}
                  onChange={(e) =>
                    onSelectEffort(EFFORT_LEVELS[Number(e.currentTarget.value)])
                  }
                  aria-label="Effort"
                  aria-valuetext={effortLabel}
                />
                <div className="axxa-effort-ticks">
                  {EFFORT_LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      className={
                        "axxa-effort-tick" +
                        (lvl === currentEffort ? " is-active" : "")
                      }
                      onClick={() => onSelectEffort(lvl)}
                    >
                      {EFFORT_LABELS[lvl]}
                    </button>
                  ))}
                </div>
              </div>

              {thinkingCapable && (
                <>
                  <div className="axxa-plus-divider" />
                  <div
                    className="axxa-sheet-row"
                    /* (P1-47) role=switch no elemento FOCÁVEL — o span
                       interno com o estado nunca era focado pelo leitor. */
                    role="switch"
                    aria-checked={thinkingOn}
                    aria-label="Thinking"
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
                      aria-hidden="true"
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
                <div className="axxa-sheet-list axxa-sheet-list-more">
                  {presentCats.map((cat) => {
                    const catModels = grouped.get(cat) ?? [];
                    if (!catModels.length) return null;
                    return (
                      <div key={cat} className="axxa-sheet-group">
                        {/* Categoria = HOOK (cabeçalho da seção), não aba. */}
                        <div className="axxa-sheet-group-label">
                          {CATEGORY_LABELS[cat]}
                        </div>
                        {catModels.map((m) => selectRow(m))}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
    </div>
  );
}
