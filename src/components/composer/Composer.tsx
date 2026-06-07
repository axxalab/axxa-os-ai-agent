// src/components/composer/Composer.tsx
// Composer:
//   - Pill simples: [+] [editor]
//   - Send/mic/stop externo à direita
//   - Status row BELOW pill: model · effort · context · in · out · total
//     (micro-ícones coloridos via Lucide / Obsidian)
//   - Background transparente
//
// "+" button abre o PlusModal (ChatGPT-style bottom sheet com Effort selector)

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { Platform } from "obsidian";
import { Icon } from "../_shared/Icon";
import { formatTokens, getContextWindow } from "../_shared/contextWindows";
import { useT } from "../../i18n";

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
}

function InfoChip({
  icon,
  color,
  children,
}: {
  icon: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <span className="axxa-info-chip" style={{ color }}>
      <Icon name={icon} />
      <span>{children}</span>
    </span>
  );
}

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
}: ComposerProps) {
  const t = useT();
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
            overflow: "auto",
          },
          "&.cm-focused": { outline: "none" },
          ".cm-content": {
            caretColor: "var(--text-normal)",
            padding: "4px 0",
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

  const handleMicClick = () => {
    if (streaming) return;
    console.log("[axxa] mic click — gravação de áudio em breve");
  };

  const handleStopClick = () => {
    onStop?.();
  };

  let iconName: string;
  let onClick: () => void;
  let label: string;

  if (streaming) {
    iconName = "square";
    onClick = handleStopClick;
    label = t.composer.stopLabel;
  } else if (isEmpty) {
    iconName = "mic";
    onClick = handleMicClick;
    label = t.composer.micLabel;
  } else {
    iconName = "arrow-up";
    onClick = handleSendClick;
    label = t.composer.sendLabel;
  }

  const contextTotal = getContextWindow(modelName);
  const tokensTotal = tokensIn + tokensOut;

  return (
    <div className="axxa-composer">
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
          className={"axxa-composer-send" + (streaming ? " axxa-composer-stop" : "")}
          onClick={onClick}
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
