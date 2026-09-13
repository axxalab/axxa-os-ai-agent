// src/ui/useVoice.ts
// O gravador de voz do composer: segurar pra gravar, travar pra falar sem
// segurar, pausar, descartar. O texto vai aparecendo ENQUANTO se fala.
//
// COMO O "ao vivo" FUNCIONA — e por que assim:
// O motor transcreve um arquivo inteiro (`transcribeAudio`, OpenAI
// /audio/transcriptions via requestUrl). Não há stream. Então a cada poucos
// segundos mandamos o áudio ACUMULADO ATÉ AQUI e trocamos o texto pelo
// resultado. Tem que ser o acumulado, não o último pedaço: os chunks do
// MediaRecorder não são decodificáveis sozinhos — só o primeiro carrega o
// cabeçalho do contêiner. Custa reenviar, mas é o único jeito honesto com este
// endpoint, e numa fala de meio minuto são poucas chamadas de centavos.
//
// O nível do microfone sai de um AnalyserNode: sem isso, microfone mudo e
// microfone morto são a mesma tela.

import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio } from "../providers/transcribe";

/** De quanto em quanto tempo o texto é atualizado durante a fala. */
const INTERIM_MS = 4000;
/** A primeira atualização sai antes: é ela que prova que está funcionando. */
const FIRST_INTERIM_MS = 1800;
/** Pedaços de 1s: é o que dá granularidade pro acumulado sem inundar. */
const TIMESLICE_MS = 1000;
/** Quantas barrinhas de nível a UI mostra. */
const LEVEL_SLOTS = 48;
/** Teto da gravação. Depois disso ela fecha sozinha. */
const MAX_SECONDS = 300;

export type VoiceState =
  | "idle"
  /** Gravando (sempre mãos livres — o gesto virou um clique). */
  | "recording"
  /** Transcrevendo o fim da gravação. */
  | "working";

export interface Voice {
  state: VoiceState;
  /** Segundos gravados (não conta pausa). */
  seconds: number;
  /** Níveis recentes do microfone, 0..1 — o mais novo por último. */
  levels: number[];
  /** Começa a gravar. Rejeita silencioso (com aviso) se não der. */
  start: () => Promise<boolean>;
  /** Joga fora: nada vai pro texto. */
  cancel: () => void;
  /** Fecha a gravação e transcreve o resto. */
  finish: () => void;
}

export interface VoiceOptions {
  /** Key da OpenAI — a transcrição mora lá. */
  apiKey: () => string;
  /** Modelo de transcrição (vem das Settings). */
  model: () => string;
  /** ISO-639-1 da fala, ou vazio pra deixar o modelo detectar. */
  language: () => string;
  /** Texto reconhecido até agora (parcial ou final). */
  onTranscript: (text: string) => void;
  /** Recado pro usuário (sem key, microfone bloqueado, falha na API). */
  onNotice: (message: string) => void;
  /** Gravação descartada — quem chamou devolve o rascunho ao que era. */
  onCancel: () => void;
}

/** mm:ss a partir de segundos. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Extensão que bate com o que o aparelho gravou (a API sniffa por ela). */
export function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

export function useVoice(opts: VoiceOptions): Voice {
  const [state, setState] = useState<VoiceState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const interimRef = useRef<number | null>(null);
  /** Uma transcrição por vez: a anterior pode chegar depois e atrasar o texto. */
  const busyRef = useRef(false);
  /** Cancelado? O onstop então não transcreve nem escreve nada. */
  const discardedRef = useRef(false);
  const startedAtRef = useRef(0);

  // Sempre o valor mais novo dentro dos callbacks do recorder (que são
  // registrados uma vez e viveriam com um fecho velho).
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (tickRef.current !== null) window.clearInterval(tickRef.current);
    if (interimRef.current !== null) window.clearInterval(interimRef.current);
    rafRef.current = null;
    tickRef.current = null;
    interimRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    recRef.current = null;
  }, []);

  // Sair da view no meio da gravação não pode deixar o microfone aberto.
  useEffect(() => cleanup, [cleanup]);

  /** Manda o acumulado pra transcrição e publica o texto. */
  const transcribeSoFar = useCallback(async (final: boolean) => {
    if (busyRef.current && !final) return;
    const rec = recRef.current;
    const parts = chunksRef.current;
    if (parts.length === 0) return;
    busyRef.current = true;
    const type = rec?.mimeType || "audio/webm";
    const blob = new Blob(parts, { type });
    try {
      const text = await transcribeAudio({
        apiKey: optsRef.current.apiKey(),
        model: optsRef.current.model(),
        language: optsRef.current.language() || undefined,
        filename: `voice.${extensionFor(type)}`,
        data: new Uint8Array(await blob.arrayBuffer()),
      });
      if (!discardedRef.current) optsRef.current.onTranscript(text.trim());
    } catch (err) {
      // No parcial o erro é silencioso de propósito: a rede oscila, e a
      // próxima rodada (ou o final) resolve. No final, o usuário precisa saber.
      if (final) {
        optsRef.current.onNotice(
          `Transcription failed: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    } finally {
      busyRef.current = false;
    }
  }, []);

  const start = useCallback(async () => {
    if (recRef.current) return false;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices) {
      optsRef.current.onNotice("This device can't record audio.");
      return false;
    }
    if (!optsRef.current.apiKey().trim()) {
      optsRef.current.onNotice(
        "Voice needs an OpenAI key — add one in Settings › Providers."
      );
      return false;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      optsRef.current.onNotice(
        "Microphone blocked — allow it for Obsidian and try again."
      );
      return false;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    discardedRef.current = false;
    busyRef.current = false;
    setSeconds(0);
    // Nasce cheia de zeros: assim a onda tem a largura final desde o primeiro
    // quadro, em vez de crescer da esquerda e empurrar os botões.
    setLevels(new Array(LEVEL_SLOTS).fill(0));

    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      cleanup();
      if (discardedRef.current) {
        setState("idle");
        return;
      }
      setState("working");
      void transcribeSoFar(true).then(() => setState("idle"));
    };
    rec.start(TIMESLICE_MS);
    recRef.current = rec;

    // Relógio da gravação (pausa congela).
    startedAtRef.current = Date.now();
    tickRef.current = window.setInterval(() => {
      if (recRef.current?.state !== "recording") return;
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      setSeconds(elapsed);
      // Teto: gravação esquecida é microfone aberto pra sempre.
      if (elapsed >= MAX_SECONDS) {
        optsRef.current.onNotice("Recording stopped at 5 minutes.");
        recRef.current.stop();
      }
    }, 200);

    // Texto aparecendo enquanto se fala. O PRIMEIRO sai mais cedo: o parcial
    // custa o intervalo + a ida à rede, e esperar 4s+latência pra ver o
    // primeiro pedaço parece que nada está acontecendo.
    const rodada = () => {
      if (recRef.current?.state !== "recording") return;
      // requestData fecha um pedaço agora; sem isso o acumulado só cresce de
      // segundo em segundo e o parcial fica sempre atrasado.
      recRef.current.requestData();
      void transcribeSoFar(false);
    };
    window.setTimeout(rodada, FIRST_INTERIM_MS);
    interimRef.current = window.setInterval(rodada, INTERIM_MS);

    // Nível do microfone.
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let last = 0;
      const sample = () => {
        rafRef.current = requestAnimationFrame(sample);
        const now = performance.now();
        if (now - last < 90) return;
        last = now;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) {
          const d = (v - 128) / 128;
          sum += d * d;
        }
        const rms = Math.sqrt(sum / buf.length);
        setLevels((prev) =>
          [...prev, Math.min(1, rms * 3)].slice(-LEVEL_SLOTS)
        );
      };
      sample();
    } catch {
      // Sem medidor a gravação continua — só perde a onda.
    }

    setState("recording");
    return true;
  }, [cleanup, transcribeSoFar]);

  const cancel = useCallback(() => {
    const rec = recRef.current;
    discardedRef.current = true;
    optsRef.current.onCancel();
    if (rec && rec.state !== "inactive") rec.stop();
    else {
      cleanup();
      setState("idle");
    }
  }, [cleanup]);

  const finish = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    try {
      if (rec.state !== "inactive") rec.stop();
    } catch {
      // Recorder já morto (o Android encerra a sessão de áudio sozinho quando
      // outro app pega o microfone): limpa na mão pra não ficar estado preso.
      cleanup();
      setState("idle");
    }
  }, [cleanup]);

  // Trocar de app com o microfone aberto é o jeito mais fácil de deixá-lo
  // ligado sem ninguém olhando — e o Android reage a isso (a sessão de áudio
  // fica disputada, o teclado pisca). Ao esconder a tela, fecha e guarda o que
  // já foi falado.
  useEffect(() => {
    if (state === "idle" || state === "working") return;
    const onHide = () => {
      if (document.hidden) finish();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [state, finish]);

  return { state, seconds, levels, start, cancel, finish };
}
