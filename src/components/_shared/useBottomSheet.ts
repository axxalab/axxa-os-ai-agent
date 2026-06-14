// src/components/_shared/useBottomSheet.ts
// Lei dos bottom sheets do AXXA: 2 estados — "opened" (abre menor, ~34vh) e
// "expanded" (~70vh; classe .axxa-plus-sheet-full). A ação é basicamente só
// AUMENTAR o modal. O TOPO (handle/header) é o toggle, igual os apps: TAP alterna;
// arrastar pra CIMA = expanded, pra BAIXO = opened (ou fecha se já estava opened).
// O topo fica FIXO (não rola) e só o corpo (.axxa-sheet-body) rola — ver CSS.

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export interface BottomSheetControls {
  /** True = full screen; false = opened (peek). */
  expanded: boolean;
  /** Sufixo de classe pra folha (`.axxa-plus-sheet` + isto). */
  sheetClass: string;
  /** Handlers pra grudar no `.axxa-sheet-top` (handle/header). */
  topProps: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
    onPointerCancel: () => void;
  };
}

/** Distância (px) que conta como swipe deliberado (vs tap). */
const SWIPE_THRESHOLD = 48;
/** Movimento (px) acima do qual deixa de ser tap. */
const TAP_SLOP = 6;

export function useBottomSheet(onClose: () => void): BottomSheetControls {
  const [expanded, setExpanded] = useState(false);
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
      setExpanded(true); // arrasta pra cima → full
    } else if (dy > SWIPE_THRESHOLD) {
      if (expanded) setExpanded(false); // full → opened
      else onClose(); // opened → fecha (igual os apps)
    }
  };

  const onPointerCancel = () => {
    startY.current = null;
  };

  return {
    expanded,
    sheetClass: expanded ? " axxa-plus-sheet-full" : "",
    topProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
