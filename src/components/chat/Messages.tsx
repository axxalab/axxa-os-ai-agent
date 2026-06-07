// src/components/chat/Messages.tsx
// 4 variantes de renderização de mensagem (regras definidas no AGENTS.md/memória):
//   - UserBubble    — bubble direita (qualquer input do user)
//   - AIResponse    — markdown renderizado esquerda + footer buttons (padrão da IA)
//   - AIComment     — bubble esquerda (status / tool use — minoria dos casos)
//   - AIOptions     — botões de seleção (igual ao componente AskUserQuestion)
//
// UserBubble e AIResponse abrem um Menu nativo do Obsidian em right-click
// (desktop) ou long-press 500ms (mobile) — ações: Copiar, Regenerar (só AI),
// Deletar. Regen e Delete vêm do ChatActionsContext (lógica no AxxaApp).

import { useState } from "react";
import { Icon } from "../_shared/Icon";
import { Markdown } from "../_shared/Markdown";
import { formatTime } from "../_shared/timestamps";
import { useChatStore } from "../../store/chat";
import { useChatActions } from "./ChatActionsContext";
import { useMessageContextMenu, type MessageMenuItem } from "./useMessageContextMenu";
import { useT } from "../../i18n";
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
  const actions = useChatActions();
  const t = useT();

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content).catch((err) =>
      console.error("[axxa] copy user msg falhou:", err)
    );
  };

  const menuHandlers = useMessageContextMenu(() => {
    const items: MessageMenuItem[] = [
      { title: t.menu.copy, icon: "copy", onClick: handleCopy },
      {
        title: t.menu.delete,
        icon: "trash-2",
        onClick: () => actions.deleteMessage(msg.id),
        destructive: true,
      },
    ];
    return items;
  });

  return (
    <div className="axxa-msg axxa-msg-user" {...menuHandlers}>
      <div className="axxa-bubble axxa-bubble-user">{msg.content}</div>
      <Timestamp ts={msg.timestamp} />
    </div>
  );
}

export function AIResponse({ msg }: { msg: AIResponseMessage }) {
  const actions = useChatActions();
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<null | boolean>(null);
  // Esconde footer enquanto essa msg específica tá sendo streamada
  const streamingId = useChatStore((s) => s.streamingMessageId);
  const isStreaming = msg.id === streamingId;

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
    actions.regenerate(msg.id);
  };

  const handleDelete = () => {
    actions.deleteMessage(msg.id);
  };

  const handleLike = () => {
    setLiked((prev) => (prev === true ? null : true));
  };

  const handleDislike = () => {
    setLiked((prev) => (prev === false ? null : false));
  };

  const menuHandlers = useMessageContextMenu(() => {
    const items: MessageMenuItem[] = [
      { title: t.menu.copy, icon: "copy", onClick: handleCopy },
      { title: t.menu.regenerate, icon: "refresh-cw", onClick: handleRegen },
      {
        title: t.menu.delete,
        icon: "trash-2",
        onClick: handleDelete,
        destructive: true,
      },
    ];
    return items;
  });

  return (
    <div className="axxa-msg axxa-msg-ai-response" {...menuHandlers}>
      <Markdown content={msg.content} />
      {!isStreaming && (
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
      )}
      {!isStreaming && <Timestamp ts={msg.timestamp} />}
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
