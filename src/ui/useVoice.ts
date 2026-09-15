// src/ui/useVoice.ts
// O gravador de voz do composer: clicar pra gravar, descartar, encerrar.
// O texto vai aparecendo ENQUANTO se fala.
//
// COMO O "ao vivo" FUNCIONA — e por que assim:
// O motor transcreve um ARQUIVO inteiro (`transcribeAudio`, OpenAI
// /audio/transcriptions via requestUrl). Não há stream de entrada. Então a
// gravação é cortada em SEGMENTOS independentes — cada um um arquivo completo,
// cortado no silêncio pra não partir palavra (veja voiceSegments.ts). Cada
// segmento sobe UMA vez, vira texto final e nunca mais é reenviado; o texto na
// tela é a soma dos finais mais o parcial do segmento em curso.
//
// Isso é o que torna o fim rápido: ao encerrar, o que falta transcrever é só o
// último segmento (segundos), não a gravação inteira. Antes, soltar o botão
// depois de um minuto de fala mandava aquele minuto todo de volta pra rede.
//
// O nível do microfone sai de um AnalyserNode: sem isso, microfone mudo e
// microfone morto são a mesma tela — e é ele também que encontra as pausas.

import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio } from "../providers/transcribe";
import {
  SILENCE_LEVEL,
  bestAudioMime,
  joinTranscripts,
  shouldRotate,
} from "./voiceSegments";

/** De quanto em quanto tempo o parcial do segmento em curso é atualizado. */
const INTERIM_MS = 3000;
/** A primeira atualização sai antes: é ela que prova que está funcionando. */
const FIRST_INTERIM_MS = 1500;
/** Pedaços de 1s: granularidade pro acumulado sem inundar. */
const TIMESLICE_MS = 1000;
/** Voz em opus: 32kbps mono é transparente pra ASR e ~4x mais leve que o
 *  padrão do Chromium — bytes a menos é latência a menos em cada envio. */
const AUDIO_BPS = 32000;
/** De quanto em quanto tempo o nível é lido pra achar as pausas. Tem que ser
 *  BEM menor que SILENCE_MS: medindo a cada 200ms, reconhecer 350ms de silêncio
 *  exigia ~550ms observados, e metade das pausas de verdade passava batido —
 *  medido no harness, com pausas de 700ms, metade dos cortes se perdia. A 60ms
 *  o erro cabe numa piscada e custa uma leitura do analyser. */
const LEVEL_MS = 60;
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
  /** Texto reconhecido até agora — parcial, pra mostrar enquanto se fala. */
  onTranscript: (text: string) => void;
  /**
   * A gravação terminou e este é o texto DEFINITIVO. Existe como aviso
   * próprio porque a alternativa — quem usa o hook observar `state` virar
   * idle e pegar o último `onTranscript` — depende da ordem em que os dois
   * chegam no render, e uma publicação atrasada fazia o texto entrar duas
   * vezes no rascunho (uma gravação de 2s virava "perfeito perfeito").
   */
  onFinal: (text: string) => void;
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

/** Um pedaço fechado da gravação: arquivo completo, transcrito uma vez só. */
interface Segmento {
  chunks: Blob[];
  mime: string;
}

export function useVoice(opts: VoiceOptions): Voice {
  const [state, setState] = useState<VoiceState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  /** O medidor fica aqui, e não preso no rAF: o SILÊNCIO é lido pelo tique de
   *  200ms. Fora da tela o rAF congela, e no aparelho ele derrapa quando algo
   *  pesado acontece (teclado abrindo, tela escurecendo) — amarrar o corte da
   *  gravação a ele era amarrá-lo a um relógio que para. */
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const nivelRef = useRef<number | null>(null);
  const interimRef = useRef<number | null>(null);
  const primeiroParcialRef = useRef<number | null>(null);

  /** Todos os segmentos, por índice — guardados inteiros pra poder repetir um
   *  envio que falhou sem perder o que foi falado. */
  const segsRef = useRef<Segmento[]>([]);
  /** Texto final de cada segmento (undefined = ainda voando). */
  const finaisRef = useRef<(string | undefined)[]>([]);
  /** Índices cujo envio falhou — ganham uma segunda chance no fim. */
  const falharamRef = useRef<Set<number>>(new Set());
  /** Envios em voo, pra o fim poder esperar todos. */
  const pendentesRef = useRef<Promise<unknown>[]>([]);
  /** Índice do segmento em curso. */
  const atualRef = useRef(0);
  /** Parcial do segmento em curso (some quando ele fecha). */
  const parcialRef = useRef("");
  /** Um parcial por vez: o anterior pode chegar depois e atrasar o texto. */
  const parcialOcupadoRef = useRef(false);
  /** Quando o nível caiu abaixo do silêncio (null = está falando). */
  const silencioDesdeRef = useRef<number | null>(null);
  /** Quando o segmento em curso começou. */
  const segIniciadoRef = useRef(0);
  /** O stop que está acontecendo é rotação de segmento, não fim da gravação. */
  const rotacionandoRef = useRef(false);
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
    if (nivelRef.current !== null) window.clearInterval(nivelRef.current);
    if (interimRef.current !== null) window.clearInterval(interimRef.current);
    if (primeiroParcialRef.current !== null)
      window.clearTimeout(primeiroParcialRef.current);
    rafRef.current = null;
    tickRef.current = null;
    nivelRef.current = null;
    interimRef.current = null;
    primeiroParcialRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    bufRef.current = null;
    recRef.current = null;
  }, []);

  // Sair da view no meio da gravação não pode deixar o microfone aberto.
  useEffect(() => cleanup, [cleanup]);

  /** Nível atual do microfone (0..1) — ou null quando não há medidor. Marca
   *  de quebra desde quando está em silêncio, que é o que decide o corte. */
  const lerNivel = useCallback(() => {
    const analyser = analyserRef.current;
    const buf = bufRef.current;
    if (!analyser || !buf) return null;
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) {
      const d = (v - 128) / 128;
      sum += d * d;
    }
    const nivel = Math.min(1, Math.sqrt(sum / buf.length) * 3);
    if (nivel < SILENCE_LEVEL) {
      if (silencioDesdeRef.current === null)
        silencioDesdeRef.current = Date.now();
    } else {
      silencioDesdeRef.current = null;
    }
    return nivel;
  }, []);

  /** Publica o que dá pra mostrar agora: finais em ordem + parcial em curso. */
  const publicar = useCallback(() => {
    if (discardedRef.current) return;
    optsRef.current.onTranscript(
      joinTranscripts(finaisRef.current, parcialRef.current)
    );
  }, []);

  /** Manda UM arquivo pra transcrição. Devolve o texto ou lança. */
  const enviar = useCallback(async (seg: Segmento) => {
    const blob = new Blob(seg.chunks, { type: seg.mime });
    return transcribeAudio({
      apiKey: optsRef.current.apiKey(),
      model: optsRef.current.model(),
      language: optsRef.current.language() || undefined,
      filename: `voice.${extensionFor(seg.mime)}`,
      data: new Uint8Array(await blob.arrayBuffer()),
    });
  }, []);

  /** Transcreve um segmento FECHADO. O resultado é final: vira texto e aquele
   *  áudio nunca mais sobe. Falha fica marcada pra segunda chance no fim. */
  const transcreverSegmento = useCallback(
    async (i: number) => {
      const seg = segsRef.current[i];
      if (!seg || seg.chunks.length === 0) return;
      try {
        const text = await enviar(seg);
        finaisRef.current[i] = text.trim();
        falharamRef.current.delete(i);
        publicar();
      } catch {
        // Silencioso aqui de propósito: a rede oscila e o fim tenta de novo.
        falharamRef.current.add(i);
      }
    },
    [enviar, publicar]
  );

  /** Parcial do segmento em curso: some assim que ele fechar. */
  const transcreverParcial = useCallback(async () => {
    if (parcialOcupadoRef.current) return;
    const rec = recRef.current;
    if (!rec || rec.state !== "recording") return;
    const i = atualRef.current;
    const seg = segsRef.current[i];
    if (!seg || seg.chunks.length === 0) return;
    parcialOcupadoRef.current = true;
    try {
      const text = await enviar({ chunks: [...seg.chunks], mime: seg.mime });
      // Chegou depois de o segmento fechar? Então é lixo — quem manda é o
      // final daquele índice, que já está (ou vai estar) no lugar. E se a
      // gravação já ACABOU, publicar aqui é pior que inútil.
      if (
        atualRef.current === i &&
        !discardedRef.current &&
        recRef.current?.state === "recording"
      ) {
        parcialRef.current = text.trim();
        publicar();
      }
    } catch {
      // Parcial que falha não incomoda ninguém: o próximo resolve.
    } finally {
      parcialOcupadoRef.current = false;
    }
  }, [enviar, publicar]);

  /** Abre um recorder novo pro segmento `i` em cima do stream que já está
   *  aberto. Os pedaços caem no segmento que era o atual quando ele começou. */
  const abrirRecorder = useCallback((i: number) => {
    const stream = streamRef.current;
    if (!stream) return null;
    const mime = bestAudioMime((t) =>
      typeof MediaRecorder !== "undefined" &&
      typeof MediaRecorder.isTypeSupported === "function"
        ? MediaRecorder.isTypeSupported(t)
        : false
    );
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        audioBitsPerSecond: AUDIO_BPS,
      });
    } catch {
      // Aparelho que recusa as opções ainda grava com o padrão dele.
      rec = new MediaRecorder(stream);
    }
    segsRef.current[i] = {
      chunks: [],
      mime: rec.mimeType || mime || "audio/webm",
    };
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) segsRef.current[i]?.chunks.push(e.data);
    };
    return rec;
  }, []);

  /** Fecha o segmento em curso e começa o próximo. Chamado pelo onstop. */
  const rotacionar = useCallback(
    (aoParar: () => void) => {
      const i = atualRef.current;
      pendentesRef.current.push(transcreverSegmento(i));
      atualRef.current = i + 1;
      parcialRef.current = "";
      segIniciadoRef.current = Date.now();
      silencioDesdeRef.current = null;

      const rec = abrirRecorder(atualRef.current);
      if (!rec) return;
      rec.onstop = aoParar;
      recRef.current = rec;
      rec.start(TIMESLICE_MS);
    },
    [abrirRecorder, transcreverSegmento]
  );

  /** Fim de verdade: fecha o último segmento, espera todo mundo, tenta de novo
   *  o que falhou (o áudio está aqui) e publica. */
  const finalizar = useCallback(async () => {
    pendentesRef.current.push(transcreverSegmento(atualRef.current));
    parcialRef.current = "";
    await Promise.allSettled(pendentesRef.current);
    pendentesRef.current = [];
    const falhos = [...falharamRef.current];
    if (falhos.length) {
      await Promise.allSettled(falhos.map((i) => transcreverSegmento(i)));
    }
    publicar();
    if (falharamRef.current.size) {
      optsRef.current.onNotice(
        "Part of the recording could not be transcribed — check the connection."
      );
    }
    if (!discardedRef.current) {
      optsRef.current.onFinal(joinTranscripts(finaisRef.current, ""));
    }
  }, [publicar, transcreverSegmento]);

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
      // Mono e com os filtros do aparelho: é voz, não música — metade dos
      // bytes e menos ruído pro modelo tropeçar.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        optsRef.current.onNotice(
          "Microphone blocked — allow it for Obsidian and try again."
        );
        return false;
      }
    }
    streamRef.current = stream;
    segsRef.current = [];
    finaisRef.current = [];
    falharamRef.current = new Set();
    pendentesRef.current = [];
    atualRef.current = 0;
    parcialRef.current = "";
    parcialOcupadoRef.current = false;
    silencioDesdeRef.current = null;
    analyserRef.current = null;
    bufRef.current = null;
    discardedRef.current = false;
    rotacionandoRef.current = false;
    setSeconds(0);
    // Nasce cheia de zeros: assim a onda tem a largura final desde o primeiro
    // quadro, em vez de crescer da esquerda e empurrar os botões.
    setLevels(new Array(LEVEL_SLOTS).fill(0));

    const rec = abrirRecorder(0);
    if (!rec) return false;
    const aoParar = () => {
      // Rotação: fecha este segmento e segue gravando no próximo.
      if (rotacionandoRef.current) {
        rotacionandoRef.current = false;
        rotacionar(aoParar);
        return;
      }
      cleanup();
      if (discardedRef.current) {
        setState("idle");
        return;
      }
      setState("working");
      void finalizar().then(() => setState("idle"));
    };
    rec.onstop = aoParar;
    recRef.current = rec;
    rec.start(TIMESLICE_MS);

    startedAtRef.current = Date.now();
    segIniciadoRef.current = Date.now();

    // Relógio da gravação + decisão de cortar. Os dois no mesmo tique porque
    // ambos olham o mesmo relógio, e assim a rotação continua acontecendo
    // mesmo quando o medidor de nível não subiu (aí só o teto por tempo corta).
    tickRef.current = window.setInterval(() => {
      const atual = recRef.current;
      if (atual?.state !== "recording") return;
      const agora = Date.now();
      const elapsed = (agora - startedAtRef.current) / 1000;
      setSeconds(elapsed);
      if (elapsed >= MAX_SECONDS) {
        optsRef.current.onNotice("Recording stopped at 5 minutes.");
        atual.stop();
        return;
      }
      const silencioMs = silencioDesdeRef.current
        ? agora - silencioDesdeRef.current
        : 0;
      if (
        !rotacionandoRef.current &&
        shouldRotate({ duracaoMs: agora - segIniciadoRef.current, silencioMs })
      ) {
        rotacionandoRef.current = true;
        try {
          atual.stop();
        } catch {
          rotacionandoRef.current = false;
        }
      }
    }, 200);

    // Leitura do nível num intervalo PRÓPRIO e fino. Fica fora do rAF de
    // propósito: fora da tela ele congela, e no aparelho derrapa quando algo
    // pesado acontece — amarrar o corte da gravação a ele é amarrá-lo a um
    // relógio que para. Aqui ele só não escreve estado: quem desenha é o rAF.
    nivelRef.current = window.setInterval(() => {
      if (recRef.current?.state === "recording") lerNivel();
    }, LEVEL_MS);

    // Texto aparecendo enquanto se fala. O PRIMEIRO sai mais cedo: o parcial
    // custa o intervalo + a ida à rede, e esperar o intervalo inteiro pra ver
    // o primeiro pedaço parece que nada está acontecendo.
    const rodada = () => {
      const atual = recRef.current;
      if (atual?.state !== "recording") return;
      // requestData fecha um pedaço agora; sem isso o acumulado só cresce de
      // segundo em segundo e o parcial fica sempre atrasado.
      atual.requestData();
      void transcreverParcial();
    };
    primeiroParcialRef.current = window.setTimeout(rodada, FIRST_INTERIM_MS);
    interimRef.current = window.setInterval(rodada, INTERIM_MS);

    // Nível do microfone — desenha a onda E encontra as pausas.
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      analyserRef.current = analyser;
      bufRef.current = new Uint8Array(analyser.frequencyBinCount);
      // O rAF agora só DESENHA a onda. Quem decide o corte é o tique.
      let last = 0;
      const sample = () => {
        rafRef.current = requestAnimationFrame(sample);
        const now = performance.now();
        if (now - last < 90) return;
        last = now;
        const nivel = lerNivel();
        if (nivel !== null) setLevels((prev) => [...prev, nivel].slice(-LEVEL_SLOTS));
      };
      sample();
    } catch {
      // Sem medidor a gravação continua — perde a onda e corta só pelo teto.
    }

    setState("recording");
    return true;
  }, [abrirRecorder, cleanup, finalizar, lerNivel, rotacionar, transcreverParcial]);

  const cancel = useCallback(() => {
    const rec = recRef.current;
    discardedRef.current = true;
    rotacionandoRef.current = false;
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
    rotacionandoRef.current = false;
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
