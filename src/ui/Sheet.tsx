// src/ui/Sheet.tsx
// Bottom sheet do composer — a folha que sobe de baixo pra escolher provider,
// modelo e effort. Substitui o Menu nativo do Obsidian nesses três seletores
// (o Menu continua servindo pras ações do histórico, que são um menu mesmo).
//
// Anatomia (na referência do app da Claude): puxador, X à esquerda com o
// título centralizado, e o conteúdo em CARDS agrupados — linhas com título +
// legenda, divisória entre elas, a selecionada em accent com um check.
//
// Fecha no scrim, no X e no Esc. Renderiza dentro da .axxa-root (que é
// position: relative), então cobre só o painel da AXXA — nunca o app inteiro.

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Icon } from "./Icon";

export function Sheet({
  title,
  open,
  onClose,
  onBack,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  /** Quando existe, a folha está num nível interno: o X vira seta de voltar
   *  (e o X migra pra direita, pra fechar continuar a um toque). */
  onBack?: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  /** peek = altura do conteúdo (teto baixo) · full = quase a tela toda. */
  const [size, setSize] = useState<"peek" | "full">("peek");
  const startY = useRef<number | null>(null);
  const dragY = useRef(0);
  /** Borda em que o arrasto do CONTEÚDO começou (null = não começou colado). */
  const edge = useRef<"top" | "bottom" | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Fechou: volta pro tamanho pequeno, senão a próxima abre gigante.
  useEffect(() => {
    if (!open) setSize("peek");
  }, [open]);

  // ── arrasto no puxador ──────────────────────────────────────────────────
  // Pra cima cresce, pra baixo encolhe e, já pequena, fecha. Enquanto arrasta
  // a folha acompanha o dedo (com resistência pra cima, que é o limite).
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    startY.current = e.clientY;
    dragY.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    panelRef.current?.classList.add("is-dragging");
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    const dy = e.clientY - startY.current;
    dragY.current = dy;
    const el = panelRef.current;
    // dy > 0 (pra baixo) segue o dedo; pra cima só 35%, que é o "encosto".
    if (el) el.style.transform = `translateY(${Math.max(dy, dy * 0.35)}px)`;
  };

  const onPointerUp = () => {
    if (startY.current === null) return;
    const dy = dragY.current;
    startY.current = null;
    const el = panelRef.current;
    if (el) {
      el.style.transform = "";
      el.classList.remove("is-dragging");
    }
    if (dy < -48) setSize("full");
    else if (dy > 48) {
      if (size === "full") setSize("peek");
      else onClose();
    }
  };

  // ── arrasto no CONTEÚDO (puxar além da borda fecha) ─────────────────────
  // Só engata quando a lista JÁ está no fim (ou no começo) na hora que o dedo
  // encosta: no meio da lista o gesto é rolagem, e o navegador cuida dela.
  const onBodyDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = bodyRef.current;
    if (!el) return;
    const noTopo = el.scrollTop <= 0;
    const noFim = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    edge.current = noTopo ? "top" : noFim ? "bottom" : null;
    // Lista que cabe inteira está nas DUAS bordas — puxar pra baixo fecha,
    // que é o gesto que todo mundo tenta primeiro.
    if (noTopo && noFim) edge.current = "top";
    startY.current = e.clientY;
    dragY.current = 0;
  };

  const onBodyMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startY.current === null || edge.current === null) return;
    const dy = e.clientY - startY.current;
    // Só conta o excesso na direção da borda; o resto é rolagem normal.
    if ((edge.current === "top" && dy <= 0) || (edge.current === "bottom" && dy >= 0)) {
      dragY.current = 0;
      const el = panelRef.current;
      if (el) el.style.transform = "";
      return;
    }
    dragY.current = dy;
    const el = panelRef.current;
    if (!el) return;
    el.classList.add("is-dragging");
    // Pra baixo a folha segue o dedo; pra cima ela só cede um pouco (não há
    // pra onde ir, o gesto é só a intenção de fechar).
    el.style.transform = `translateY(${dy > 0 ? dy : dy * 0.25}px)`;
  };

  const onBodyUp = () => {
    if (startY.current === null) return;
    const dy = dragY.current;
    const borda = edge.current;
    startY.current = null;
    edge.current = null;
    const el = panelRef.current;
    if (el) {
      el.style.transform = "";
      el.classList.remove("is-dragging");
    }
    // Passou da borda com folga? Fecha — dos DOIS lados, como o usuário pediu.
    if (borda === "top" && dy > 96) onClose();
    else if (borda === "bottom" && dy < -96) onClose();
  };

  return (
    <div
      className={open ? "axxa-sheet-layer is-open" : "axxa-sheet-layer"}
      aria-hidden={!open}
    >
      <div className="axxa-scrim" onClick={onClose} />
      <div
        ref={panelRef}
        className={size === "full" ? "axxa-sheet is-full" : "axxa-sheet"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div
          className="axxa-sheet-drag"
          title="Drag to resize"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="axxa-sheet-grab" aria-hidden="true" />
        </div>
        <header className="axxa-sheet-head">
          <button
            type="button"
            className="axxa-icon-btn"
            aria-label={onBack ? "Back" : "Close"}
            onClick={onBack ?? onClose}
          >
            <Icon name={onBack ? "chevron-left" : "x"} />
          </button>
          <h3 className="axxa-sheet-title">{title}</h3>
          {/* Espelha a largura do botão pra manter o título no centro óptico —
              e no nível interno esse lugar é do X. */}
          {onBack ? (
            <button
              type="button"
              className="axxa-icon-btn"
              aria-label="Close"
              onClick={onClose}
            >
              <Icon name="x" />
            </button>
          ) : (
            <span className="axxa-sheet-head-spacer" aria-hidden="true" />
          )}
        </header>
        <div
          ref={bodyRef}
          className="axxa-sheet-body"
          onPointerDown={onBodyDown}
          onPointerMove={onBodyMove}
          onPointerUp={onBodyUp}
          onPointerCancel={onBodyUp}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** Cartão que agrupa linhas (divisória entre elas, cantos arredondados). */
export function SheetGroup({ children }: { children: ReactNode }) {
  return <div className="axxa-sheet-group">{children}</div>;
}

/**
 * Segmented control DENTRO da folha — hoje, os providers. Colunas iguais
 * (são todos logos, mesma largura), então o thumb é só o índice ativo: nada
 * de medir nó, ao contrário do das Settings, onde os rótulos têm larguras
 * diferentes.
 */
export function SheetSeg({
  items,
  activeId,
  onPick,
  label,
}: {
  items: {
    id: string;
    icon: string;
    label: string;
    /** Bolinha de conexão. Bloqueado (off/fail) também não é clicável. */
    health?: "off" | "unknown" | "ok" | "fail";
    /** Por que está bloqueado — vira o tooltip. */
    blocked?: string | null;
  }[];
  activeId: string;
  onPick: (id: string) => void;
  label: string;
}) {
  const index = Math.max(
    items.findIndex((i) => i.id === activeId),
    0
  );
  return (
    <div
      className="axxa-sheet-seg"
      role="group"
      aria-label={label}
      style={
        {
          "--axxa-seg": index,
          "--axxa-seg-count": items.length,
        } as CSSProperties
      }
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={
            "axxa-sheet-seg-item" +
            (it.id === activeId ? " is-active" : "") +
            (it.blocked ? " is-blocked" : "")
          }
          aria-pressed={it.id === activeId}
          aria-label={it.label}
          title={it.blocked ? `${it.label} — ${it.blocked}` : it.label}
          disabled={!!it.blocked && it.id !== activeId}
          onClick={() => onPick(it.id)}
        >
          <span className="axxa-sheet-seg-mark">
            <Icon name={it.icon} size={20} />
            {it.health && (
              <span
                className={`axxa-seg-dot is-${it.health}`}
                aria-hidden="true"
              />
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Linha que ABRE outro nível na mesma folha (o "Show list ›"). Não escolhe
 * nada: navega. Por isso o chevron pra direita, e não um check.
 */
export function SheetNavRow({
  icon,
  title,
  note,
  onClick,
}: {
  icon: string;
  title: string;
  note?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="axxa-sheet-row is-nav" onClick={onClick}>
      <span className="axxa-sheet-badge">
        <Icon name={icon} size={18} />
      </span>
      <span className="axxa-sheet-row-main">
        <span className="axxa-sheet-row-title">{title}</span>
        {note && <span className="axxa-sheet-row-note">{note}</span>}
      </span>
      <Icon name="chevron-right" size={18} className="axxa-sheet-chev" />
    </button>
  );
}

/** Linha de recado dentro do cartão (lista vazia, aviso). */
export function SheetNote({ children }: { children: ReactNode }) {
  return <p className="axxa-sheet-note">{children}</p>;
}

export function SheetRow({
  title,
  note,
  badge,
  icon,
  selected,
  onClick,
}: {
  title: string;
  /** Legenda em uma linha, abaixo do título. */
  note?: string;
  /** Emoji no círculo à esquerda (opcional). */
  badge?: string;
  /** Ícone no círculo à esquerda — inclui os logos dos providers. */
  icon?: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={selected ? "axxa-sheet-row is-active" : "axxa-sheet-row"}
      aria-pressed={selected === true}
      onClick={onClick}
    >
      {badge && <span className="axxa-sheet-badge">{badge}</span>}
      {!badge && icon && (
        <span className="axxa-sheet-badge">
          <Icon name={icon} size={18} />
        </span>
      )}
      <span className="axxa-sheet-row-main">
        <span className="axxa-sheet-row-title">{title}</span>
        {note && <span className="axxa-sheet-row-note">{note}</span>}
      </span>
      {selected && <Icon name="check" size={20} className="axxa-sheet-check" />}
    </button>
  );
}
