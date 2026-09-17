// src/usage/format.ts
// Números grandes ditos em poucos caracteres: 940, 12.4k, 3.1M.
//
// O relatório de uso já fazia isso na mão; o cartão da home precisa do MESMO
// jeito de dizer, senão "48.2k" numa tela e "48,200" na outra passam a
// parecer dois números diferentes.

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  // Acima de 10k a casa decimal não informa nada — "48k" e "48.2k" levam a
  // mesma decisão, e a segunda ocupa mais espaço numa linha apertada.
  if (abs >= 1_000) return (n / 1_000).toFixed(abs >= 10_000 ? 0 : 1) + "k";
  return String(n);
}
