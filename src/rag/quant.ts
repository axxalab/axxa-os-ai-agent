// src/rag/quant.ts
// Quantização + perfis de índice (estilo Effort): o user escolhe o trade-off
// qualidade × memória e o app recomenda o melhor pro tamanho do vault.
//
// Matemática: embeddings são unit-normalizados (||v|| = 1) ANTES de quantizar.
//  - float32: guarda o vetor unit como Float32Array → cosine = dot (unit norm).
//  - int8:    guarda round(unit × 127) como Int8Array (8× menor que o number[]
//             float64 antigo) → cosine ≈ dot / 127².
// A query é normalizada/quantizada do mesmo jeito no momento da busca.

export type QuantPrecision = "float32" | "int8";

export interface QuantProfile {
  id: string;
  /** Precisão de armazenamento dos vetores. */
  precision: QuantPrecision;
  /** Dim alvo (Matryoshka). 0 = dim cheia do modelo. Só aplica a modelos que
   *  suportam o param `dimensions` (OpenAI text-embedding-3-*). */
  targetDim: number;
  /** Emoji pro seletor (estilo Effort). Label/descrição vêm do i18n. */
  emoji: string;
}

/** 4 perfis — do mais preciso/pesado ao mais leve. */
export const QUANT_PROFILES: Record<string, QuantProfile> = {
  precision: { id: "precision", precision: "float32", targetDim: 0, emoji: "🎯" },
  balanced: { id: "balanced", precision: "int8", targetDim: 0, emoji: "⚖️" },
  light: { id: "light", precision: "int8", targetDim: 512, emoji: "🪶" },
  minimal: { id: "minimal", precision: "int8", targetDim: 256, emoji: "🔬" },
};

export const QUANT_PROFILE_IDS = [
  "precision",
  "balanced",
  "light",
  "minimal",
] as const;

/** Labels curtos (estilo EFFORT_LABELS — em código, não i18n). */
export const QUANT_PROFILE_LABELS: Record<string, string> = {
  precision: "Precisão",
  balanced: "Equilibrado",
  light: "Leve",
  minimal: "Mínimo",
};

/** "Melhor uso" mostrado no campo (estilo EFFORT_DESCRIPTIONS). */
export const QUANT_PROFILE_USES: Record<string, string> = {
  precision: "Máxima qualidade. Vaults pequenos (<2k notas) ou desktop.",
  balanced: "Recomendado. Ótima qualidade e cabe no mobile.",
  light: "Vaults grandes (10k+) no mobile. Rápido e leve.",
  minimal: "Vaults gigantes (50k+). Busca grosseira, máxima economia.",
};

export function getQuantProfile(id: string): QuantProfile {
  return QUANT_PROFILES[id] ?? QUANT_PROFILES.balanced;
}

/** Recomenda um perfil pelo tamanho do vault (nº de notas markdown). */
export function recommendProfile(noteCount: number): string {
  if (noteCount < 2000) return "precision";
  if (noteCount < 10000) return "balanced";
  if (noteCount < 50000) return "light";
  return "minimal";
}

// ============================================================
// Normalização + quantização
// ============================================================

/** Normaliza pra unit norm (||v|| = 1). Devolve Float32Array. */
export function unitNormalize(v: number[] | Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

/** Quantiza um embedding RAW pro typed array do perfil (já unit-normalizado). */
export function quantizeEmbedding(
  raw: number[] | Float32Array,
  precision: QuantPrecision
): Float32Array | Int8Array {
  const unit = unitNormalize(raw);
  if (precision === "float32") return unit;
  const out = new Int8Array(unit.length);
  for (let i = 0; i < unit.length; i++) {
    const q = Math.round(unit[i] * 127);
    out[i] = q > 127 ? 127 : q < -127 ? -127 : q;
  }
  return out;
}

// ============================================================
// Score — dot product sobre vetores unit/quantizados
// ============================================================

/** Cosine ≈ dot (vetores já unit-normalizados). int8 divide por 127² pra
 *  voltar a [-1, 1] (mantém o threshold minScore consistente). */
export function scoreVectors(
  a: Float32Array | Int8Array,
  b: Float32Array | Int8Array,
  precision: QuantPrecision
): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return precision === "int8" ? dot / (127 * 127) : dot;
}

// ============================================================
// Persistência: typed array <-> base64 (1 arquivo JSON, embeddings binários)
// ============================================================

/** Encoda um typed array (Int8/Float32) em base64 do seu buffer. */
export function typedArrayToBase64(arr: Int8Array | Float32Array): string {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let binary = "";
  const chunk = 0x8000; // 32K — evita stack overflow no fromCharCode.apply
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk))
    );
  }
  return btoa(binary);
}

/** Decoda base64 → typed array conforme a precisão do índice. */
export function base64ToTypedArray(
  b64: string,
  precision: QuantPrecision
): Float32Array | Int8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return precision === "int8"
    ? new Int8Array(bytes.buffer)
    : new Float32Array(bytes.buffer);
}

/** Estimativa de RAM (bytes) pra N chunks numa dim/precisão. UI pré-indexação. */
export function estimateIndexBytes(
  chunkCount: number,
  dim: number,
  precision: QuantPrecision
): number {
  const bytesPerComponent = precision === "int8" ? 1 : 4;
  return chunkCount * dim * bytesPerComponent;
}
