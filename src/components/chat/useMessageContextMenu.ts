// src/components/chat/useMessageContextMenu.ts
// Hook que retorna handlers React pra abrir o Menu nativo do Obsidian em:
//   - Right-click (desktop)
//   - Long-press 500ms (mobile) + vibração háptica de 30ms ao disparar
//
// Cancelar critério: dedo se move >10px OU touchend antes do timer.
//
// Decisão de design: usa Menu nativo do Obsidian (não custom popup) — herda
// estilo do tema, ícones Lucide, comportamento de fechar ao clicar fora.

import { useEffect, useRef } from "react";
import { Menu } from "obsidian";
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";

export interface MessageMenuItem {
  title: string;
  icon: string;
  onClick: () => void;
  /** Tinge o item de vermelho (Obsidian aplica .is-warning). */
  destructive?: boolean;
}

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_THRESHOLD_PX = 10;

export function useMessageContextMenu(getItems: () => MessageMenuItem[]) {
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const showMenu = (x: number, y: number) => {
    const items = getItems();
    if (items.length === 0) return;
    const menu = new Menu();
    items.forEach((it) => {
      menu.addItem((m) => {
        m.setTitle(it.title);
        m.setIcon(it.icon);
        if (it.destructive) m.setWarning(true);
        m.onClick(it.onClick);
      });
    });
    menu.showAtPosition({ x, y });
  };

  const cancel = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  };

  // v0.1.228 — cancela qualquer long-press pendente no unmount, evitando que o
  // timer dispare showMenu/vibrate depois do componente sair da árvore.
  useEffect(() => cancel, []);

  return {
    onContextMenu: (e: ReactMouseEvent) => {
      e.preventDefault();
      showMenu(e.clientX, e.clientY);
    },
    onTouchStart: (e: ReactTouchEvent) => {
      if (e.touches.length !== 1) {
        cancel();
        return;
      }
      const t = e.touches[0];
      startRef.current = { x: t.clientX, y: t.clientY };
      timerRef.current = window.setTimeout(() => {
        if (startRef.current) {
          // Feedback háptico — confirma que o long-press foi reconhecido.
          // Android nativo: vibra. iOS Safari: ignora silenciosamente.
          navigator.vibrate?.(30);
          showMenu(startRef.current.x, startRef.current.y);
        }
        cancel();
      }, LONG_PRESS_MS);
    },
    onTouchMove: (e: ReactTouchEvent) => {
      if (!startRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = Math.abs(t.clientX - startRef.current.x);
      const dy = Math.abs(t.clientY - startRef.current.y);
      if (dx > MOVE_CANCEL_THRESHOLD_PX || dy > MOVE_CANCEL_THRESHOLD_PX) cancel();
    },
    onTouchEnd: cancel,
    onTouchCancel: cancel,
  };
}
