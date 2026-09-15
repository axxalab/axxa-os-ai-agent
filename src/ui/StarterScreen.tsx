// src/ui/StarterScreen.tsx
// A TELA DO MÓDULO: o que aparece enquanto a conversa está vazia — e é pra cá
// que o menu leva quando se escolhe Chat, Vault Q&A ou Agent.
//
// Ela é a casa do módulo, não um cartaz de boas-vindas: tem o seletor de modo,
// a saudação, o campo de texto logo abaixo (do ChatView) e AS CONVERSAS
// daquele módulo. A lista morava dentro da gaveta; ficava a dois toques e
// longe do lugar onde se escreve. Aqui ela está onde o trabalho acontece.
//
// Provider / modelo / effort continuam na barra do composer — esta tela cuida
// do "o quê", não do "com quê".

import type { CSSProperties } from "react";
import { useMemo } from "react";
import type AxxaPlugin from "../main";
import type { ChatMode, ChatSession } from "../core/session";
import { CHAT_MODES } from "../core/session";
import { MODULES, chatsOfModule, moduleIcon } from "./modules";
import { providerConfigured, PROVIDERS } from "../core/providersMeta";
import { ChatList, useChatSummaries } from "./ChatList";
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
  moduloExterno,
  onSairDoExterno,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  /** Módulo que este código não conhece e que está sendo visto (ver App). */
  moduloExterno: string | null;
  onSairDoExterno: () => void;
}) {
  const cfg = session.config;
  const hasKey = providerConfigured(plugin, cfg.provider);
  const providerName =
    PROVIDERS.find((p) => p.id === cfg.provider)?.name ?? cfg.provider;
  // Índice do modo ativo — move o thumb do segmented control via CSS.
  const activeIndex = Math.max(CHAT_MODES.indexOf(cfg.mode), 0);

  // Qual módulo esta tela está mostrando. Nos três de casa é o modo da
  // sessão — assim o seletor logo acima muda a tela na hora. Num módulo
  // estranho é ele mesmo: não dá pra pôr a sessão nesse modo, mas as
  // conversas dele têm que aparecer em algum lugar.
  const daTela = moduloExterno ?? cfg.mode;

  // As conversas DESTE módulo. Todas, não as N mais novas: cortar a lista é
  // criar conversa invisível, e daqui não há pra onde mandar ver o resto.
  const todas = useChatSummaries(plugin);
  const minhas = useMemo(() => chatsOfModule(todas, daTela), [todas, daTela]);

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
            className={
              !moduloExterno && m === cfg.mode
                ? "axxa-mode is-active"
                : "axxa-mode"
            }
            aria-pressed={!moduloExterno && m === cfg.mode}
            onClick={() => {
              // Tocar aqui é voltar pra casa: sai do módulo estranho e a tela
              // volta a seguir o modo da sessão.
              onSairDoExterno();
              session.setMode(m);
            }}
          >
            {MODULES[m].label}
          </button>
        ))}
      </div>

      <div className="axxa-starter-hero">
        <Icon name={moduleIcon(daTela)} size={26} className="axxa-starter-mark" />
        <h2 className="axxa-starter-title">{greeting()}.</h2>
        <p className="axxa-starter-sub">
          {moduloExterno
            ? `Chats saved under "${moduloExterno}". This version can't start new ones here.`
            : MODULES[cfg.mode].tagline}
        </p>
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

      {minhas.length > 0 && (
        <section className="axxa-starter-recents">
          <span className="axxa-section-label">Recents</span>
          <ChatList plugin={plugin} session={session} chats={minhas} />
        </section>
      )}
    </div>
  );
}
