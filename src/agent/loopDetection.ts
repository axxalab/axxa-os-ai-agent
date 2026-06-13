// src/agent/loopDetection.ts
// Detecção de loop do agent: o LLM às vezes "gira" chamando a MESMA tool com os
// MESMOS args N vezes seguidas (ex: re-lendo um arquivo que já falhou). Esta
// lógica era inline no runAgentTurn — extraída pra cá pra ser pura e testável.

/**
 * Serializa um valor de forma determinística: ordena as chaves de TODO objeto
 * (recursivamente) antes do stringify. v0.1.228: sem isso, args com a mesma
 * informação mas ordem de chaves diferente (ex: {a,b} vs {b,a}) geravam
 * assinaturas distintas e furavam a detecção de loop.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.keys(val as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (val as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return val;
  });
}

/** Assinatura única de uma tool call (name + args serializados). */
export function makeCallSignature(
  name: string,
  args: Record<string, unknown>
): string {
  return `${name}::${stableStringify(args)}`;
}

/**
 * True quando as últimas `window` assinaturas existem E são todas idênticas —
 * o sinal de "o agent travou repetindo a mesma chamada". window<=0 desliga.
 */
export function isLooping(signatures: string[], window: number): boolean {
  if (window <= 0) return false;
  const lastN = signatures.slice(-window);
  return lastN.length === window && lastN.every((s) => s === lastN[0]);
}

/** Mantém só as últimas `keep` assinaturas (limita memória do buffer). */
export function trimSignatures(signatures: string[], keep: number): void {
  if (signatures.length > keep) {
    signatures.splice(0, signatures.length - keep);
  }
}
