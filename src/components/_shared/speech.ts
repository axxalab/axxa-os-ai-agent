// src/components/_shared/speech.ts
// Wrappers finos do Web Speech API (TTS + STT). Usados pelo read-aloud das
// mensagens e pelo Modo Voz. Nativo por padrão (grátis); quando o ★ TTS de
// Connections → Models está setado, usa cloud TTS (OpenAI) — ver setCloudTts.

import { openaiProvider } from "../../providers/openai";

export interface SpeakOpts {
  voiceURI?: string;
  rate?: number;
  onEnd?: () => void;
  onError?: () => void;
}

/** Limpa markdown ruidoso antes de falar. */
export function plainForSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_>~|]/g, "")
    .replace(/\n{2,}/g, ". ")
    .trim();
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

export function cancelSpeech(): void {
  stopCloudAudio();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

// ── Exclusividade de fala ──────────────────────────────────
// speechSynthesis é GLOBAL: só uma fala toca por vez. Quando um novo speak()
// começa, o anterior é cancelado pelo browser — mas o componente que o disparou
// não sabe (UI fica travada em "falando"). Este registry avisa o "dono" anterior
// pra resetar o estado. v0.1.195
let activeSpeaker: (() => void) | null = null;

/** Registra o reset do falante atual; reseta o anterior (cuja fala foi cortada). */
export function claimSpeaker(reset: () => void): void {
  if (activeSpeaker && activeSpeaker !== reset) activeSpeaker();
  activeSpeaker = reset;
}

/** Libera o slot se `reset` ainda for o dono (fala terminou/parou). */
export function releaseSpeaker(reset: () => void): void {
  if (activeSpeaker === reset) activeSpeaker = null;
}

// Ref do último utterance disparado, pra desconectar seus handlers antes do
// próximo cancel() e evitar callbacks fora de ordem. v0.1.228
let lastUtter: SpeechSynthesisUtterance | null = null;

// ── Cloud TTS (opt-in) ──────────────────────────────────────
// Quando AxxaApp injeta uma config (★ TTS de Connections → Models), speak() usa
// a nuvem em vez do TTS nativo do SO. Só OpenAI (/v1/audio/speech) por enquanto.
interface CloudTtsConfig {
  provider: string;
  model: string;
  apiKey: string;
  voice?: string;
}
let cloudTts: CloudTtsConfig | null = null;

/** Liga/desliga o cloud TTS. cfg null (ou sem key/model) = volta pro nativo. */
export function setCloudTts(cfg: CloudTtsConfig | null): void {
  cloudTts = cfg && cfg.apiKey && cfg.model ? cfg : null;
}

/** true se o cloud TTS está ativo (read-aloud funciona mesmo sem speechSynthesis). */
export function isCloudTtsActive(): boolean {
  return cloudTts !== null;
}

// Áudio cloud em reprodução — cancelado junto do speechSynthesis.
let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
function stopCloudAudio(): void {
  if (activeAudio) {
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.pause();
    activeAudio = null;
  }
  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = null;
  }
}

/** Fala via provider (nuvem): cria o <audio> JÁ no tick do gesto (ajuda o
 *  autoplay do mobile), busca o mp3 e toca. true se conseguiu iniciar. */
function speakViaProvider(
  text: string,
  opts: SpeakOpts,
  cfg: CloudTtsConfig
): boolean {
  if (cfg.provider !== "openai") return false;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  stopCloudAudio();
  const audio = new Audio();
  activeAudio = audio;
  audio.onended = () => {
    stopCloudAudio();
    opts.onEnd?.();
  };
  audio.onerror = () => {
    stopCloudAudio();
    opts.onError?.();
  };
  openaiProvider
    .generateAudio({ model: cfg.model, prompt: text, voice: cfg.voice }, cfg.apiKey)
    .then((items) => {
      const item = items[0];
      if (!item || audio !== activeAudio) return; // cancelado nesse meio tempo
      // item.data.buffer é o arrayBuffer cru completo (generateAudio o cria de
      // res.arrayBuffer); cast resolve a união ArrayBuffer|SharedArrayBuffer.
      const blob = new Blob([item.data.buffer as ArrayBuffer], {
        type: item.mime || "audio/mpeg",
      });
      const url = URL.createObjectURL(blob);
      activeAudioUrl = url;
      audio.src = url;
      if (opts.rate) audio.playbackRate = Math.max(0.5, Math.min(2, opts.rate));
      void audio.play().catch(() => {
        stopCloudAudio();
        opts.onError?.();
      });
    })
    .catch(() => {
      stopCloudAudio();
      opts.onError?.();
    });
  return true;
}

/** Fala o texto. Devolve true se conseguiu iniciar. */
export function speak(text: string, opts: SpeakOpts = {}): boolean {
  // Cloud TTS (★ de Models) tem prioridade; se não iniciar, cai pro nativo.
  if (cloudTts && speakViaProvider(text, opts, cloudTts)) return true;
  if (!("speechSynthesis" in window)) {
    opts.onError?.();
    return false;
  }
  const synth = window.speechSynthesis;
  const utter = new SpeechSynthesisUtterance(text);
  if (opts.rate) utter.rate = Math.max(0.5, Math.min(2, opts.rate));
  if (opts.voiceURI) {
    const v = synth.getVoices().find((x) => x.voiceURI === opts.voiceURI);
    if (v) utter.voice = v;
  }
  utter.onend = () => opts.onEnd?.();
  utter.onerror = () => opts.onError?.();
  // v0.1.228: desconecta os handlers do utterance anterior antes de cancelar.
  // synth.cancel() pode disparar o onend/onerror do utterance que estava
  // tocando — tarde e fora de ordem — confundindo o dono anterior. Sem
  // handlers, esses callbacks viram no-op e só o `utter` atual reporta estado.
  if (lastUtter) {
    lastUtter.onend = null;
    lastUtter.onerror = null;
  }
  lastUtter = utter;
  synth.cancel();
  synth.speak(utter);
  return true;
}

// ── STT (reconhecimento de fala) ───────────────────────────
// webkitSpeechRecognition existe no Chromium/Electron; pode faltar em alguns
// builds. Sempre checar isSpeechRecognitionAvailable() antes.

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionAvailable(): boolean {
  return getRecognitionCtor() !== null;
}

export interface DictationHandle {
  stop: () => void;
}

/**
 * Inicia o ditado. `onFinal` recebe cada frase finalizada; `onInterim` recebe
 * o texto parcial (ao vivo). Devolve handle pra parar, ou null se indisponível.
 */
export function startDictation(
  lang: string,
  handlers: {
    onFinal: (text: string) => void;
    onInterim?: (text: string) => void;
    onError?: () => void;
    onEnd?: () => void;
  }
): DictationHandle | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (e) => {
    // v0.1.228: guarda r[0]?.transcript e envolve em try/catch — entrada
    // malformada (alternativa ausente) jogava TypeError que matava o handler
    // sem avisar onError. Agora pula a entrada e reporta a falha.
    try {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const alt = r && r[0];
        const txt = alt?.transcript;
        if (!txt) continue;
        if (r.isFinal) handlers.onFinal(txt.trim());
        else interim += txt;
      }
      if (interim) handlers.onInterim?.(interim.trim());
    } catch {
      handlers.onError?.();
    }
  };
  rec.onerror = () => handlers.onError?.();
  rec.onend = () => handlers.onEnd?.();
  try {
    rec.start();
  } catch {
    return null;
  }
  return { stop: () => rec.stop() };
}
