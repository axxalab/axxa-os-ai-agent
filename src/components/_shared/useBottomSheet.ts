// src/components/_shared/useBottomSheet.ts
// Lei dos bottom sheets do AXXA: 2 estados — "opened" (abre menor, ~34vh) e
// "expanded" (~70vh; classe .axxa-plus-sheet-full). A ação é basicamente só
// AUMENTAR o modal. O TOPO (handle/header) é o toggle, igual os apps: TAP alterna;
// arrastar pra CIMA = expanded, pra BAIXO = opened (ou fecha se já estava opened).
// O topo fica FIXO (não rola) e só o corpo (.axxa-sheet-body) rola — ver CSS.
//
// O TOPO usa pointer events (tem touch-action:none, não rola → o pointer completa).
// O CORPO usa TOUCH events: como ele ROLA, o pointer é CANCELADO quando o scroll
// nativo começa (por isso o overscroll não pegava com pointer). Com touch +
// preventDefault na borda a gente captura o overscroll sem o scroll sequestrar.

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

export interface BottomSheetControls {
  /** True = expanded (~70vh); false = opened (~34vh). */
  expanded: boolean;
  /** Sufixo de classe pra folha (`.axxa-plus-sheet` + isto). */
  sheetClass: string;
  /** Handlers pra grudar no `.axxa-sheet-top` (handle/header) — o toggle. */
  topProps: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
    onPointerCancel: () => void;
  };
  /** Ref pra grudar no `.axxa-sheet-body` — overscroll nas 2 pontas (touch). */
  bodyRef: RefObject<HTMLDivElement>;
}

/** Distância (px) que conta como swipe deliberado (vs tap) no topo. */
const SWIPE_THRESHOLD = 48;
/** Movimento (px) acima do qual deixa de ser tap. */
const TAP_SLOP = 6;
/** Overscroll (px) na ponta do corpo que muda de nível. */
const PULL_LEVEL = 64;

export function useBottomSheet(onClose: () => void): BottomSheetControls {
  const [expanded, setExpanded] = useState(false);
  // Refs frescos pros listeners de touch (anexados uma vez, sem stale closure).
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ── TOPO: toggle via pointer (tap alterna; drag cima/baixo = expand/colapsa). ──
  const startY = useRef<number | null>(null);
  const moved = useRef(false);

  const onPointerDown = (e: ReactPointerEvent) => {
    startY.current = e.clientY;
    moved.current = false;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* setPointerCapture pode não existir em alguns WebViews — ignora */
    }
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (startY.current === null) return;
    if (Math.abs(e.clientY - startY.current) > TAP_SLOP) moved.current = true;
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    if (startY.current === null) return;
    const dy = e.clientY - startY.current;
    startY.current = null;
    if (!moved.current) {
      setExpanded((v) => !v); // tap no topo → alterna
      return;
    }
    if (dy < -SWIPE_THRESHOLD) {
      setExpanded(true); // arrasta pra cima → expanded
    } else if (dy > SWIPE_THRESHOLD) {
      if (expanded) setExpanded(false); // expanded → opened
      else onClose(); // opened → fecha
    }
  };
  const onPointerCancel = () => {
    startY.current = null;
  };

  // ── CORPO: overscroll nas 2 pontas via TOUCH. No TOPO + puxa pra baixo → desce
  // um nível (expanded→opened→fecha). No FIM + puxa pra cima → sobe um nível
  // (opened→expanded). No meio o scroll nativo rola normal. ──
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    let sy = 0;
    let dy = 0;
    let dir = 0; // 1 = overscroll pra baixo no topo; -1 = pra cima no fim.

    const atBottom = () =>
      el.scrollHeight - (el.scrollTop + el.clientHeight) <= 1;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      sy = e.touches[0].clientY;
      dy = 0;
      dir = 0;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      dy = t.clientY - sy;
      if (el.scrollTop <= 0 && dy > 0) {
        dir = 1; // no topo, puxando pra baixo
        if (e.cancelable) e.preventDefault();
      } else if (atBottom() && dy < 0) {
        dir = -1; // no fim, puxando pra cima
        if (e.cancelable) e.preventDefault();
      } else {
        dir = 0; // rolando no meio → deixa o scroll nativo
      }
    };
    const onEnd = () => {
      if (dir === 1 && dy > PULL_LEVEL) {
        if (expandedRef.current) setExpanded(false);
        else onCloseRef.current();
      } else if (dir === -1 && dy < -PULL_LEVEL && !expandedRef.current) {
        setExpanded(true);
      }
      dir = 0;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return {
    expanded,
    sheetClass: expanded ? " axxa-plus-sheet-full" : "",
    topProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    bodyRef,
  };
}
