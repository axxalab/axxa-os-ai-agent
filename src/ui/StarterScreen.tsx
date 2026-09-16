// src/ui/StarterScreen.tsx
// A tela inicial de uma CONVERSA: o que aparece enquanto ela está vazia.
// É aqui que se escolhe o MODO (a decisão que trava no 1º envio). Provider /
// modelo / effort ficam na barra do composer, logo abaixo — esta tela cuida do
// "o quê", não do "com quê".
//
// As conversas gravadas NÃO moram aqui: cada módulo tem a sua home (ver
// ModuleHome.tsx), que é onde se escolhe qual abrir. Esta tela é pra escrever.

import type AxxaPlugin from "../main";
import type { ChatMode, ChatSession } from "../core/session";
import { CHAT_MODES } from "../core/session";
import { MODULES } from "./modules";
import { providerConfigured, PROVIDERS } from "../core/providersMeta";
import { Icon } from "./Icon";
import { Segmented } from "./Segmented";
import { openPluginSettings } from "./modals";

/** Saudação pela hora local — o chat abre falando com você, não com o void. */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function StarterScreen({
  plugin,
  session,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
}) {
  const cfg = session.config;
  const mode = MODULES[cfg.mode];
  const hasKey = providerConfigured(plugin, cfg.provider);
  const providerName =
    PROVIDERS.find((p) => p.id === cfg.provider)?.name ?? cfg.provider;

  return (
    <div className="axxa-starter">
      {/* O MESMO controle que filtra a lista na home (ver Segmented.tsx) —
          aqui com o nome inteiro, que cabe em três colunas. */}
      <Segmented
        options={CHAT_MODES.map((m) => ({ id: m, label: MODULES[m].label }))}
        value={cfg.mode}
        label="Chat mode"
        onChange={(id) => session.setMode(id as ChatMode)}
      />

      <div className="axxa-starter-hero">
        <Icon name={mode.icon} size={26} className="axxa-starter-mark" />
        <h2 className="axxa-starter-title">{greeting()}.</h2>
        <p className="axxa-starter-sub">{mode.tagline}</p>
      </div>

      {!hasKey && (
        <div className="axxa-callout">
          <Icon name="key-round" size={16} />
          <span>
            No API key for {providerName} yet — add one to start.
          </span>
          <button type="button" onClick={() => openPluginSettings(plugin)}>
            Open settings
          </button>
        </div>
      )}

    </div>
  );
}
