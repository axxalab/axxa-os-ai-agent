// src/components/screens/Screens.tsx
// Telas-BASE da navegação lateral (v0.1.174): Media, Statistics, Projects,
// Profile + LockedScreen (upsell do free). Focadas no que já temos hoje; cada
// uma será aprofundada depois. Cada tela é um painel full com header (voltar +
// título). Padrão visual segue ConversationsList.

import { useMemo, useState, type ReactNode } from "react";
import type { App } from "obsidian";
import { Icon } from "../_shared/Icon";
import { ThinkingGlyph } from "../_shared/ThinkingGlyph";
import { useT } from "../../i18n";
import {
  aggregateFromSummaries,
  sortBucketEntries,
} from "../../usage/aggregate";
import { formatUsd } from "../../usage/pricing";
import { formatTokens } from "../_shared/contextWindows";
import type { ChatSummary } from "../_shared/chatPersistence";
import type { AppView, Tier } from "../../entitlements";

// ── Shell comum ────────────────────────────────────────────
function ScreenShell({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="axxa-screen">
      <div className="axxa-screen-head">
        <button
          type="button"
          className="axxa-screen-back"
          onClick={onClose}
          aria-label="Voltar"
        >
          <Icon name="arrow-left" />
        </button>
        <span className="axxa-screen-title">
          <Icon name={icon} />
          {title}
        </span>
      </div>
      <div className="axxa-screen-body">{children}</div>
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="axxa-screen-empty">
      <Icon name={icon} />
      <p className="axxa-screen-empty-title">{title}</p>
      <p className="axxa-screen-empty-sub">{sub}</p>
    </div>
  );
}

// ── Media — imagens/áudios/vídeos do vault ─────────────────
const IMG_EXT = ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif"];
const AUD_EXT = ["mp3", "wav", "ogg", "flac", "m4a", "aac"];
const VID_EXT = ["mp4", "webm", "mov", "mkv"];

export function MediaScreen({
  app,
  axxaPaths,
  onClose,
}: {
  app: App;
  /** Pastas do AXXA (gerações + gravações) — pro filtro "só AXXA". #6 */
  axxaPaths: string[];
  onClose: () => void;
}) {
  const t = useT();
  const [scope, setScope] = useState<"axxa" | "all">("axxa");
  const media = useMemo(() => {
    const inAxxa = (p: string) => axxaPaths.some((base) => base && p.startsWith(base));
    const files = app.vault.getFiles();
    const imgs: { path: string; src: string }[] = [];
    const others: { path: string; ext: string; kind: "audio" | "video" }[] = [];
    for (const f of files) {
      if (scope === "axxa" && !inAxxa(f.path)) continue;
      const ext = (f.extension || "").toLowerCase();
      if (IMG_EXT.includes(ext)) {
        imgs.push({ path: f.path, src: app.vault.getResourcePath(f) });
      } else if (AUD_EXT.includes(ext)) {
        others.push({ path: f.path, ext, kind: "audio" });
      } else if (VID_EXT.includes(ext)) {
        others.push({ path: f.path, ext, kind: "video" });
      }
    }
    return { imgs: imgs.slice(0, 300), others: others.slice(0, 200) };
  }, [app, axxaPaths, scope]);

  const total = media.imgs.length + media.others.length;

  return (
    <ScreenShell title={t.nav.media} icon="image" onClose={onClose}>
      <div className="axxa-media-scope">
        <button
          type="button"
          className={"axxa-media-scope-btn" + (scope === "axxa" ? " is-on" : "")}
          onClick={() => setScope("axxa")}
        >
          {t.screens.mediaScopeAxxa}
        </button>
        <button
          type="button"
          className={"axxa-media-scope-btn" + (scope === "all" ? " is-on" : "")}
          onClick={() => setScope("all")}
        >
          {t.screens.mediaScopeAll}
        </button>
      </div>
      {total === 0 ? (
        <EmptyState icon="image-off" title={t.screens.mediaEmptyTitle} sub={t.screens.mediaEmptySub} />
      ) : (
        <>
          <div className="axxa-media-grid">
            {media.imgs.map((m) => (
              <a
                key={m.path}
                className="axxa-media-cell"
                href={m.path}
                title={m.path}
              >
                <img src={m.src} loading="lazy" alt="" />
              </a>
            ))}
          </div>
          {media.others.length > 0 && (
            <div className="axxa-media-list">
              {media.others.map((m) => (
                <div key={m.path} className="axxa-media-row">
                  <Icon name={m.kind === "audio" ? "volume-2" : "video"} />
                  <span className="axxa-media-row-path">{m.path}</span>
                  <span className="axxa-media-row-ext">{m.ext}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ScreenShell>
  );
}

// ── Statistics — insights das contas (reusa o agregador do Usage) ──
export function StatisticsScreen({
  summaries,
  onOpenUsage,
  onClose,
}: {
  summaries: ChatSummary[];
  onOpenUsage: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const agg = useMemo(() => aggregateFromSummaries(summaries), [summaries]);
  const topModels = sortBucketEntries(agg.byModel).slice(0, 5);

  return (
    <ScreenShell title={t.nav.statistics} icon="bar-chart-3" onClose={onClose}>
      <div className="axxa-stat-cards">
        <StatCard label={t.screens.statSpend} value={formatUsd(agg.total.cost)} icon="dollar-sign" />
        <StatCard label={t.screens.statChats} value={String(agg.total.chats)} icon="message-square" />
        <StatCard label={t.screens.statTokens} value={formatTokens(agg.total.tokensIn + agg.total.tokensOut)} icon="sigma" />
      </div>

      <div className="axxa-screen-section-head">{t.screens.statTopModels}</div>
      {topModels.length === 0 ? (
        <EmptyState icon="bar-chart-3" title={t.screens.statEmptyTitle} sub={t.screens.statEmptySub} />
      ) : (
        <div className="axxa-stat-list">
          {topModels.map(([model, b]) => (
            <div key={model} className="axxa-stat-row">
              <code className="axxa-stat-model">{model}</code>
              <span className="axxa-stat-row-cost">{formatUsd(b.cost)}</span>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="axxa-screen-cta" onClick={onOpenUsage}>
        <Icon name="external-link" />
        {t.screens.statOpenUsage}
      </button>
    </ScreenShell>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="axxa-stat-card">
      <span className="axxa-stat-card-ico"><Icon name={icon} /></span>
      <span className="axxa-stat-card-label">{label}</span>
      <span className="axxa-stat-card-value">{value}</span>
    </div>
  );
}

// ── Projects — scaffold (em breve) ─────────────────────────
export function ProjectsScreen({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <ScreenShell title={t.nav.projects} icon="folder-kanban" onClose={onClose}>
      <EmptyState icon="folder-kanban" title={t.screens.projectsEmptyTitle} sub={t.screens.projectsEmptySub} />
    </ScreenShell>
  );
}

// ── Profile — conta (scaffold reusando o que temos) ────────
export function ProfileScreen({
  tier,
  email,
  connectedProviders,
  totalChats,
  onClose,
}: {
  tier: Tier;
  email: string;
  connectedProviders: string[];
  totalChats: number;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <ScreenShell title={t.nav.profile} icon="user-round" onClose={onClose}>
      <div className="axxa-profile-card">
        <div className="axxa-profile-avatar"><Icon name="user-round" /></div>
        <div className="axxa-profile-id">
          <span className="axxa-profile-name">{email || "AXXA OS"}</span>
          <span className={"axxa-profile-tier axxa-profile-tier-" + tier}>
            {tier === "pro" ? "PRO" : "FREE"}
          </span>
        </div>
      </div>
      <div className="axxa-profile-rows">
        <div className="axxa-profile-row">
          <span>{t.screens.profileProviders}</span>
          <span className="axxa-profile-row-val">
            {connectedProviders.length > 0 ? connectedProviders.join(" · ") : "—"}
          </span>
        </div>
        <div className="axxa-profile-row">
          <span>{t.screens.profileChats}</span>
          <span className="axxa-profile-row-val">{totalChats}</span>
        </div>
      </div>
    </ScreenShell>
  );
}

// ── Onboarding de 1º uso (zero keys) + discoverability (#4/#7) ──
export function OnboardingScreen({
  onOpenSettings,
  onDismiss,
}: {
  onOpenSettings: () => void;
  onDismiss: () => void;
}) {
  const t = useT();
  const features = [
    { icon: "messages-square", text: t.onboarding.f1 },
    { icon: "library-big", text: t.onboarding.f2 },
    { icon: "bot", text: t.onboarding.f3 },
    { icon: "image-plus", text: t.onboarding.f4 },
    { icon: "drama", text: t.onboarding.f5 },
  ];
  return (
    <div className="axxa-onboarding">
      <div className="axxa-onboarding-hero">
        <ThinkingGlyph className="axxa-onboarding-glyph" />
        <h2 className="axxa-onboarding-title">{t.onboarding.title}</h2>
        <p className="axxa-onboarding-sub">{t.onboarding.sub}</p>
      </div>
      <div className="axxa-onboarding-features">
        {features.map((f, i) => (
          <div key={i} className="axxa-onboarding-feature">
            <span className="axxa-onboarding-feature-ico">
              <Icon name={f.icon} />
            </span>
            <span>{f.text}</span>
          </div>
        ))}
      </div>
      <p className="axxa-onboarding-note">{t.onboarding.byoNote}</p>
      <div className="axxa-onboarding-actions">
        <button type="button" className="axxa-screen-cta" onClick={onOpenSettings}>
          <Icon name="key-round" />
          {t.onboarding.cta}
        </button>
        <button type="button" className="axxa-onboarding-skip" onClick={onDismiss}>
          {t.onboarding.skip}
        </button>
      </div>
    </div>
  );
}

// ── Locked — upsell quando free tenta uma tela paga ────────
export function LockedScreen({
  view,
  onClose,
  onSeePlans,
}: {
  view: AppView;
  onClose: () => void;
  onSeePlans: () => void;
}) {
  const t = useT();
  const title = (t.nav as Record<string, string>)[view] ?? view;
  return (
    <ScreenShell title={title} icon="lock" onClose={onClose}>
      <div className="axxa-locked">
        <div className="axxa-locked-badge"><Icon name="lock" /></div>
        <p className="axxa-locked-title">{t.screens.lockedTitle}</p>
        <p className="axxa-locked-sub">{t.screens.lockedSub}</p>
        <button type="button" className="axxa-screen-cta axxa-locked-cta" onClick={onSeePlans}>
          <Icon name="sparkles" />
          {t.screens.lockedCta}
        </button>
      </div>
    </ScreenShell>
  );
}
