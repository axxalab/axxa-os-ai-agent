// src/components/chat/NewChatScreen.tsx
// Base de "nova conversa" (v0.1.219). Substitui a StarterScreen quando o user
// abre um chat novo pela gaveta (New chat / New Q&A / New Agent): saudação por
// modo + os MESMOS seletores de provider e de modelo da StarterScreen
// (SegmentedRow de providers + ModelInfoCard, reusados v0.1.220) + o Composer
// (renderizado por fora, embaixo). SEM dashboard/stats/recentes — é a base limpa.

import { Icon } from "../_shared/Icon";
import { SegmentedRow } from "../_shared/SegmentedRow";
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
}

const PROVIDER_ADD = "__add__";

export function NewChatScreen({
  mode,
  plugin,
  provider,
  onProviderChange,
  onOpenSettings,
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
      <div className="axxa-newchat-inner">
        {/* Provider ACIMA da saudação — mesmo seg-block da StarterScreen. */}
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

        <div className="axxa-newchat-head">
          <span className="axxa-newchat-icon">
            <Icon name={icon} />
          </span>
          <h2 className="axxa-newchat-title">{title}</h2>
          <p className="axxa-newchat-sub">{sub}</p>
        </div>
      </div>
    </div>
  );
}
