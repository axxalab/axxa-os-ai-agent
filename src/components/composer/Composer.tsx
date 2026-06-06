// src/components/composer/Composer.tsx
// Composer pill — "+" à esquerda, CodeMirror no meio, send/mic/stop externo à direita.
// O botão da direita tem 3 estados:
//   1. Não streaming + campo vazio  → mic (futuro: gravar áudio)
//   2. Não streaming + campo cheio  → arrow-up (enviar)
//   3. Streaming                    → square (parar geração)
//
// CodeMirror é o MESMO editor que o Obsidian usa nas notas — herda tema, atalhos,
// markdown e comportamento de teclado virtual.

import { useEffect, useRef, useState } from "react";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { Platform } from "obsidian";
import { Icon } from "../_shared/Icon";

interface ComposerProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  streaming?: boolean;
}

export function Composer({ onSend, onStop, streaming = false }: ComposerProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const sendRef = useRef(onSend);
  sendRef.current = onSend;
  // streamingRef permite que o keymap consulte o valor atual sem precisar
  // recriar o EditorView toda vez que streaming muda
  const streamingRef = useRef(streaming);
  streamingRef.current = streaming;

  // Controla se o campo está vazio — pra alternar ícone do botão da direita
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!editorRef.current) return;

    function sendCurrent(view: EditorView): boolean {
      // Se está em streaming, Enter não faz nada (precisa parar primeiro)
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
          "&.cm-focused": {
            outline: "none",
          },
          ".cm-content": {
            caretColor: "var(--text-normal)",
            padding: "4px 0",
          },
          ".cm-line": {
            padding: "0",
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });
    viewRef.current = view;

    if (!Platform.isMobile) {
      view.focus();
    }

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

  // Determina o ícone e a ação do botão direito
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

  return (
    <div className="axxa-composer">
      <div className="axxa-composer-pill">
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
  );
}
