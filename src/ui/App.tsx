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
import { Dashboard } from "./Dashboard";
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
  // Abre no PAINEL, não numa conversa vazia: a primeira pergunta de quem
  // abre o app não é "o que eu escrevo", é "onde eu estava".
  const [view, setView] = useState<ViewId>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  /** De qual módulo é a home que está aberta (ou foi a última). */
  const [modulo, setModulo] = useState<string>(
    () => plugin.settings.defaultMode || "chat"
  );
  const [inject, setInject] = useState<ComposerInject | null>(null);
  /** De onde se entrou na conversa — é pra lá que a seta de voltar leva.
   *  A seta tem que desfazer o toque que trouxe você, não levar a um lugar
   *  parecido: quem abriu do painel volta ao painel, quem abriu da tela do
   *  módulo volta pra ela. */
  const [voltarPara, setVoltarPara] = useState<"home" | "module">("module");
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
      {view === "home" ? (
        <Dashboard
          plugin={plugin}
          session={session}
          onOpenMenu={() => setMenuOpen(true)}
          // Cartão do painel: conversa nova naquele modo, JÁ ESCREVENDO. O
          // `inject` sem texto é exatamente isso — "põe o cursor no campo" —
          // e é o mesmo caminho que a skill usa pra chegar lá com texto.
          onNewChat={(m) => {
            session.newChat(m);
            setModulo(m);
            setInject({ text: "", nonce: Date.now() });
            setVoltarPara("home");
            setView("chat");
          }}
          onOpenChat={() => {
            setVoltarPara("home");
            setView("chat");
          }}
        />
      ) : view === "module" ? (
        <ModuleHome
          plugin={plugin}
          session={session}
          modulo={modulo}
          onOpenMenu={() => setMenuOpen(true)}
          // Só troca de tela: quem manda carregar é a própria lista
          // (ChatList.abrir). Carregar aqui de novo era pedir a mesma conversa
          // duas vezes — inofensivo pelo guarda de identidade da sessão, mas
          // ainda assim uma segunda ida ao disco por toque.
          onOpenChat={() => {
            setVoltarPara("module");
            setView("chat");
          }}
          onNewChat={() => {
            if (isChatMode(modulo)) session.newChat(modulo);
            setVoltarPara("module");
            setView("chat");
          }}
          onOpenSkills={() => setView("skills")}
        />
      ) : view === "chat" ? (
        <ChatView
          plugin={plugin}
          session={session}
          inject={inject}
          // Volta pra ONDE SE ENTROU. E, quando isso é a tela de um módulo,
          // é a do módulo DESTA conversa — não a da última visitada: se você
          // abriu um chat de Agent vindo do Chat, voltar leva ao Agent, que é
          // onde ele mora.
          onBackHome={() => {
            if (voltarPara === "home") {
              setView("home");
              return;
            }
            const m = session.config.mode;
            setModulo(m);
            setView("module");
          }}
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
