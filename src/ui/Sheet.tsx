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

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./Icon";

export function Sheet({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      className={open ? "axxa-sheet-layer is-open" : "axxa-sheet-layer"}
      aria-hidden={!open}
    >
      <div className="axxa-scrim" onClick={onClose} />
      <div
        ref={panelRef}
        className="axxa-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="axxa-sheet-grab" aria-hidden="true" />
        <header className="axxa-sheet-head">
          <button
            type="button"
            className="axxa-icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
          <h3 className="axxa-sheet-title">{title}</h3>
          {/* Espelha a largura do X pra manter o título no centro óptico. */}
          <span className="axxa-sheet-head-spacer" aria-hidden="true" />
        </header>
        <div className="axxa-sheet-body">{children}</div>
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
  items: { id: string; icon: string; label: string; dim?: boolean }[];
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
            (it.dim ? " is-dim" : "")
          }
          aria-pressed={it.id === activeId}
          aria-label={it.label}
          title={it.label}
          onClick={() => onPick(it.id)}
        >
          <Icon name={it.icon} size={20} />
        </button>
      ))}
    </div>
  );
}

/** Divisória rotulada DENTRO de um cartão ("Favorites", "Show list"). */
export function SheetBlock({ children }: { children: ReactNode }) {
  return <p className="axxa-sheet-block">{children}</p>;
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
