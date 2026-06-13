// src/components/_shared/timestamps.ts
// Utilitários de formatação de data/hora pras mensagens. en-US por enquanto
// (PT-BR removido na base 1.0; i18n próprio será refeito depois).

const DATE_LOCALE = "en-US";

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Hora curta da mensagem — "2:32 PM" */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(DATE_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Label do dia pra usar no day separator.
 * "Today" / "Yesterday" / "June 12" / "June 12, 2025"
 */
export function formatDayLabel(ts: number, now: Date = new Date()): string {
  const d = new Date(ts);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameDay(d, now)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";

  // Mesmo ano → "June 12"; ano diferente → "June 12, 2025"
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(DATE_LOCALE, { day: "2-digit", month: "long" });
  }
  return d.toLocaleDateString(DATE_LOCALE, {
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
