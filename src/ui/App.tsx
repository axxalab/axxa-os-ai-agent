// src/ui/App.tsx
// Casca CRUD crua — nav + 3 telas (Chats / Projects / Skills). Sem design:
// componentes nativos, zero CSS além do esqueleto de layout. Tudo que a UI
// faz passa pela ChatSession (src/core/session.ts) ou pelo plugin.

import { useEffect, useReducer, useState } from "react";
import type AxxaPlugin from "../main";
import { isChatMode, type ChatSession } from "../core/session";
import type { Skill } from "../skills/skills";
import { ChatView } from "./ChatView";
import { ProjectsView } from "./ProjectsView";
import { SkillsView } from "./SkillsView";
import { openPluginSettings } from "./modals";

type ViewId = "chat" | "projects" | "skills";
const VIEWS: Array<{ id: ViewId; label: string }> = [
  { id: "chat", label: "Chats" },
  { id: "projects", label: "Projects" },
  { id: "skills", label: "Skills" },
];

export interface ComposerInject {
  text: string;
  nonce: number;
}

export function App({
  plugin,
  session,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
}) {
  const [view, setView] = useState<ViewId>("chat");
  const [inject, setInject] = useState<ComposerInject | null>(null);
  const [, force] = useReducer((n: number) => n + 1, 0);

  // Re-render em mudanças de sessão (seleção/lock) e de settings.
  useEffect(() => {
    const u1 = session.onChange(force);
    const u2 = plugin.onSettingsChange(force);
    return () => {
      u1();
      u2();
    };
  }, [session, plugin]);

  const useSkill = (skill: Skill) => {
    // Skill com modo preferido troca o modo (no-op se a sessão já travou).
    if (isChatMode(skill.mode)) session.setMode(skill.mode);
    setInject({ text: skill.body, nonce: Date.now() });
    setView("chat");
  };

  return (
    <div className="axxa-root">
      <nav className="axxa-nav">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            disabled={view === v.id}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
        <button type="button" onClick={() => openPluginSettings(plugin)}>
          Settings
        </button>
        <small className="axxa-nav-version">v{plugin.manifest.version}</small>
      </nav>
      {view === "chat" && (
        <ChatView plugin={plugin} session={session} inject={inject} />
      )}
      {view === "projects" && (
        <ProjectsView
          plugin={plugin}
          session={session}
          onOpenChat={() => setView("chat")}
        />
      )}
      {view === "skills" && <SkillsView plugin={plugin} onUse={useSkill} />}
    </div>
  );
}
