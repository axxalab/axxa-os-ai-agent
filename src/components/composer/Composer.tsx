// src/components/composer/Composer.tsx
// Composer:
//   - Pill simples: [+] [editor]
//   - Send/mic/stop externo à direita
//   - Status row BELOW pill: model · effort · context · in · out · total
//     (micro-ícones coloridos via Lucide / Obsidian)
//   - Background transparente
//
// "+" button abre o PlusModal (ChatGPT-style bottom sheet com Effort selector)

import { useEffect, useRef, useState } from "react";
import {
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
  tooltips,
} from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { autocompletion } from "@codemirror/autocomplete";
import { Notice, Platform } from "obsidian";
import { Icon } from "../_shared/Icon";
import { InfoChip } from "../_shared/InfoChip";
import { formatTokens, getContextWindow } from "../_shared/contextWindows";
import { useT } from "../../i18n";
import { useApp } from "../_shared/AppContext";
import {
  wikilinkCompletionSource,
  commandCompletionSource,
  type AxxaCommand,
} from "./completions";

function formatRecordingDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface ComposerProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  onPlusClick?: () => void;
  streaming?: boolean;
  providerName: string;
  modelName: string;
  effort: string;
  tokensIn: number;
  tokensOut: number;
  contextUsed: number;
  /** Session travada (após primeira msg) — mostra ícone de cadeado no model */
  locked?: boolean;
  /** Modo atual (chat / vault-qa / agent / coder) */
  mode?: string;
  /** Texto do placeholder do editor — varia por modo */
  placeholder?: string;
  /** Salva o áudio gravado no vault e devolve o path relativo (ou null se falhou). */
  onSaveAudio?: (blob: Blob, durationMs: number) => Promise<string | null>;
  /** Lista de comandos /command disponíveis pro autocomplete do composer. */
  commands?: AxxaCommand[];
}

// InfoChip extraído pra _shared/InfoChip.tsx — reusado em recent chats list,
// ConversationsList items, etc. (v0.1.37)

export function Composer({
  onSend,
  onStop,
  onPlusClick,
  streaming = false,
  providerName,
  modelName,
  effort,
  tokensIn,
  tokensOut,
  contextUsed,
  locked = false,
  mode = "chat",
  placeholder,
  onSaveAudio,
  commands,
}: ComposerProps) {
  const t = useT();
  const app = useApp();
  // Refs estáveis pros sources de autocomplete — o ref pra commands permite
  // que mudanças na lista (ex: nova conversa altera estado) sejam refletidas
  // sem recriar o editor.
  const commandsRef = useRef<AxxaCommand[]>(commands ?? []);
  commandsRef.current = commands ?? [];
  // Fallback se nenhum placeholder for passado — usa o default do dicionário
  const placeholderText = placeholder ?? t.composer.placeholderChat;
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const sendRef = useRef(onSend);
  sendRef.current = onSend;
  const streamingRef = useRef(streaming);
  streamingRef.current = streaming;

  // Compartment = "slot" reconfigurável do CodeMirror — permite trocar o
  // placeholder em runtime (ex.: mode chat → vault-qa) sem destruir o editor.
  const [placeholderCompartment] = useState(() => new Compartment());

  const [isEmpty, setIsEmpty] = useState(true);

  // ============================================================
  // Audio recording state — hold-to-record com MediaRecorder
  // ============================================================
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
  // Flag: se true, descarta o áudio em vez de salvar (sliding-finger-off)
  const cancelRecordingRef = useRef(false);

  // Cleanup do MediaRecorder no unmount (libera o mic se ainda tava ativo)
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current !== null) {
        window.clearInterval(recordingTimerRef.current);
      }
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.stream.getTracks().forEach((tr) => tr.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;

    function sendCurrent(view: EditorView): boolean {
      if (streamingRef.current) return false;
      const text = view.state.doc.toString().trim();
      if (!text) return false;
      sendRef.current(text);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: "" },
      });
      return true;
    }

    const enterKey = Platform.isMobile
      ? []
      : [
          { key: "Enter", run: (view: EditorView) => sendCurrent(view) },
          { key: "Shift-Enter", run: () => false },
        ];

    const state = EditorState.create({
      doc: "",
      extensions: [
        keymap.of(enterKey),
        EditorView.lineWrapping,
        placeholderCompartment.of(cmPlaceholder(placeholderText)),
        // Autocomplete: @nota (wikilinks) + /comando (actions do AXXA).
        // Sources delegam pra app e commandsRef — capturam ref live (não closure).
        autocompletion({
          override: [
            wikilinkCompletionSource(app),
            commandCompletionSource(commandsRef.current),
          ],
          activateOnTyping: true,
          maxRenderedOptions: 30,
        }),
        // Renderiza o popup do autocomplete COMO position:fixed no document.body,
        // escapando do overflow:hidden do composer pill. Sem isso o dropdown
        // ficava clipado dentro do text field e não aparecia.
        tooltips({
          position: "fixed",
          parent: document.body,
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const text = update.state.doc.toString().trim();
            setIsEmpty(text.length === 0);
          }
        }),
        EditorView.theme({
          "&": {
            backgroundColor: "transparent",
            color: "var(--text-normal)",
            fontFamily: "var(--font-text)",
            fontSize: "var(--font-ui-medium)",
            maxHeight: "200px",
            // overflow-x: hidden — campo de mensagem NUNCA scrolla horizontalmente
            // (regra: tudo respira pra baixo, jamais pra direita)
            overflowX: "hidden",
            overflowY: "auto",
          },
          "&.cm-focused": { outline: "none" },
          ".cm-scroller": { overflowX: "hidden" },
          ".cm-content": {
            caretColor: "var(--text-normal)",
            padding: "4px 0",
            // Quebra palavras longas (URLs, identifiers, etc) que lineWrapping
            // sozinho não pega (lineWrapping só quebra em word boundary).
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          },
          ".cm-line": { padding: "0" },
        }),
      ],
    });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;

    if (!Platform.isMobile) view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconfigura placeholder em runtime sem recriar o editor
  // (ex.: usuário muda do modo chat → vault-qa antes de mandar a 1ª msg,
  // OU usuário muda de idioma nas Settings)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: placeholderCompartment.reconfigure(cmPlaceholder(placeholderText)),
    });
  }, [placeholderText, placeholderCompartment]);

  const handleSendClick = () => {
    if (streaming) return;
    const view = viewRef.current;
    if (!view) return;
    const text = view.state.doc.toString().trim();
    if (!text) return;
    onSend(text);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: "" },
    });
    view.focus();
  };

  const handleStopClick = () => {
    onStop?.();
  };

  // ============================================================
  // Gravação de áudio — hold-to-record
  // ============================================================
  const startRecording = async () => {
    if (isRecording || streaming) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      new Notice(t.recording.micUnsupported);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("[axxa] mic permission falhou:", err);
      new Notice(t.recording.micDenied);
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch (err) {
      console.error("[axxa] MediaRecorder não suportado:", err);
      stream.getTracks().forEach((tr) => tr.stop());
      new Notice(t.recording.micUnsupported);
      return;
    }

    recordedChunksRef.current = [];
    cancelRecordingRef.current = false;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop());
      const ms = Date.now() - recordingStartRef.current;
      const chunks = recordedChunksRef.current;
      recordedChunksRef.current = [];

      if (cancelRecordingRef.current) {
        new Notice(t.recording.cancelled);
        return;
      }
      // Ignora gravações muito curtas (<300ms — provavelmente tap acidental)
      if (chunks.length === 0 || ms < 300) {
        return;
      }
      const blob = new Blob(chunks, {
        type: recorder.mimeType || "audio/webm",
      });
      const path = await onSaveAudio?.(blob, ms);
      const durationStr = formatRecordingDuration(ms);
      if (!path) {
        new Notice(t.recording.saveFailed);
        return;
      }
      new Notice(t.recording.saved(durationStr));
      // Insere wikilink no composer no cursor atual
      const view = viewRef.current;
      if (view) {
        const wikilink = `[[${path}|${t.recording.alias(durationStr)}]] `;
        view.dispatch(view.state.replaceSelection(wikilink));
        view.focus();
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    recordingStartRef.current = Date.now();
    setIsRecording(true);
    setRecordingMs(0);

    // Atualiza o contador a cada 200ms — suficiente pra UX, leve no CPU
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingMs(Date.now() - recordingStartRef.current);
    }, 200);

    navigator.vibrate?.(30);
  };

  const stopRecording = (cancel = false) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !isRecording) return;
    cancelRecordingRef.current = cancel;
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingMs(0);
    if (recorder.state !== "inactive") recorder.stop();
    mediaRecorderRef.current = null;
    navigator.vibrate?.(30);
  };

  // Handler global: se user solta o mouse FORA do botão durante a gravação,
  // pega o release no document e para mesmo assim. Necessário porque
  // onMouseLeave do botão é disparado antes do onMouseUp em alguns navegadores.
  useEffect(() => {
    if (!isRecording) return;
    const onUp = () => stopRecording(false);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    document.addEventListener("touchcancel", onUp);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
      document.removeEventListener("touchcancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  // O botão à direita tem 3 modos: send (texto digitado) / stop (streaming) / mic (vazio).
  // Em "mic", o press inicia gravação e release para (hold-to-record).
  // Em "send" e "stop", click normal.
  const isMicMode = !streaming && isEmpty;

  let iconName: string;
  let label: string;
  let onClick: (() => void) | undefined;

  if (streaming) {
    iconName = "square";
    label = t.composer.stopLabel;
    onClick = handleStopClick;
  } else if (isEmpty) {
    iconName = "mic";
    label = isRecording ? t.composer.micRecording : t.composer.micLabel;
    onClick = undefined; // mic é controlado por press/release, não click
  } else {
    iconName = "arrow-up";
    label = t.composer.sendLabel;
    onClick = handleSendClick;
  }

  // Press/release só são "armados" no modo mic — em send/stop, undefined
  const onMicPressStart = isMicMode ? () => startRecording() : undefined;
  const onMicPressEnd = isMicMode ? () => stopRecording(false) : undefined;

  const contextTotal = getContextWindow(modelName);
  const tokensTotal = tokensIn + tokensOut;

  return (
    <div className="axxa-composer">
      {isRecording && (
        <div className="axxa-recording-indicator" aria-live="polite">
          <span className="axxa-recording-dot" aria-hidden="true" />
          <span className="axxa-recording-timer">
            {formatRecordingDuration(recordingMs)}
          </span>
          <span className="axxa-recording-hint">{t.composer.micRecording}</span>
        </div>
      )}
      <div className="axxa-composer-row">
        <div className="axxa-composer-pill">
          <button
            type="button"
            className="axxa-composer-plus"
            aria-label={t.composer.plusLabel}
            title={t.composer.plusLabel}
            onClick={onPlusClick}
          >
            <Icon name="plus" />
          </button>
          <div ref={editorRef} className="axxa-composer-editor" />
        </div>
        <button
          type="button"
          className={
            "axxa-composer-send" +
            (streaming ? " axxa-composer-stop" : "") +
            (isRecording ? " axxa-composer-recording" : "")
          }
          onClick={onClick}
          onMouseDown={onMicPressStart}
          onTouchStart={(e) => {
            if (onMicPressStart) {
              // Previne click depois — em mobile, touch dispara click sintético
              e.preventDefault();
              onMicPressStart();
            }
          }}
          onMouseUp={onMicPressEnd}
          onTouchEnd={(e) => {
            if (onMicPressEnd) {
              e.preventDefault();
              onMicPressEnd();
            }
          }}
          onTouchCancel={onMicPressEnd}
          aria-label={label}
          title={label}
        >
          <Icon name={iconName} />
        </button>
      </div>

      {/* Status row abaixo do pill — micro-ícones coloridos */}
      <div className="axxa-composer-info">
        {mode !== "chat" && (
          <InfoChip icon="library" color="var(--color-pink, #f472b6)">
            {mode === "vault-qa" ? "vault" : mode}
          </InfoChip>
        )}
        <InfoChip
          icon={locked ? "lock" : "cpu"}
          color="var(--color-purple, #a370f7)"
        >
          {modelName}
        </InfoChip>
        <InfoChip icon="zap" color="var(--color-orange, #ec7b3e)">
          {effort}
        </InfoChip>
        <InfoChip icon="gauge" color="var(--color-cyan, #4cc9f0)">
          {formatTokens(contextUsed)}/{formatTokens(contextTotal)}
        </InfoChip>
        <span className="axxa-info-sep">·</span>
        <InfoChip icon="arrow-down" color="var(--color-blue, #4361ee)">
          {tokensIn}
        </InfoChip>
        <InfoChip icon="arrow-up" color="var(--color-green, #06d6a0)">
          {tokensOut}
        </InfoChip>
        <InfoChip icon="sigma" color="var(--text-muted)">
          {tokensTotal}
        </InfoChip>
      </div>
    </div>
  );
}
