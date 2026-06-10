// src/components/_shared/SegmentedRow.tsx
// Controle segmentado SÓ ÍCONE com pílula DESLIZANTE (estilo nav do Threads).
// Extraído da StarterScreen (v0.1.136) pra reuso — StarterScreen (mode/provider)
// + ConversationsList (filtro de modo). Slots iguais (flex 1 1 0); o indicador
// (.axxa-seg-ind) tem a largura de UM slot e desliza via translateX(--seg-i ×
// 100%) com transição. CSS vive em styles/main.css (.axxa-seg*).

import { type CSSProperties } from "react";
import { Icon } from "./Icon";

export interface SegmentedItem {
  id: string;
  icon: string;
  /** Usado em aria-label + fallback de title. */
  label: string;
  /** Tooltip (hover) — cai no label se ausente. */
  title?: string;
  /** Mock visual (não selecionável ainda) — caller trata no onSelect. */
  soon?: boolean;
}

export function SegmentedRow({
  items,
  activeId,
  onSelect,
}: {
  items: SegmentedItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const activeIndex = Math.max(
    0,
    items.findIndex((it) => it.id === activeId)
  );
  return (
    <div
      className="axxa-seg"
      role="tablist"
      style={
        {
          ["--seg-n" as string]: items.length,
          ["--seg-i" as string]: activeIndex,
        } as CSSProperties
      }
    >
      <span className="axxa-seg-ind" aria-hidden="true" />
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={it.id === activeId}
          aria-label={it.label}
          title={it.title ?? it.label}
          className={
            "axxa-seg-btn" + (it.id === activeId ? " axxa-seg-btn-active" : "")
          }
          onClick={() => onSelect(it.id)}
        >
          <Icon name={it.icon} />
        </button>
      ))}
    </div>
  );
}
