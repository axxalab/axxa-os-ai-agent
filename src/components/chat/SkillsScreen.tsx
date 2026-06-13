// src/components/chat/SkillsScreen.tsx
// Explorar Apps/Skills (refs: ChatGPT iOS 60 "Explore apps", 119 "Connect app").
// No AXXA, "apps" = skills .md do vault (prompt templates). Tela full com cards;
// tocar usa a skill (injeta o corpo no composer). Empty state = "nada aqui"
// no espírito do 404 (ChatGPT iOS 285).

import { Icon } from "../_shared/Icon";
import { useT } from "../../i18n";
import type { Skill } from "../../skills/skills";

interface SkillsScreenProps {
  skills: Skill[];
  onUse: (skill: Skill) => void;
  onOpenNote: (path: string) => void;
  onClose: () => void;
}

export function SkillsScreen({
  skills,
  onUse,
  onOpenNote,
  onClose,
}: SkillsScreenProps) {
  const t = useT();
  return (
    <div className="axxa-skills" role="dialog" aria-label={t.skills.title}>
      <div className="axxa-screen-head">
        <button
          type="button"
          className="axxa-screen-back"
          onClick={onClose}
          aria-label={t.skills.close}
        >
          <Icon name="arrow-left" />
        </button>
        <span className="axxa-screen-title">
          <Icon name="layout-grid" />
          {t.skills.title}
        </span>
      </div>

      <div className="axxa-screen-body">
        <p className="axxa-skills-sub">{t.skills.subtitle}</p>

        {skills.length === 0 ? (
          <div className="axxa-screen-empty axxa-skills-empty">
            {/* 404 é só decorativo; leitor usa emptyTitle/emptySub (v0.1.228) */}
            <span className="axxa-skills-404" aria-hidden="true">404</span>
            <p className="axxa-screen-empty-title">{t.skills.emptyTitle}</p>
            <p className="axxa-screen-empty-sub">{t.skills.emptySub}</p>
          </div>
        ) : (
          <div className="axxa-skills-grid">
            {skills.map((s) => (
              <div key={s.id} className="axxa-skill-card">
                <button
                  type="button"
                  className="axxa-skill-card-main"
                  onClick={() => onUse(s)}
                >
                  <span className="axxa-skill-card-icon">
                    <Icon name={s.icon || "sparkles"} />
                  </span>
                  <span className="axxa-skill-card-name">{s.name}</span>
                  {s.description && (
                    <span className="axxa-skill-card-desc">
                      {s.description}
                    </span>
                  )}
                </button>
                <div className="axxa-skill-card-actions">
                  <button
                    type="button"
                    className="axxa-skill-card-use"
                    onClick={() => onUse(s)}
                  >
                    {t.skills.use}
                  </button>
                  <button
                    type="button"
                    className="axxa-skill-card-open"
                    onClick={() => onOpenNote(s.path)}
                    aria-label={t.skills.openNote}
                    title={t.skills.openNote}
                  >
                    <Icon name="file-pen-line" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
