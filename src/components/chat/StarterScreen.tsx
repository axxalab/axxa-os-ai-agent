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
  { id: "openrouter", name: "OpenRouter", icon: "shuffle" },
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
  onLoadChat: (chatId: string) => void;
}

// MODES_ICONS — só os ícones e ids ficam aqui. Nomes/descrições vêm do i18n.
const MODES_META = [
  { id: "chat" as const, icon: "message-square" },
  { id: "vault-qa" as const, icon: "library" },
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

  // Resolve name/desc dos modos via i18n (chat / vault-qa).
  const modeLabel = (id: string) =>
    id === "vault-qa" ? t.modes.vaultQa : t.modes.chat;
  const modeDesc = (id: string) =>
    id === "vault-qa" ? t.modes.vaultQaDesc : t.modes.chatDesc;

  return (
    <div className="axxa-starter">
      <div className="axxa-starter-head">
        <h2 className="axxa-starter-title">{t.starter.title}</h2>
        <p className="axxa-starter-subtitle">{t.starter.subtitle}</p>
      </div>

      <div className="axxa-starter-section">
        <label className="axxa-starter-label">{t.starter.modeLabel}</label>
        <div className="axxa-starter-providers">
          {MODES_META.map((m) => (
            <button
              key={m.id}
              type="button"
              className={
                "axxa-starter-provider-btn" +
                (m.id === mode ? " axxa-starter-provider-active" : "")
              }
              onClick={() => onModeChange(m.id)}
              title={modeDesc(m.id)}
            >
              <Icon name={m.icon} />
              <span>{modeLabel(m.id)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="axxa-starter-section">
        <label className="axxa-starter-label">{t.starter.providerLabel}</label>
        <div className="axxa-starter-providers">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={
                "axxa-starter-provider-btn" +
                (p.id === provider ? " axxa-starter-provider-active" : "")
              }
              onClick={() => onProviderChange(p.id)}
            >
              <Icon name={p.icon} />
              <span>{p.name}</span>
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
                onClick={() => onLoadChat(c.id)}
              >
                <div className="axxa-recent-title">{c.title}</div>
                <div className="axxa-recent-meta">
                  <span>{formatRelativeDate(c.date)}</span>
                  <span>·</span>
                  <span>{c.model}</span>
                  <span>·</span>
                  <span>{c.messageCount} msgs</span>
                  <span>·</span>
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
