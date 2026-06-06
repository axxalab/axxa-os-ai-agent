// src/components/_shared/timestamps.ts
// Utilitários de formatação de data/hora pras mensagens.
// Tudo em PT-BR (default do projeto — vide user_profile).

const PT_BR = "pt-BR";

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Hora curta da mensagem — "14:32" */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(PT_BR, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Label do dia pra usar no day separator.
 * "Hoje" / "Ontem" / "12 de junho" / "12 de junho de 2025"
 */
export function formatDayLabel(ts: number, now: Date = new Date()): string {
  const d = new Date(ts);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameDay(d, now)) return "Hoje";
  if (sameDay(d, yesterday)) return "Ontem";

  // Mesmo ano → "12 de junho"; ano diferente → "12 de junho de 2025"
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(PT_BR, { day: "2-digit", month: "long" });
  }
  return d.toLocaleDateString(PT_BR, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Chave única do dia pra detectar mudança entre mensagens consecutivas. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
