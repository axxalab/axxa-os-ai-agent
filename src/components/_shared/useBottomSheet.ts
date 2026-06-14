// src/components/_shared/useBottomSheet.ts
// Lei dos bottom sheets do AXXA: 2 estados — "opened" (abre menor, ~34vh) e
// "expanded" (~70vh; classe .axxa-plus-sheet-full). A ação é basicamente só
// AUMENTAR o modal. O TOPO (handle/header) é o toggle, igual os apps: TAP alterna;
// arrastar pra CIMA = expanded, pra BAIXO = opened (ou fecha se já estava opened).
// O topo fica FIXO (não rola) e só o corpo (.axxa-sheet-body) rola — ver CSS.

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export interface BottomSheetControls {
  /** True = expanded (~70vh); false = opened (~34vh). */
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
  /** Handlers pra grudar no `.axxa-sheet-body` — puxar pra baixo COM o scroll no
   *  topo colapsa (expanded→opened, opened→fecha). */
  bodyProps: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
    onPointerCancel: () => void;
  };
}

/** Distância (px) que conta como swipe deliberado (vs tap). */
const SWIPE_THRESHOLD = 48;
/** Movimento (px) acima do qual deixa de ser tap. */
const TAP_SLOP = 6;
/** Puxão pra baixo (px) no topo do corpo que colapsa/fecha o sheet. */
const PULL_DISMISS = 64;

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

  // ── Corpo: overscroll nas DUAS pontas (o slide vale no corpo inteiro). No TOPO
  // (sem mais o que rolar) + puxa pra baixo → desce um nível (expanded→opened→fecha).
  // No FIM do scroll + puxa pra cima → sobe um nível (opened→expanded). No meio, o
  // scroll nativo rola normal (não captura o pointer). Conteúdo que cabe inteiro
  // está em ambas as pontas → o corpo todo vira "alça". ──
  const bodyStart = useRef<{ y: number; atTop: boolean; atBottom: boolean } | null>(
    null
  );
  const isAtBottom = (el: HTMLElement) =>
    el.scrollHeight - (el.scrollTop + el.clientHeight) <= 1;

  const onBodyPointerDown = (e: ReactPointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    bodyStart.current = {
      y: e.clientY,
      atTop: el.scrollTop <= 0,
      atBottom: isAtBottom(el),
    };
  };

  const onBodyPointerUp = (e: ReactPointerEvent) => {
    if (!bodyStart.current) return;
    const el = e.currentTarget as HTMLElement;
    const dy = e.clientY - bodyStart.current.y;
    const { atTop, atBottom } = bodyStart.current;
    bodyStart.current = null;
    // Topo + puxa pra baixo → desce um nível.
    if (atTop && el.scrollTop <= 0 && dy > PULL_DISMISS) {
      if (expanded) setExpanded(false);
      else onClose();
      return;
    }
    // Fim + puxa pra cima → sobe um nível.
    if (atBottom && isAtBottom(el) && dy < -PULL_DISMISS && !expanded) {
      setExpanded(true);
    }
  };

  const onBodyPointerCancel = () => {
    bodyStart.current = null;
  };

  return {
    expanded,
    sheetClass: expanded ? " axxa-plus-sheet-full" : "",
    topProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    bodyProps: {
      onPointerDown: onBodyPointerDown,
      onPointerUp: onBodyPointerUp,
      onPointerCancel: onBodyPointerCancel,
    },
  };
}
