// src/ui/VoiceBar.tsx
// O dock de voz: o composer de texto desce e ELE sobe no lugar.
//
// Formato da referência (app da Claude): uma barra arredondada com [✕] à
// esquerda, a onda no meio e [✓] à direita. Sem relógio, sem pausa, sem
// arrasto — o gesto inteiro virou dois cliques: um pra começar, um pra
// terminar (ou o ✕ pra jogar fora).
//
// O ✓ NÃO envia a mensagem: a voz vira TEXTO no composer, e quem envia é o
// usuário. Por isso é um check, e não um avião de papel.

import { Icon } from "./Icon";
import type { Voice } from "./useVoice";

export function VoiceDock({ voice }: { voice: Voice }) {
  const working = voice.state === "working";
  return (
    <div className="axxa-voice-dock">
      <button
        type="button"
        className="axxa-voice-x"
        aria-label="Discard recording"
        disabled={working}
        onClick={voice.cancel}
      >
        <Icon name="x" size={20} />
      </button>

      {working ? (
        <span className="axxa-voice-working">Transcribing…</span>
      ) : (
        // A onda é a única prova de que o microfone está ouvindo: sem ela,
        // mudo e quebrado são a mesma tela.
        <div className="axxa-voice-wave" aria-hidden="true">
          {voice.levels.map((l, i) => (
            <span
              key={i}
              className="axxa-voice-bar"
              style={{ height: `${Math.max(3, Math.round(l * 26))}px` }}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        className="axxa-voice-ok"
        aria-label="Use this transcript"
        disabled={working}
        onClick={voice.finish}
      >
        <Icon name="check" size={22} />
      </button>
    </div>
  );
}
