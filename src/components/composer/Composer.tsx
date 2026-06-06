// src/components/composer/Composer.tsx
// Campo de texto do chat usando CodeMirror 6 — o MESMO editor que o Obsidian
// usa nas notas. Vantagem: herda tema, atalhos, suporte a markdown, e
// comportamento de teclado virtual no mobile.
//
// Keymap:
//   Desktop:  Enter = enviar, Shift+Enter = nova linha
//   Mobile:   Enter = nova linha (Send button é a única forma de enviar)
//             — convenção dos apps de chat (ChatGPT, Claude, WhatsApp)

import { useEffect, useRef } from "react";
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
  // sendRef permite que o handler do keymap chame a versão atual de onSend
  // mesmo que ele mude entre renders, sem precisar recriar o EditorView.
  const sendRef = useRef(onSend);
  sendRef.current = onSend;

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

    // No desktop, Enter envia. No mobile, Enter quebra linha (Send é o botão).
    const enterKey = Platform.isMobile
      ? []
      : [
          {
            key: "Enter",
            run: (view: EditorView) => sendCurrent(view),
          },
          {
            // Shift+Enter no desktop deixa o comportamento default (newline)
            key: "Shift-Enter",
            run: () => false,
          },
        ];

    const state = EditorState.create({
      doc: "",
      extensions: [
        keymap.of(enterKey),
        EditorView.lineWrapping,
        placeholder("Pergunte alguma coisa..."),
        // Tema pontual aplicando CSS variables do Obsidian.
        // O CSS principal (styles/main.css) cuida do layout externo.
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
            padding: "8px 0",
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

    // Foca o editor ao montar
    view.focus();

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

  return (
    <div className="axxa-composer">
      <div ref={editorRef} className="axxa-composer-editor" />
      <button
        type="button"
        className="axxa-composer-send"
        onClick={handleSendClick}
        aria-label="Enviar mensagem"
        title="Enviar"
      >
        <Icon name="send" />
      </button>
    </div>
  );
}
