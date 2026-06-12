// src/components/_shared/SegmentedRow.tsx
// Controle segmentado com pílula DESLIZANTE (estilo nav do Threads).
// Extraído da StarterScreen (v0.1.136) pra reuso — StarterScreen (mode/provider)
// + ConversationsList (filtro de modo). Slots iguais (flex 1 1 0); o indicador
// (.axxa-seg-ind) tem a largura de UM slot e desliza via translateX(--seg-i ×
// 100%) com transição. CSS vive em styles/main.css (.axxa-seg*).
//
// Variante `showActiveLabel` (v0.1.210): só o slot ATIVO mostra o texto do modo
// e cresce pra caber; os inativos ficam só ícone. Como os slots deixam de ser
// iguais, o indicador passa a ser MEDIDO (offsetLeft/Width do botão ativo) e
// posicionado inline — desliza E faz morph de largura. A altura não muda (o
// label entra na horizontal).

import {
  type CSSProperties,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
  showActiveLabel = false,
}: {
  items: SegmentedItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Mostra o texto do modo SÓ no slot ativo (cresce na horizontal). */
  showActiveLabel?: boolean;
}) {
  const activeIndex = Math.max(
    0,
    items.findIndex((it) => it.id === activeId)
  );

  // Indicador MEDIDO (só no modo label): os slots têm larguras diferentes, então
  // calculamos a posição/largura reais do botão ativo em vez de fração igual.
  const rowRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!showActiveLabel) return;
    const measure = () => {
      const el = btnRefs.current[activeIndex];
      if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    // Re-mede quando o trilho muda de tamanho (rotação / painel redimensionado)
    // pra a pílula não descolar do botão.
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && rowRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(rowRef.current);
    }
    return () => ro?.disconnect();
  }, [showActiveLabel, activeIndex, items.length]);

  // No modo medido o left vira translateX (GPU) e a largura é setada inline; a
  // transição de width é ligada via CSS (.axxa-seg-labeled .axxa-seg-ind).
  const indStyle: CSSProperties | undefined =
    showActiveLabel && ind
      ? { left: 0, width: ind.width, transform: `translateX(${ind.left}px)` }
      : undefined;

  return (
    <div
      ref={rowRef}
      className={"axxa-seg" + (showActiveLabel ? " axxa-seg-labeled" : "")}
      role="tablist"
      style={
        {
          ["--seg-n" as string]: items.length,
          ["--seg-i" as string]: activeIndex,
        } as CSSProperties
      }
    >
      <span className="axxa-seg-ind" aria-hidden="true" style={indStyle} />
      {items.map((it, i) => {
        const active = it.id === activeId;
        return (
          <button
            key={it.id}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={it.label}
            title={it.title ?? it.label}
            className={
              "axxa-seg-btn" + (active ? " axxa-seg-btn-active" : "")
            }
            onClick={() => onSelect(it.id)}
          >
            <Icon name={it.icon} />
            {showActiveLabel && active && (
              <span className="axxa-seg-btn-label">{it.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
