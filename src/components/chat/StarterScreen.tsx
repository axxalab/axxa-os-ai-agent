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

const PROVIDERS = [
  { id: "openai", name: "OpenAI", icon: "sparkles" },
  { id: "anthropic", name: "Anthropic", icon: "bot" },
  { id: "openrouter", name: "OpenRouter", icon: "shuffle" },
  { id: "ollama", name: "Ollama", icon: "hard-drive" },
];

const MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "o1", "o3", "gpt-5"],
  anthropic: [
    "claude-opus-4-8",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
  ],
  openrouter: [
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "meta-llama/llama-3.3-70b-instruct",
    "google/gemini-2.0-flash-001",
  ],
  ollama: ["llama3.2", "qwen2.5", "deepseek-r1", "mistral"],
};

interface StarterScreenProps {
  provider: string;
  model: string;
  effort: string;
  recentChats: ChatSummary[];
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onEffortChange: (level: EffortLevel) => void;
  onLoadChat: (chatId: string) => void;
}

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
  recentChats,
  onProviderChange,
  onModelChange,
  onEffortChange,
  onLoadChat,
}: StarterScreenProps) {
  const modelOptions = MODELS[provider] ?? [];

  return (
    <div className="axxa-starter">
      <div className="axxa-starter-head">
        <h2 className="axxa-starter-title">Nova conversa</h2>
        <p className="axxa-starter-subtitle">
          Configure antes de começar — provider e modelo travam ao mandar a primeira mensagem.
        </p>
      </div>

      <div className="axxa-starter-section">
        <label className="axxa-starter-label">Provider</label>
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
        <label className="axxa-starter-label">Modelo</label>
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
        <label className="axxa-starter-label">Effort</label>
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
          <label className="axxa-starter-label">Conversas recentes</label>
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

      <p className="axxa-starter-hint">
        Mande a primeira mensagem pra começar. Provider e modelo travam — só Effort pode mudar depois (via "+").
      </p>
    </div>
  );
}
