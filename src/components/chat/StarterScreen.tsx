// src/components/chat/StarterScreen.tsx
// Dashboard inicial quando chat tá vazio (v0.1.103):
//   - Saudação por hora do dia + tagline
//   - Visão geral: stat cards (conversas/mensagens/tokens/gasto) + atividade 14d
//   - Nova conversa: provider buttons + model dropdown + effort row
//   - Recent chats list (últimos 8 chats salvos) — clique carrega
//   - Status: índice RAG + providers configurados (clique abre Settings)
//   - Quando user manda primeira msg, AxxaApp chama lockSession()

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useId,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { Notice } from "obsidian";
import type AxxaPlugin from "../../main";
import { Icon } from "../_shared/Icon";
import { InfoChip } from "../_shared/InfoChip";
import { hapticTick } from "../_shared/haptics";
import {
  EFFORT_LEVELS,
  EFFORT_LABELS,
  EFFORT_DESCRIPTIONS,
  type EffortLevel,
} from "../_shared/effort";
import type { ChatSummary } from "../_shared/chatPersistence";
import { formatTokens } from "../_shared/contextWindows";
import {
  aggregateFromSummaries,
  lastNDays,
  type UsageAggregate,
} from "../../usage/aggregate";
import { useT, type Translations } from "../../i18n";
import {
  getModelCapabilities,
  capabilityBadges,
} from "../../providers/modelCapabilities";
import {
  getModelFullInfo,
  localizedDescription,
  groupModelsByCategory,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type ModelFullInfo,
} from "../../providers/modelDescriptions";
import { hasBrandLogo } from "../_shared/brandLogos";
import { formatUsd } from "../../usage/pricing";

// Cores DS pra badges de capacidade — cada flag tem uma cor semântica fixa.
const CAP_COLORS = {
  vision: "var(--color-purple, #a370f7)",     // multimodal = roxo
  tools: "var(--color-orange, #ec7b3e)",      // tools = laranja
  stream: "var(--color-green, #06d6a0)",      // streaming real = verde
  free: "var(--color-cyan, #4cc9f0)",         // grátis = cyan
  "img-gen": "var(--color-pink, #f472b6)",    // gera imagem = rosa
  "audio-gen": "var(--color-cyan, #4cc9f0)",  // gera áudio = cyan
  "video-gen": "var(--color-purple, #a370f7)", // gera vídeo = roxo
} as const;

// Mesmas cores semânticas usadas no status line do Composer.
const CHIP_COLORS = {
  mode: "var(--color-pink, #f472b6)",
  model: "var(--color-purple, #a370f7)",
  date: "var(--text-muted)",
  messages: "var(--color-cyan, #4cc9f0)",
  tokens: "var(--color-green, #06d6a0)",
} as const;

// Cor por modo — escala sutil: chat (sóbrio) → vault → agent (mais forte).
const MODE_COLOR: Record<string, string> = {
  chat: "var(--text-muted)",
  "vault-qa": "var(--color-cyan, #4cc9f0)",
  agent: "var(--color-purple, #a370f7)",
};
function modeColor(mode: string): string {
  return MODE_COLOR[mode] ?? "var(--text-muted)";
}

// Logo de marca por provider (abas + fallback dos cards de modelo).
const PROVIDER_LOGO: Record<string, string> = {
  openai: "logo-openai",
  anthropic: "logo-anthropic",
  gemini: "logo-gemini",
  openrouter: "logo-openrouter",
  nim: "logo-nvidia",
  ollama: "logo-ollama",
};

// model-id → logo do VENDOR real do modelo (ex: um llama no OpenRouter mostra a
// Meta). 1ª regra que casa vence; fallback no logo do provider. (v0.1.92)
const MODEL_LOGO_RULES: [RegExp, string][] = [
  [/claude/, "logo-claude-color"],
  [/(gemini[\w.-]*image|nano-?banana)/, "logo-nanobanana-color"],
  [/(gemini|imagen|gemma|palm|bison)/, "logo-gemini-color"],
  [/(llama|meta-)/, "logo-meta-color"],
  [/qwen/, "logo-qwen-color"],
  [/(mistral|mixtral|codestral|pixtral|ministral)/, "logo-mistral-color"],
  [/deepseek/, "logo-deepseek-color"],
  [/flux/, "logo-flux"],
  [/(stable-?diffusion|sdxl|stability)/, "logo-stability-color"],
  [/(gpt|^o[1-9]|davinci|dall|whisper|tts|chatgpt|text-embedding)/, "logo-openai"],
  [/(nemotron|nvidia)/, "logo-nvidia-color"],
];

/** Resolve o logo de um modelo: tenta o vendor do modelo, senão o do provider. */
function modelLogo(provider: string, model: string): string {
  const id = (model || "").toLowerCase();
  const tail = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id;
  for (const [re, logo] of MODEL_LOGO_RULES) {
    if (re.test(tail) || re.test(id)) return logo;
  }
  return PROVIDER_LOGO[provider] ?? "logo-openai";
}

/** Linha de custo (números reais): tokens in/out, por imagem, ou por chars (TTS). */
function buildCostLine(pricing: ReturnType<typeof getModelFullInfo>["pricing"]): string | null {
  if (pricing.imagePerCall != null) return `${formatUsd(pricing.imagePerCall)} / imagem`;
  if (pricing.charPerMillion != null) return `${formatUsd(pricing.charPerMillion)} / 1M chars`;
  if (pricing.inputPerMillion != null || pricing.outputPerMillion != null) {
    return `${formatUsd(pricing.inputPerMillion)} in · ${formatUsd(
      pricing.outputPerMillion
    )} out / 1M`;
  }
  return null;
}

/** Ícone Lucide por categoria do modelo. */
function categoryIcon(cat: string): string {
  switch (cat) {
    case "flagship": return "crown";
    case "balanced": return "scale";
    case "fast": return "zap";
    case "reasoning": return "brain";
    case "image": return "image";
    case "audio": return "audio-lines";
    case "video": return "clapperboard";
    case "embedding": return "boxes";
    default: return "sparkles";
  }
}

/**
 * Logo do VENDOR do modelo — SEMPRE o original (ex: gpt no OpenRouter mostra
 * OpenAI, não OpenRouter). Se a gente ainda NÃO tem o logo do vendor, cai num
 * placeholder de TEXTO em roxo vivo (pro dev ver e saber qual logo criar). v0.1.130
 */
function ModelVendorLogo({
  provider,
  model,
}: {
  provider: string;
  model: string;
}) {
  const id = (model || "").toLowerCase();
  const tail = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id;
  let logoId: string | null = null;
  for (const [re, logo] of MODEL_LOGO_RULES) {
    if (re.test(tail) || re.test(id)) {
      logoId = hasBrandLogo(logo) ? logo : null;
      break;
    }
  }
  if (logoId) return <Icon name={logoId} />;
  // placeholder roxo vivo com o vendor detectado
  const raw = model && model.includes("/")
    ? model.slice(0, model.indexOf("/"))
    : (model || provider).split(/[-.\s:]/)[0];
  const label = (raw || provider).toUpperCase().slice(0, 10);
  return (
    <span className="axxa-logo-ph" title={`logo ausente: ${label}`}>
      {label}
    </span>
  );
}

// Metadados das pills informativas do modelo (ícone + cor por id).
const PILL_META: Record<string, { label: string; icon: string; color: string }> = {
  "img-gen": { label: "img-gen", icon: "image-plus", color: CAP_COLORS["img-gen"] },
  "vid-gen": { label: "vid-gen", icon: "video", color: CAP_COLORS["video-gen"] },
  "audio-gen": { label: "audio-gen", icon: "volume-2", color: CAP_COLORS["audio-gen"] },
  multimodal: { label: "multimodal", icon: "layers", color: "var(--color-purple, #a370f7)" },
  vision: { label: "vision", icon: "image", color: CAP_COLORS.vision },
  tools: { label: "tool call", icon: "wrench", color: CAP_COLORS.tools },
  stream: { label: "stream", icon: "zap", color: CAP_COLORS.stream },
  paid: { label: "paid", icon: "circle-dollar-sign", color: "var(--color-orange, #ec7b3e)" },
  free: { label: "free", icon: "gift", color: CAP_COLORS.free },
};

/** Lista de pills (ids) a partir das caps + pricing + specs enriquecidas. */
function cardPills(info: ModelFullInfo): string[] {
  const { caps, pricing, enriched } = info;
  const ids: string[] = [];
  if (caps.imageGen) ids.push("img-gen");
  if (caps.videoGen) ids.push("vid-gen");
  if (caps.audioGen) ids.push("audio-gen");
  const multi =
    (enriched?.modalities?.filter((m) => m && m !== "text").length ?? 0) > 0;
  if (multi) ids.push("multimodal");
  else if (caps.vision) ids.push("vision");
  if (caps.tools) ids.push("tools");
  if (caps.streaming) ids.push("stream");
  const tier = enriched?.tier ?? pricing.tier;
  if (tier === "free" || caps.free) ids.push("free");
  else if (tier === "paid") ids.push("paid");
  return ids;
}

function Pills({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <div className="axxa-model-caps">
      {ids.map((id) => {
        const m = PILL_META[id];
        if (!m) return null;
        return (
          <InfoChip key={id} icon={m.icon} color={m.color}>
            {m.label}
          </InfoChip>
        );
      })}
    </div>
  );
}

/** Specs técnicas (verso do flip + modal): contexto, preço, modalidades, etc. */
function ModelSpecs({ info }: { info: ModelFullInfo }) {
  const { card, pricing, enriched } = info;
  const ctx = enriched?.contextWindow ?? card.contextWindow;
  const inP = enriched?.inputPerMillion ?? pricing.inputPerMillion;
  const outP = enriched?.outputPerMillion ?? pricing.outputPerMillion;
  const modal = enriched?.modalities?.filter(Boolean) ?? [];
  const rows: { icon: string; k: string; v: string }[] = [];
  if (ctx != null) rows.push({ icon: "layers", k: "context", v: `${formatTokens(ctx)} tok` });
  if (inP != null) rows.push({ icon: "arrow-down-to-line", k: "input", v: `${formatUsd(inP)} / 1M` });
  if (outP != null) rows.push({ icon: "arrow-up-from-line", k: "output", v: `${formatUsd(outP)} / 1M` });
  if (enriched?.imagePerCall != null) rows.push({ icon: "image", k: "image", v: `${formatUsd(enriched.imagePerCall)} / img` });
  if (modal.length) rows.push({ icon: "shapes", k: "modalities", v: modal.join(", ") });
  if (enriched?.supportsTools != null) rows.push({ icon: "wrench", k: "tools", v: enriched.supportsTools ? "yes" : "no" });
  const stamp = enriched?.fetchedAt?.slice(0, 10) ?? pricing.asOf;
  return (
    <div className="axxa-mc-specs">
      {rows.length === 0 ? (
        <p className="axxa-mc-specs-empty">{card.description}</p>
      ) : (
        rows.map((r) => (
          <div key={r.k} className="axxa-mc-spec">
            <span className="axxa-mc-spec-k">
              <Icon name={r.icon} />
              {r.k}
            </span>
            <span className="axxa-mc-spec-v">{r.v}</span>
          </div>
        ))
      )}
      {stamp && (
        <div className="axxa-mc-spec axxa-mc-spec-stamp">
          <span className="axxa-mc-spec-k">
            <Icon name="calendar" />
            {enriched?.source ?? "local"}
          </span>
          <span className="axxa-mc-spec-v">{stamp}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Card de info do modelo (v0.1.130) — ALTURA FIXA (não quebra o layout).
 *   • frente: logo do vendor (ou placeholder roxo) + nome + categoria + tier +
 *     descrição (pt/en) + pills; última linha = TOGGLE de modelo full-width
 *     (dropdown quebra pra fora);
 *   • verso (flip ao tocar): specs técnicas + botão "Fetch info" (OpenRouter);
 *   • ícone de EXPAND no canto superior direito → modal completo (com collapse).
 */
function ModelInfoCard({
  provider,
  model,
  modelOptions,
  onModelChange,
  plugin,
}: {
  provider: string;
  model: string;
  modelOptions: string[];
  onModelChange: (model: string) => void;
  plugin: AxxaPlugin;
}) {
  const t = useT();
  const lang = plugin.settings.language;
  const [flipped, setFlipped] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [, setBump] = useState(0);
  const fieldRef = useRef<HTMLDivElement>(null);
  const autoFetchedRef = useRef<Set<string>>(new Set());

  const info = getModelFullInfo(provider, model);
  const { card, pricing, enriched } = info;

  // Reset ao trocar modelo/provider.
  useEffect(() => {
    setPickerOpen(false);
    setFlipped(false);
  }, [provider, model]);

  // Auto-fetch PREGUIÇOSO (v0.1.131): na 1ª vez que um modelo sem cache
  // aparece, busca as specs em background (silencioso, 1× por modelo/sessão).
  useEffect(() => {
    const key = provider + "::" + model;
    if (enriched || autoFetchedRef.current.has(key)) return;
    autoFetchedRef.current.add(key);
    let cancelled = false;
    void (async () => {
      try {
        const res = await plugin.fetchModelInfo(provider, model);
        if (!cancelled && res) setBump((b) => b + 1);
      } catch {
        /* auto-fetch é silencioso — o botão manual reporta erros */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, model]);

  // Fecha o dropdown ao clicar fora ou Escape.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (fieldRef.current && !fieldRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  const tier = enriched?.tier ?? pricing.tier ?? "unknown";
  const tierText = tier === "free" ? "FREE" : tier === "paid" ? "PAID" : "?";
  const pills = cardPills(info);
  const desc = localizedDescription(info, model, lang);
  const opts = modelOptions.includes(model)
    ? modelOptions
    : [model, ...modelOptions];

  const doFetch = async () => {
    if (fetching) return;
    setFetching(true);
    hapticTick();
    try {
      const res = await plugin.fetchModelInfo(provider, model);
      if (!res) new Notice(t.dashboard.modelFetchNone);
      setBump((b) => b + 1);
    } catch {
      new Notice(t.dashboard.modelFetchErr);
    } finally {
      setFetching(false);
    }
  };

  return (
    <>
      <div className={"axxa-mc" + (flipped ? " axxa-mc-flipped" : "")}>
        {/* EXPAND — canto superior direito, abre o modal completo */}
        <button
          type="button"
          className="axxa-mc-expand"
          aria-label={t.dashboard.modelExpand}
          onClick={() => {
            hapticTick();
            setModalOpen(true);
          }}
        >
          <Icon name="maximize-2" />
        </button>

        {/* Zona que vira (flip) — fica ACIMA do toggle (que não vira) */}
        <div className="axxa-mc-flipzone">
          <div className="axxa-mc-flip">
            {/* FRENTE */}
            <button
              type="button"
              className="axxa-mc-face axxa-mc-front"
              aria-label={t.dashboard.modelSpecs}
              onClick={() => {
                hapticTick();
                setFlipped(true);
              }}
            >
              <div className="axxa-model-card-top">
                <span className="axxa-model-card-avatar">
                  <ModelVendorLogo provider={provider} model={model} />
                </span>
                <span className="axxa-model-card-id">
                  <span className="axxa-model-card-name">{model}</span>
                  <span className="axxa-model-card-cat">
                    <Icon name={categoryIcon(card.category)} />
                    {CATEGORY_LABELS[card.category]}
                  </span>
                </span>
                <span className={"axxa-model-tier axxa-model-tier-" + tier}>
                  {tierText}
                </span>
              </div>
              <p className="axxa-mc-desc">{desc}</p>
              <Pills ids={pills} />
              <span className="axxa-mc-fliphint">
                <Icon name="rotate-cw" />
                {t.dashboard.modelSpecs}
              </span>
            </button>

            {/* VERSO — specs + fetch */}
            <div className="axxa-mc-face axxa-mc-back">
              <button
                type="button"
                className="axxa-mc-back-tap"
                aria-label={t.dashboard.modelFlipBack}
                onClick={() => {
                  hapticTick();
                  setFlipped(false);
                }}
              >
                <div className="axxa-mc-back-head">
                  <span className="axxa-model-card-avatar axxa-model-card-avatar-sm">
                    <ModelVendorLogo provider={provider} model={model} />
                  </span>
                  <span className="axxa-model-card-name">{model}</span>
                  <Icon name="rotate-ccw" />
                </div>
                <ModelSpecs info={info} />
              </button>
              <button
                type="button"
                className="axxa-mc-fetch"
                onClick={doFetch}
                disabled={fetching}
              >
                <Icon name={fetching ? "loader-2" : "download-cloud"} />
                {fetching ? t.dashboard.modelFetching : t.dashboard.modelFetch}
              </button>
            </div>
          </div>
        </div>

        {/* TOGGLE — última linha, FULL WIDTH (não vira no flip) */}
        <div className="axxa-model-field axxa-mc-toggle" ref={fieldRef}>
          <button
            type="button"
            className={
              "axxa-model-trigger axxa-mc-trigger" +
              (pickerOpen ? " axxa-model-trigger-open" : "")
            }
            onClick={() => {
              hapticTick();
              setPickerOpen((o) => !o);
            }}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
          >
            <span className="axxa-model-trigger-logo">
              <ModelVendorLogo provider={provider} model={model} />
            </span>
            <span className="axxa-model-trigger-name">{model}</span>
            <span className="axxa-model-trigger-chevron">
              <Icon name="chevron-down" />
            </span>
          </button>
          {pickerOpen && (
            <ModelDropdown
              provider={provider}
              model={model}
              modelOptions={opts}
              onSelect={(m) => {
                hapticTick();
                onModelChange(m);
                setPickerOpen(false);
              }}
            />
          )}
        </div>
      </div>

      {modalOpen && (
        <ModelCardModal
          provider={provider}
          model={model}
          plugin={plugin}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Modal com o card COMPLETO (v0.1.130) — expand. Portalado pro <body>, fecha
 * no overlay/Escape ou no ícone de COLLAPSE. Tem o botão Fetch info também.
 */
function ModelCardModal({
  provider,
  model,
  plugin,
  onClose,
}: {
  provider: string;
  model: string;
  plugin: AxxaPlugin;
  onClose: () => void;
}) {
  const t = useT();
  const lang = plugin.settings.language;
  const [fetching, setFetching] = useState(false);
  const [, setBump] = useState(0);
  const info = getModelFullInfo(provider, model);
  const { card, pricing, enriched } = info;
  const tier = enriched?.tier ?? pricing.tier ?? "unknown";
  const pills = cardPills(info);
  const desc = localizedDescription(info, model, lang);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const doFetch = async () => {
    if (fetching) return;
    setFetching(true);
    hapticTick();
    try {
      const res = await plugin.fetchModelInfo(provider, model);
      if (!res) new Notice(t.dashboard.modelFetchNone);
      setBump((b) => b + 1);
    } catch {
      new Notice(t.dashboard.modelFetchErr);
    } finally {
      setFetching(false);
    }
  };

  return createPortal(
    <div
      className="axxa-mc-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="axxa-mc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="axxa-model-card-top">
          <span className="axxa-model-card-avatar">
            <ModelVendorLogo provider={provider} model={model} />
          </span>
          <span className="axxa-model-card-id">
            <span className="axxa-model-card-name">{model}</span>
            <span className="axxa-model-card-cat">
              <Icon name={categoryIcon(card.category)} />
              {CATEGORY_LABELS[card.category]}
            </span>
          </span>
          <span className={"axxa-model-tier axxa-model-tier-" + tier}>
            {tier === "free" ? "FREE" : tier === "paid" ? "PAID" : "?"}
          </span>
          <button
            type="button"
            className="axxa-mc-modal-close"
            onClick={onClose}
            aria-label={t.dashboard.modelCollapse}
          >
            <Icon name="minimize-2" />
          </button>
        </div>

        <Pills ids={pills} />

        {card.goodFor && (
          <div className="axxa-model-card-goodfor">
            <Icon name="sparkles" />
            <span>{card.goodFor}</span>
          </div>
        )}
        {desc && <p className="axxa-mc-modal-desc">{desc}</p>}

        <ModelSpecs info={info} />

        <button
          type="button"
          className="axxa-mc-fetch"
          onClick={doFetch}
          disabled={fetching}
        >
          <Icon name={fetching ? "loader-2" : "download-cloud"} />
          {fetching ? t.dashboard.modelFetching : t.dashboard.modelFetch}
        </button>
      </div>
    </div>,
    document.body
  );
}

/**
 * Dropdown (lista suspensa) de seleção de modelo — ancorado no trigger, sem
 * overlay/modal. Scrollável e responsivo. Cards com logo + nome + descrição,
 * agrupados por categoria. Estruturado pra reuso futuro no Settings. (v0.1.93)
 */
function ModelDropdown({
  provider,
  model,
  modelOptions,
  onSelect,
}: {
  provider: string;
  model: string;
  modelOptions: string[];
  onSelect: (model: string) => void;
}) {
  const grouped = groupModelsByCategory(provider, modelOptions);
  const cats = CATEGORY_ORDER.filter((c) => grouped.has(c));

  return (
    <div className="axxa-model-dropdown" role="listbox">
      {cats.map((cat) => (
        <div key={cat} className="axxa-model-dd-group">
          <div className="axxa-model-dd-group-label">{CATEGORY_LABELS[cat]}</div>
          {(grouped.get(cat) ?? []).map((m) => {
            const info = getModelFullInfo(provider, m);
            const active = m === model;
            return (
              <button
                key={m}
                type="button"
                role="option"
                aria-selected={active}
                className={"axxa-model-opt" + (active ? " axxa-model-opt-active" : "")}
                onClick={() => onSelect(m)}
              >
                <span className="axxa-model-opt-logo">
                  <Icon name={modelLogo(provider, m)} />
                </span>
                <span className="axxa-model-opt-main">
                  <span className="axxa-model-opt-name">{m}</span>
                  {info.card.description && (
                    <span className="axxa-model-opt-desc">
                      {info.card.description}
                    </span>
                  )}
                </span>
                {active && (
                  <span className="axxa-model-opt-check">
                    <Icon name="check" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Formato compacto do context window: 128000 → "128k", 2000000 → "2M" */
function formatContextWindow(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "k";
  return String(n);
}

/** Tooltip por badge — texto explicativo do que cada flag significa. */
function modelCapTooltip(
  id: "vision" | "tools" | "stream" | "free" | "img-gen" | "audio-gen" | "video-gen",
  t: ReturnType<typeof useT>
): string {
  switch (id) {
    case "vision": return t.starter.capVisionTooltip;
    case "tools": return t.starter.capToolsTooltip;
    case "stream": return t.starter.capStreamTooltip;
    case "free": return t.starter.capFreeTooltip;
    case "img-gen": return t.starter.capImageGenTooltip;
    case "audio-gen": return t.starter.capAudioGenTooltip;
    case "video-gen": return t.starter.capVideoGenTooltip;
  }
}

function modeChipIcon(mode: string): string {
  switch (mode) {
    case "agent": return "bot";
    case "vault-qa": return "library";
    default: return "message-square";
  }
}

const PROVIDERS = [
  { id: "openai", name: "OpenAI", icon: "logo-openai" },
  { id: "anthropic", name: "Anthropic", icon: "logo-anthropic" },
  { id: "gemini", name: "Gemini", icon: "logo-gemini" },
  { id: "openrouter", name: "OpenRouter", icon: "logo-openrouter" },
  { id: "nim", name: "Nvidia NIM", icon: "logo-nvidia" },
  { id: "ollama", name: "Ollama", icon: "logo-ollama" },
];

interface StarterScreenProps {
  /** Plugin — fonte dos dados do dashboard (usage, vectorIndex, settings, versão). */
  plugin: AxxaPlugin;
  provider: string;
  model: string;
  effort: string;
  mode: string;
  recentChats: ChatSummary[];
  /** Todos os summaries da varredura que o AxxaApp já faz pros recentes —
   *  alimenta os stats do dashboard sem IO extra. null = carregando. */
  summaries: ChatSummary[] | null;
  /** Modelos ativos por provider — curado pelo user nas Settings.
   *  Substitui a lista hardcoded antiga: agora é o user que define o que aparece aqui. */
  activeModels: Record<string, string[]>;
  /** Chips visíveis em cada recent item (curado em Settings → Outros → Chips). */
  visibleChips: string[];
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onEffortChange: (level: EffortLevel) => void;
  onModeChange: (mode: string) => void;
  onLoadChat: (chatId: string, chatMode: string) => void;
  /** "Ver todas" na seção de recentes — abre a ConversationsList. */
  onOpenConversations: () => void;
  /** Clique nos cards de status (RAG / providers) — abre as Settings. */
  onOpenSettings: () => void;
  /** Prompt starter clicado → injeta o texto no Composer + foca. v0.1.131 */
  onPromptStarter: (text: string) => void;
}

// MODES_META — só os ícones e ids ficam aqui. Nomes/descrições vêm do i18n.
// `soon: true` = mock visual (UI presente, lógica vem depois). Não é
// selecionável ainda — clicar mostra Notice "em breve".
const MODES_META: { id: string; icon: string; soon?: boolean }[] = [
  { id: "chat", icon: "message-square" },
  { id: "vault-qa", icon: "library" },
  { id: "agent", icon: "bot" },
];

function formatRelativeDate(iso: string, t: Translations): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return t.dashboard.relNow;
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d`;
    return d.toLocaleDateString(t.dashboard.dateLocale, {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Formato compacto pra contagens grandes: 1234 → "1.2k", 3400000 → "3.4M". */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return Math.round(n / 1_000) + "k";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

/** Saudação por hora do dia (5-11 manhã, 12-17 tarde, resto noite). */
function greetingFor(hour: number, t: Translations): string {
  if (hour >= 5 && hour < 12) return t.dashboard.greetingMorning;
  if (hour >= 12 && hour < 18) return t.dashboard.greetingAfternoon;
  return t.dashboard.greetingEvening;
}

/** Provider tem credencial configurada? (ollama não tem key — checa endpoint) */
function providerConfigured(plugin: AxxaPlugin, id: string): boolean {
  const s = plugin.settings;
  switch (id) {
    case "anthropic": return !!s.anthropicApiKey?.trim();
    case "gemini": return !!s.geminiApiKey?.trim();
    case "openrouter": return !!s.openrouterApiKey?.trim();
    case "nim": return !!s.nimApiKey?.trim();
    case "ollama": return !!s.ollamaEndpoint?.trim();
    default: return !!s.openaiApiKey?.trim();
  }
}

/**
 * Cabeçalho de seção do dashboard — título com ícone à esquerda e ação
 * opcional ("Ver todas") à direita.
 */
function SectionHead({
  icon,
  title,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="axxa-dash-secthead">
      <span className="axxa-dash-secthead-title">
        <Icon name={icon} />
        {title}
      </span>
      {actionLabel && onAction && (
        <button
          type="button"
          className="axxa-dash-secthead-action"
          onClick={onAction}
        >
          {actionLabel}
          <Icon name="chevron-right" />
        </button>
      )}
    </div>
  );
}

/** Stat card — label com micro-ícone colorido em cima, valor grande embaixo. */
function StatCard({
  icon,
  color,
  label,
  value,
  title,
}: {
  icon: string;
  color: string;
  label: string;
  value: string;
  /** Tooltip nativo — ex.: explicação do "*" de custo parcial. */
  title?: string;
}) {
  return (
    <div className="axxa-dash-stat" title={title}>
      <span className="axxa-dash-stat-top">
        <span className="axxa-dash-stat-icon" style={{ color }}>
          <Icon name={icon} />
        </span>
        {label}
      </span>
      <span className="axxa-dash-stat-value">{value}</span>
    </div>
  );
}

/** Slot do chart: dia agregado ou null (placeholder enquanto carrega). */
type DaySlot = ReturnType<typeof lastNDays>[number] | null;

/**
 * Converte pontos numa curva suave (Catmull-Rom → cubic Bézier).
 * Controles com y clampado pro overshoot não estourar o card.
 */
function smoothPath(
  pts: { x: number; y: number }[],
  yMin: number,
  yMax: number
): string {
  if (pts.length === 0) return "";
  const clamp = (y: number) => Math.min(yMax, Math.max(yMin, y));
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6);
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(
      1
    )}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// Geometria do wave chart (viewBox; estica pro card via preserveAspectRatio).
const WAVE_W = 280;
const WAVE_H = 64;
const WAVE_TOP = 8;
const WAVE_BASE = WAVE_H - 6;

// Modo "3 dias": custo agrupado em blocos de BLOCK_HORAS h, alinhados ao
// relógio local, terminando no bloco atual. 3×24/4 = 18 pontos.
const BLOCK_HORAS = 4;
const SPAN_DIAS = 3;
const N_BLOCOS = (SPAN_DIAS * 24) / BLOCK_HORAS;

interface HourBlock {
  start: number; // epoch ms do início do bloco (hora local)
  cost: number;
  chats: number;
}

/** Agrupa o custo das conversas (agg.chats) em blocos de hora dos últimos 3 dias. */
function lastHourBlocks(rows: { date: string; cost: number | null }[]): HourBlock[] {
  const blockMs = BLOCK_HORAS * 3_600_000;
  const anchor = new Date();
  anchor.setMinutes(0, 0, 0);
  anchor.setHours(Math.floor(anchor.getHours() / BLOCK_HORAS) * BLOCK_HORAS);
  const newestStart = anchor.getTime();
  const windowStart = newestStart - (N_BLOCOS - 1) * blockMs;

  const blocks: HourBlock[] = [];
  for (let i = 0; i < N_BLOCOS; i++) {
    blocks.push({ start: windowStart + i * blockMs, cost: 0, chats: 0 });
  }
  for (const r of rows) {
    const ts = Date.parse(r.date);
    if (isNaN(ts) || ts < windowStart || ts >= newestStart + blockMs) continue;
    const idx = Math.floor((ts - windowStart) / blockMs);
    if (idx < 0 || idx >= N_BLOCOS) continue;
    blocks[idx].cost += r.cost ?? 0;
    blocks[idx].chats += 1;
  }
  return blocks;
}

/** Rótulo de um bloco de hora pro tooltip: "09/06 08h–12h". */
function fmtBlock(start: number): string {
  const d = new Date(start);
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = d.getHours();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(h)}h–${pad(
    (h + BLOCK_HORAS) % 24
  )}h`;
}

type ActivityMode = "7d" | "3d";

/**
 * Wave chart "vivo" (v0.1.105) — dois modos via toggle:
 *   7d → atividade (tokens) por dia nos últimos 7 dias
 *   3d → gasto ($) por bloco de 4h nos últimos 3 dias
 * Curva suave que ondula (swell + skew), draw-in no mount, pulso de luz
 * percorrendo a linha e dot pingando no agora. agg=null → linha flat (loading).
 */
function ActivityChart({ agg }: { agg: UsageAggregate | null }) {
  const t = useT();
  const [mode, setMode] = useState<ActivityMode>("7d");
  const gradId = useId().replace(/:/g, "") + "-wave";

  // Série conforme o modo selecionado.
  let values: number[];
  let tooltips: (string | undefined)[];
  let label: string;
  let emptyMsg: string;
  if (mode === "3d") {
    const blocks: (HourBlock | null)[] = agg
      ? lastHourBlocks(agg.chats)
      : new Array(N_BLOCOS).fill(null);
    values = blocks.map((b) => (b ? b.cost : 0));
    tooltips = blocks.map((b) =>
      b
        ? `${fmtBlock(b.start)} — ${t.dashboard.activityBlock(
            b.chats,
            formatUsd(b.cost)
          )}`
        : undefined
    );
    label = t.dashboard.activitySpend;
    emptyMsg = t.dashboard.activitySpendEmpty;
  } else {
    const days: DaySlot[] = agg ? lastNDays(agg.byDay, 7) : new Array(7).fill(null);
    values = days.map((d) => (d ? d.bucket.tokensIn + d.bucket.tokensOut : 0));
    tooltips = days.map((d) =>
      d
        ? `${d.day.slice(8, 10)}/${d.day.slice(5, 7)} — ${t.dashboard.activityDay(
            d.bucket.chats,
            formatTokens(d.bucket.tokensIn + d.bucket.tokensOut)
          )}`
        : undefined
    );
    label = t.dashboard.activityLabel;
    emptyMsg = t.dashboard.activityEmpty;
  }

  const max = values.reduce((m, v) => Math.max(m, v), 0);
  const hasData = max > 0;
  const pts = values.map((v, i) => ({
    x: (i * WAVE_W) / Math.max(1, values.length - 1),
    y: hasData ? WAVE_BASE - (v / max) * (WAVE_BASE - WAVE_TOP) : WAVE_BASE - 2,
  }));
  const line = smoothPath(pts, 2, WAVE_BASE);
  const area = `${line} L ${WAVE_W} ${WAVE_H} L 0 ${WAVE_H} Z`;
  const last = pts[pts.length - 1];

  const toggleBtn = (m: ActivityMode, lbl: string) => (
    <button
      type="button"
      className={
        "clickable-icon axxa-dash-actoggle" +
        (mode === m ? " axxa-dash-actoggle-active" : "")
      }
      aria-pressed={mode === m}
      onClick={() => {
        hapticTick();
        setMode(m);
      }}
    >
      {lbl}
    </button>
  );

  return (
    <div className="axxa-dash-activity">
      <div className="axxa-dash-activity-head">
        <span className="axxa-dash-activity-title">{label}</span>
        <div className="axxa-dash-actoggle-group" role="group">
          {toggleBtn("7d", "7d")}
          {toggleBtn("3d", "3d")}
        </div>
      </div>
      {agg && !hasData ? (
        <div className="axxa-dash-activity-empty">{emptyMsg}</div>
      ) : (
        <div className="axxa-dash-wave-wrap">
          <svg
            className="axxa-dash-wave"
            viewBox={`0 0 ${WAVE_W} ${WAVE_H}`}
            preserveAspectRatio="none"
            aria-label={label}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-cyan, #4cc9f0)"
                  stopOpacity="0.38"
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-cyan, #4cc9f0)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            <g className="axxa-wave-bob">
              <path
                className="axxa-wave-area"
                d={area}
                fill={`url(#${gradId})`}
              />
              {/* Grupo interno ondula (swell + skew) sem mexer no preenchimento.
                  SEM vector-effect: non-scaling-stroke quebra a normalização
                  do pathLength no Blink. */}
              <g className="axxa-wave-undulate">
                <path className="axxa-wave-line" d={line} pathLength={1} />
                <path className="axxa-wave-glow" d={line} pathLength={1} />
              </g>
            </g>
          </svg>
          {hasData && (
            <span
              className="axxa-wave-live"
              style={{
                left: `${(last.x / WAVE_W) * 100}%`,
                top: `${(last.y / WAVE_H) * 100}%`,
              }}
            />
          )}
          {/* Colunas invisíveis — tooltip nativo por ponto em cima da curva */}
          <div className="axxa-dash-wave-cols">
            {values.map((_, i) => (
              <span
                key={i}
                className="axxa-dash-wave-col"
                title={tooltips[i]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Cards de status — índice RAG (chunks/notas + última indexação + warning de
 * mismatch de modelo) e providers configurados. Clique abre as Settings.
 */
function StatusCards({
  plugin,
  onOpenSettings,
}: {
  plugin: AxxaPlugin;
  onOpenSettings?: () => void;
}) {
  const t = useT();
  const idx = plugin.vectorIndex;
  const hasIndex = !!idx && idx.size > 0;
  const mismatch =
    hasIndex && idx!.model !== plugin.settings.ragEmbeddingModel;

  const configured = PROVIDERS.filter((p) => providerConfigured(plugin, p.id));

  const ragDot = mismatch
    ? "axxa-dash-dot-warn"
    : hasIndex
      ? "axxa-dash-dot-ok"
      : "axxa-dash-dot-off";

  return (
    <div className="axxa-dash-status">
      <button
        type="button"
        className="axxa-dash-status-card"
        onClick={onOpenSettings}
        title={t.dashboard.ragTitle}
      >
        <span className="axxa-dash-status-icon">
          <Icon name="library" />
        </span>
        <span className="axxa-dash-status-main">
          <span className="axxa-dash-status-title">
            <span className={"axxa-dash-dot " + ragDot} />
            {t.dashboard.ragTitle}
          </span>
          <span className="axxa-dash-status-sub">
            {hasIndex
              ? t.dashboard.ragStats(formatCompact(idx!.size), idx!.fileCount)
              : t.dashboard.ragEmpty}
          </span>
          {(mismatch || (hasIndex && idx!.lastIndexedAt)) && (
            <span
              className={
                "axxa-dash-status-sub" +
                (mismatch ? " axxa-dash-status-warn" : "")
              }
            >
              {mismatch
                ? t.dashboard.ragMismatch
                : t.dashboard.ragLast(
                    formatRelativeDate(idx!.lastIndexedAt, t)
                  )}
            </span>
          )}
        </span>
        <span className="axxa-recent-chevron">
          <Icon name="chevron-right" />
        </span>
      </button>

      <button
        type="button"
        className="axxa-dash-status-card"
        onClick={onOpenSettings}
        title={t.dashboard.providersTitle}
      >
        <span className="axxa-dash-status-icon">
          <Icon name="plug-zap" />
        </span>
        <span className="axxa-dash-status-main">
          <span className="axxa-dash-status-title">
            <span
              className={
                "axxa-dash-dot " +
                (configured.length > 0 ? "axxa-dash-dot-ok" : "axxa-dash-dot-off")
              }
            />
            {t.dashboard.providersTitle}
          </span>
          <span className="axxa-dash-status-sub">
            {t.dashboard.providersCount(configured.length, PROVIDERS.length)}
          </span>
          <span className="axxa-dash-provider-icons">
            {PROVIDERS.map((p) => (
              <span
                key={p.id}
                className={
                  "axxa-dash-provider-ic" +
                  (providerConfigured(plugin, p.id)
                    ? " axxa-dash-provider-ic-on"
                    : "")
                }
                title={p.name}
              >
                <Icon name={"brand-" + p.id} />
              </span>
            ))}
          </span>
        </span>
        <span className="axxa-recent-chevron">
          <Icon name="chevron-right" />
        </span>
      </button>
    </div>
  );
}

/**
 * SegmentedRow — controle segmentado SÓ ÍCONE com pílula DESLIZANTE, igual o
 * nav do Threads (v0.1.127). Slots iguais (flex 1 1 0); o indicador (.axxa-seg-ind)
 * tem a largura de UM slot e desliza via translateX(--seg-i × 100%) com
 * transição — "muda de um pra outro". Sem label (largura menor / icon-only).
 */
function SegmentedRow({
  items,
  activeId,
  onSelect,
}: {
  items: { id: string; icon: string; label: string; title?: string; soon?: boolean }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const activeIndex = Math.max(
    0,
    items.findIndex((it) => it.id === activeId)
  );
  return (
    <div
      className="axxa-seg"
      role="tablist"
      style={
        {
          ["--seg-n" as string]: items.length,
          ["--seg-i" as string]: activeIndex,
        } as CSSProperties
      }
    >
      <span className="axxa-seg-ind" aria-hidden="true" />
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={it.id === activeId}
          aria-label={it.label}
          title={it.title ?? it.label}
          className={
            "axxa-seg-btn" + (it.id === activeId ? " axxa-seg-btn-active" : "")
          }
          onClick={() => onSelect(it.id)}
        >
          <Icon name={it.icon} />
        </button>
      ))}
    </div>
  );
}

/**
 * EffortSlider — slider tátil estilo "brilho" do One UI / Samsung (v0.1.127).
 * Clicável: toca ou arrasta em QUALQUER ponto pra setar o nível (sem hold).
 * Barra arredondada com fill accent; raios (zap) DOURADOS (gradiente + fake-3D)
 * como marcadores de intensidade. No drag: a barra CRESCE e o fundo do plugin
 * fica em SCRIM (escurece), exatamente igual o slider de brilho da Samsung.
 */
function EffortSlider({
  effort,
  onChange,
  liveLabel,
}: {
  effort: string;
  onChange: (level: EffortLevel) => void;
  liveLabel: string;
}) {
  const n = EFFORT_LEVELS.length;
  const idx = Math.max(0, EFFORT_LEVELS.indexOf(effort as EffortLevel));
  const [cur, setCur] = useState(idx);
  const [dragging, setDragging] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const draggingRef = useRef(false);
  const curRef = useRef(idx);

  // Sincroniza com mudança externa de effort (só quando NÃO está arrastando).
  useEffect(() => {
    if (!draggingRef.current) {
      setCur(idx);
      curRef.current = idx;
    }
  }, [idx]);

  // Se desmontar no meio do drag, garante que o scrim/lift do root saia.
  useEffect(() => () => rootRef.current?.classList.remove("axxa-eff-dragging"), []);

  // Fill em degraus (estilo brilho): low=1/n … max=n/n da barra.
  const pct = ((cur + 1) / n) * 100;

  const idxFromX = (clientX: number): number => {
    const el = barRef.current;
    if (!el) return curRef.current;
    const r = el.getBoundingClientRect();
    const p = r.width > 0 ? (clientX - r.left) / r.width : 0;
    return Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))));
  };

  const setLevel = (ni: number) => {
    if (ni === curRef.current) return;
    curRef.current = ni;
    setCur(ni);
    hapticTick();
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    // Acha a área do plugin pra escurecer (scrim) e elevar o slider.
    const root = barRef.current?.closest(".axxa-root") as HTMLElement | null;
    rootRef.current = root;
    root?.classList.add("axxa-eff-dragging");
    setDragging(true);
    setLevel(idxFromX(e.clientX));
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) setLevel(idxFromX(e.clientX));
  };
  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    rootRef.current?.classList.remove("axxa-eff-dragging");
    setDragging(false);
    if (curRef.current !== idx) onChange(EFFORT_LEVELS[curRef.current]);
  };

  const lvl = EFFORT_LEVELS[cur];

  // Conteúdo DENTRO da barra (raio à esquerda + nome + medidor de raios à
  // direita). Renderizado em DUAS camadas idênticas: a base (muted, sobre o
  // trilho) e a do fill (clara, recortada pelo fill) — o texto "acende" da
  // esquerda pra direita conforme o fill cobre, igual o slider da One UI.
  const content = (
    <>
      <span className="axxa-eff-ico">
        <Icon name="zap" />
      </span>
      <span className="axxa-eff-name">{EFFORT_LABELS[lvl]}</span>
      <span className="axxa-eff-spacer" />
      <span className="axxa-eff-meter">
        {EFFORT_LEVELS.map((l, i) => (
          <span
            key={l}
            className={
              "axxa-eff-pip" +
              (i <= cur ? " axxa-eff-pip-on" : "") +
              (i === cur ? " axxa-eff-pip-cur" : "")
            }
          >
            <Icon name="zap" />
          </span>
        ))}
      </span>
    </>
  );

  return (
    <div className="axxa-eff">
      {/* defs do gradiente DOURADO usado nos raios (fill via url(#...)) */}
      <svg
        width="0"
        height="0"
        aria-hidden="true"
        style={{ position: "absolute", width: 0, height: 0 }}
      >
        <defs>
          <linearGradient id="axxa-eff-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffe79a" />
            <stop offset="45%" stopColor="#f6c63f" />
            <stop offset="100%" stopColor="#c5830b" />
          </linearGradient>
        </defs>
      </svg>
      <div
        ref={barRef}
        className={"axxa-eff-bar" + (dragging ? " axxa-eff-bar-drag" : "")}
        style={{ ["--eff-pct" as string]: `${pct}%` } as CSSProperties}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="slider"
        aria-label={liveLabel}
        aria-valuemin={0}
        aria-valuemax={n - 1}
        aria-valuenow={cur}
        aria-valuetext={EFFORT_LABELS[lvl]}
      >
        <div className="axxa-eff-face axxa-eff-face-base" aria-hidden="true">
          {content}
        </div>
        <span className="axxa-eff-fill" />
        <div className="axxa-eff-face axxa-eff-face-fill" aria-hidden="true">
          {content}
        </div>
      </div>
      <span className="axxa-eff-desc">{EFFORT_DESCRIPTIONS[lvl]}</span>
      {/* SCRIM — escurece a área do plugin durante o drag (Samsung-style) */}
      {dragging &&
        rootRef.current &&
        createPortal(<div className="axxa-eff-scrim" />, rootRef.current)}
    </div>
  );
}

/** Ícone da saudação por hora (amanhecer / dia / noite). */
function greetingIcon(hour: number): string {
  if (hour >= 5 && hour < 12) return "sunrise";
  if (hour >= 12 && hour < 18) return "sun";
  return "moon";
}

/**
 * Launcher v2 (v0.1.131) — prompt starters por MODO. Clicar preenche + foca o
 * composer (via onPromptStarter). É a ação principal da home.
 */
function PromptStarters({
  mode,
  onPromptStarter,
}: {
  mode: string;
  onPromptStarter: (text: string) => void;
}) {
  const t = useT();
  const key =
    mode === "vault-qa" ? "vaultQa" : mode === "agent" ? "agent" : "chat";
  const items =
    t.dashboard.starters[key as "chat" | "vaultQa" | "agent"] ??
    t.dashboard.starters.chat;
  return (
    <div className="axxa-launcher" role="list">
      {items.map((text, i) => (
        <button
          key={i}
          type="button"
          role="listitem"
          className="axxa-launch-chip"
          onClick={() => {
            hapticTick();
            onPromptStarter(text);
          }}
        >
          <Icon name="sparkles" />
          <span className="axxa-launch-chip-txt">{text}</span>
          <Icon name="arrow-up-right" />
        </button>
      ))}
    </div>
  );
}

/**
 * Status compacto v2 (v0.1.131) — chips de UMA linha (índice RAG + providers)
 * no lugar dos dois cards altos. Toque abre Settings.
 */
function StatusChips({
  plugin,
  onOpenSettings,
}: {
  plugin: AxxaPlugin;
  onOpenSettings: () => void;
}) {
  const t = useT();
  const idx = plugin.vectorIndex;
  const hasIndex = !!idx && idx.size > 0;
  const mismatch = hasIndex && idx!.model !== plugin.settings.ragEmbeddingModel;
  const configured = PROVIDERS.filter((p) => providerConfigured(plugin, p.id));
  const ragDot = mismatch
    ? "axxa-dash-dot-warn"
    : hasIndex
      ? "axxa-dash-dot-ok"
      : "axxa-dash-dot-off";
  return (
    <div className="axxa-statuschips">
      <button
        type="button"
        className="axxa-statuschip"
        onClick={() => {
          hapticTick();
          onOpenSettings();
        }}
        title={t.dashboard.ragTitle}
      >
        <span className={"axxa-dash-dot " + ragDot} />
        <Icon name="library" />
        <span className="axxa-statuschip-v">
          {hasIndex ? formatCompact(idx!.size) : "off"}
        </span>
      </button>
      <button
        type="button"
        className="axxa-statuschip"
        onClick={() => {
          hapticTick();
          onOpenSettings();
        }}
        title={t.dashboard.providersTitle}
      >
        <span
          className={
            "axxa-dash-dot " +
            (configured.length > 0 ? "axxa-dash-dot-ok" : "axxa-dash-dot-off")
          }
        />
        <Icon name="plug-zap" />
        <span className="axxa-statuschip-v">
          {configured.length}/{PROVIDERS.length}
        </span>
      </button>
    </div>
  );
}

export function StarterScreen({
  plugin,
  provider,
  model,
  effort,
  mode,
  recentChats,
  summaries,
  activeModels,
  visibleChips,
  onProviderChange,
  onModelChange,
  onEffortChange,
  onModeChange,
  onLoadChat,
  onOpenConversations,
  onOpenSettings,
  onPromptStarter,
}: StarterScreenProps) {
  const t = useT();
  const modelOptions = activeModels[provider] ?? [];

  // (Overview/usage saiu daqui — vive em Settings → Usage. v0.1.120)
  // (Effort agora é o componente EffortSlider, com estado próprio. v0.1.122)
  // (Picker de modelo agora vive DENTRO do ModelInfoCard. v0.1.125)
  const hour = new Date().getHours();
  const greeting = greetingFor(hour, t);
  const lastChat = recentChats[0];

  // Provider segmented v2: só os CONFIGURADOS (+ garante o atual selecionado)
  // e um item "+" no fim que abre o Settings. v0.1.131
  const PROVIDER_ADD = "__add__";
  const configuredProv = PROVIDERS.filter((p) =>
    providerConfigured(plugin, p.id)
  );
  const provBase = configuredProv.some((p) => p.id === provider)
    ? configuredProv
    : [...PROVIDERS.filter((p) => p.id === provider), ...configuredProv];
  const provItems = [
    ...provBase.map((p) => ({ id: p.id, icon: p.icon, label: p.name })),
    { id: PROVIDER_ADD, icon: "plus", label: t.dashboard.providerAdd },
  ];

  // Resolve name/desc dos modos via i18n (chat / vault-qa / agent).
  const modeLabel = (id: string) => {
    if (id === "vault-qa") return t.modes.vaultQa;
    if (id === "agent") return t.modes.agent;
    if (id === "coder") return t.modes.coder;
    if (id === "study") return t.modes.study;
    return t.modes.chat;
  };
  const modeDesc = (id: string) => {
    if (id === "vault-qa") return t.modes.vaultQaDesc;
    if (id === "agent") return t.modes.agentDesc;
    if (id === "coder") return t.modes.coderDesc;
    if (id === "study") return t.modes.studyDesc;
    return t.modes.chatDesc;
  };

  return (
    <div className="axxa-starter axxa-dash">
      {/* Saudação viva (v0.1.131) — glifo por hora + greeting + retomar último */}
      <div className="axxa-starter-head">
        <h2 className="axxa-starter-title">
          <Icon name={greetingIcon(hour)} />
          {greeting}
        </h2>
        {lastChat ? (
          <button
            type="button"
            className="axxa-starter-resume"
            onClick={() => {
              hapticTick();
              onLoadChat(lastChat.id, lastChat.mode);
            }}
          >
            <Icon name="rotate-ccw" />
            <span className="axxa-starter-resume-label">
              {t.dashboard.resume}:
            </span>
            <span className="axxa-starter-resume-title">{lastChat.title}</span>
          </button>
        ) : (
          <p className="axxa-starter-subtitle">{t.dashboard.tagline}</p>
        )}
      </div>

      {/* Launcher — prompt starters por modo → preenchem o composer */}
      <PromptStarters mode={mode} onPromptStarter={onPromptStarter} />

      {/* ===== Nova conversa — setup (provider / modo+modelo / effort) ===== */}
      <div className="axxa-dash-setup">
      <SectionHead
        icon="message-circle-plus"
        title={t.dashboard.newChatLabel}
      />

      {/* Modo + Provider — JUNTOS no mesmo container, ambos SEGMENTED (mode
          igual provider: só ícone). Model fica por último, lá embaixo. v0.1.121 */}
      <div className="axxa-starter-section">
        {/* Mode + Provider + Effort — mesmo container, mas cada um com seu
            PRÓPRIO indicativo de texto (label + valor selecionado). v0.1.129 */}
        <div className="axxa-mp">
          {/* Modo */}
          <div className="axxa-seg-block">
            <span className="axxa-seg-head">
              {t.starter.modeLabel}
              <b className="axxa-seg-head-v">{modeLabel(mode)}</b>
            </span>
            <SegmentedRow
              items={MODES_META.map((m) => ({
                id: m.id,
                icon: m.icon,
                label: modeLabel(m.id),
                title: m.soon
                  ? t.modes.comingSoon(modeLabel(m.id))
                  : modeDesc(m.id),
                soon: m.soon,
              }))}
              activeId={mode}
              onSelect={(id) => {
                const meta = MODES_META.find((x) => x.id === id);
                if (meta?.soon) {
                  new Notice(t.modes.comingSoon(modeLabel(id)));
                  return;
                }
                hapticTick();
                onModeChange(id);
              }}
            />
          </div>
          {/* Provider */}
          <div className="axxa-seg-block">
            <span className="axxa-seg-head">
              {t.starter.providerLabel}
              <b className="axxa-seg-head-v">
                {PROVIDERS.find((p) => p.id === provider)?.name ?? provider}
              </b>
            </span>
            <SegmentedRow
              items={provItems}
              activeId={provider}
              onSelect={(id) => {
                if (id === PROVIDER_ADD) {
                  hapticTick();
                  onOpenSettings();
                  return;
                }
                hapticTick();
                onProviderChange(id);
              }}
            />
          </div>
          {/* Effort — slider tátil clicável (estilo brilho One UI) */}
          <div className="axxa-seg-block">
            <span className="axxa-seg-head">
              {t.starter.effortLabel}
              <b className="axxa-seg-head-v">
                {EFFORT_LABELS[effort as EffortLevel] ?? effort}
              </b>
            </span>
            <EffortSlider
              effort={effort}
              onChange={onEffortChange}
              liveLabel={t.dashboard.effortAdjusting}
            />
          </div>
        </div>
      </div>

      {/* Modelo — POR ÚLTIMO, abaixo do card de modo/provider. Card único com
          info + "Ver mais" + toggle DENTRO; o dropdown quebra pra fora. v0.1.125 */}
      <div className="axxa-starter-section">
        <label className="axxa-starter-label">{t.starter.modelLabel}</label>
        <ModelInfoCard
          provider={provider}
          model={model}
          modelOptions={modelOptions}
          onModelChange={onModelChange}
          plugin={plugin}
        />
      </div>
      </div>
      {/* ===== /Nova conversa ===== */}

      {recentChats.length > 0 && (
        <div className="axxa-starter-section">
          <SectionHead
            icon="history"
            title={t.starter.recentChatsLabel}
            actionLabel={t.dashboard.viewAll}
            onAction={onOpenConversations}
          />
          <div className="axxa-recent-list">
            {recentChats.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className={
                  "axxa-recent-item" + (i === 0 ? " axxa-recent-resume" : "")
                }
                data-mode={c.mode}
                onClick={() => {
                  hapticTick();
                  onLoadChat(c.id, c.mode);
                }}
              >
                <span className="axxa-recent-logo">
                  <Icon name={modelLogo(c.provider, c.model)} />
                </span>
                <span className="axxa-recent-main">
                  <span className="axxa-recent-top">
                    <span className="axxa-recent-title">{c.title}</span>
                    <span className="axxa-recent-date">
                      {formatRelativeDate(c.date, t)}
                    </span>
                  </span>
                  {/* Status line — só texto, sem fundo */}
                  <span className="axxa-composer-info axxa-recent-status">
                    {visibleChips.includes("mode") && (
                      <InfoChip
                        icon={modeChipIcon(c.mode)}
                        color={modeColor(c.mode)}
                      >
                        {c.mode}
                      </InfoChip>
                    )}
                    {visibleChips.includes("model") && (
                      <InfoChip icon="cpu" color={CHIP_COLORS.model}>
                        {c.model}
                      </InfoChip>
                    )}
                    {visibleChips.includes("messages") && (
                      <InfoChip
                        icon="message-square"
                        color={CHIP_COLORS.messages}
                      >
                        {c.messageCount}
                      </InfoChip>
                    )}
                    {visibleChips.includes("tokens") && (
                      <InfoChip icon="sigma" color={CHIP_COLORS.tokens}>
                        {formatTokens(c.tokensIn + c.tokensOut)}
                      </InfoChip>
                    )}
                  </span>
                </span>
                <span className="axxa-recent-chevron">
                  <Icon name="chevron-right" />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== Status — chips compactos de 1 linha (v0.1.131) ===== */}
      <StatusChips plugin={plugin} onOpenSettings={onOpenSettings} />
    </div>
  );
}
