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

import { useEffect, useMemo, useRef, useState } from "react";
import { Menu } from "obsidian";
import { Icon } from "../_shared/Icon";
import { SegmentedRow } from "../_shared/SegmentedRow";
import { useT, type Translations } from "../../i18n";
import { formatTokens } from "../_shared/contextWindows";
import { modelVendorLogoId } from "../_shared/modelLogo";
import { hapticTick } from "../_shared/haptics";
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
  /** Abre uma conversa NOVA já num modo (chat | vault-qa | agent). v0.1.219 */
  onNewChatMode: (mode: string) => void;
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
  onNewChatMode,
  onOpenSettings,
  onNavigate,
  tier,
  onDeleteChat,
  activeView,
  version,
  founder,
}: SidebarProps) {
  const t = useT();

  // Blindagem contra cache ruim: se o prop vier nulo/undefined/não-array (cache
  // corrompido, formato antigo), tratamos como lista vazia em vez de quebrar.
  // v0.1.215
  const safeChats = useMemo(
    () => (Array.isArray(chats) ? chats.filter(Boolean) : []),
    [chats]
  );

  // Stats básicas do user pro rodapé: chats iniciados + tokens totais.
  // num() blinda contra summaries "estrangeiros" (outro provedor, formato
  // diferente) cujos campos podem vir NaN/undefined → nunca quebra. v0.1.207
  const num = (v: unknown): number => (Number.isFinite(v) ? (v as number) : 0);
  const totalChats = safeChats.length;
  const totalTokens = useMemo(
    () => safeChats.reduce((s, c) => s + num(c.tokensIn) + num(c.tokensOut), 0),
    [safeChats]
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
  // ao da StarterScreen. v0.1.205. "Todos" fica só ícone (iconOnly) e um "|"
  // separa ele dos 3 modos (dividerBefore no chat). v0.1.213
  const [modeFilter, setModeFilter] = useState<string>("all");
  // Direção do último switch (-1 esq / +1 dir / 0 nenhum) — a lista desliza no
  // mesmo sentido do segmento. v0.1.213
  const [slideDir, setSlideDir] = useState<number>(0);
  // FAB "subir ao topo" aparece quando a gaveta está rolada. v0.1.216
  const [scrolled, setScrolled] = useState(false);
  const filterItems = [
    {
      id: "all",
      icon: "layout-grid",
      label: t.conversations.filterAll,
      iconOnly: true,
    },
    {
      id: "chat",
      icon: "message-square",
      label: t.modes.chat,
      dividerBefore: true,
    },
    { id: "vault-qa", icon: "library", label: t.modes.vaultQa },
    { id: "agent", icon: "bot", label: t.modes.agent },
  ];
  const selectMode = (id: string) => {
    const order = filterItems.map((f) => f.id);
    const from = order.indexOf(modeFilter);
    const to = order.indexOf(id);
    setSlideDir(to === from ? 0 : to > from ? 1 : -1);
    setModeFilter(id);
  };

  const recents = useMemo(() => {
    // Sort blindado: summaries estrangeiros podem ter date vazia/ausente.
    const arr = [...safeChats].sort((a, b) =>
      String(b.date ?? "").localeCompare(String(a.date ?? ""))
    );
    // Chats de OUTRO provedor (modo desconhecido) só aparecem em "Todos" — os
    // filtros específicos só batem com os modos nativos (chat/vault-qa/agent).
    // Como o mode deles não casa com nenhum filtro, ficam naturalmente fora.
    return modeFilter === "all"
      ? arr
      : arr.filter((c) => c.mode === modeFilter);
  }, [safeChats, modeFilter]);

  // Toda a gaveta rola junto (só o rodapé fica fixo). Ao TROCAR de modo,
  // rolamos a faixa "Recentes + filtro" pro topo do scroll — a brand/nav/new
  // somem por cima e a lista fica mais ampla. Scoped ao scroll da gaveta (não
  // mexe no scroll do Obsidian). v0.1.212
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const recentsHeadRef = useRef<HTMLDivElement | null>(null);
  const didMountRef = useRef(false);

  // Rola a faixa "Recentes + filtro" pro topo do scroll da gaveta. O
  // .axxa-sidebar-list tem min-height:100% (CSS) garantindo que SEMPRE há espaço
  // pra a faixa chegar ao topo — então o movimento é idêntico com 1 ou 10000
  // chats. Scoped ao scroll da gaveta (não mexe no Obsidian). v0.1.214
  const scrollRecentsToTop = () => {
    const sc = scrollRef.current;
    const hd = recentsHeadRef.current;
    if (!sc || !hd) return;
    const top =
      hd.getBoundingClientRect().top -
      sc.getBoundingClientRect().top +
      sc.scrollTop;
    sc.scrollTo({ top, behavior: "smooth" });
  };

  // Ao trocar de modo: roda DEPOIS do commit (lista nova já no DOM) pro scrollTo
  // clampar na altura final. Pula o mount inicial.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    scrollRecentsToTop();
  }, [modeFilter]);

  // A11y: Escape fecha a gaveta enquanto aberta. O aside fica sempre montado
  // (toggle por classe pra animar saída), então só escutamos quando open. Junto
  // com inert={!open} no aside, os filhos saem do tab order/leitor ao fechar.
  // v0.1.228
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
        // Fechada: tira os filhos do tab order e do leitor de tela (a gaveta
        // fica sempre montada pra animar). `inert` via ref pq nem todo @types/react
        // tipa o atributo JSX; a propriedade DOM é tipada (lib.dom). v0.1.228
        ref={(el) => {
          if (el) el.inert = !open;
        }}
      >
        {/* Tudo rola junto (brand + new + nav + recentes); só o rodapé fica
            fixo. v0.1.212 */}
        <div
          className="axxa-sidebar-scroll"
          ref={scrollRef}
          onScroll={(e) => {
            const top = e.currentTarget.scrollTop;
            setScrolled((s) => (s ? top > 80 : top > 160));
          }}
        >
          <div className="axxa-sidebar-head">
            <span className="axxa-sidebar-brand">
              <span className="axxa-sidebar-brand-name">AXXA AI Agent</span>
              {version && (
                <span className="axxa-sidebar-brand-ver">v{version}</span>
              )}
            </span>
          </div>

          {/* Um "módulo" por modo: cada um abre uma conversa NOVA já no modo
              certo (chat / vault-qa / agent). Mesma lógica, modo diferente. */}
          <div className="axxa-sidebar-new-group">
            {[
              { mode: "chat", icon: "circle-plus", label: t.header.newChat },
              { mode: "vault-qa", icon: "library", label: t.header.newQa },
              { mode: "agent", icon: "bot", label: t.header.newAgent },
            ].map((b) => (
              <button
                key={b.mode}
                type="button"
                className={"axxa-sidebar-new axxa-sidebar-new-" + b.mode}
                onClick={() => {
                  hapticTick();
                  onNewChatMode(b.mode);
                  onClose();
                }}
              >
                <Icon name={b.icon} />
                <span>{b.label}</span>
              </button>
            ))}
          </div>

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
                  {locked && (
                    <Icon name="lock" className="axxa-sidebar-nav-lock" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="axxa-sidebar-divider" />

          <div className="axxa-sidebar-list">
            <div className="axxa-sidebar-recents-head" ref={recentsHeadRef}>
              <div className="axxa-sidebar-recents-label">{t.header.recents}</div>
              <div className="axxa-sidebar-seg">
                <SegmentedRow
                  items={filterItems}
                  activeId={modeFilter}
                  showActiveLabel
                  onSelect={(id) => {
                    hapticTick();
                    selectMode(id);
                  }}
                />
              </div>
            </div>
            {/* key={modeFilter} força remount → a lista "nasce" deslizando no
                sentido do switch (--axxa-slide-dir). v0.1.213 */}
            <div
              className="axxa-sidebar-list-items"
              key={modeFilter}
              style={{ ["--axxa-slide-dir" as string]: String(slideDir) }}
            >
              {recents.length === 0 ? (
                /* Vazio: distingue "sem nenhuma conversa" de "nada nesse filtro"
                   (existem chats, só não nesse modo). v0.1.215 */
                <div className="axxa-sidebar-empty">
                  <Icon name="inbox" />
                  <p>
                    {safeChats.length === 0
                      ? t.conversations.emptyAll
                      : t.conversations.emptyFilter}
                  </p>
                </div>
              ) : (
                <>
                  {recents.map((c, i) => (
                    <button
                      key={c.filePath || c.id || `row-${i}`}
                      type="button"
                      className="axxa-sidebar-item"
                      onClick={() => {
                        onLoadChat(c.id, c.mode);
                        onClose();
                      }}
                      onContextMenu={(e) => openItemMenu(e, c)}
                    >
                      <span className="axxa-sidebar-item-ico">
                        <Icon
                          name={
                            modelVendorLogoId(c.provider, c.model) ??
                            "message-square"
                          }
                        />
                      </span>
                      <span className="axxa-sidebar-item-title">
                        {c.title?.trim() || t.conversations.untitled}
                      </span>
                      <span className="axxa-sidebar-item-date">
                        {relDate(c.date, t)}
                      </span>
                    </button>
                  ))}
                  {/* "fim da lista" — pinta o vazio abaixo da lista curta com um
                      estado sutil em vez de deixar liso. v0.1.215 */}
                  <div className="axxa-sidebar-end" aria-hidden="true">
                    <span className="axxa-sidebar-end-line" />
                    <span className="axxa-sidebar-end-text">
                      {t.conversations.endOfList}
                    </span>
                    <span className="axxa-sidebar-end-line" />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* FAB "subir ao topo" — só aparece quando a gaveta está rolada. */}
        <button
          type="button"
          className={"axxa-sidebar-fab" + (scrolled ? " is-visible" : "")}
          onClick={() => {
            hapticTick();
            scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label={t.conversations.scrollTop}
          title={t.conversations.scrollTop}
          aria-hidden={!scrolled}
          tabIndex={scrolled ? 0 : -1}
        >
          <Icon name="arrow-up" />
        </button>

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
            <span className="axxa-sidebar-account-avatar">
              {t.account.label.trim().slice(0, 2).toUpperCase()}
            </span>
            <span className="axxa-sidebar-account-main">
              <span className="axxa-sidebar-account-top">
                <span className="axxa-sidebar-account-name">
                  {t.account.label}
                </span>
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
