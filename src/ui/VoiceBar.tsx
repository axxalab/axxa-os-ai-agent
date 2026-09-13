// src/ui/VoiceBar.tsx
// A cara do modo de voz, no formato do WhatsApp (referência do Rafael):
//
//   SEGURANDO   🎤 0:03 ············ ‹ Slide to cancel      (+ cadeado acima)
//   TRAVADO     0:11 ~~~~~~~~~~~~~~~~~~~~
//               [🗑]  [ ⏸ Pause ]  [✓]
//   PAUSADO     idem, com [🎙 Resume] em verde
//
// Uma diferença de propósito: o botão verde aqui é um CHECK, não um avião de
// papel. No WhatsApp ele manda o áudio; aqui a voz vira TEXTO no composer, e
// quem manda a mensagem continua sendo o usuário.

import { Icon } from "./Icon";
import { formatDuration, type Voice } from "./useVoice";

/** Onda do microfone. Sem ela, mudo e quebrado são a mesma tela. */
function Wave({ levels }: { levels: number[] }) {
  return (
    <div className="axxa-voice-wave" aria-hidden="true">
      {levels.map((l, i) => (
        <span
          key={i}
          className="axxa-voice-bar"
          style={{ height: `${Math.max(3, Math.round(l * 22))}px` }}
        />
      ))}
    </div>
  );
}

/** Enquanto o dedo está na tela. */
export function VoiceHold({
  voice,
  slide,
}: {
  voice: Voice;
  /** Quanto o dedo já arrastou pra esquerda (negativo). */
  slide: number;
}) {
  return (
    <div className="axxa-voice-hold">
      <Icon name="mic" size={18} className="axxa-voice-rec" />
      <span className="axxa-voice-time">{formatDuration(voice.seconds)}</span>
      <Wave levels={voice.levels} />
      <span
        className="axxa-voice-cancel"
        style={{ transform: `translateX(${Math.max(slide, -60)}px)` }}
      >
        <Icon name="chevron-left" size={14} />
        Slide to cancel
      </span>
    </div>
  );
}

/** Travado (mãos livres) ou pausado. */
export function VoicePanel({ voice }: { voice: Voice }) {
  const paused = voice.state === "paused";
  return (
    <div className="axxa-voice-panel">
      <div className="axxa-voice-head">
        <span className="axxa-voice-time">{formatDuration(voice.seconds)}</span>
        <Wave levels={voice.levels} />
      </div>
      <div className="axxa-voice-actions">
        <button
          type="button"
          className="axxa-voice-trash"
          aria-label="Discard recording"
          onClick={voice.cancel}
        >
          <Icon name="trash-2" size={18} />
        </button>
        <button
          type="button"
          className={
            paused ? "axxa-voice-toggle is-resume" : "axxa-voice-toggle"
          }
          onClick={paused ? voice.resume : voice.pause}
        >
          <Icon name={paused ? "mic" : "pause"} size={18} />
          <span>{paused ? "Resume" : "Pause"}</span>
        </button>
        <button
          type="button"
          className="axxa-voice-done"
          aria-label="Use this transcript"
          onClick={voice.finish}
        >
          <Icon name="check" size={20} />
        </button>
      </div>
    </div>
  );
}
