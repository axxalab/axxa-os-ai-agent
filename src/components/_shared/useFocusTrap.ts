// src/components/_shared/useFocusTrap.ts
// Focus-trap acessível pros modais React (PlusModal, CameraModal, etc).
//
// Os modais .ts (PersonaModal, RenameChatModal, ConfirmationModal, …) estendem
// o Modal nativo do Obsidian e GANHAM foco/Escape de graça. Os modais .tsx são
// React custom e precisavam de um document.addEventListener("keydown") na unha
// só pro Escape — sem prender o Tab nem devolver o foco. Este hook unifica isso
// no padrão WAI-ARIA de dialog:
//   • Tab / Shift+Tab ciclam SÓ entre os focáveis do container (não vazam pro
//     Obsidian atrás do overlay).
//   • Escape chama onEscape (só intercepta se onEscape for passado — assim um
//     modal com navegação própria por teclado, tipo a Arena, mantém suas setas).
//   • Ao desmontar, DEVOLVE o foco pro elemento que o tinha antes de abrir
//     (a11y: o teclado volta pro botão que disparou o modal).

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

interface FocusTrapOptions {
  /** Chamado no Escape. Se ausente, o Escape passa batido (não intercepta). */
  onEscape?: () => void;
  /** Liga/desliga o trap (default true). */
  active?: boolean;
  /** Foca o 1º focável ao montar (default true). */
  autoFocus?: boolean;
}

/**
 * Prende o foco do teclado dentro de `ref` enquanto o modal está aberto.
 * O container precisa ser focável (`tabIndex={-1}`) pra receber foco quando
 * não há nenhum elemento focável dentro.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement>,
  { onEscape, active = true, autoFocus = true }: FocusTrapOptions = {}
): void {
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    // Quem tinha o foco antes de abrir — pra devolver no fim.
    const prevFocus = document.activeElement as HTMLElement | null;

    // Lista os focáveis VISÍVEIS do container (offsetParent null = escondido).
    const focusables = (): HTMLElement[] =>
      Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    if (autoFocus) {
      const first = focusables()[0];
      (first ?? container).focus?.();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!onEscape) return; // deixa o modal tratar (ex.: Arena)
        e.preventDefault();
        e.stopPropagation();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) {
        // Sem focáveis: mantém o foco no container, não deixa vazar.
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !container.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    };

    // Captura=true: intercepta antes dos handlers internos do modal.
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      // Devolve o foco a quem tinha antes (se ainda está no DOM).
      if (prevFocus && prevFocus.isConnected) prevFocus.focus?.();
    };
  }, [ref, onEscape, active, autoFocus]);
}
