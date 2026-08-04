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
import { PROVIDERS, providerConfigured } from "../_shared/providersMeta";

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

/** Rotas grátis destacadas quando o usuário ainda não configurou nada (NOV-03). */
const FREE_ROUTES = [
  { id: "gemini", icon: "logo-gemini", name: "Gemini", key: "freeRouteGemini" },
  {
    id: "openrouter",
    icon: "logo-openrouter",
    name: "OpenRouter",
    key: "freeRouteOpenrouter",
  },
  { id: "ollama", icon: "logo-ollama", name: "Ollama", key: "freeRouteOllama" },
] as const;

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
    // (P1-48) Provider atual SEM key entra na lista com marca explícita —
    // antes era visualmente idêntico aos configurados e o 1º envio falhava.
    ...provBase.map((p) => ({
      id: p.id,
      icon: providerConfigured(plugin, p.id) ? p.icon : "key-round",
      label: providerConfigured(plugin, p.id)
        ? p.name
        : `${p.name} — ${t.newChatScreen.noKeyBadge}`,
    })),
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

      {/* (P1-84) Status do índice semântico direto na New Q&A: um estado, um
          link — resolve descoberta do indexador e comunica a degradação
          keyword quando não há índice. */}
      {mode === "vault-qa" && (
        <button
          type="button"
          className={
            "axxa-newchat-ragchip" +
            (plugin.vectorIndex && plugin.vectorIndex.size > 0
              ? " is-ok"
              : " is-off")
          }
          onClick={onOpenSettings}
          title={t.newChatScreen.ragChipTitle}
        >
          <Icon
            name={
              plugin.vectorIndex && plugin.vectorIndex.size > 0
                ? "radar"
                : "circle-dashed"
            }
          />
          {plugin.vectorIndex && plugin.vectorIndex.size > 0
            ? t.newChatScreen.ragChipOk(plugin.vectorIndex.size)
            : t.newChatScreen.ragChipOff}
        </button>
      )}
      {/* (NOV-03) Caminho grátis — o README promete "start free, no credit
          card" e até agora isso não existia na UI (as chaves i18n estavam
          órfãs). Só aparece quando NENHUM provider tem credencial: com key
          configurada o bloco sai do caminho. Cada rota seleciona o provider e
          abre as Settings pra colar a key (ou o endpoint, no Ollama). */}
      {configuredProv.length === 0 && (
        <div className="axxa-newchat-free">
          <span className="axxa-newchat-free-title">
            {t.dashboard.freeStartTitle}
          </span>
          <p className="axxa-newchat-free-sub">{t.dashboard.freeStartSub}</p>
          <div className="axxa-newchat-free-routes">
            {FREE_ROUTES.map((r) => (
              <button
                key={r.id}
                type="button"
                className="axxa-newchat-free-route"
                title={t.newChatScreen.freeRouteHint(r.name)}
                aria-label={t.newChatScreen.freeRouteHint(r.name)}
                onClick={() => {
                  hapticTick();
                  onProviderChange(r.id);
                  onOpenSettings();
                }}
              >
                <Icon name={r.icon} />
                <b>{r.name}</b>
                <span>{t.newChatScreen[r.key]}</span>
              </button>
            ))}
          </div>
          <span className="axxa-newchat-free-trust">{t.dashboard.trustLine}</span>
        </div>
      )}

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
