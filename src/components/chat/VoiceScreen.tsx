// src/components/chat/VoiceScreen.tsx
// Modo Voz (refs: ChatGPT iOS 133 intro / 140 conversa / Grok 63-66 ajustes).
//   - Intro (1ª vez): lista de recursos + "Começar"
//   - Conversa: orb animado por estado + status + mic + fechar + ajustes
//   - Ajustes: voz (TTS) + velocidade (slider com bolha de valor)
//
// STT via Web Speech API (quando disponível); TTS via speechSynthesis. Tudo
// local. Loop hands-free: ouve → envia → IA responde → lê em voz → volta a ouvir.

import { useEffect, useRef, useState } from "react";
import { Icon } from "../_shared/Icon";
import { useT } from "../../i18n";
import {
  speak,
  cancelSpeech,
  plainForSpeech,
  listVoices,
  isSpeechRecognitionAvailable,
  startDictation,
  type DictationHandle,
} from "../_shared/speech";

type ConvoState = "idle" | "listening" | "thinking" | "speaking";

interface VoiceScreenProps {
  onSend: (text: string) => void;
  onClose: () => void;
  /** Última resposta da IA — lida em voz quando `done`. */
  lastAi: { id: string; content: string; done: boolean } | null;
  isStreaming: boolean;
  /** Locale pra STT (ex: "pt-BR"). */
  lang: string;
  voiceURI: string;
  voiceRate: number;
  onChangeVoice: (uri: string) => void;
  onChangeRate: (rate: number) => void;
  introDone: boolean;
  onIntroDone: () => void;
}

export function VoiceScreen({
  onSend,
  onClose,
  lastAi,
  isStreaming,
  lang,
  voiceURI,
  voiceRate,
  onChangeVoice,
  onChangeRate,
  introDone,
  onIntroDone,
}: VoiceScreenProps) {
  const t = useT();
  const sttOk = isSpeechRecognitionAvailable();
  const [showIntro, setShowIntro] = useState(!introDone);
  const [state, setState] = useState<ConvoState>("idle");
  const [interim, setInterim] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(listVoices());

  const dictationRef = useRef<DictationHandle | null>(null);
  const spokenIdRef = useRef<string | null>(null);
  const stateRef = useRef<ConvoState>("idle");
  stateRef.current = state;

  // Voices podem carregar async (onvoiceschanged).
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const update = () => setVoices(listVoices());
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);

  const stopListening = () => {
    dictationRef.current?.stop();
    dictationRef.current = null;
  };

  const startListening = () => {
    if (!sttOk) return;
    setInterim("");
    setState("listening");
    dictationRef.current = startDictation(lang, {
      onInterim: setInterim,
      onFinal: (text) => {
        if (!text) return;
        stopListening();
        setInterim("");
        setState("thinking");
        onSend(text);
      },
      onError: () => setState("idle"),
      onEnd: () => {
        // Se parou sozinho enquanto ainda "ouvindo", volta pra idle.
        if (stateRef.current === "listening") setState("idle");
      },
    });
  };

  const toggleMic = () => {
    if (state === "listening") {
      stopListening();
      setState("idle");
    } else if (state === "idle") {
      startListening();
    }
  };

  // Quando a IA termina de responder, lê em voz e (depois) volta a ouvir.
  useEffect(() => {
    if (!lastAi || !lastAi.done) return;
    if (lastAi.id === spokenIdRef.current) return;
    if (showIntro) return;
    spokenIdRef.current = lastAi.id;
    const text = plainForSpeech(lastAi.content);
    if (!text) {
      setState("idle");
      return;
    }
    setState("speaking");
    speak(text, {
      voiceURI,
      rate: voiceRate,
      onEnd: () => {
        setState("idle");
        if (sttOk) startListening();
      },
      onError: () => setState("idle"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAi?.id, lastAi?.done]);

  // Streaming em andamento → "pensando".
  useEffect(() => {
    if (isStreaming) {
      stopListening();
      setState("thinking");
    }
  }, [isStreaming]);

  // Cleanup ao desmontar.
  useEffect(() => {
    return () => {
      stopListening();
      cancelSpeech();
    };
  }, []);

  const handleClose = () => {
    stopListening();
    cancelSpeech();
    onClose();
  };

  const startConvo = () => {
    onIntroDone();
    setShowIntro(false);
    if (sttOk) startListening();
  };

  // ── Intro ────────────────────────────────────────────────
  if (showIntro) {
    const features: { icon: string; title: string; desc: string }[] = [
      { icon: "messages-square", title: t.voice.feat1Title, desc: t.voice.feat1Desc },
      { icon: "volume-2", title: t.voice.feat2Title, desc: t.voice.feat2Desc },
      { icon: "sliders-horizontal", title: t.voice.feat3Title, desc: t.voice.feat3Desc },
      { icon: "shield-check", title: t.voice.feat4Title, desc: t.voice.feat4Desc },
    ];
    return (
      <div className="axxa-voice axxa-voice-intro" role="dialog" aria-label={t.voice.introTitle}>
        <button
          type="button"
          className="axxa-voice-close axxa-voice-close-corner"
          onClick={handleClose}
          aria-label={t.voice.close}
        >
          <Icon name="x" />
        </button>
        <h2 className="axxa-voice-intro-title">{t.voice.introTitle}</h2>
        <div className="axxa-voice-feats">
          {features.map((f, i) => (
            <div key={i} className="axxa-voice-feat">
              <span className="axxa-voice-feat-icon">
                <Icon name={f.icon} />
              </span>
              <span className="axxa-voice-feat-text">
                <span className="axxa-voice-feat-title">{f.title}</span>
                <span className="axxa-voice-feat-desc">{f.desc}</span>
              </span>
            </div>
          ))}
        </div>
        {!sttOk && (
          <p className="axxa-voice-warn">{t.voice.sttUnavailable}</p>
        )}
        <button type="button" className="axxa-voice-cta" onClick={startConvo}>
          {t.voice.start}
        </button>
      </div>
    );
  }

  // ── Conversa ─────────────────────────────────────────────
  const statusText =
    state === "listening"
      ? interim || t.voice.statusListening
      : state === "thinking"
        ? t.voice.statusThinking
        : state === "speaking"
          ? t.voice.statusSpeaking
          : sttOk
            ? t.voice.statusTapToTalk
            : t.voice.statusTtsOnly;

  return (
    <div className={"axxa-voice axxa-voice-state-" + state} role="dialog" aria-label={t.voice.title}>
      <div className="axxa-voice-top">
        <button
          type="button"
          className="axxa-voice-iconbtn"
          onClick={() => setShowSettings((s) => !s)}
          aria-label={t.voice.settings}
          title={t.voice.settings}
        >
          <Icon name="sliders-horizontal" />
        </button>
        <button
          type="button"
          className="axxa-voice-iconbtn"
          onClick={handleClose}
          aria-label={t.voice.close}
          title={t.voice.close}
        >
          <Icon name="x" />
        </button>
      </div>

      <div className="axxa-voice-stage">
        <div className="axxa-voice-orb" aria-hidden="true">
          <span className="axxa-voice-orb-core" />
          <span className="axxa-voice-orb-ring axxa-voice-orb-ring-1" />
          <span className="axxa-voice-orb-ring axxa-voice-orb-ring-2" />
        </div>
        <p className="axxa-voice-status">{statusText}</p>
      </div>

      <div className="axxa-voice-controls">
        <button
          type="button"
          className={
            "axxa-voice-mic" +
            (state === "listening" ? " axxa-voice-mic-on" : "")
          }
          onClick={toggleMic}
          disabled={!sttOk || state === "thinking" || state === "speaking"}
          aria-label={state === "listening" ? t.voice.stop : t.voice.talk}
          title={state === "listening" ? t.voice.stop : t.voice.talk}
        >
          <Icon name={state === "listening" ? "square" : "mic"} />
        </button>
      </div>

      {showSettings && (
        <div className="axxa-voice-settings">
          <div className="axxa-voice-settings-head">
            <span>{t.voice.settings}</span>
            <button
              type="button"
              className="axxa-voice-iconbtn"
              onClick={() => setShowSettings(false)}
              aria-label={t.voice.close}
            >
              <Icon name="x" />
            </button>
          </div>

          <label className="axxa-voice-field-label">{t.voice.voiceLabel}</label>
          <select
            className="dropdown axxa-voice-voiceselect"
            value={voiceURI}
            onChange={(e) => onChangeVoice(e.target.value)}
          >
            <option value="">{t.voice.voiceDefault}</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>

          <label className="axxa-voice-field-label">{t.voice.speedLabel}</label>
          <div className="axxa-voice-slider-wrap">
            <span className="axxa-voice-slider-bubble">
              {voiceRate.toFixed(1)}x
            </span>
            <input
              type="range"
              className="axxa-voice-slider"
              min={0.5}
              max={2}
              step={0.1}
              value={voiceRate}
              onChange={(e) => onChangeRate(parseFloat(e.target.value))}
            />
          </div>
          <button
            type="button"
            className="axxa-voice-test"
            onClick={() =>
              speak(t.voice.testPhrase, { voiceURI, rate: voiceRate })
            }
          >
            <Icon name="play" />
            {t.voice.test}
          </button>
        </div>
      )}
    </div>
  );
}
