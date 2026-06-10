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
import { Notice } from "obsidian";
import type AxxaPlugin from "../../main";
import { Icon } from "../_shared/Icon";
import { InfoChip } from "../_shared/InfoChip";
import { hapticTick } from "../_shared/haptics";
import {
  EFFORT_LEVELS,
  EFFORT_LABELS,
  EFFORT_EMOJIS,
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
  groupModelsByCategory,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from "../../providers/modelDescriptions";
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

/**
 * Card de info do modelo — descrição + categoria + cost + context window +
 * badges. Aparece abaixo do <select> da starter.
 *
 * Quando o modelo é desconhecido (sem card), mostra mensagem mais genérica.
 */
function ModelInfoCard({
  provider,
  model,
}: {
  provider: string;
  model: string;
}) {
  const t = useT();
  const info = getModelFullInfo(provider, model);
  const { card, caps, pricing } = info;

  // Tier (pago/free) — vira pílula no header.
  const tier = pricing.tier ?? "unknown";

  // Linha de custo (números reais): tokens in/out, por imagem, ou por chars (TTS).
  let costLine: string | null = null;
  if (pricing.imagePerCall != null) {
    costLine = `${formatUsd(pricing.imagePerCall)} / imagem`;
  } else if (pricing.charPerMillion != null) {
    costLine = `${formatUsd(pricing.charPerMillion)} / 1M chars`;
  } else if (
    pricing.inputPerMillion != null ||
    pricing.outputPerMillion != null
  ) {
    costLine = `${formatUsd(pricing.inputPerMillion)} in · ${formatUsd(
      pricing.outputPerMillion
    )} out / 1M`;
  }

  // Badges de capacidade — "free" sai (a pílula de tier já cobre).
  const badges = capabilityBadges(caps).filter((b) => b.id !== "free");

  return (
    <div className="axxa-model-card">
      <div className="axxa-model-card-top">
        <span className="axxa-model-card-avatar">
          <Icon name={modelLogo(provider, model)} />
        </span>
        <span className="axxa-model-card-id">
          <span className="axxa-model-card-name">{model}</span>
          <span className="axxa-model-card-cat">
            {CATEGORY_LABELS[card.category]}
          </span>
        </span>
        <span className={"axxa-model-tier axxa-model-tier-" + tier}>
          {tier === "free" ? "FREE" : tier === "paid" ? "PAID" : "?"}
        </span>
      </div>

      {badges.length > 0 && (
        <div className="axxa-model-caps" aria-label={t.starter.modelCapsAria}>
          {badges.map((b) => (
            <InfoChip
              key={b.id}
              icon={b.icon}
              color={CAP_COLORS[b.id]}
              title={modelCapTooltip(b.id, t)}
            >
              {b.label}
            </InfoChip>
          ))}
        </div>
      )}

      <div className="axxa-model-stats">
        {card.contextWindow != null && (
          <span className="axxa-model-stat" title="Context window">
            <Icon name="layers" />
            {formatContextWindow(card.contextWindow)} ctx
          </span>
        )}
        {costLine && (
          <span className="axxa-model-stat axxa-model-stat-cost" title="Preço">
            <Icon name="circle-dollar-sign" />
            {costLine}
          </span>
        )}
      </div>

      {card.description && (
        <div className="axxa-model-card-desc">{card.description}</div>
      )}
      {card.goodFor && (
        <div className="axxa-model-card-goodfor">
          <Icon name="sparkles" />
          <span>{card.goodFor}</span>
        </div>
      )}
    </div>
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
 * EffortSlider — slider TÁTIL com press-hold (v0.1.122). Vive no bloco de
 * seleção básica (Mode/Provider) como um segment. Tap NÃO muda nada; segurar
 * ~200ms "arma" (haptic forte + thumb cresce), aí arrastar troca de nível com
 * tick háptico por detente; soltar confirma. Evita mudança acidental.
 */
function EffortSlider({
  effort,
  onChange,
  holdLabel,
  liveLabel,
}: {
  effort: string;
  onChange: (level: EffortLevel) => void;
  holdLabel: string;
  liveLabel: string;
}) {
  const n = EFFORT_LEVELS.length;
  const idx = Math.max(0, EFFORT_LEVELS.indexOf(effort as EffortLevel));
  const [armed, setArmed] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef<number | null>(null);

  const cur = dragIdx ?? idx;
  const pct = n > 1 ? (cur / (n - 1)) * 100 : 0;

  const idxFromX = (clientX: number): number => {
    const el = railRef.current;
    if (!el) return idx;
    const r = el.getBoundingClientRect();
    const p = r.width > 0 ? (clientX - r.left) / r.width : 0;
    return Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))));
  };

  const clearHold = () => {
    if (holdRef.current != null) {
      window.clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const start = idxFromX(e.clientX);
    holdRef.current = window.setTimeout(() => {
      setArmed(true);
      setDragIdx(start);
      hapticTick(22);
    }, 200);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!armed) return;
    const ni = idxFromX(e.clientX);
    if (ni !== cur) {
      hapticTick();
      setDragIdx(ni);
    }
  };
  const onUp = () => {
    clearHold();
    if (armed && dragIdx != null && dragIdx !== idx) {
      onChange(EFFORT_LEVELS[dragIdx]);
    }
    setArmed(false);
    setDragIdx(null);
  };

  return (
    <div className={"axxa-eff" + (armed ? " axxa-eff-armed" : "")}>
      <div
        className="axxa-eff-track"
        style={{ ["--eff-pct" as string]: `${pct}%` } as CSSProperties}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="slider"
        aria-label={liveLabel}
        aria-valuemin={0}
        aria-valuemax={n - 1}
        aria-valuenow={cur}
        aria-valuetext={EFFORT_LABELS[EFFORT_LEVELS[cur]]}
      >
        <span className="axxa-eff-fill" />
        <div className="axxa-eff-rail" ref={railRef}>
          {EFFORT_LEVELS.map((lvl, i) => (
            <span
              key={lvl}
              className={"axxa-eff-dot" + (i <= cur ? " axxa-eff-dot-on" : "")}
              style={{ left: `${(i / (n - 1)) * 100}%` }}
            />
          ))}
          <span className="axxa-eff-thumb" style={{ left: `${pct}%` }}>
            <span className="axxa-eff-thumb-dot">
              {EFFORT_EMOJIS[EFFORT_LEVELS[cur]]}
            </span>
          </span>
        </div>
      </div>
      <div className="axxa-eff-meta">
        <span className="axxa-eff-name">{EFFORT_LABELS[EFFORT_LEVELS[cur]]}</span>
        <span className="axxa-eff-hint">{armed ? liveLabel : holdLabel}</span>
      </div>
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
}: StarterScreenProps) {
  const t = useT();
  const modelOptions = activeModels[provider] ?? [];
  const [pickerOpen, setPickerOpen] = useState(false);
  const modelFieldRef = useRef<HTMLDivElement>(null);

  // (Overview/usage saiu daqui — vive em Settings → Usage. v0.1.120)
  // (Effort agora é o componente EffortSlider, com estado próprio. v0.1.122)
  const greeting = greetingFor(new Date().getHours(), t);

  // Fecha o dropdown de modelo ao clicar fora ou apertar Escape.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (
        modelFieldRef.current &&
        !modelFieldRef.current.contains(e.target as Node)
      ) {
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
      <div className="axxa-starter-head">
        <h2 className="axxa-starter-title">{greeting} 👋</h2>
        <p className="axxa-starter-subtitle">{t.dashboard.tagline}</p>
      </div>

      {/* ===== Nova conversa — setup (provider / modo+modelo / effort) ===== */}
      <div className="axxa-dash-setup">
      <SectionHead
        icon="message-circle-plus"
        title={t.dashboard.newChatLabel}
      />

      {/* Modo + Provider — JUNTOS no mesmo container, ambos SEGMENTED (mode
          igual provider: só ícone). Model fica por último, lá embaixo. v0.1.121 */}
      <div className="axxa-starter-section">
        <label className="axxa-starter-label">
          {t.starter.modeLabel} · {t.starter.providerLabel} ·{" "}
          {t.starter.effortLabel}
        </label>
        <div className="axxa-mp">
          {/* Mode — segmented icon, idêntico ao provider */}
          <div className="axxa-settings-subtabs axxa-provider-seg" role="tablist">
            {MODES_META.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={m.id === mode}
                aria-label={modeLabel(m.id)}
                className={
                  "clickable-icon axxa-subtab-btn axxa-subtab-icon" +
                  (m.id === mode ? " axxa-subtab-active" : "")
                }
                onClick={() => {
                  if (m.soon) {
                    new Notice(t.modes.comingSoon(modeLabel(m.id)));
                    return;
                  }
                  hapticTick();
                  onModeChange(m.id);
                }}
                title={
                  m.soon ? t.modes.comingSoon(modeLabel(m.id)) : modeDesc(m.id)
                }
              >
                <Icon name={m.icon} />
                <span className="axxa-subtab-label">{modeLabel(m.id)}</span>
              </button>
            ))}
          </div>
          {/* Provider — segmented icon */}
          <div className="axxa-settings-subtabs axxa-provider-seg" role="tablist">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={p.id === provider}
                aria-label={p.name}
                className={
                  "clickable-icon axxa-subtab-btn axxa-subtab-icon" +
                  (p.id === provider ? " axxa-subtab-active" : "")
                }
                onClick={() => {
                  hapticTick();
                  onProviderChange(p.id);
                }}
                title={p.name}
              >
                <Icon name={p.icon} />
                <span className="axxa-subtab-label">{p.name}</span>
              </button>
            ))}
          </div>
          {/* Effort — slider TÁTIL (press-hold), dentro do bloco básico */}
          <EffortSlider
            effort={effort}
            onChange={onEffortChange}
            holdLabel={t.dashboard.effortHold}
            liveLabel={t.dashboard.effortAdjusting}
          />
        </div>
      </div>

      {/* Modelo — POR ÚLTIMO, abaixo do card de modo/provider. Trigger +
          dropdown + card de info (inalterado). v0.1.121 */}
      <div className="axxa-starter-section">
        <label className="axxa-starter-label">{t.starter.modelLabel}</label>
        {/* v0.1.122: card EM CIMA, seletor de modelo EMBAIXO */}
        <ModelInfoCard provider={provider} model={model} />
        <div className="axxa-model-field" ref={modelFieldRef}>
          <button
            type="button"
            className={
              "axxa-model-trigger" + (pickerOpen ? " axxa-model-trigger-open" : "")
            }
            onClick={() => setPickerOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
          >
            <span className="axxa-model-trigger-logo">
              <Icon name={modelLogo(provider, model)} />
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
              modelOptions={
                modelOptions.includes(model)
                  ? modelOptions
                  : [model, ...modelOptions]
              }
              onSelect={(m) => {
                hapticTick();
                onModelChange(m);
                setPickerOpen(false);
              }}
            />
          )}
        </div>
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
            {recentChats.map((c) => (
              <button
                key={c.id}
                type="button"
                className="axxa-recent-item"
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

      {/* ===== Status — índice RAG + providers configurados ===== */}
      <div className="axxa-starter-section">
        <SectionHead icon="activity" title={t.dashboard.statusLabel} />
        <StatusCards plugin={plugin} onOpenSettings={onOpenSettings} />
      </div>

      <p className="axxa-starter-hint">{t.starter.hint}</p>
    </div>
  );
}
