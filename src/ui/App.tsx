// src/ui/App.tsx
// A casca. Uma tela por vez (Chats / Projects / Skills) + o menu lateral, que
// é onde vivem as opções: nova conversa, histórico, navegação e Settings.
// Tudo que a UI faz passa pela ChatSession (src/core/session.ts) ou pelo plugin.

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type AxxaPlugin from "../main";
import { isChatMode, type ChatSession } from "../core/session";
import type { Skill } from "../skills/skills";
import { ChatView } from "./ChatView";
import { ProjectsView } from "./ProjectsView";
import { SkillsView } from "./SkillsView";
import { Drawer, type ViewId } from "./Drawer";
import { Icon } from "./Icon";
import { useKeyboardInset } from "./useKeyboardInset";

export interface ComposerInject {
  text: string;
  nonce: number;
}

const PAGE_TITLE: Record<ViewId, string> = {
  chat: "Chats",
  projects: "Projects",
  skills: "Skills",
};

export function App({
  plugin,
  session,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
}) {
  const [view, setView] = useState<ViewId>("chat");
  const [menuOpen, setMenuOpen] = useState(false);
  const [inject, setInject] = useState<ComposerInject | null>(null);
  const [, force] = useReducer((n: number) => n + 1, 0);
  const rootRef = useRef<HTMLDivElement>(null);

  // Mobile: o composer acompanha o teclado (ver useKeyboardInset.ts).
  useKeyboardInset(rootRef);

  // Re-render em mudanças de sessão (seleção/lock) e de settings.
  useEffect(() => {
    const u1 = session.onChange(force);
    const u2 = plugin.onSettingsChange(force);
    return () => {
      u1();
      u2();
    };
  }, [session, plugin]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const useSkill = (skill: Skill) => {
    // Skill com modo preferido troca o modo (no-op se a sessão já travou).
    if (isChatMode(skill.mode)) session.setMode(skill.mode);
    setInject({ text: skill.body, nonce: Date.now() });
    setView("chat");
  };

  return (
    <div className="axxa-root" ref={rootRef}>
      {view === "chat" ? (
        <ChatView
          plugin={plugin}
          session={session}
          inject={inject}
          onOpenMenu={() => setMenuOpen(true)}
          onUseSkill={useSkill}
        />
      ) : (
        <div className="axxa-chat">
          <header className="axxa-topbar">
            <button
              type="button"
              className="axxa-icon-btn"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <div className="axxa-topbar-title">
              <span className="axxa-topbar-name">{PAGE_TITLE[view]}</span>
            </div>
            <button
              type="button"
              className="axxa-icon-btn"
              aria-label="Back to chat"
              onClick={() => setView("chat")}
            >
              <Icon name="message-square" />
            </button>
          </header>
          <div className="axxa-messages axxa-page">
            {view === "projects" && (
              <ProjectsView
                plugin={plugin}
                session={session}
                onOpenChat={() => setView("chat")}
              />
            )}
            {view === "skills" && (
              <SkillsView plugin={plugin} onUse={useSkill} />
            )}
          </div>
        </div>
      )}

      <Drawer
        plugin={plugin}
        session={session}
        open={menuOpen}
        view={view}
        onNavigate={setView}
        onClose={closeMenu}
      />
    </div>
  );
}
