// src/components/_shared/useWakeLock.ts
// Mantém a tela LIGADA enquanto `active` for true (ex: durante a geração da IA).
//
// Resolve o caso mobile mais comum: você manda a mensagem, larga o celular, a
// tela apagaria por inatividade em ~30s e o WebView congelaria o stream no meio.
// Com o screen wake lock a tela fica acesa enquanto gera → o JS continua rodando
// → a resposta termina.
//
// Limitação de plataforma (honesta): NÃO mantém JS rodando se o usuário
// bloquear a tela manualmente (botão power) ou mandar o app pro background —
// o WebView do Obsidian mobile congela o event loop e um plugin não tem acesso
// a foreground service nativo. O lock também cai quando a aba fica oculta; por
// isso re-adquirimos no `visibilitychange`.

import { useEffect, useRef } from "react";

// A Wake Lock API não está nos tipos DOM do TS deste projeto (@types/node 16),
// então tipamos o mínimo necessário aqui.
interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", cb: () => void) => void;
}
interface WakeLockNavigator {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
}

export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    const nav = navigator as Navigator & WakeLockNavigator;
    if (!nav.wakeLock) return; // indisponível (iOS antigo, desktop sem suporte)

    let cancelled = false;

    const acquire = async () => {
      if (!active || document.visibilityState !== "visible") return;
      // Já temos um lock vivo
      if (sentinelRef.current && !sentinelRef.current.released) return;
      try {
        const sentinel = await nav.wakeLock!.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        // OS pode soltar sozinho (bateria baixa, etc.) — limpa a ref pra
        // permitir re-aquisição no próximo visibilitychange.
        sentinel.addEventListener("release", () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch {
        // Best-effort — se falhar, segue sem wake lock
      }
    };

    const release = () => {
      const s = sentinelRef.current;
      sentinelRef.current = null;
      if (s && !s.released) s.release().catch(() => {});
    };

    // O lock cai quando a aba fica oculta; re-adquire ao voltar (se ainda ativo)
    const onVisibility = () => {
      if (active && document.visibilityState === "visible") acquire();
    };

    if (active) acquire();
    else release();

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [active]);
}
