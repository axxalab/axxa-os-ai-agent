// src/components/composer/Composer.tsx
// Composer pill — "+" à esquerda, CodeMirror no meio, send/mic externo à direita.
// O botão da direita transforma: vazio = mic (futuro: gravar áudio), com texto = enviar.
//
// CodeMirror é o MESMO editor que o Obsidian usa nas notas — herda tema, atalhos,
// markdown e comportamento de teclado virtual.
//
// Keymap:
//   Desktop:  Enter = enviar, Shift+Enter = nova linha
//   Mobile:   Enter = nova linha (botão send é a única forma de enviar)

import { useEffect, useRef, useState } from "react";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { Platform } from "obsidian";
import { Icon } from "../_shared/Icon";

interface ComposerProps {
  onSend: (text: string) => void;
}

export function Composer({ onSend }: ComposerProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const sendRef = useRef(onSend);
  sendRef.current = onSend;

  // Controla se o campo está vazio — pra alternar ícone do botão da direita
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!editorRef.current) return;

    function sendCurrent(view: EditorView): boolean {
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
        // Listener pra trackear se o doc está vazio (botão muda mic ↔ send)
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
            // Mesma regra do .axxa-composer: scroll-margin garante 8cm
            // de espaço acima do elemento focado quando o teclado abre.
            scrollMarginBlockStart: "8cm",
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

    // Não dá foco automático — no mobile isso abre o teclado e atrapalha
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
    // Stub — áudio será implementado num módulo próprio
    console.log("[axxa] mic click — gravação de áudio em breve");
  };

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
        className="axxa-composer-send"
        onClick={isEmpty ? handleMicClick : handleSendClick}
        aria-label={isEmpty ? "Gravar áudio" : "Enviar mensagem"}
        title={isEmpty ? "Gravar áudio (em breve)" : "Enviar"}
      >
        <Icon name={isEmpty ? "mic" : "arrow-up"} />
      </button>
    </div>
  );
}
