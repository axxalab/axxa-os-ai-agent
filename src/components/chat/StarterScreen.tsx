// src/components/chat/StarterScreen.tsx
// Dashboard inicial quando chat tá vazio (v0.1.103):
//   - Saudação por hora do dia + tagline
//   - Visão geral: stat cards (conversas/mensagens/tokens/gasto) + atividade 14d
//   - Nova conversa: provider buttons + model dropdown + effort row
//   - Recent chats list (últimos 8 chats salvos) — clique carrega
//   - Status: índice RAG + providers configurados (clique abre Settings)
//   - Quando user manda primeira msg, AxxaApp chama lockSession()

import { useState, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { Notice } from "obsidian";
import type AxxaPlugin from "../../main";
import { Icon } from "../_shared/Icon";
import { InfoChip } from "../_shared/InfoChip";
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
 * Mini bar chart dos últimos 14 dias — altura proporcional a tokens/dia.
 * Sem lib: barras flex com height inline. Tooltip nativo por dia.
 * agg=null (carregando) → barras fantasma na altura mínima.
 */
function ActivityChart({ agg }: { agg: UsageAggregate | null }) {
  const t = useT();
  const days: DaySlot[] = agg
    ? lastNDays(agg.byDay, 14)
    : new Array(14).fill(null);
  const max = days.reduce(
    (m, d) => Math.max(m, d ? d.bucket.tokensIn + d.bucket.tokensOut : 0),
    0
  );
  const hasData = max > 0;

  return (
    <div className="axxa-dash-activity">
      {agg && !hasData ? (
        <div className="axxa-dash-activity-empty">
          {t.dashboard.activityEmpty}
        </div>
      ) : (
        <div className="axxa-dash-bars" aria-label={t.dashboard.activityLabel}>
          {days.map((d, i) => {
            const tokens = d ? d.bucket.tokensIn + d.bucket.tokensOut : 0;
            const pct = hasData
              ? Math.max(6, Math.round((tokens / max) * 100))
              : 6;
            const isToday = d != null && i === days.length - 1;
            return (
              <span
                key={d?.day ?? i}
                className={
                  "axxa-dash-bar" +
                  (tokens > 0 ? " axxa-dash-bar-on" : "") +
                  (isToday ? " axxa-dash-bar-today" : "")
                }
                style={{ height: `${pct}%` }}
                title={
                  d
                    ? `${d.day.slice(8, 10)}/${d.day.slice(5, 7)} — ${t.dashboard.activityDay(
                        d.bucket.chats,
                        formatTokens(tokens)
                      )}`
                    : undefined
                }
              />
            );
          })}
        </div>
      )}
      <div className="axxa-dash-bars-caption">
        <span>{t.dashboard.activityLabel}</span>
        <span>{t.dashboard.activityToday}</span>
      </div>
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

  // Agregação de uso (todo o histórico) — derivada dos summaries que o
  // AxxaApp já carregou pra lista de recentes. Zero IO aqui: só CPU
  // (pricing por chat + buckets), memoizado por referência do array.
  const agg: UsageAggregate | null = useMemo(
    () => (summaries ? aggregateFromSummaries(summaries) : null),
    [summaries]
  );

  // Stats derivadas — "—" enquanto carrega.
  const totalMessages = agg
    ? agg.chats.reduce((n, c) => n + c.messages, 0)
    : null;
  const statChats = agg ? formatCompact(agg.total.chats) : "—";
  const statMessages = totalMessages != null ? formatCompact(totalMessages) : "—";
  const statTokens = agg
    ? formatTokens(agg.total.tokensIn + agg.total.tokensOut)
    : "—";
  const statCost = agg
    ? formatUsd(agg.total.cost) + (agg.total.hasUnknownCost ? "*" : "")
    : "—";

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

      {/* ===== Visão geral — stat cards + atividade 14d ===== */}
      <div className="axxa-starter-section">
        <SectionHead
          icon="layout-dashboard"
          title={t.dashboard.overviewLabel}
        />
        <div className="axxa-dash-stats">
          <StatCard
            icon="messages-square"
            color={CHIP_COLORS.messages}
            label={t.dashboard.statChats}
            value={statChats}
          />
          <StatCard
            icon="message-square"
            color={CHIP_COLORS.mode}
            label={t.dashboard.statMessages}
            value={statMessages}
          />
          <StatCard
            icon="sigma"
            color="var(--color-blue, #4361ee)"
            label={t.dashboard.statTokens}
            value={statTokens}
          />
          <StatCard
            icon="circle-dollar-sign"
            color={CHIP_COLORS.tokens}
            label={t.dashboard.statCost}
            value={statCost}
            title={
              agg?.total.hasUnknownCost
                ? t.settings.usagePartialFootnote
                : undefined
            }
          />
        </div>
        <ActivityChart agg={agg} />
      </div>

      {/* ===== Nova conversa — setup (modo/provider/modelo/effort) ===== */}
      <div className="axxa-dash-setup">
      <SectionHead
        icon="message-circle-plus"
        title={t.dashboard.newChatLabel}
      />
      <div className="axxa-starter-section">
        <label className="axxa-starter-label">{t.starter.modeLabel}</label>
        <div className="axxa-starter-segment" role="tablist">
          {MODES_META.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={m.id === mode}
              className={
                "axxa-starter-segment-btn" +
                (m.id === mode ? " axxa-starter-segment-active" : "") +
                (m.soon ? " axxa-starter-segment-soon" : "")
              }
              onClick={() => {
                if (m.soon) {
                  new Notice(t.modes.comingSoon(modeLabel(m.id)));
                  return;
                }
                onModeChange(m.id);
              }}
              title={m.soon ? t.modes.comingSoon(modeLabel(m.id)) : modeDesc(m.id)}
            >
              <Icon name={m.icon} />
              <span className="axxa-starter-segment-label">{modeLabel(m.id)}</span>
              {m.soon && (
                <span className="axxa-starter-segment-badge">
                  {t.modes.soonBadge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="axxa-starter-section">
        <label className="axxa-starter-label">{t.starter.providerLabel}</label>
        <div className="axxa-settings-subtabs axxa-provider-seg" role="tablist">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === provider}
              aria-label={p.name}
              className={
                "axxa-subtab-btn axxa-subtab-icon" +
                (p.id === provider ? " axxa-subtab-active" : "")
              }
              onClick={() => onProviderChange(p.id)}
              title={p.name}
            >
              <Icon name={p.icon} />
            </button>
          ))}
        </div>
      </div>

      <div className="axxa-starter-section">
        <label className="axxa-starter-label">{t.starter.modelLabel}</label>
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
                onModelChange(m);
                setPickerOpen(false);
              }}
            />
          )}
        </div>
        {/* Model card: descrição + cost + caps */}
        <ModelInfoCard provider={provider} model={model} />
      </div>

      <div className="axxa-starter-section">
        <label className="axxa-starter-label">{t.starter.effortLabel}</label>
        {/* v0.1.101: segmented full-width (igual aos Settings) com THUMB que
            desliza animado pro nível selecionado. Raios = intensidade (1→5). */}
        <div
          className="axxa-effort-seg"
          role="radiogroup"
          aria-label={t.starter.effortLabel}
          style={
            {
              "--eff-idx": EFFORT_LEVELS.indexOf(effort as EffortLevel),
            } as CSSProperties
          }
        >
          <span className="axxa-effort-seg-thumb" aria-hidden="true" />
          {EFFORT_LEVELS.map((level, idx) => {
            const active = level === effort;
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={active}
                className={
                  "axxa-effort-seg-btn" +
                  (active ? " axxa-effort-seg-active" : "")
                }
                onClick={() => onEffortChange(level)}
                title={`${EFFORT_LABELS[level]} — ${EFFORT_DESCRIPTIONS[level]}`}
                aria-label={EFFORT_LABELS[level]}
              >
                <span className="axxa-effort-seg-bolts">
                  {"⚡".repeat(idx + 1)}
                </span>
              </button>
            );
          })}
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
                onClick={() => onLoadChat(c.id, c.mode)}
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
