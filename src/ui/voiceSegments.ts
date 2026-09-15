// src/ui/voiceSegments.ts
// Onde CORTAR a gravação em pedaços, e como remontar o texto deles.
//
// POR QUE CORTAR. O endpoint de transcrição recebe um arquivo inteiro — não há
// stream de entrada. A casca anterior mandava, a cada rodada, TODO o áudio
// gravado até ali (os pedaços do MediaRecorder não são decodificáveis
// sozinhos: só o primeiro carrega o cabeçalho do contêiner). Isso tem dois
// custos que crescem com a fala: cada parcial sobe mais bytes que o anterior,
// e o ÚLTIMO envio — o que acontece quando se solta o botão, justo quando se
// está esperando o texto — sobe a gravação inteira de novo.
//
// Cortando em segmentos independentes, cada um é um arquivo completo: sobe uma
// vez, vira texto final e nunca mais é reenviado. O que fica pendente no fim é
// só o último segmento, de poucos segundos.
//
// ONDE CORTAR. No SILÊNCIO. Cortar por relógio parte palavra no meio e o
// modelo devolve um caco em cada lado. O medidor de nível que desenha a onda
// já diz quando a pessoa parou de falar — é de graça e é o lugar certo.
// O teto por tempo existe pra quem fala sem respirar.

/** Nível (0..1, o mesmo da onda) abaixo do qual contamos como silêncio. */
export const SILENCE_LEVEL = 0.05;
/** Silêncio contínuo que autoriza o corte: uma pausa de fala, não um respiro.
 *  Pausa entre frases dura de 300 a 800ms — 350 pega as curtas sem confundir
 *  com a hesitação no meio de uma palavra (que é bem mais breve). Quem garante
 *  que não se corta cedo demais é o MIN_SEGMENT_MS, não este número. */
export const SILENCE_MS = 350;
/** Antes disso não corta — segmento curto vira chamada de rede à toa. */
export const MIN_SEGMENT_MS = 2500;
/** Teto duro: sem nenhuma pausa, corta assim mesmo. */
export const MAX_SEGMENT_MS = 12000;

/**
 * Chegou a hora de fechar o segmento atual?
 *
 * `silencioMs` é há quanto tempo o nível está abaixo de SILENCE_LEVEL (0 quando
 * a pessoa está falando, e também quando não há medidor — aí só o teto corta).
 */
export function shouldRotate(p: {
  duracaoMs: number;
  silencioMs: number;
}): boolean {
  if (p.duracaoMs >= MAX_SEGMENT_MS) return true;
  return p.duracaoMs >= MIN_SEGMENT_MS && p.silencioMs >= SILENCE_MS;
}

/**
 * Texto mostrado = os segmentos já transcritos, em ordem, mais o parcial do
 * segmento que ainda está sendo falado.
 *
 * Um buraco (segmento ainda voando) é PULADO em vez de segurar o resto: ele
 * chega em ~1s e o texto se corrige no lugar. Segurar tudo por causa dele
 * faria a tela parar justamente enquanto a pessoa fala.
 */
export function joinTranscripts(
  finais: ReadonlyArray<string | undefined>,
  parcial = ""
): string {
  return [...finais, parcial]
    .map((t) => (t ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Melhor contêiner que o aparelho grava, do mais leve pro mais comum.
 * `undefined` = deixa o MediaRecorder escolher (é o que o Android faz quando
 * não suporta nenhum dos nomeados).
 */
export function bestAudioMime(suporta: (t: string) => boolean): string | undefined {
  const candidatos = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  return candidatos.find((t) => suporta(t));
}
