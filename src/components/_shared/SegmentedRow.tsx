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
// posicionado inline.
//
// v0.1.216 — o SLIDE+MORPH é dirigido pela Web Animations API (element.animate),
// NÃO por transition CSS. Motivo: o transition por inline-style setado dentro de
// useLayoutEffect era frágil (a "mola" não disparava no ambiente do user, mesmo
// com o CSS certo). WAAPI roda imperativo: ignora cascade, prefers-reduced-motion
// e o timing de re-render do React → a mola SEMPRE roda. Lê dur/ease dos tokens
// [DS:motion] da .axxa-root (respeita o nível escolhido nos Settings).

import {
  type CSSProperties,
  Fragment,
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
  /** Nunca mostra label, mesmo ativo (ex.: "Todos" — fica só ícone). */
  iconOnly?: boolean;
  /** Renderiza um divisor "|" ANTES deste item (separa grupos de modos). */
  dividerBefore?: boolean;
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
  const indRef = useRef<HTMLSpanElement | null>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);
  const prevIndRef = useRef<{ left: number; width: number } | null>(null);

  // Lê os tokens de motion ([DS:motion]) da .axxa-root → {ms, ease} pro WAAPI.
  const readMotion = (el: Element): { ms: number; ease: string } => {
    const root = (el.closest(".axxa-root") as HTMLElement | null) ?? null;
    const cs = root ? getComputedStyle(root) : null;
    const durRaw = (cs?.getPropertyValue("--axxa-motion-dur") || "").trim();
    const ms = (parseFloat(durRaw) || 0.34) * (durRaw.endsWith("ms") ? 1 : 1000);
    const ease = (cs?.getPropertyValue("--axxa-motion-ease") || "").trim() || "ease";
    return { ms: Math.max(1, ms), ease };
  };

  useLayoutEffect(() => {
    if (!showActiveLabel) return;
    // Posiciona o indicador no botão ativo. `animate=true` toca a mola (WAAPI)
    // do estado anterior pro novo; em resize só reposiciona (sem animar).
    const place = (animate: boolean) => {
      const el = btnRefs.current[activeIndex];
      const indEl = indRef.current;
      if (!el) return;
      const next = { left: el.offsetLeft, width: el.offsetWidth };
      const prev = prevIndRef.current;
      setInd(next); // posição de descanso (inline)
      prevIndRef.current = next;
      if (
        animate &&
        indEl &&
        prev &&
        typeof indEl.animate === "function" &&
        (prev.left !== next.left || prev.width !== next.width)
      ) {
        const { ms, ease } = readMotion(indEl);
        indEl.animate(
          [
            { transform: `translateX(${prev.left}px)`, width: `${prev.width}px` },
            { transform: `translateX(${next.left}px)`, width: `${next.width}px` },
          ],
          { duration: ms, easing: ease, fill: "none" }
        );
      }
    };
    place(true);
    // Re-mede quando o trilho muda de tamanho (rotação / painel redimensionado).
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && rowRef.current) {
      ro = new ResizeObserver(() => place(false));
      ro.observe(rowRef.current);
    }
    return () => ro?.disconnect();
  }, [showActiveLabel, activeIndex, items.length]);

  // Posição de descanso (inline). O slide entre posições é o WAAPI acima — o CSS
  // do .axxa-seg-labeled .axxa-seg-ind tem transition:none pra não duplicar.
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
      <span
        className="axxa-seg-ind"
        aria-hidden="true"
        ref={indRef}
        style={indStyle}
      />
      {items.map((it, i) => {
        const active = it.id === activeId;
        return (
          <Fragment key={it.id}>
            {it.dividerBefore && (
              <span className="axxa-seg-div" aria-hidden="true" />
            )}
            <button
              ref={(el) => {
                btnRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={it.label}
              title={it.title ?? it.label}
              className={
                "axxa-seg-btn" +
                (active ? " axxa-seg-btn-active" : "") +
                (it.iconOnly ? " axxa-seg-btn-icononly" : "")
              }
              onClick={() => onSelect(it.id)}
            >
              <Icon name={it.icon} />
              {showActiveLabel && active && !it.iconOnly && (
                <span className="axxa-seg-btn-label">{it.label}</span>
              )}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
