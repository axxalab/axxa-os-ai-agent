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
import { hapticTick } from "../_shared/haptics";
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content).catch((err) =>
      console.error("[axxa] copy user msg falhou:", err)
    );
  };

  const startEdit = () => {
    setDraft(msg.content);
    setEditing(true);
  };

  const saveEdit = () => {
    const text = draft.trim();
    setEditing(false);
    // Re-envia só se mudou de fato (trunca a conversa dali e regenera)
    if (text && text !== msg.content) actions.editMessage(msg.id, text);
  };

  const menuHandlers = useMessageContextMenu(() => {
    const items: MessageMenuItem[] = [
      { title: t.menu.copy, icon: "copy", onClick: handleCopy },
      { title: t.menu.edit, icon: "pencil", onClick: startEdit },
      {
        title: t.menu.delete,
        icon: "trash-2",
        onClick: () => actions.deleteMessage(msg.id),
        destructive: true,
      },
    ];
    return items;
  });

  if (editing) {
    return (
      <div className="axxa-msg axxa-msg-user">
        <div className="axxa-bubble axxa-bubble-user axxa-bubble-editing">
          <textarea
            className="axxa-edit-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(8, draft.split("\n").length + 1)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                saveEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setEditing(false);
              }
            }}
          />
        </div>
        <div className="axxa-edit-actions">
          <button
            type="button"
            className="axxa-edit-btn"
            onClick={() => setEditing(false)}
          >
            {t.menu.cancel}
          </button>
          <button
            type="button"
            className="axxa-edit-btn axxa-edit-btn-primary"
            onClick={saveEdit}
          >
            {t.menu.saveResend}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="axxa-msg axxa-msg-user"
      data-msg-id={msg.id}
      {...menuHandlers}
    >
      <div
        className="axxa-bubble axxa-bubble-user"
        onDoubleClick={startEdit}
        title={t.menu.edit}
      >
        {msg.content}
      </div>
      <Timestamp ts={msg.timestamp} />
    </div>
  );
}

export function AIResponse({ msg }: { msg: AIResponseMessage }) {
  const actions = useChatActions();
  const t = useT();
  const [copied, setCopied] = useState(false);
  // Reaction agora vem do store (persiste no .md). Local state era perdido
  // a cada reload — não rastreava feedback do user de forma confiável.
  const setReaction = useChatStore((s) => s.setReaction);
  const navigateVariant = useChatStore((s) => s.navigateVariant);
  const liked = msg.reaction === "like" ? true : msg.reaction === "dislike" ? false : null;
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
    setReaction(msg.id, msg.reaction === "like" ? null : "like");
  };

  const handleDislike = () => {
    setReaction(msg.id, msg.reaction === "dislike" ? null : "dislike");
  };

  const handleContinue = () => {
    actions.continueResponse(msg.id);
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
    <div
      className="axxa-msg axxa-msg-ai-response"
      data-msg-id={msg.id}
      {...menuHandlers}
    >
      <Markdown content={msg.content} />
      {msg.truncated && !isStreaming && (
        <button
          type="button"
          className="axxa-continue-btn"
          onClick={handleContinue}
          title={t.chat.continueTitle}
        >
          <Icon name="chevrons-down" />
          {t.chat.continueLabel}
        </button>
      )}
      {!isStreaming && (
        <div className="axxa-response-footer">
          {msg.variants && msg.variants.length > 1 && (
            <div className="axxa-variant-nav" aria-label="Versões da resposta">
              <button
                type="button"
                className="axxa-variant-arrow"
                onClick={() => navigateVariant(msg.id, -1)}
                disabled={(msg.variantIndex ?? 0) <= 0}
                aria-label="Versão anterior"
              >
                <Icon name="chevron-left" />
              </button>
              <span className="axxa-variant-count">
                {(msg.variantIndex ?? msg.variants.length - 1) + 1}/
                {msg.variants.length}
              </span>
              <button
                type="button"
                className="axxa-variant-arrow"
                onClick={() => navigateVariant(msg.id, 1)}
                disabled={
                  (msg.variantIndex ?? msg.variants.length - 1) >=
                  msg.variants.length - 1
                }
                aria-label="Próxima versão"
              >
                <Icon name="chevron-right" />
              </button>
            </div>
          )}
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
  // Quando ai-comment tem `activity`, vira ActivityComment (estilo Claude Code:
  // ícone pulsando enquanto pending, troca pra check/x quando termina, texto
  // contextual mostra início e resultado).
  if (msg.activity) {
    return <ActivityComment msg={msg} />;
  }
  // Fallback: ai-comment "thinking" estilo Claude chat (sparkle pulsando).
  return (
    <div className="axxa-msg axxa-msg-ai-comment">
      <div className="axxa-bubble axxa-bubble-ai axxa-bubble-thinking">
        <Icon name="sparkles" className="axxa-bubble-icon" />
        <span>{msg.content}</span>
      </div>
    </div>
  );
}

/**
 * ActivityComment — CHIP de tool estilo Claude Code mobile (v0.1.111).
 *
 * [ícone] ação ……………… +add/−del  ›
 *                                    └ expande → snippet do resultado
 *
 * Estados:
 *   pending → ícone pulsa, sem chevron (ainda rodando)
 *   done    → ícone "pop", stat colorido (+verde / −vermelho / neutro),
 *             chevron expande o detalhe (snippet do resultado)
 *   failed  → ícone X vermelho, sem stat
 */
function ActivityComment({ msg }: { msg: AICommentMessage }) {
  const activity = msg.activity!;
  const [open, setOpen] = useState(false);

  const isPending = activity.phase === "pending";
  const isDone = activity.phase === "done";
  const isFailed = activity.phase === "failed";

  const iconName = isPending
    ? activity.iconPending
    : isFailed
      ? activity.iconFailed ?? "x"
      : activity.iconDone ?? "check";

  const label = isPending
    ? activity.pendingText
    : isFailed
      ? activity.failedText ?? activity.pendingText
      : activity.doneText ?? activity.pendingText;

  // Stat = meta curto (ex: "1.2k chars", "+12 chars", "8 itens"). Cor pelo sinal.
  const stat = msg.content && msg.content !== label ? msg.content : "";
  const statTone = stat.startsWith("+")
    ? "add"
    : stat.startsWith("-")
      ? "del"
      : "neutral";

  const detail = activity.detail?.trim();
  const canExpand = !!detail && !isPending;

  return (
    <div className={"axxa-activity axxa-activity-" + activity.phase}>
      <button
        type="button"
        className={
          "axxa-activity-row" +
          (canExpand ? " axxa-activity-row-expandable" : "")
        }
        onClick={
          canExpand
            ? () => {
                hapticTick();
                setOpen((o) => !o);
              }
            : undefined
        }
        disabled={!canExpand}
        aria-expanded={canExpand ? open : undefined}
        role={isPending ? "status" : undefined}
        aria-live={isPending ? "polite" : undefined}
      >
        <span
          className={
            "axxa-activity-icon" +
            (isPending ? " axxa-activity-pulse" : "") +
            (isDone ? " axxa-activity-pop" : "")
          }
          aria-hidden="true"
        >
          <Icon name={iconName} />
        </span>
        <span className="axxa-activity-text">{label}</span>
        {stat && (
          <span className={"axxa-activity-stat axxa-activity-stat-" + statTone}>
            {stat}
          </span>
        )}
        {canExpand && (
          <span
            className={
              "axxa-activity-chevron" +
              (open ? " axxa-activity-chevron-open" : "")
            }
            aria-hidden="true"
          >
            <Icon name="chevron-right" />
          </span>
        )}
      </button>
      {canExpand && open && (
        <pre className="axxa-activity-detail">{detail}</pre>
      )}
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
