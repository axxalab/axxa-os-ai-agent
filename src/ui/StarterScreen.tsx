// src/ui/StarterScreen.tsx
// A tela inicial de cada chat: o que aparece enquanto a conversa está vazia.
// É aqui que se escolhe o MODO (a decisão que trava no 1º envio) e daqui saem
// os atalhos que preenchem o composer. Provider / modelo / effort ficam na
// barra do composer, logo abaixo — esta tela cuida do "o quê", não do "com quê".

import type { CSSProperties } from "react";
import type AxxaPlugin from "../main";
import type { ChatMode, ChatSession } from "../core/session";
import { CHAT_MODES } from "../core/session";
import { MODULES } from "./modules";
import { providerConfigured, PROVIDERS } from "../core/providersMeta";
import { Icon } from "./Icon";
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
  // Índice do modo ativo — move o thumb do segmented control via CSS.
  const activeIndex = Math.max(CHAT_MODES.indexOf(cfg.mode), 0);

  return (
    <div className="axxa-starter">
      <div
        className="axxa-modes"
        role="group"
        aria-label="Chat mode"
        style={{ "--axxa-seg": activeIndex } as CSSProperties}
      >
        {CHAT_MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={m === cfg.mode ? "axxa-mode is-active" : "axxa-mode"}
            aria-pressed={m === cfg.mode}
            onClick={() => session.setMode(m)}
          >
            {MODULES[m].label}
          </button>
        ))}
      </div>

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
