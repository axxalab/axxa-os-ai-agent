// src/components/composer/Composer.tsx
// Composer com:
//   - Info box DENTRO da pill (topo): model · effort · context_used/total
//   - Input row na pill (embaixo): [+] [editor]
//   - Tokens display FORA da pill, abaixo: in/out/total (tiny, não clicável)
//   - Send/mic/stop button externo à direita
//
// Background do composer container é TRANSPARENTE (decisão do dev).

import { useEffect, useRef, useState } from "react";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { Platform } from "obsidian";
import { Icon } from "../_shared/Icon";
import { formatTokens, getContextWindow } from "../_shared/contextWindows";

interface ComposerProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  streaming?: boolean;
  providerName: string;
  modelName: string;
  effort: string;
  tokensIn: number;
  tokensOut: number;
  contextUsed: number;
}

export function Composer({
  onSend,
  onStop,
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
          <div className="axxa-pill-info" aria-label={`${providerName} · ${modelName}`}>
            <span className="axxa-pill-info-text">
              {modelName} · {effort} · {formatTokens(contextUsed)}/{formatTokens(contextTotal)}
            </span>
          </div>
          <div className="axxa-pill-input">
            <button
              type="button"
              className="axxa-composer-plus"
              aria-label="Mais opções"
              title="Mais opções (em breve)"
              disabled
            >
              <Icon name="plus" />
            </button>
            <div ref={editorRef} className="axxa-composer-editor" />
          </div>
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
      <div className="axxa-composer-tokens" aria-label="Tokens da sessão">
        in {tokensIn} · out {tokensOut} · total {tokensTotal}
      </div>
    </div>
  );
}
