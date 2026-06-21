// src/components/chat/NewChatScreen.tsx
// Base de "nova conversa" (v0.1.219). Substitui a StarterScreen quando o user
// abre um chat novo pela gaveta (New chat / New Q&A / New Agent): saudação por
// modo + os MESMOS seletores de provider e de modelo da StarterScreen
// (SegmentedRow de providers + ModelInfoCard, reusados v0.1.220) + o Composer
// (renderizado por fora, embaixo). SEM dashboard/stats/recentes — é a base limpa.

import { Icon } from "../_shared/Icon";
import { SegmentedRow } from "../_shared/SegmentedRow";
import { ComposerSuggestions } from "../composer/ComposerSuggestions";
import { hapticTick } from "../_shared/haptics";
import { useT } from "../../i18n";
import type AxxaPlugin from "../../main";
import { PROVIDERS, providerConfigured } from "./StarterScreen";

/** Ícone + textos por modo. chat | vault-qa | agent. */
function modeBits(mode: string, t: ReturnType<typeof useT>) {
  switch (mode) {
    case "vault-qa":
      return {
        icon: "library",
        title: t.newChatScreen.vaultQaTitle,
        sub: t.newChatScreen.vaultQaSub,
      };
    case "agent":
      return {
        icon: "bot",
        title: t.newChatScreen.agentTitle,
        sub: t.newChatScreen.agentSub,
      };
    default:
      return {
        icon: "message-square",
        title: t.newChatScreen.chatTitle,
        sub: t.newChatScreen.chatSub,
      };
  }
}

interface NewChatScreenProps {
  mode: string;
  plugin: AxxaPlugin;
  provider: string;
  onProviderChange: (provider: string) => void;
  /** "+" no provider / abrir Settings. */
  onOpenSettings: () => void;
  /** Injeta o prompt do balão de sugestão no composer. */
  onPickSuggestion: (text: string) => void;
  /** Abre o bottom sheet "See more" com a lista completa do modo. */
  onSeeMoreSuggestions: () => void;
  /** Mostra os balões (chat vazio + editor do composer ainda vazio). */
  showSuggestions: boolean;
}

const PROVIDER_ADD = "__add__";

export function NewChatScreen({
  mode,
  plugin,
  provider,
  onProviderChange,
  onOpenSettings,
  onPickSuggestion,
  onSeeMoreSuggestions,
  showSuggestions,
}: NewChatScreenProps) {
  const t = useT();
  const { icon, title, sub } = modeBits(mode, t);

  // Provider segmented: só os CONFIGURADOS (+ garante o atual) e um "+" no fim
  // que abre Settings — idêntico à StarterScreen. v0.1.220
  const configuredProv = PROVIDERS.filter((p) => providerConfigured(plugin, p.id));
  const provBase = configuredProv.some((p) => p.id === provider)
    ? configuredProv
    : [...PROVIDERS.filter((p) => p.id === provider), ...configuredProv];
  const provItems = [
    ...provBase.map((p) => ({ id: p.id, icon: p.icon, label: p.name })),
    { id: PROVIDER_ADD, icon: "plus", label: t.dashboard.providerAdd },
  ];

  return (
    <div className="axxa-newchat" data-mode={mode}>
      {/* Disposição: saudação (welcome) CENTRADA · seletor de provider logo
          ABAIXO dela · balões no FUNDO (acima do composer). */}
      <div className="axxa-newchat-head">
        <span className="axxa-newchat-icon">
          <Icon name={icon} />
        </span>
        <h2 className="axxa-newchat-title">{title}</h2>
        <p className="axxa-newchat-sub">{sub}</p>
      </div>

      <div className="axxa-newchat-provider">
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
              hapticTick();
              if (id === PROVIDER_ADD) {
                onOpenSettings();
                return;
              }
              onProviderChange(id);
            }}
          />
        </div>
      </div>

      {/* Balões — no fundo, acima do composer (o .axxa-newchat reserva a altura
          dele). 3 visíveis + "See more" → bottom sheet com a lista completa. */}
      {showSuggestions && (
        <ComposerSuggestions
          mode={mode}
          onPick={onPickSuggestion}
          onSeeMore={onSeeMoreSuggestions}
        />
      )}
    </div>
  );
}
