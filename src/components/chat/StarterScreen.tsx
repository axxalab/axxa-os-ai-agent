// src/components/chat/StarterScreen.tsx
// Mostra antes da primeira mensagem (chat vazio) — Module 2.1 Session Modal,
// mas como starter screen embedded ao invés de modal flutuante.
// Permite escolher provider, modelo e effort.
// Quando user manda a primeira msg, AxxaApp chama lockSession() e isso some.
// Depois disso, só Effort é mutável (via PlusModal no "+").

import { Icon } from "../_shared/Icon";
import {
  EFFORT_LEVELS,
  EFFORT_LABELS,
  EFFORT_DESCRIPTIONS,
  type EffortLevel,
} from "../_shared/effort";

const PROVIDERS = [
  { id: "openai", name: "OpenAI", icon: "sparkles" },
  { id: "anthropic", name: "Anthropic", icon: "bot" },
];

// Modelos relevantes hardcoded — user pode personalizar via Settings (fetch da API)
const MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "o1", "o3", "gpt-5"],
  anthropic: [
    "claude-opus-4-8",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
  ],
};

interface StarterScreenProps {
  provider: string;
  model: string;
  effort: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onEffortChange: (level: EffortLevel) => void;
}

export function StarterScreen({
  provider,
  model,
  effort,
  onProviderChange,
  onModelChange,
  onEffortChange,
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
          {/* Caso o modelo atual não esteja na lista hardcoded (ex: API fetch),
              mostra ele mesmo assim */}
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

      <p className="axxa-starter-hint">
        Mande a primeira mensagem pra começar. Provider e modelo travam — só Effort pode mudar depois (via "+").
      </p>
    </div>
  );
}
