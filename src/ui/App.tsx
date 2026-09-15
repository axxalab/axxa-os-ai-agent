// src/ui/App.tsx
// A casca. Uma tela por vez + o menu lateral.
//
// As telas são: a HOME de um módulo (Chat, Vault Q&A, Agent — cada um com a
// sua, ver ModuleHome.tsx), a conversa em si, e as páginas de Projects e
// Skills. O menu é só navegação: leva a uma delas e sai da frente.
// Tudo que a UI faz passa pela ChatSession (src/core/session.ts) ou pelo plugin.

import { useCallback, useEffect, useReducer, useState } from "react";
import type AxxaPlugin from "../main";
import { isChatMode, type ChatSession } from "../core/session";
import type { Skill } from "../skills/skills";
import { ChatView } from "./ChatView";
import { ModuleHome } from "./ModuleHome";
import { ProjectsView } from "./ProjectsView";
import { SkillsView } from "./SkillsView";
import { Drawer, type ViewId } from "./Drawer";
import { Icon } from "./Icon";

export interface ComposerInject {
  text: string;
  nonce: number;
}

/** Só as páginas que usam a topbar comum — a home do módulo tem a sua. */
const PAGE_TITLE: Partial<Record<ViewId, string>> = {
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
  /** De qual módulo é a home que está aberta (ou foi a última). */
  const [modulo, setModulo] = useState<string>(
    () => plugin.settings.defaultMode || "chat"
  );
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

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  /** Entrar num módulo pelo menu: abre a HOME dele. */
  const entrarNoModulo = useCallback((mode: string) => {
    setModulo(mode);
    setView("module");
    setMenuOpen(false);
  }, []);

  const useSkill = (skill: Skill) => {
    // Skill com modo preferido troca o modo (no-op se a sessão já travou).
    if (isChatMode(skill.mode)) session.setMode(skill.mode);
    setInject({ text: skill.body, nonce: Date.now() });
    setView("chat");
  };

  return (
    <div className="axxa-root">
      {view === "module" ? (
        <ModuleHome
          plugin={plugin}
          session={session}
          modulo={modulo}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenChat={(c) => {
            void session.load(c);
            setView("chat");
          }}
          onNewChat={() => {
            if (isChatMode(modulo)) session.newChat(modulo);
            setView("chat");
          }}
          onOpenSkills={() => setView("skills")}
        />
      ) : view === "chat" ? (
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
        modulo={modulo}
        onEnterModule={entrarNoModulo}
        onNavigate={setView}
        onClose={closeMenu}
      />
    </div>
  );
}
