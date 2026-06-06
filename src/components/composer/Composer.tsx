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
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { Platform } from "obsidian";
import { Icon } from "../_shared/Icon";
import { formatTokens, getContextWindow } from "../_shared/contextWindows";

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
}: ComposerProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const sendRef = useRef(onSend);
  sendRef.current = onSend;
  const streamingRef = useRef(streaming);
  streamingRef.current = streaming;

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
        placeholder("Pergunte ao AXXA Agent..."),
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
    label = "Parar geração";
  } else if (isEmpty) {
    iconName = "mic";
    onClick = handleMicClick;
    label = "Gravar áudio";
  } else {
    iconName = "arrow-up";
    onClick = handleSendClick;
    label = "Enviar mensagem";
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
            aria-label="Mais opções"
            title="Mais opções"
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
      <div className="axxa-composer-info" aria-label="Status da sessão">
        <InfoChip icon="cpu" color="var(--color-purple, #a370f7)">
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
