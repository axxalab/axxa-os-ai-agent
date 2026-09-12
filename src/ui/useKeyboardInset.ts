// src/ui/useKeyboardInset.ts
// Mantém o composer colado no teclado no mobile.
//
// O Obsidian já faz metade do trabalho: ele mantém `--keyboard-height` e
// encolhe o `.app-container` (`max-height: calc(100vh - var(--keyboard-height))`).
// Quando isso funciona, a nossa view encolhe junto e não há nada a fazer —
// mas nem toda WebView reporta a tempo, e durante a animação o Obsidian
// devolve o container pra 100vh (`body.keyboard-animating`).
//
// Então em vez de confiar num sinal só, a gente MEDE: quanto do fundo da
// nossa raiz ficou embaixo do viewport visível? Essa sobra vira
// `--axxa-kb`, que o CSS usa como padding-bottom da raiz. Se o app já tratou,
// a sobra é 0 e o hook não faz nada.

import { Platform } from "obsidian";
import { useEffect, type RefObject } from "react";

/** Abaixo disto é ruído de arredondamento, não teclado. */
const MIN_INSET = 24;

export function useKeyboardInset(ref: RefObject<HTMLElement>): void {
  useEffect(() => {
    const el = ref.current;
    const vv = window.visualViewport;
    if (!el || !Platform.isMobile || !vv) return;

    let raf = 0;

    const measure = () => {
      raf = 0;
      // Quanto o viewport visível sobe em relação ao layout viewport —
      // ou seja, a altura coberta pelo teclado.
      const covered = Math.max(
        0,
        window.innerHeight - (vv.height + vv.offsetTop)
      );
      if (covered < MIN_INSET) {
        el.style.setProperty("--axxa-kb", "0px");
        return;
      }
      // Quanto o fundo da view já está acima do fim do layout viewport
      // (o que o próprio Obsidian já compensou ao encolher o container).
      // Mede com o padding atual zerado, senão a conta se realimenta.
      el.style.setProperty("--axxa-kb", "0px");
      const gap = Math.max(0, window.innerHeight - el.getBoundingClientRect().bottom);
      const inset = Math.max(0, Math.round(covered - gap));
      el.style.setProperty("--axxa-kb", `${inset}px`);
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(measure);
    };

    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    // O teclado anima: remede quando ela termina.
    window.addEventListener("focusin", schedule);
    const settle = window.setTimeout(schedule, 350);

    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("focusin", schedule);
      window.clearTimeout(settle);
      if (raf) window.cancelAnimationFrame(raf);
      el.style.removeProperty("--axxa-kb");
    };
  }, [ref]);
}
