// src/components/chat/StarterScreen.tsx
// Tela inicial quando chat tá vazio:
//   - Provider buttons + model dropdown + effort row
//   - Recent chats list (últimos 5 chats salvos) — clique carrega
//   - Quando user manda primeira msg, AxxaApp chama lockSession()

import { Icon } from "../_shared/Icon";
import {
  EFFORT_LEVELS,
  EFFORT_LABELS,
  EFFORT_DESCRIPTIONS,
  type EffortLevel,
} from "../_shared/effort";
import type { ChatSummary } from "../_shared/chatPersistence";
import { formatTokens } from "../_shared/contextWindows";
import { useT } from "../../i18n";

const PROVIDERS = [
  { id: "openai", name: "OpenAI", icon: "sparkles" },
  { id: "anthropic", name: "Anthropic", icon: "bot" },
  { id: "gemini", name: "Gemini", icon: "sparkle" },
  { id: "openrouter", name: "OpenRouter", icon: "shuffle" },
  { id: "nim", name: "Nvidia NIM", icon: "cpu" },
  { id: "ollama", name: "Ollama", icon: "hard-drive" },
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
          {modelOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="axxa-starter-section">
        <label className="axxa-starter-label">{t.starter.effortLabel}</label>
        <div className="axxa-starter-effort">
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
                title={EFFORT_DESCRIPTIONS[level]}
              >
                {EFFORT_LABELS[level]}
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
                <div className="axxa-recent-meta">
                  <span>{formatRelativeDate(c.date)}</span>
                  <span className="axxa-recent-meta-dot" aria-hidden="true" />
                  <span>{c.model}</span>
                  <span className="axxa-recent-meta-dot" aria-hidden="true" />
                  <span>{c.messageCount} msgs</span>
                  <span className="axxa-recent-meta-dot" aria-hidden="true" />
                  <span>{formatTokens(c.tokensIn + c.tokensOut)} tokens</span>
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
