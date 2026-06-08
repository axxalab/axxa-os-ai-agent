// src/components/composer/Composer.tsx
// Composer:
//   - Pill simples: [+] [editor]
//   - Send/mic/stop externo à direita
//   - Status row BELOW pill: model · effort · context · in · out · total
//     (micro-ícones coloridos via Lucide / Obsidian)
//   - Background transparente
//
// "+" button abre o PlusModal (ChatGPT-style bottom sheet com Effort selector)

import { useEffect, useRef, useState, type ChangeEvent } from "react";
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
  extractWikilinks,
  type AxxaCommand,
} from "./completions";

function formatRecordingDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Entry de anexo no Composer — tipo discriminado por kind. */
interface PendingImage {
  id: string;
  kind: "image";
  dataUrl: string;
  mimeType: string;
  name: string;
}
interface PendingNote {
  id: string;
  kind: "note";
  path: string;
  name: string;
}
interface PendingPdf {
  id: string;
  kind: "pdf";
  name: string;
  /** dataUrl ou path no vault; pra MVP só name. */
  dataUrl?: string;
}
interface PendingAudio {
  id: string;
  kind: "audio";
  path: string;
  name: string;
  durationMs?: number;
}

export type PendingAttachment =
  | PendingImage
  | PendingNote
  | PendingPdf
  | PendingAudio;

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
  /** Tokens por segundo do stream atual (atualiza durante geração). */
  tokensPerSec: number;
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
  /** IDs dos chips visíveis no status line. Cada chip renderiza só se seu
   *  id estiver aqui (curado pelo user em Settings → Outros → Chips). */
  visibleChips: string[];
  /** True se o modelo selecionado aceita imagens. Habilita botão de attach
   *  + paste de imagem. */
  visionEnabled?: boolean;
  /** Anexos pendentes (qualquer tipo). Renderizados como chips acima do composer. */
  pendingAttachments?: PendingAttachment[];
  /** Callback chamado quando user adiciona imagem via paste. */
  onAddImage?: (img: PendingImage) => void;
  /** Callback chamado quando user remove um anexo do pending. */
  onRemoveAttachment?: (id: string) => void;
  /** Callback chamado quando user seleciona uma nota via @ autocomplete OU
   *  cola um wikilink. Caller lê o conteúdo e adiciona ao pending attachments. */
  onPickNote?: (path: string, isFolder: boolean) => void;
}

export type { PendingImage };

/**
 * Chip de imagem com placeholder shimmer estilo ChatGPT.
 * - Mostra placeholder cinza animado até `<img onLoad>` disparar
 * - Trocando pro thumbnail real com fade-in (opacity 0→1)
 * - Botão X pra remover do pending
 */
function AttachmentImageChip({
  img,
  onRemove,
  removeLabel,
}: {
  img: PendingImage;
  onRemove: () => void;
  removeLabel: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="axxa-attachment-chip axxa-attachment-chip-image">
      <div className="axxa-attachment-thumb-wrap">
        {!loaded && (
          <div className="axxa-image-placeholder axxa-attachment-thumb-placeholder">
            <Icon name="image" />
          </div>
        )}
        <img
          src={img.dataUrl}
          alt={img.name}
          className={
            "axxa-attachment-thumb" +
            (loaded ? "" : " axxa-attachment-thumb-loading")
          }
          onLoad={() => setLoaded(true)}
        />
      </div>
      <span className="axxa-attachment-name">{img.name}</span>
      <button
        type="button"
        className="axxa-attachment-remove"
        aria-label={removeLabel}
        title={removeLabel}
        onClick={onRemove}
      >
        <Icon name="x" />
      </button>
    </div>
  );
}

/**
 * Chip genérico pra note/pdf/audio — ícone circular semântico + nome + remove.
 * Cor tonal vem do tipo (green pra note, red pra pdf, blue pra audio).
 */
function AttachmentGenericChip({
  icon,
  name,
  tone,
  onRemove,
  removeLabel,
}: {
  icon: string;
  name: string;
  tone: "note" | "pdf" | "audio";
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className={"axxa-attachment-chip axxa-attachment-chip-" + tone}>
      <span className="axxa-attachment-icon-wrap">
        <Icon name={icon} />
      </span>
      <span className="axxa-attachment-name">{name}</span>
      <button
        type="button"
        className="axxa-attachment-remove"
        aria-label={removeLabel}
        title={removeLabel}
        onClick={onRemove}
      >
        <Icon name="x" />
      </button>
    </div>
  );
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
  tokensPerSec,
  contextUsed,
  locked = false,
  mode = "chat",
  placeholder,
  onSaveAudio,
  commands,
  visibleChips,
  visionEnabled = false,
  pendingAttachments = [],
  onAddImage,
  onRemoveAttachment,
  onPickNote,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs vivas pros handlers da imagem — evita reapegar listeners no editor
  const visionEnabledRef = useRef(visionEnabled);
  visionEnabledRef.current = visionEnabled;
  const onAddImageRef = useRef(onAddImage);
  onAddImageRef.current = onAddImage;
  const onPickNoteRef = useRef(onPickNote);
  onPickNoteRef.current = onPickNote;

  // Converte File/Blob em PendingImage via FileReader (data URL).
  const blobToPendingImage = (blob: Blob, name: string): Promise<PendingImage> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? "");
        resolve({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          kind: "image",
          dataUrl,
          mimeType: blob.type || "image/png",
          name,
        });
      };
      reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
      reader.readAsDataURL(blob);
    });

  const handleAttachClick = () => {
    if (!visionEnabled) {
      new Notice(t.composer.attachImageNoVision);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // reset pro mesmo arquivo poder ser reanexado
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const img = await blobToPendingImage(file, file.name);
        onAddImage?.(img);
      } catch (err) {
        console.error("[axxa] anexo de imagem falhou:", err);
        new Notice(t.composer.attachImageFailed);
      }
    }
  };

  // Helper interno: ícone Lucide por tipo de attachment
  const attachmentIcon = (a: PendingAttachment): string => {
    switch (a.kind) {
      case "note": return "file-text";
      case "pdf": return "file";
      case "audio": return "mic";
      case "image": return "image";
    }
  };

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
        // aboveCursor:true → tooltip sempre acima do cursor pra não ficar
        // escondido atrás do teclado virtual no mobile.
        autocompletion({
          override: [
            // @ autocomplete → dispara onPickNote em vez de inserir [[]]
            wikilinkCompletionSource(app, (path, isFolder) => {
              onPickNoteRef.current?.(path, isFolder);
            }),
            commandCompletionSource(commandsRef.current),
          ],
          activateOnTyping: true,
          maxRenderedOptions: 30,
          aboveCursor: true,
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
        // Paste handlers:
        //  1. Imagem do clipboard → vira anexo (quando modelo suporta vision)
        //  2. Texto com wikilinks `[[path]]` → extrai os links pra anexos
        //     e cola só o texto limpo
        EditorView.domEventHandlers({
          paste: (event, view) => {
            const items = event.clipboardData?.items;

            // === 1. Imagem do clipboard ===
            if (items && visionEnabledRef.current && onAddImageRef.current) {
              for (let i = 0; i < items.length; i++) {
                const it = items[i];
                if (it.kind === "file" && it.type.startsWith("image/")) {
                  const file = it.getAsFile();
                  if (!file) continue;
                  event.preventDefault();
                  blobToPendingImage(file, file.name || `pasted-${Date.now()}.png`)
                    .then((img) => {
                      onAddImageRef.current?.(img);
                      new Notice(t.composer.attachImagePastedNotice);
                    })
                    .catch((err) => {
                      console.error("[axxa] paste de imagem falhou:", err);
                      new Notice(t.composer.attachImageFailed);
                    });
                  return true;
                }
              }
            }

            // === 2. Texto com wikilinks `[[path]]` ===
            const pastedText = event.clipboardData?.getData("text/plain");
            if (pastedText && pastedText.includes("[[")) {
              const { cleanText, links } = extractWikilinks(pastedText);
              if (links.length > 0 && onPickNoteRef.current) {
                event.preventDefault();
                // Insere o cleanText no cursor (substitui seleção se houver)
                view.dispatch(view.state.replaceSelection(cleanText));
                // Adiciona cada link como anexo (caller resolve path real)
                for (const link of links) {
                  onPickNoteRef.current(link.path, false);
                }
                return true;
              }
            }

            return false;
          },
        }),
        EditorView.theme({
          "&": {
            backgroundColor: "transparent",
            color: "var(--text-normal)",
            fontFamily: "var(--font-text)",
            fontSize: "var(--font-ui-medium)",
            lineHeight: "1.5",
            overflowX: "hidden",
            overflowY: "visible",
            // CRÍTICO: reseta padding/margin/border que CodeMirror aplica
            // por default no .cm-editor — esses deslocam o texto pro
            // direito visualmente.
            padding: "0",
            margin: "0",
            border: "none",
          },
          "&.cm-focused": { outline: "none" },
          ".cm-scroller": {
            overflowX: "hidden",
            overflowY: "visible",
            fontFamily: "var(--font-text)",
            fontSize: "var(--font-ui-medium)",
            lineHeight: "1.5",
            // Sem padding/margin — texto começa no left edge do flex container
            padding: "0",
            margin: "0",
          },
          ".cm-content": {
            caretColor: "var(--text-normal)",
            // Padding 0 — texto começa EXATAMENTE no left edge do editor
            // (offset horizontal vem só do flex parent: composer-pill padding)
            padding: "0",
            margin: "0",
            fontFamily: "var(--font-text)",
            fontSize: "var(--font-ui-medium)",
            lineHeight: "1.5",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          },
          ".cm-line": {
            // CRÍTICO pro X-align: padding 0 horizontal + 0 vertical
            padding: "0",
            margin: "0",
            lineHeight: "1.5",
          },
          ".cm-placeholder": {
            color: "var(--text-faint)",
            fontFamily: "var(--font-text)",
            fontSize: "var(--font-ui-medium)",
            lineHeight: "1.5",
            // Sem indent — fica no mesmo X que o texto digitado
            padding: "0",
            margin: "0",
            textIndent: "0",
          },
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

  // Mede a altura do composer + atualiza CSS var --axxa-composer-h na .axxa-root.
  // Permite que o ChatArea aplique padding-bottom dinâmico = altura real do composer
  // (que cresce com texto + anexos pendentes). Usa ResizeObserver pra reatividade.
  const composerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const root = el.closest(".axxa-root") as HTMLElement | null;
    if (!root) return;
    const update = () => {
      root.style.setProperty(
        "--axxa-composer-h",
        `${Math.round(el.offsetHeight)}px`
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--axxa-composer-h");
    };
  }, []);

  return (
    <div className="axxa-composer" ref={composerRef}>
      {isRecording && (
        <div className="axxa-recording-indicator" aria-live="polite">
          <span className="axxa-recording-dot" aria-hidden="true" />
          <span className="axxa-recording-timer">
            {formatRecordingDuration(recordingMs)}
          </span>
          <span className="axxa-recording-hint">{t.composer.micRecording}</span>
        </div>
      )}
      {/* Hidden file input — disparado pelo botão de clip quando visionEnabled */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      {/* Anexos pendentes (preview chips antes do envio).
          Multi-tipo: image (thumbnail+shimmer), note (ícone file-text),
          pdf (ícone file), audio (ícone mic). */}
      {pendingAttachments.length > 0 && (
        <div className="axxa-composer-attachments" aria-label="Anexos pendentes">
          {pendingAttachments.map((att) => {
            if (att.kind === "image") {
              return (
                <AttachmentImageChip
                  key={att.id}
                  img={att}
                  onRemove={() => onRemoveAttachment?.(att.id)}
                  removeLabel={t.composer.attachImageRemoveLabel}
                />
              );
            }
            return (
              <AttachmentGenericChip
                key={att.id}
                icon={attachmentIcon(att)}
                name={att.name}
                tone={att.kind}
                onRemove={() => onRemoveAttachment?.(att.id)}
                removeLabel={t.composer.attachImageRemoveLabel}
              />
            );
          })}
        </div>
      )}
      <div className="axxa-composer-row">
        <div
          className={
            "axxa-composer-pill" +
            (isEmpty ? "" : " axxa-composer-pill-typing")
          }
        >
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
          {/* Attach buttons (paperclip + image) — APENAS quando isEmpty
              (composer vazio). Quando user comeca a digitar, somem e cedem
              espaco pro texto. Pra anexar depois, user vai no + (PlusModal). */}
          <button
            type="button"
            className="axxa-composer-attach axxa-composer-attach-file"
            aria-label={t.composer.plusLabel}
            title={t.composer.plusLabel}
            onClick={onPlusClick}
          >
            <Icon name="paperclip" />
          </button>
          {visionEnabled && (
            <button
              type="button"
              className="axxa-composer-attach"
              aria-label={t.composer.attachImageLabel}
              title={t.composer.attachImageLabel}
              onClick={handleAttachClick}
            >
              <Icon name="image" />
            </button>
          )}
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

      {/* Status row abaixo do pill — micro-ícones coloridos
          SINGLE LINE (v0.1.38): flex-wrap:nowrap no CSS. User curated
          chips via Settings → Outros → Chips. */}
      <div className="axxa-composer-info">
        {visibleChips.includes("mode") && mode !== "chat" && (
          <InfoChip icon="library" color="var(--color-pink, #f472b6)">
            {mode === "vault-qa" ? "vault" : mode}
          </InfoChip>
        )}
        {visibleChips.includes("model") && (
          <InfoChip
            icon={locked ? "lock" : "cpu"}
            color="var(--color-purple, #a370f7)"
          >
            {modelName}
          </InfoChip>
        )}
        {visibleChips.includes("effort") && (
          <InfoChip icon="zap" color="var(--color-orange, #ec7b3e)">
            {effort}
          </InfoChip>
        )}
        {visibleChips.includes("context") && (
          <InfoChip icon="gauge" color="var(--color-cyan, #4cc9f0)">
            {formatTokens(contextUsed)}/{formatTokens(contextTotal)}
          </InfoChip>
        )}
        {visibleChips.includes("in") && (
          <InfoChip icon="arrow-down" color="var(--color-blue, #4361ee)">
            {tokensIn}
          </InfoChip>
        )}
        {visibleChips.includes("out") && (
          <InfoChip icon="arrow-up" color="var(--color-green, #06d6a0)">
            {tokensOut}
          </InfoChip>
        )}
        {visibleChips.includes("total") && (
          <InfoChip icon="sigma" color="var(--text-muted)">
            {tokensTotal}
          </InfoChip>
        )}
        {visibleChips.includes("speed") && tokensPerSec > 0 && (
          <InfoChip icon="activity" color="var(--color-yellow, #facc15)">
            {tokensPerSec >= 10
              ? Math.round(tokensPerSec)
              : tokensPerSec.toFixed(1)}
            {" t/s"}
          </InfoChip>
        )}
      </div>
    </div>
  );
}
