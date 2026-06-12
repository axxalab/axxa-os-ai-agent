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

import { useEffect, useRef, useState } from "react";
import { Notice } from "obsidian";
import { Icon } from "../_shared/Icon";
import {
  speak,
  cancelSpeech,
  plainForSpeech,
  claimSpeaker,
  releaseSpeaker,
} from "../_shared/speech";
import { ThinkingGlyph } from "../_shared/ThinkingGlyph";
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
import type { AIToolStep } from "../../agent/types";

/** Arg mais significativo de uma tool (path/from/query) pro chip. */
function stepArg(step: AIToolStep): string {
  const a = step.arguments ?? {};
  return String(a.path ?? a.from ?? a.folder ?? a.query ?? "");
}

/**
 * Bloco colapsável "🔧 N ações do agente" numa resposta do Agent. Mostra o que
 * o agente fez (persistido) — e, junto com o replay no history, é o que dá
 * continuidade: reabrir o chat e o agente lembra do que já executou. v0.1.160
 */
function AgentSteps({ steps }: { steps: AIToolStep[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={"axxa-agent-steps" + (open ? " is-open" : "")}>
      <button
        type="button"
        className="axxa-agent-steps-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Icon name="wrench" />
        <span>{steps.length} ações do agente</span>
        <Icon name="chevron-right" className="axxa-agent-steps-chevron" />
      </button>
      {open && (
        <ul className="axxa-agent-steps-list">
          {steps.map((s, i) => (
            <li
              key={i}
              className={"axxa-agent-step" + (s.ok ? "" : " is-fail")}
            >
              <Icon name={s.ok ? "check" : "x"} />
              <code>{s.name}</code>
              {stepArg(s) && <span className="axxa-agent-step-arg">{stepArg(s)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Painel colapsável de RACIOCÍNIO (ref: ChatGPT iOS 91, Grok iOS 26).
 * Mostra o chain-of-thought dos modelos reasoning (DeepSeek R1 etc) num bloco
 * "Raciocínio ›" que expande. Enquanto `live`, fica aberto e pulsa. v0.1.193
 */
function ReasoningPanel({ text, live }: { text: string; live: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // Expande automaticamente enquanto está pensando ao vivo.
  const expanded = open || live;
  return (
    <div className={"axxa-reasoning" + (live ? " axxa-reasoning-live" : "")}>
      <button
        type="button"
        className="axxa-reasoning-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={expanded}
      >
        <Icon name="brain" />
        <span className="axxa-reasoning-label">
          {live ? t.chat.reasoningLive : t.chat.reasoningDone}
        </span>
        <Icon
          name="chevron-right"
          className={
            "axxa-reasoning-chevron" + (expanded ? " is-open" : "")
          }
        />
      </button>
      {expanded && <div className="axxa-reasoning-body">{text}</div>}
    </div>
  );
}

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
      new Notice(t.chat.copied);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("[axxa] copy falhou:", err);
    }
  };

  const handleRegen = () => {
    actions.regenerate(msg.id);
  };

  const handleSaveNote = () => {
    actions.saveResponseAsNote(msg.content);
  };

  // Read-aloud via Web Speech API (local, sem custo). Toggle: fala / para.
  // Usa o helper compartilhado speak() + registry de exclusividade: como
  // speechSynthesis é global, iniciar a leitura de OUTRA mensagem reseta o
  // estado "falando" desta (cuja fala foi cortada). v0.1.195
  const [speaking, setSpeaking] = useState(false);
  const resetSpeakingRef = useRef(() => setSpeaking(false));
  const handleReadAloud = () => {
    if (!("speechSynthesis" in window)) {
      new Notice(t.chat.saveAsNoteFailed);
      return;
    }
    if (speaking) {
      cancelSpeech();
      releaseSpeaker(resetSpeakingRef.current);
      setSpeaking(false);
      return;
    }
    const plain = plainForSpeech(msg.content);
    if (!plain) return;
    claimSpeaker(resetSpeakingRef.current); // reseta o falante anterior, se houver
    const ok = speak(plain, {
      onEnd: () => {
        setSpeaking(false);
        releaseSpeaker(resetSpeakingRef.current);
      },
      onError: () => {
        setSpeaking(false);
        releaseSpeaker(resetSpeakingRef.current);
      },
    });
    if (ok) setSpeaking(true);
  };

  // Para a leitura SÓ desta mensagem se ela desmontar (troca de chat, delete).
  // Dep [] = só no unmount; usa o ref pra ler o estado atual sem re-registrar.
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;
  useEffect(() => {
    return () => {
      if (speakingRef.current) {
        cancelSpeech();
        releaseSpeaker(resetSpeakingRef.current);
      }
    };
  }, []);

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
      {msg.reasoning && msg.reasoning.trim().length > 0 && (
        <ReasoningPanel text={msg.reasoning} live={isStreaming} />
      )}
      <Markdown content={msg.content} />
      {/* Caret de digitação (barra piscante) enquanto os tokens chegam. #10 */}
      {isStreaming && <span className="axxa-typing-caret" aria-hidden="true" />}
      {msg.agentSteps && msg.agentSteps.length > 0 && !isStreaming && (
        <AgentSteps steps={msg.agentSteps} />
      )}
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
            aria-label={t.chat.actionCopy}
            title={t.chat.actionCopy}
          >
            <Icon name={copied ? "check" : "copy"} />
          </button>
          <button
            type="button"
            className="axxa-footer-btn"
            onClick={handleSaveNote}
            aria-label={t.chat.actionSaveNote}
            title={t.chat.actionSaveNote}
          >
            <Icon name="file-plus-2" />
          </button>
          <button
            type="button"
            className={"axxa-footer-btn" + (speaking ? " axxa-footer-btn-active" : "")}
            onClick={handleReadAloud}
            aria-label={speaking ? t.chat.actionStopReading : t.chat.actionReadAloud}
            title={speaking ? t.chat.actionStopReading : t.chat.actionReadAloud}
          >
            <Icon name={speaking ? "square" : "volume-2"} />
          </button>
          <button
            type="button"
            className="axxa-footer-btn"
            onClick={handleRegen}
            aria-label={t.chat.actionRegen}
            title={t.chat.actionRegen}
          >
            <Icon name="refresh-cw" />
          </button>
          <button
            type="button"
            className={"axxa-footer-btn" + (liked === true ? " axxa-footer-btn-active" : "")}
            onClick={handleLike}
            aria-label={t.chat.actionLike}
            title={t.chat.actionLike}
          >
            <Icon name="thumbs-up" />
          </button>
          <button
            type="button"
            className={"axxa-footer-btn" + (liked === false ? " axxa-footer-btn-active" : "")}
            onClick={handleDislike}
            aria-label={t.chat.actionDislike}
            title={t.chat.actionDislike}
          >
            <Icon name="thumbs-down" />
          </button>
          <span className="axxa-pro-pill" aria-label="Upgrade para PRO">PRO</span>
        </div>
      )}
      {!isStreaming && <Timestamp ts={msg.timestamp} />}
    </div>
  );
}

/**
 * ErrorMessage — bolha dedicada pra ai-response com isError. Em vez do footer
 * de resposta normal (copiar/regen/like/PRO — que não faz sentido num erro),
 * mostra um card de alerta + ações ACIONÁVEIS: "Tentar de novo" sempre, e
 * "Abrir Configurações" quando o erro é de API key (no-key / invalid-key).
 * É o que tira o cold-start do beco sem saída. v0.1.147
 */
export function ErrorMessage({ msg }: { msg: AIResponseMessage }) {
  const actions = useChatActions();
  const t = useT();
  // Tira o prefixo "[Erro]" do texto — o card já comunica que é erro pelo ícone.
  const text = msg.content.startsWith(t.ai.errorPrefix)
    ? msg.content.slice(t.ai.errorPrefix.length).trim()
    : msg.content;
  const isKeyError =
    msg.errorCode === "no-key" || msg.errorCode === "invalid-key";
  // Billing do Gemini: ação dedicada → abre o AI Studio pra ativar billing
  // (a assinatura consumer não cobre a API). v0.1.162
  const isBilling = msg.errorCode === "billing";

  return (
    <div className="axxa-msg axxa-msg-error" data-msg-id={msg.id}>
      <div className="axxa-error-card">
        <span className="axxa-error-icon" aria-hidden="true">
          <Icon name="alert-triangle" />
        </span>
        <span className="axxa-error-text">{text}</span>
      </div>
      <div className="axxa-error-actions">
        {isKeyError && (
          <button
            type="button"
            className="axxa-error-btn axxa-error-btn-primary"
            onClick={actions.openSettings}
          >
            <Icon name="settings" />
            {t.ai.openSettings}
          </button>
        )}
        {isBilling && (
          <button
            type="button"
            className="axxa-error-btn axxa-error-btn-primary"
            onClick={() =>
              window.open("https://aistudio.google.com/apikey", "_blank")
            }
          >
            <Icon name="credit-card" />
            {t.ai.openBilling}
          </button>
        )}
        <button
          type="button"
          className="axxa-error-btn"
          onClick={() => actions.retryError(msg.id)}
        >
          <Icon name="refresh-cw" />
          {t.ai.retry}
        </button>
      </div>
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
        <ThinkingGlyph className="axxa-bubble-glyph" />
        <span className="axxa-shimmer-text">{msg.content}</span>
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

  // "Pensando..." (sparkles) vira o glyph animado; tools/gen mantêm o ícone
  // contextual (radar/wrench/image-plus) com o pulse. v0.1.173
  const showGlyph = isPending && iconName === "sparkles";

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
            (isPending && !showGlyph ? " axxa-activity-pulse" : "") +
            (isDone ? " axxa-activity-pop" : "")
          }
          aria-hidden="true"
        >
          {showGlyph ? <ThinkingGlyph /> : <Icon name={iconName} />}
        </span>
        <span
          className={
            "axxa-activity-text" + (isPending ? " axxa-shimmer-text" : "")
          }
        >
          {label}
        </span>
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
      {/* Placeholder com gradiente animado da imagem sendo gerada (#73). */}
      {isPending && activity.placeholder === "image" && (
        <div className="axxa-img-placeholder" aria-hidden="true" />
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
