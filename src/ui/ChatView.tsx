// src/ui/ChatView.tsx
// CRUD de chats + mensagens + composer, cru. Lista de conversas (abrir /
// renomear / apagar), timeline do store, seletores de modo / provider / modelo
// / effort (travam após a 1ª mensagem) e envio com streaming.

import { useEffect, useState } from "react";
import type AxxaPlugin from "../main";
import {
  useChatStore,
  type ActivityMeta,
  type ChatMessage,
} from "../store/chat";
import { CHAT_MODES, isChatMode, type ChatSession } from "../core/session";
import { PROVIDERS } from "../core/providersMeta";
import { EFFORT_LEVELS, EFFORT_LABELS } from "../core/effort";
import type { ChatSummary } from "../core/chatPersistence";
import { Markdown } from "./Markdown";
import { PromptModal, ConfirmModal } from "./modals";
import type { ComposerInject } from "./App";

const MODE_PLACEHOLDER: Record<string, string> = {
  chat: "Message the model…",
  "vault-qa": "Ask something about your notes…",
  agent: "Tell the agent what to do in your vault…",
};

export function ChatView({
  plugin,
  session,
  inject,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  inject: ComposerInject | null;
}) {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const loadingChat = useChatStore((s) => s.loadingChat);
  const streamingId = useChatStore((s) => s.streamingMessageId);
  const currentChatId = useChatStore((s) => s.currentChatId);
  const currentChatTitle = useChatStore((s) => s.currentChatTitle);
  const tokensIn = useChatStore((s) => s.tokensIn);
  const tokensOut = useChatStore((s) => s.tokensOut);
  // Lido do store pra re-renderizar quando a sessão trava/destrava.
  const locked = useChatStore((s) => s.sessionProvider) !== null;
  const cfg = session.config;

  const [chats, setChats] = useState<ChatSummary[]>(
    plugin.chatSummaries ?? []
  );
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let alive = true;
    void plugin.loadChatSummaries().then((all) => {
      if (alive) setChats(all);
    });
    const unsub = plugin.onChatsChange(() =>
      setChats(plugin.chatSummaries ?? [])
    );
    return () => {
      alive = false;
      unsub();
    };
  }, [plugin]);

  // Skill "Use": entra no rascunho (abaixo do que já estava escrito).
  useEffect(() => {
    if (!inject) return;
    setDraft((d) => (d.trim() ? `${d}\n\n${inject.text}` : inject.text));
  }, [inject]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || isLoading) return;
    setDraft("");
    await session.send(text);
  };

  const onRename = async (c: ChatSummary) => {
    const title = await new PromptModal(plugin.app, {
      title: "Rename chat",
      label: "Title",
      initial: c.title,
      submitLabel: "Rename",
    }).openAndWait();
    if (title && title !== c.title) await session.rename(c, title);
  };

  const onDelete = async (c: ChatSummary) => {
    const ok = await new ConfirmModal(plugin.app, {
      title: `Delete "${c.title || "Untitled"}"?`,
      body: "The chat file goes to the system trash (recoverable).",
      confirmLabel: "Delete",
      danger: true,
    }).openAndWait();
    if (ok) await session.delete(c);
  };

  const models = session.modelOptions(cfg.provider);

  return (
    <div className="axxa-chat">
      <section className="axxa-chats">
        <div className="axxa-row">
          <button type="button" onClick={() => session.newChat()}>
            New chat
          </button>
          <strong>
            {currentChatId ? currentChatTitle || "Untitled" : "New chat"}
          </strong>
          <small>
            {locked
              ? `locked: ${cfg.provider} / ${cfg.model} / ${cfg.mode}`
              : "not started"}
            {" · "}in {tokensIn} · out {tokensOut}
          </small>
        </div>
        <ul>
          {chats.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={c.id === currentChatId}
                onClick={() => void session.load(c)}
              >
                {c.title || "Untitled"}
              </button>{" "}
              <small>
                {c.mode} · {c.provider}/{c.model} ·{" "}
                {c.date.slice(0, 16).replace("T", " ")} · {c.messageCount} msgs
              </small>{" "}
              <button type="button" onClick={() => void onRename(c)}>
                Rename
              </button>{" "}
              <button type="button" onClick={() => void onDelete(c)}>
                Delete
              </button>
            </li>
          ))}
          {chats.length === 0 && (
            <li>
              <em>No chats yet.</em>
            </li>
          )}
        </ul>
      </section>

      <section className="axxa-messages">
        {loadingChat && (
          <p>
            <em>Loading…</em>
          </p>
        )}
        {messages.map((m) => (
          <MessageRow
            key={m.id}
            msg={m}
            plugin={plugin}
            streaming={m.id === streamingId}
          />
        ))}
        {messages.length === 0 && !loadingChat && (
          <p>
            <em>Send a message to start.</em>
          </p>
        )}
      </section>

      <section className="axxa-composer">
        <div className="axxa-row">
          <label>
            Mode{" "}
            <select
              value={cfg.mode}
              disabled={locked}
              onChange={(e) => {
                const v = e.currentTarget.value;
                if (isChatMode(v)) session.setMode(v);
              }}
            >
              {CHAT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>{" "}
          <label>
            Provider{" "}
            <select
              value={cfg.provider}
              disabled={locked}
              onChange={(e) => session.setProvider(e.currentTarget.value)}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {plugin.providerCredential(p.id).trim() ? "" : " (no key)"}
                </option>
              ))}
            </select>
          </label>{" "}
          <label>
            Model{" "}
            <select
              value={cfg.model}
              disabled={locked}
              onChange={(e) => session.setModel(e.currentTarget.value)}
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>{" "}
          <label>
            Effort{" "}
            <select
              value={cfg.effort}
              onChange={(e) => session.setEffort(e.currentTarget.value)}
            >
              {EFFORT_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {EFFORT_LABELS[l]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          rows={3}
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
        <div className="axxa-row">
          {isLoading ? (
            <button type="button" onClick={() => session.stop()}>
              Stop
            </button>
          ) : (
            <button
              type="button"
              disabled={!draft.trim()}
              onClick={() => void submit()}
            >
              Send
            </button>
          )}
          <small>Ctrl/Cmd+Enter sends</small>
        </div>
      </section>
    </div>
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
  const time = new Date(msg.timestamp).toLocaleTimeString();
  switch (msg.type) {
    case "user":
      return (
        <div className="axxa-msg axxa-msg-user">
          <div className="axxa-msg-head">
            <b>You</b> <small>{time}</small>
          </div>
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
          <div className="axxa-msg-head">
            <b>{msg.isError ? "Error" : "Assistant"}</b> <small>{time}</small>
            {msg.truncated && <small> · truncated</small>}
          </div>
          {msg.reasoning && (
            <details>
              <summary>Reasoning</summary>
              <pre className="axxa-msg-text">{msg.reasoning}</pre>
            </details>
          )}
          {msg.isError ? (
            <div className="axxa-msg-text">{msg.content}</div>
          ) : (
            <Markdown app={plugin.app} text={msg.content} streaming={streaming} />
          )}
          {msg.agentSteps && msg.agentSteps.length > 0 && (
            <details>
              <summary>{msg.agentSteps.length} tool call(s)</summary>
              <ul>
                {msg.agentSteps.map((s) => (
                  <li key={s.id}>
                    <code>
                      {s.ok ? "✓" : "✗"} {s.name}{" "}
                      {JSON.stringify(s.arguments)}
                    </code>
                    {s.result && (
                      <pre className="axxa-msg-text">{s.result}</pre>
                    )}
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
          <em>
            [{msg.activity ? msg.activity.phase : "note"}]{" "}
            {msg.activity ? activityText(msg.activity) : msg.content}
          </em>
          {msg.activity && msg.content && <small> — {msg.content}</small>}
          {msg.activity?.detail && (
            <details>
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
          {msg.options.map((o, i) => (
            <button
              key={i}
              type="button"
              disabled={msg.selectedIndex !== undefined}
              onClick={() => useChatStore.getState().selectOption(msg.id, i)}
            >
              {msg.selectedIndex === i ? "● " : ""}
              {o}
            </button>
          ))}
        </div>
      );
    default:
      return null;
  }
}
