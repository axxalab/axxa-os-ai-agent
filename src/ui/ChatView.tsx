// src/ui/ChatView.tsx
// A tela do chat: barra do topo (menu · título · nova conversa), o corpo
// (StarterScreen enquanto vazio, timeline depois) e o composer. O MODO se
// escolhe na tela inicial; provider e modelo ficam nos pills do composer e
// somem quando a sessão trava (1º envio) — o effort continua livre sempre.
//
// O histórico de conversas NÃO mora aqui: é o menu lateral (Drawer.tsx).

import { useEffect, useRef, useState } from "react";
import type AxxaPlugin from "../main";
import {
  useChatStore,
  type ActivityMeta,
  type ChatMessage,
} from "../store/chat";
import type { ChatSession } from "../core/session";
import { PROVIDERS, providerConfigured } from "../core/providersMeta";
import {
  EFFORT_LEVELS,
  EFFORT_LABELS,
  EFFORT_EMOJIS,
  EFFORT_DESCRIPTIONS,
  type EffortLevel,
} from "../core/effort";
import type { Skill } from "../skills/skills";
import { Markdown } from "./Markdown";
import { Icon } from "./Icon";
import { openPicker } from "./menu";
import { StarterScreen } from "./StarterScreen";
import type { ComposerInject } from "./App";

const MODE_PLACEHOLDER: Record<string, string> = {
  chat: "Message the model…",
  "vault-qa": "Ask something about your notes…",
  agent: "Tell the agent what to do in your vault…",
};

const MODE_LABEL: Record<string, string> = {
  chat: "Chat",
  "vault-qa": "Vault Q&A",
  agent: "Agent",
};

export function ChatView({
  plugin,
  session,
  inject,
  onOpenMenu,
  onUseSkill,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  inject: ComposerInject | null;
  onOpenMenu: () => void;
  onUseSkill: (skill: Skill) => void;
}) {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const loadingChat = useChatStore((s) => s.loadingChat);
  const streamingId = useChatStore((s) => s.streamingMessageId);
  const currentChatId = useChatStore((s) => s.currentChatId);
  const currentChatTitle = useChatStore((s) => s.currentChatTitle);
  // Lido do store pra re-renderizar quando a sessão trava/destrava.
  const locked = useChatStore((s) => s.sessionProvider) !== null;
  const cfg = session.config;

  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Skill "Use" / sugestão: entra no rascunho, abaixo do que já estava escrito.
  useEffect(() => {
    if (!inject) return;
    setDraft((d) => (d.trim() ? `${d}\n\n${inject.text}` : inject.text));
    textareaRef.current?.focus();
  }, [inject]);

  // Composer cresce com o texto. Mede com height:0 (altura definida) — com
  // `auto` o textarea é um flex item e pode ser medido esticado, o que fazia
  // o composer abrir tomando meia tela.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "0px";
      const max = Math.round(window.innerHeight * 0.4);
      el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    };
    const raf = window.requestAnimationFrame(fit);
    return () => window.cancelAnimationFrame(raf);
  }, [draft]);

  // Timeline colada no fim enquanto chega texto novo.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingId]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || isLoading) return;
    setDraft("");
    await session.send(text);
  };

  const empty = messages.length === 0 && !loadingChat;
  const effort = cfg.effort as EffortLevel;

  return (
    <div className="axxa-chat">
      <header className="axxa-topbar">
        <button
          type="button"
          className="axxa-icon-btn"
          aria-label="Open menu"
          onClick={onOpenMenu}
        >
          <Icon name="menu" />
        </button>
        <div className="axxa-topbar-title">
          <span className="axxa-topbar-name">
            {currentChatId ? currentChatTitle || "Untitled" : "New chat"}
          </span>
          {locked && (
            <span className="axxa-topbar-meta">
              {MODE_LABEL[cfg.mode] ?? cfg.mode} · {cfg.model}
            </span>
          )}
        </div>
        <button
          type="button"
          className="axxa-icon-btn"
          aria-label="New chat"
          disabled={empty && !currentChatId}
          onClick={() => session.newChat()}
        >
          <Icon name="square-pen" />
        </button>
      </header>

      <div className="axxa-messages" ref={scrollRef}>
        {loadingChat && <p className="axxa-empty-line">Loading…</p>}
        {empty ? (
          <StarterScreen
            plugin={plugin}
            session={session}
            onUseSkill={onUseSkill}
          />
        ) : (
          messages.map((m) => (
            <MessageRow
              key={m.id}
              msg={m}
              plugin={plugin}
              streaming={m.id === streamingId}
            />
          ))
        )}
      </div>

      <section className="axxa-composer">
        {/* Travada a sessão, provider/modelo/modo já aparecem no topo — aqui
            fica só o effort, que continua livre no meio da conversa. */}
        <div className="axxa-pills">
          {!locked && (
            <>
              <Pill
                icon="plug"
                label={
                  PROVIDERS.find((p) => p.id === cfg.provider)?.name ??
                  cfg.provider
                }
                onClick={(e) =>
                  openPicker(
                    e,
                    PROVIDERS.map((p) => ({
                      value: p.id,
                      label: p.name,
                      note: providerConfigured(plugin, p.id)
                        ? undefined
                        : "no key",
                    })),
                    cfg.provider,
                    (v) => session.setProvider(v)
                  )
                }
              />
              <Pill
                icon="cpu"
                label={cfg.model || "no model"}
                onClick={(e) =>
                  openPicker(
                    e,
                    session
                      .modelOptions(cfg.provider)
                      .map((m) => ({ value: m, label: m })),
                    cfg.model,
                    (v) => session.setModel(v)
                  )
                }
              />
            </>
          )}
          <Pill
            label={`${EFFORT_EMOJIS[effort] ?? ""} ${
              EFFORT_LABELS[effort] ?? cfg.effort
            }`}
            onClick={(e) =>
              openPicker(
                e,
                EFFORT_LEVELS.map((l) => ({
                  value: l,
                  label: EFFORT_LABELS[l],
                  note: EFFORT_DESCRIPTIONS[l],
                })),
                cfg.effort,
                (v) => session.setEffort(v)
              )
            }
          />
        </div>

        <div className="axxa-input">
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            placeholder={MODE_PLACEHOLDER[cfg.mode] ?? ""}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          {isLoading ? (
            <button
              type="button"
              className="axxa-send is-stop"
              aria-label="Stop"
              onClick={() => session.stop()}
            >
              <Icon name="square" size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="axxa-send"
              aria-label="Send"
              disabled={!draft.trim()}
              onClick={() => void submit()}
            >
              <Icon name="arrow-up" size={18} />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function Pill({
  icon,
  label,
  onClick,
}: {
  icon?: string;
  label: string;
  onClick: (e: MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      className="axxa-pill"
      onClick={(e) => onClick(e as unknown as MouseEvent)}
    >
      {icon && <Icon name={icon} size={14} />}
      <span className="axxa-pill-label">{label}</span>
      <Icon name="chevron-down" size={14} />
    </button>
  );
}

function activityText(a: ActivityMeta): string {
  if (a.phase === "pending") return a.pendingText;
  if (a.phase === "done") return a.doneText ?? a.pendingText;
  return a.failedText ?? "Failed";
}

function MessageRow({
  msg,
  plugin,
  streaming,
}: {
  msg: ChatMessage;
  plugin: AxxaPlugin;
  streaming: boolean;
}) {
  switch (msg.type) {
    case "user":
      return (
        <div className="axxa-msg axxa-msg-user">
          <div className="axxa-msg-text">{msg.content}</div>
        </div>
      );
    case "ai-response":
      return (
        <div
          className={
            "axxa-msg axxa-msg-ai" + (msg.isError ? " axxa-msg-error" : "")
          }
        >
          {msg.reasoning && (
            <details className="axxa-details">
              <summary>Reasoning</summary>
              <pre className="axxa-msg-text">{msg.reasoning}</pre>
            </details>
          )}
          {msg.isError ? (
            <div className="axxa-msg-text">{msg.content}</div>
          ) : (
            <Markdown
              app={plugin.app}
              text={msg.content}
              streaming={streaming}
            />
          )}
          {msg.truncated && <small className="axxa-msg-note">truncated</small>}
          {msg.agentSteps && msg.agentSteps.length > 0 && (
            <details className="axxa-details">
              <summary>{msg.agentSteps.length} tool call(s)</summary>
              <ul>
                {msg.agentSteps.map((s) => (
                  <li key={s.id}>
                    <code>
                      {s.ok ? "✓" : "✗"} {s.name} {JSON.stringify(s.arguments)}
                    </code>
                    {s.result && <pre className="axxa-msg-text">{s.result}</pre>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      );
    case "ai-comment":
      return (
        <div className="axxa-msg axxa-msg-comment">
          <Icon
            name={
              msg.activity?.phase === "failed"
                ? "alert-triangle"
                : msg.activity?.phase === "done"
                  ? "check"
                  : "loader"
            }
            size={13}
          />
          <span>
            {msg.activity ? activityText(msg.activity) : msg.content}
            {msg.activity && msg.content ? ` — ${msg.content}` : ""}
          </span>
          {msg.activity?.detail && (
            <details className="axxa-details">
              <summary>details</summary>
              <pre className="axxa-msg-text">{msg.activity.detail}</pre>
            </details>
          )}
        </div>
      );
    case "ai-options":
      return (
        <div className="axxa-msg axxa-msg-options">
          <div>{msg.prompt}</div>
          <div className="axxa-suggestions">
            {msg.options.map((o, i) => (
              <button
                key={i}
                type="button"
                className={
                  msg.selectedIndex === i ? "axxa-chip is-active" : "axxa-chip"
                }
                disabled={msg.selectedIndex !== undefined}
                onClick={() => useChatStore.getState().selectOption(msg.id, i)}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}
