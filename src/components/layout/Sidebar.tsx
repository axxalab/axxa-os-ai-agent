// src/components/layout/Sidebar.tsx
// Gaveta lateral ESQUERDA — redesenhada pra espelhar EXATAMENTE a referência do
// Claude (v0.1.201): minimalista, leve, com respiro. Estrutura:
//   • brand em texto puro (sem avatar/box)
//   • "Nova conversa" = ícone + texto em accent (sem card)
//   • nav em linhas FLAT (ícone + label), a tela ativa ganha uma pílula sutil
//   • divisória
//   • "Recentes" = lista PLANA (título + hora à direita), sem chips/dots/cards
//     (deletar via long-press / right-click → menu nativo)
//   • rodapé: avatar + nome + engrenagem (Settings)
// Só o TEMA (cores) é nosso; a distribuição é a da referência.
//
// Sempre montado (toggle por classe) pra animar entrada E saída.

import { useMemo, useState } from "react";
import { Menu } from "obsidian";
import { Icon } from "../_shared/Icon";
import { SegmentedRow } from "../_shared/SegmentedRow";
import { useT, type Translations } from "../../i18n";
import { formatTokens } from "../_shared/contextWindows";
import type { ChatSummary } from "../_shared/chatPersistence";
import {
  NAV_ITEMS,
  viewRequiresPro,
  type AppView,
  type Tier,
} from "../../entitlements";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  chats: ChatSummary[];
  onLoadChat: (chatId: string, chatMode: string) => void;
  onNewChat: () => void;
  /** "Ver todas" → tela cheia de conversas (com filtros/sort). */
  onOpenAll: () => void;
  onOpenSettings: () => void;
  /** Navega pra uma tela (media/statistics/projects/profile/conversations). */
  onNavigate: (view: AppView) => void;
  /** Plano efetivo — gateia as telas pagas (cadeado no free). */
  tier: Tier;
  /** Deleta uma conversa (vai pra lixeira). #3 */
  onDeleteChat: (chatId: string, mode: string) => void;
  /** Tela atual — destaca o item de nav correspondente (pílula). */
  activeView?: AppView;
  /** Versão do plugin (mostrada embaixo do brand). */
  version?: string;
  /** Emblema "Founder" (acima de Premium/Free). */
  founder?: boolean;
}

function relDate(iso: string, t: Translations): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
    if (diffMin < 1) return t.dashboard.relNow;
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d`;
    return d.toLocaleDateString(t.dashboard.dateLocale, {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function Sidebar({
  open,
  onClose,
  chats,
  onLoadChat,
  onNewChat,
  onOpenSettings,
  onNavigate,
  tier,
  onDeleteChat,
  activeView,
  version,
  founder,
}: SidebarProps) {
  const t = useT();

  // Stats básicas do user pro rodapé: chats iniciados + tokens totais.
  // num() blinda contra summaries "estrangeiros" (outro provedor, formato
  // diferente) cujos campos podem vir NaN/undefined → nunca quebra. v0.1.207
  const num = (v: unknown): number => (Number.isFinite(v) ? (v as number) : 0);
  const totalChats = chats.length;
  const totalTokens = useMemo(
    () => chats.reduce((s, c) => s + num(c.tokensIn) + num(c.tokensOut), 0),
    [chats]
  );
  // Emblema: Founder > Premium (pro) > Free.
  const badgeKind = founder ? "founder" : tier === "pro" ? "premium" : "free";
  const badgeLabel = founder
    ? t.account.badgeFounder
    : tier === "pro"
      ? t.account.badgePremium
      : t.account.badgeFree;
  const navLabel = (v: AppView): string =>
    (t.nav as Record<string, string>)[v] ?? v;

  // Filtro de modo dos recentes — segmented control (pílula deslizante) igual
  // ao da StarterScreen. v0.1.205
  const [modeFilter, setModeFilter] = useState<string>("all");
  const filterItems = [
    { id: "all", icon: "layout-grid", label: t.conversations.filterAll },
    { id: "chat", icon: "message-square", label: t.modes.chat },
    { id: "vault-qa", icon: "library", label: t.modes.vaultQa },
    { id: "agent", icon: "bot", label: t.modes.agent },
  ];

  const recents = useMemo(() => {
    // Sort blindado: summaries estrangeiros podem ter date vazia/ausente.
    const arr = [...chats].sort((a, b) =>
      String(b.date ?? "").localeCompare(String(a.date ?? ""))
    );
    // Chats de OUTRO provedor (modo desconhecido) só aparecem em "Todos" — os
    // filtros específicos só batem com os modos nativos (chat/vault-qa/agent).
    // Como o mode deles não casa com nenhum filtro, ficam naturalmente fora.
    return modeFilter === "all"
      ? arr
      : arr.filter((c) => c.mode === modeFilter);
  }, [chats, modeFilter]);

  // Deletar via menu nativo (long-press mobile / right-click desktop) — sem
  // poluir a linha com um botão de lixeira, igual à referência.
  const openItemMenu = (e: React.MouseEvent, c: ChatSummary) => {
    e.preventDefault();
    e.stopPropagation();
    const menu = new Menu();
    menu.addItem((i) =>
      i
        .setTitle(t.menu.delete)
        .setIcon("trash-2")
        .onClick(() => onDeleteChat(c.id, c.mode))
    );
    menu.showAtMouseEvent(e.nativeEvent);
  };

  return (
    <>
      <div
        className={"axxa-sidebar-scrim" + (open ? " axxa-sidebar-scrim-open" : "")}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={"axxa-sidebar" + (open ? " axxa-sidebar-open" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={t.header.conversations}
        aria-hidden={!open}
      >
        <div className="axxa-sidebar-head">
          <span className="axxa-sidebar-brand">
            <span className="axxa-sidebar-brand-name">AXXA AI Agent</span>
            {version && (
              <span className="axxa-sidebar-brand-ver">v{version}</span>
            )}
          </span>
        </div>

        <button
          type="button"
          className="axxa-sidebar-new"
          onClick={() => {
            onNewChat();
            onClose();
          }}
        >
          <Icon name="circle-plus" />
          <span>{t.header.newChat}</span>
        </button>

        {/* Navegação das seções — todas FLAT, a ativa com pílula sutil. */}
        <nav className="axxa-sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const locked = tier === "free" && viewRequiresPro(item.view);
            const isActive = activeView === item.view;
            return (
              <button
                key={item.view}
                type="button"
                className={
                  "axxa-sidebar-nav-item" +
                  (isActive ? " is-active" : "") +
                  (locked ? " is-locked" : "")
                }
                onClick={() => {
                  onNavigate(item.view);
                  onClose();
                }}
              >
                <Icon name={item.icon} />
                <span className="axxa-sidebar-nav-label">
                  {navLabel(item.view)}
                </span>
                {locked && <Icon name="lock" className="axxa-sidebar-nav-lock" />}
              </button>
            );
          })}
        </nav>

        <div className="axxa-sidebar-divider" />

        <div className="axxa-sidebar-list">
          <div className="axxa-sidebar-recents-label">{t.header.recents}</div>
          <div className="axxa-sidebar-seg">
            <SegmentedRow
              items={filterItems}
              activeId={modeFilter}
              onSelect={setModeFilter}
            />
          </div>
          {recents.length === 0 && (
            <div className="axxa-sidebar-empty">
              <p>{t.conversations.emptyAll}</p>
            </div>
          )}
          {recents.map((c) => (
            <button
              key={c.filePath || c.id}
              type="button"
              className="axxa-sidebar-item"
              onClick={() => {
                onLoadChat(c.id, c.mode);
                onClose();
              }}
              onContextMenu={(e) => openItemMenu(e, c)}
            >
              <span className="axxa-sidebar-item-title">{c.title}</span>
              <span className="axxa-sidebar-item-date">{relDate(c.date, t)}</span>
            </button>
          ))}
        </div>

        {/* Rodapé: conta (avatar + nome + emblema) + stats + engrenagem. */}
        <div className="axxa-sidebar-foot">
          <button
            type="button"
            className="axxa-sidebar-account"
            onClick={() => {
              onNavigate("profile");
              onClose();
            }}
          >
            <span className="axxa-sidebar-account-avatar">AL</span>
            <span className="axxa-sidebar-account-main">
              <span className="axxa-sidebar-account-top">
                <span className="axxa-sidebar-account-name">Axxa Lab</span>
                <span
                  className={"axxa-sidebar-badge axxa-sidebar-badge-" + badgeKind}
                >
                  {badgeLabel}
                </span>
              </span>
              <span className="axxa-sidebar-account-stats">
                {t.account.stats(totalChats, formatTokens(totalTokens))}
              </span>
            </span>
          </button>
          <button
            type="button"
            className="axxa-sidebar-foot-gear"
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
            aria-label={t.header.openSettings}
            title={t.header.openSettings}
          >
            <Icon name="settings" />
          </button>
        </div>
      </aside>
    </>
  );
}
