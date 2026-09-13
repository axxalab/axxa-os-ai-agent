// src/ui/readAloud.ts
// Ler a resposta em voz alta. O motor já falava esse endpoint —
// `OpenAIProvider.generateAudio` (/v1/audio/speech, devolve mp3) — e nada
// nesta casca usava. Aqui só cuidamos do que é de UI: uma fala por vez, o
// áudio tocado e descartado, e recado honesto quando não dá.
//
// Uma fala por vez de propósito: duas respostas falando juntas é ruído, não
// recurso. Pedir pra ler enquanto outra toca PARA a anterior.

import { Notice } from "obsidian";
import type AxxaPlugin from "../main";
import { getProvider } from "../providers";

/** Teto do texto mandado pro TTS. Resposta longa vira audiobook e custa caro. */
export const SPEAK_MAX_CHARS = 4000;

/** Vozes da OpenAI (as que o endpoint aceita hoje). */
export const TTS_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
];

/** Modelos de TTS conhecidos, do mais novo ao mais barato. */
export const TTS_MODELS = ["gpt-4o-mini-tts", "tts-1-hd", "tts-1"];

/** Modelos de transcrição conhecidos. */
export const STT_MODELS = [
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "whisper-1",
];

let current: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

/** Para a fala em andamento (se houver) e limpa o blob. */
export function stopSpeaking(): void {
  current?.pause();
  current = null;
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = null;
}

/** Está falando agora? */
export function isSpeaking(): boolean {
  return current !== null;
}

/**
 * Fala o texto. Resolve quando o áudio TERMINA (ou falha) — quem chama usa
 * isso pra desligar o estado "falando" do botão.
 */
export async function speak(plugin: AxxaPlugin, text: string): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  const key = plugin.providerCredential("openai");
  if (!key) {
    new Notice("Read aloud needs an OpenAI key — add one in Settings › Providers.");
    return;
  }
  const provider = getProvider("openai");
  if (!provider.generateAudio) {
    new Notice("This provider can't do text-to-speech.");
    return;
  }
  stopSpeaking();
  try {
    const [item] = await provider.generateAudio(
      {
        model: plugin.settings.ttsModel,
        prompt: clean.slice(0, SPEAK_MAX_CHARS),
        voice: plugin.settings.ttsVoice,
      },
      key
    );
    if (!item) return;
    const url = URL.createObjectURL(
      new Blob([item.data as unknown as BlobPart], { type: item.mime })
    );
    const audio = new Audio(url);
    current = audio;
    currentUrl = url;
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      void audio.play().catch(() => resolve());
    });
  } catch (err) {
    new Notice(
      `Read aloud failed: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    // Só limpa se ainda for ESTA fala: outra pode ter começado no meio.
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    current = null;
    currentUrl = null;
  }
}
