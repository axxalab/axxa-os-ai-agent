// src/ui/haptics.ts
// Feedback tátil. Uma única porta pro `navigator.vibrate`, com vocabulário —
// `tap` não é a mesma coisa que `commit`, e o dedo sabe a diferença.
//
// O QUE ISTO NÃO FAZ, e não dá pra fazer: iPhone. O WebKit não expõe vibração
// pra página (a Apple só libera o Taptic Engine pro app nativo). Então isto é
// Android na prática — e o `can()` abaixo simplesmente não faz nada nos
// aparelhos onde a API não existe, em vez de fingir.
//
// Desktop fica de fora de propósito: mouse não tem tato, e um motor de
// vibração num notebook (alguns têm) seria ruído.

import { Platform } from "obsidian";

/** Espelha `settings.hapticsEnabled` — o AxxaView mantém em dia. */
let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

function can(): boolean {
  return (
    enabled &&
    Platform.isMobile &&
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  );
}

function buzz(pattern: number | number[]): void {
  if (!can()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* aparelho recusou — segue sem tato */
  }
}

/** Toque comum: botão, item de lista, aba. O mais curto que se sente. */
export function tap(): void {
  buzz(8);
}

/** Algo ABRIU ou FECHOU: folha, menu, tela. Um tico mais longo que o toque. */
export function screen(): void {
  buzz(14);
}

/** Confirmou algo que vai embora: enviar, usar a transcrição. Dois pulsos. */
export function commit(): void {
  buzz([12, 30, 18]);
}

/** Deu errado ou foi descartado: mais grave, ninguém confunde com sucesso. */
export function warn(): void {
  buzz([20, 45, 20]);
}

/**
 * Liga o tato em TODO clique dentro de uma árvore. Existe pra não depender de
 * alguém lembrar de chamar `tap()` em cada botão novo — o que acaba sempre com
 * metade da tela muda. Os momentos com significado próprio (abrir, enviar,
 * descartar) continuam chamando o seu.
 *
 * Em `pointerdown`, não em `click`: o tato tem que chegar junto com o dedo.
 */
export function hapticsOn(root: HTMLElement): () => void {
  const onDown = (e: Event) => {
    const alvo = e.target as HTMLElement | null;
    if (!alvo?.closest) return;
    if (
      alvo.closest(
        'button, a, [role="button"], input[type="checkbox"], .checkbox-container, select, .axxa-sheet-row, .axxa-seg-item'
      )
    ) {
      tap();
    }
  };
  root.addEventListener("pointerdown", onDown, { capture: true });
  return () => root.removeEventListener("pointerdown", onDown, true);
}
