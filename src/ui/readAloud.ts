// src/ui/readAloud.ts
// Ler em voz alta. Dois caminhos, escolhidos nas Settings:
//
//   OpenAI      `OpenAIProvider.generateAudio` (/v1/audio/speech) — já existia
//               no motor e nada nesta casca chamava.
//   ElevenLabs  vozes deles E as CLONADAS da conta — é o único caminho pra
//               "minha própria voz", que a OpenAI não expõe por API.
//
// O DETALHE QUE FAZIA O TESTE "NÃO FUNCIONAR": navegador (e WebView) só deixa
// tocar áudio dentro do gesto do usuário. Entre o clique e o play tem uma ida
// à rede — quando ela volta, o gesto já morreu e o `play()` é recusado em
// silêncio. Por isso o elemento é criado e DESTRAVADO com um silêncio ainda
// dentro do clique; quando o mp3 chega, ele só troca de fonte.

import { Notice } from "obsidian";
import type AxxaPlugin from "../main";
import { getProvider } from "../providers";
import { elevenSpeak } from "../providers/elevenlabs";

/** Teto do texto mandado pro TTS. Resposta longa vira audiobook e custa caro. */
export const SPEAK_MAX_CHARS = 4000;

/** WAV mudo de ~50ms: serve só pra destravar o elemento dentro do gesto. */
const SILENCE =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";

/** Vozes da OpenAI (as que o endpoint aceita hoje). */
export const OPENAI_VOICES = [
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

/** Modelos de TTS da OpenAI, do mais novo ao mais barato. */
export const OPENAI_TTS_MODELS = ["gpt-4o-mini-tts", "tts-1-hd", "tts-1"];

/** Modelos de transcrição conhecidos. */
export const STT_MODELS = [
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "whisper-1",
];

/** Quem sabe falar hoje. Cresce quando um provider ganhar `generateAudio`. */
export const TTS_PROVIDERS: { id: string; label: string; needs: string }[] = [
  { id: "openai", label: "OpenAI", needs: "OpenAI key" },
  { id: "eleven", label: "ElevenLabs", needs: "ElevenLabs key" },
];

/** Tem credencial pra falar por este caminho? */
export function ttsReady(plugin: AxxaPlugin, id: string): boolean {
  return id === "eleven"
    ? !!plugin.settings.elevenApiKey?.trim()
    : !!plugin.providerCredential("openai");
}

let current: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

export function stopSpeaking(): void {
  current?.pause();
  current = null;
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = null;
}

export function isSpeaking(): boolean {
  return current !== null;
}

/** Gera o áudio pelo caminho configurado. */
async function synthesize(
  plugin: AxxaPlugin,
  text: string
): Promise<{ data: Uint8Array; mime: string } | null> {
  const s = plugin.settings;
  if (s.ttsProvider === "eleven") {
    return elevenSpeak({
      apiKey: s.elevenApiKey,
      voiceId: s.elevenVoice,
      model: s.elevenModel,
      text,
    });
  }
  const provider = getProvider("openai");
  if (!provider.generateAudio) return null;
  const [item] = await provider.generateAudio(
    { model: s.ttsModel, prompt: text, voice: s.ttsVoice },
    plugin.providerCredential("openai")
  );
  return item ? { data: item.data as Uint8Array, mime: item.mime } : null;
}

/**
 * Fala o texto. Resolve quando o áudio TERMINA (ou falha) — quem chama usa
 * isso pra desligar o estado "falando" do botão.
 *
 * Chame DIRETO do handler do clique: a primeira linha precisa rodar dentro do
 * gesto pra destravar o áudio.
 */
export async function speak(plugin: AxxaPlugin, text: string): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  const s = plugin.settings;
  if (!ttsReady(plugin, s.ttsProvider)) {
    new Notice(
      s.ttsProvider === "eleven"
        ? "Add your ElevenLabs key in Settings › Chat › Voice."
        : "Add your OpenAI key in Settings › Providers."
    );
    return;
  }

  stopSpeaking();
  // Ainda DENTRO do clique: nasce e toca um silêncio, o que autoriza este
  // elemento a tocar de novo depois que a rede responder.
  const audio = new Audio();
  audio.src = SILENCE;
  void audio.play().catch(() => {});
  current = audio;

  try {
    const item = await synthesize(plugin, clean.slice(0, SPEAK_MAX_CHARS));
    if (!item) {
      new Notice("This provider can't do text-to-speech yet.");
      return;
    }
    // Outra fala começou enquanto esta buscava o áudio: desiste.
    if (current !== audio) return;
    const url = URL.createObjectURL(
      new Blob([item.data as unknown as BlobPart], { type: item.mime })
    );
    currentUrl = url;
    audio.src = url;
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch((err: unknown) => {
        // Recusa do sistema é diferente de erro de rede — e o usuário precisa
        // saber qual dos dois foi.
        new Notice(
          `Playback blocked: ${err instanceof Error ? err.message : String(err)}`
        );
        resolve();
      });
    });
  } catch (err) {
    new Notice(
      `Read aloud failed: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    if (current === audio) {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      current = null;
      currentUrl = null;
    }
  }
}
