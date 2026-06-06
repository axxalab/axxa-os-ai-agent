// src/components/chat/Messages.tsx
// 4 variantes de renderização de mensagem (regras definidas no AGENTS.md/memória):
//   - UserBubble    — bubble direita (qualquer input do user)
//   - AIResponse    — markdown renderizado esquerda + footer buttons (padrão da IA)
//   - AIComment     — bubble esquerda (status / tool use — minoria dos casos)
//   - AIOptions     — botões de seleção (igual ao componente AskUserQuestion)

import { useState } from "react";
import { Icon } from "../_shared/Icon";
import { Markdown } from "../_shared/Markdown";
import { formatTime } from "../_shared/timestamps";
import { useChatStore } from "../../store/chat";
import type {
  UserMessage,
  AIResponseMessage,
  AICommentMessage,
  AIOptionsMessage,
} from "../../store/chat";

function Timestamp({ ts }: { ts: number }) {
  return <div className="axxa-msg-timestamp">{formatTime(ts)}</div>;
}

export function UserBubble({ msg }: { msg: UserMessage }) {
  return (
    <div className="axxa-msg axxa-msg-user">
      <div className="axxa-bubble axxa-bubble-user">{msg.content}</div>
      <Timestamp ts={msg.timestamp} />
    </div>
  );
}

export function AIResponse({ msg }: { msg: AIResponseMessage }) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<null | boolean>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("[axxa] copy falhou:", err);
    }
  };

  const handleRegen = () => {
    console.log("[axxa] regen request — implementar quando precisar");
  };

  const handleLike = () => {
    setLiked((prev) => (prev === true ? null : true));
    console.log("[axxa] like");
  };

  const handleDislike = () => {
    setLiked((prev) => (prev === false ? null : false));
    console.log("[axxa] dislike");
  };

  return (
    <div className="axxa-msg axxa-msg-ai-response">
      <Markdown content={msg.content} />
      <div className="axxa-response-footer">
        <button
          type="button"
          className="axxa-footer-btn"
          onClick={handleCopy}
          aria-label="Copiar resposta"
          title="Copiar"
        >
          <Icon name={copied ? "check" : "copy"} />
        </button>
        <button
          type="button"
          className="axxa-footer-btn"
          onClick={handleRegen}
          aria-label="Regenerar"
          title="Regenerar"
        >
          <Icon name="refresh-cw" />
        </button>
        <button
          type="button"
          className={"axxa-footer-btn" + (liked === true ? " axxa-footer-btn-active" : "")}
          onClick={handleLike}
          aria-label="Curtir"
          title="Curtir"
        >
          <Icon name="thumbs-up" />
        </button>
        <button
          type="button"
          className={"axxa-footer-btn" + (liked === false ? " axxa-footer-btn-active" : "")}
          onClick={handleDislike}
          aria-label="Descurtir"
          title="Descurtir"
        >
          <Icon name="thumbs-down" />
        </button>
        <button
          type="button"
          className="axxa-footer-btn"
          aria-label="Mais opções"
          title="Mais opções (em breve)"
          disabled
        >
          <Icon name="more-horizontal" />
        </button>
        <span className="axxa-pro-pill" aria-label="Upgrade para PRO">PRO</span>
      </div>
      <Timestamp ts={msg.timestamp} />
    </div>
  );
}

export function AIComment({ msg }: { msg: AICommentMessage }) {
  return (
    <div className="axxa-msg axxa-msg-ai-comment">
      <div className="axxa-bubble axxa-bubble-ai">
        <Icon name="sparkles" className="axxa-bubble-icon" />
        <span>{msg.content}</span>
      </div>
    </div>
  );
}

export function AIOptions({ msg }: { msg: AIOptionsMessage }) {
  const selectOption = useChatStore((s) => s.selectOption);
  const locked = msg.selectedIndex !== undefined;

  return (
    <div className="axxa-msg axxa-msg-ai-options">
      <div className="axxa-response-text">{msg.prompt}</div>
      <div className="axxa-options-list">
        {msg.options.map((opt, i) => {
          const isSelected = msg.selectedIndex === i;
          return (
            <button
              key={i}
              type="button"
              className={
                "axxa-option-btn" + (isSelected ? " axxa-option-selected" : "")
              }
              onClick={() => !locked && selectOption(msg.id, i)}
              disabled={locked && !isSelected}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
