// src/components/chat/StarterScreen.tsx
// Tela inicial quando chat tá vazio:
//   - Provider buttons + model dropdown + effort row
//   - Recent chats list (últimos 5 chats salvos) — clique carrega
//   - Quando user manda primeira msg, AxxaApp chama lockSession()

import { Icon } from "../_shared/Icon";
import { InfoChip } from "../_shared/InfoChip";
import {
  EFFORT_LEVELS,
  EFFORT_LABELS,
  EFFORT_EMOJIS,
  EFFORT_DESCRIPTIONS,
  type EffortLevel,
} from "../_shared/effort";
import type { ChatSummary } from "../_shared/chatPersistence";
import { formatTokens } from "../_shared/contextWindows";
import { useT } from "../../i18n";
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

  // Linha de custo: tokens in/out OU por chamada (image), OU free
  let costLine: string | null = null;
  if (pricing.tier === "free") {
    costLine = "FREE";
  } else if (pricing.imagePerCall != null) {
    costLine = `${formatUsd(pricing.imagePerCall)} por imagem`;
  } else if (
    pricing.inputPerMillion != null ||
    pricing.outputPerMillion != null
  ) {
    const inS =
      pricing.inputPerMillion != null
        ? formatUsd(pricing.inputPerMillion)
        : "—";
    const outS =
      pricing.outputPerMillion != null
        ? formatUsd(pricing.outputPerMillion)
        : "—";
    costLine = `${inS} in / ${outS} out · por 1M tokens`;
  }

  return (
    <div className="axxa-model-card">
      <div className="axxa-model-card-head">
        <span className="axxa-model-card-category">
          {CATEGORY_LABELS[card.category]}
        </span>
        {card.contextWindow != null && (
          <span className="axxa-model-card-ctx">
            {formatContextWindow(card.contextWindow)} ctx
          </span>
        )}
        {costLine && (
          <span className="axxa-model-card-cost">{costLine}</span>
        )}
      </div>
      <div className="axxa-model-card-desc">{card.description}</div>
      {card.goodFor && (
        <div className="axxa-model-card-goodfor">
          <span className="axxa-model-card-goodfor-label">Bom pra:</span>{" "}
          {card.goodFor}
        </div>
      )}
      <div className="axxa-model-caps" aria-label={t.starter.modelCapsAria}>
        {capabilityBadges(caps).map((b) => (
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
  { id: "openai", name: "OpenAI", icon: "zap" },
  { id: "anthropic", name: "Anthropic", icon: "zap" },
  { id: "gemini", name: "Gemini", icon: "zap" },
  { id: "openrouter", name: "OpenRouter", icon: "zap" },
  { id: "nim", name: "Nvidia NIM", icon: "zap" },
  { id: "ollama", name: "Ollama", icon: "zap" },
];

interface StarterScreenProps {
  provider: string;
  model: string;
  effort: string;
  mode: string;
  recentChats: ChatSummary[];
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
}

// MODES_ICONS — só os ícones e ids ficam aqui. Nomes/descrições vêm do i18n.
const MODES_META = [
  { id: "chat" as const, icon: "message-square" },
  { id: "vault-qa" as const, icon: "library" },
  { id: "agent" as const, icon: "bot" },
];

function formatRelativeDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return iso.slice(0, 10);
  }
}

export function StarterScreen({
  provider,
  model,
  effort,
  mode,
  recentChats,
  activeModels,
  visibleChips,
  onProviderChange,
  onModelChange,
  onEffortChange,
  onModeChange,
  onLoadChat,
}: StarterScreenProps) {
  const t = useT();
  const modelOptions = activeModels[provider] ?? [];

  // Resolve name/desc dos modos via i18n (chat / vault-qa / agent).
  const modeLabel = (id: string) => {
    if (id === "vault-qa") return t.modes.vaultQa;
    if (id === "agent") return t.modes.agent;
    return t.modes.chat;
  };
  const modeDesc = (id: string) => {
    if (id === "vault-qa") return t.modes.vaultQaDesc;
    if (id === "agent") return t.modes.agentDesc;
    return t.modes.chatDesc;
  };

  return (
    <div className="axxa-starter">
      <div className="axxa-starter-head">
        <h2 className="axxa-starter-title">{t.starter.title}</h2>
        <p className="axxa-starter-subtitle">{t.starter.subtitle}</p>
      </div>

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
                (m.id === mode ? " axxa-starter-segment-active" : "")
              }
              onClick={() => onModeChange(m.id)}
              title={modeDesc(m.id)}
            >
              <Icon name={m.icon} />
              <span className="axxa-starter-segment-label">{modeLabel(m.id)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="axxa-starter-section">
        <label className="axxa-starter-label">{t.starter.providerLabel}</label>
        <div className="axxa-starter-segment" role="tablist">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === provider}
              className={
                "axxa-starter-segment-btn" +
                (p.id === provider ? " axxa-starter-segment-active" : "")
              }
              onClick={() => onProviderChange(p.id)}
              title={p.name}
            >
              <Icon name={p.icon} />
              <span className="axxa-starter-segment-label">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="axxa-starter-section">
        <label className="axxa-starter-label">{t.starter.modelLabel}</label>
        <select
          className="dropdown axxa-starter-model"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
        >
          {!modelOptions.includes(model) && (
            <option value={model}>{model}</option>
          )}
          {(() => {
            // Agrupa modelos por categoria via <optgroup>
            const grouped = groupModelsByCategory(provider, modelOptions);
            return CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map(
              (cat) => (
                <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
                  {(grouped.get(cat) ?? []).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </optgroup>
              )
            );
          })()}
        </select>
        {/* Model card: descrição + cost + caps */}
        <ModelInfoCard provider={provider} model={model} />
      </div>

      <div className="axxa-starter-section">
        <label className="axxa-starter-label">{t.starter.effortLabel}</label>
        {/* v0.1.66: emoji-based segmented pilled control */}
        <div className="axxa-starter-effort axxa-starter-effort-emoji">
          {EFFORT_LEVELS.map((level) => {
            const active = level === effort;
            return (
              <button
                key={level}
                type="button"
                className={
                  "axxa-starter-effort-btn" + (active ? " axxa-starter-effort-active" : "")
                }
                onClick={() => onEffortChange(level)}
                title={`${EFFORT_LABELS[level]} — ${EFFORT_DESCRIPTIONS[level]}`}
                aria-label={EFFORT_LABELS[level]}
              >
                <span className="axxa-starter-effort-emoji-icon">
                  {EFFORT_EMOJIS[level]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {recentChats.length > 0 && (
        <div className="axxa-starter-section">
          <label className="axxa-starter-label">{t.starter.recentChatsLabel}</label>
          <div className="axxa-recent-list">
            {recentChats.map((c) => (
              <button
                key={c.id}
                type="button"
                className="axxa-recent-item"
                onClick={() => onLoadChat(c.id, c.mode)}
              >
                <div className="axxa-recent-title">{c.title}</div>
                {/* Meta single-line — chips curados via Settings → Chips list */}
                <div className="axxa-composer-info axxa-recent-meta">
                  {visibleChips.includes("mode") && (
                    <InfoChip icon={modeChipIcon(c.mode)} color={CHIP_COLORS.mode}>
                      {c.mode}
                    </InfoChip>
                  )}
                  {visibleChips.includes("model") && (
                    <InfoChip icon="cpu" color={CHIP_COLORS.model}>
                      {c.model}
                    </InfoChip>
                  )}
                  {visibleChips.includes("date") && (
                    <InfoChip icon="clock" color={CHIP_COLORS.date}>
                      {formatRelativeDate(c.date)}
                    </InfoChip>
                  )}
                  {visibleChips.includes("messages") && (
                    <InfoChip icon="message-square" color={CHIP_COLORS.messages}>
                      {c.messageCount}
                    </InfoChip>
                  )}
                  {visibleChips.includes("tokens") && (
                    <InfoChip icon="sigma" color={CHIP_COLORS.tokens}>
                      {formatTokens(c.tokensIn + c.tokensOut)}
                    </InfoChip>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="axxa-starter-hint">{t.starter.hint}</p>
    </div>
  );
}
