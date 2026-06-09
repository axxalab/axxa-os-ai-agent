// src/components/_shared/haptics.ts
// Micro vibração (haptic tick) em seleções de UI — v0.1.104.
//
// Usa navigator.vibrate: funciona no Obsidian mobile Android (webview);
// iOS não expõe a API → no-op silencioso. Desktop ignora.
// Duração curtinha (8ms) = "tick" tátil, não zumbido.

export function hapticTick(ms = 8): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no-op — API ausente ou bloqueada */
  }
}
