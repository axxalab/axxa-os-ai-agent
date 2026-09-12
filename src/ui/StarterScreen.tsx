// src/ui/StarterScreen.tsx
// A tela inicial de cada chat: o que aparece enquanto a conversa está vazia.
// É aqui que se escolhe o MODO (a decisão que trava no 1º envio) e daqui saem
// os atalhos que preenchem o composer. Provider / modelo / effort ficam na
// barra do composer, logo abaixo — esta tela cuida do "o quê", não do "com quê".

import type { CSSProperties } from "react";
import type AxxaPlugin from "../main";
import type { ChatMode, ChatSession } from "../core/session";
import { CHAT_MODES } from "../core/session";
import type { Skill } from "../skills/skills";
import { providerConfigured, PROVIDERS } from "../core/providersMeta";
import { Icon } from "./Icon";
import { openPluginSettings } from "./modals";

interface Suggestion {
  /** O que o chip mostra. */
  label: string;
  /** O que vai pro composer (com o espaço final pra continuar digitando). */
  text: string;
}

interface ModeMeta {
  label: string;
  icon: string;
  tagline: string;
  suggestions: Suggestion[];
}

const MODES: Record<ChatMode, ModeMeta> = {
  chat: {
    label: "Chat",
    icon: "message-circle",
    tagline: "Just you and the model. Your notes stay out of it.",
    suggestions: [
      { label: "Explain simply", text: "Explain this in simple terms: " },
      { label: "Draft an outline", text: "Draft an outline for " },
      { label: "Three angles", text: "Give me three angles on " },
    ],
  },
  "vault-qa": {
    label: "Vault Q&A",
    icon: "library",
    tagline: "Answers grounded in your notes, found by local search.",
    suggestions: [
      { label: "What do my notes say…", text: "What do my notes say about " },
      { label: "Summarize what I wrote", text: "Summarize what I wrote on " },
      { label: "Find connections", text: "Which notes connect to " },
    ],
  },
  agent: {
    label: "Agent",
    icon: "bot",
    tagline: "Reads and edits your vault — every change asks first.",
    suggestions: [
      {
        label: "Plan my day",
        text: "Create a note with today's plan",
      },
      { label: "Fix broken links", text: "Find and fix broken links in " },
      {
        label: "Tidy my inbox",
        text: "Organize my inbox notes into folders",
      },
    ],
  },
};

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
  onPick,
  onUseSkill,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  /** Coloca um texto no composer (não envia). */
  onPick: (text: string) => void;
  onUseSkill: (skill: Skill) => void;
}) {
  const cfg = session.config;
  const mode = MODES[cfg.mode];
  const hasKey = providerConfigured(plugin, cfg.provider);
  const providerName =
    PROVIDERS.find((p) => p.id === cfg.provider)?.name ?? cfg.provider;
  const skills = plugin.skills.slice(0, 4);

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
            {MODES[m].label}
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

      <div className="axxa-suggestions">
        {mode.suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            className="axxa-chip"
            onClick={() => onPick(s.text)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {skills.length > 0 && (
        <div className="axxa-starter-skills">
          <span className="axxa-section-label">Your skills</span>
          <div className="axxa-suggestions">
            {skills.map((s) => (
              <button
                key={s.id}
                type="button"
                className="axxa-chip"
                title={s.description}
                onClick={() => onUseSkill(s)}
              >
                <Icon name={s.icon || "sparkles"} size={14} />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
