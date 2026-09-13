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
import {
  PROVIDERS,
  providerBlockedReason,
  providerHealth,
} from "../core/providersMeta";
import {
  getModelCard,
  prettyModelName,
} from "../providers/modelDescriptions";
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
import {
  Sheet,
  SheetGroup,
  SheetNavRow,
  SheetNote,
  SheetRow,
  SheetSeg,
} from "./Sheet";
import { getModelFamily } from "../providers/modelFamily";
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
  /** Qual bottom sheet do composer está aberta. */
  const [sheet, setSheet] = useState<"model" | "effort" | null>(
    null
  );
  /** Provider que a folha de modelos está MOSTRANDO — não é o da sessão até
   *  alguém tocar num modelo. Dá pra espiar o catálogo de outro provider sem
   *  trocar nada por engano. */
  const [pickProvider, setPickProvider] = useState(cfg.provider);
  /** Nível da folha de modelos: os favoritos, ou a lista inteira. */
  const [modelView, setModelView] = useState<"root" | "list">("root");
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
  const stickToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  useEffect(stickToBottom, [messages, streamingId]);

  // Teclado abrindo: a área da conversa encolhe, então reancora no fim
  // depois da animação (o inset em si é do useKeyboardInset).
  const onComposerFocus = () => {
    stickToBottom();
    window.setTimeout(stickToBottom, 350);
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text || isLoading) return;
    setDraft("");
    await session.send(text);
  };

  // Abrir uma sheet tira o foco do campo — senão o teclado sobe por cima dela.
  const openSheet = (which: "model" | "effort") => {
    textareaRef.current?.blur();
    // A folha de modelos abre sempre no provider da sessão, e no primeiro nível.
    if (which === "model") {
      setPickProvider(cfg.provider);
      setModelView("root");
    }
    setSheet(which);
  };
  const closeSheet = () => setSheet(null);

  // Os dois blocos do cartão de modelos. Favoritar já implica Show, então o
  // segundo bloco tira os favoritos pra ninguém aparecer duas vezes.
  const favorites = (
    plugin.settings.favoriteModels?.[pickProvider] ?? []
  ).slice(0, 5);
  const rest = session
    .modelOptions(pickProvider)
    .filter((m) => !favorites.includes(m));

  /** Tocar num modelo comita as DUAS coisas: o provider da folha e o modelo. */
  const chooseModel = (model: string) => {
    if (pickProvider !== cfg.provider) session.setProvider(pickProvider);
    session.setModel(model);
    closeSheet();
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

      {/* Composer: UM bloco só — campo em cima, barra de controles embaixo,
          sem régua horizontal separando nada. */}
      <section className="axxa-composer">
        <div className="axxa-input">
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            placeholder={MODE_PLACEHOLDER[cfg.mode] ?? ""}
            onFocus={onComposerFocus}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void submit();
              }
            }}
          />

          <div className="axxa-input-bar">
            {/* Travada a sessão, provider/modelo já aparecem na topbar — aqui
                fica só o effort, que continua livre no meio da conversa. */}
            <div className="axxa-pills">
              {/* Um botão só pro modelo: o provider virou o trilho de logos
                  DENTRO da folha, então ter um seletor separado era pedir a
                  mesma coisa duas vezes. O logo aqui diz de quem é o modelo. */}
              {!locked && (
                <Pill
                  icon={
                    PROVIDERS.find((p) => p.id === cfg.provider)?.icon
                  }
                  label={cfg.model || "no model"}
                  onClick={() => openSheet("model")}
                />
              )}
              <Pill
                label={`${EFFORT_EMOJIS[effort] ?? ""} ${
                  EFFORT_LABELS[effort] ?? cfg.effort
                }`}
                onClick={() => openSheet("effort")}
              />
            </div>

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
        </div>
      </section>

      {/* Bottom sheets do composer — modelo · effort. */}
      {/* Dois níveis na MESMA folha, como o app da Claude: em cima os
          favoritos (o atalho), e "Show list" é uma linha que abre a lista
          inteira aqui dentro — com seta pra voltar. Sem favorito não há de
          onde descer, então a lista já vem no primeiro nível. */}
      <Sheet
        title={modelView === "list" ? "Show list" : "Select model"}
        open={sheet === "model"}
        onClose={closeSheet}
        onBack={modelView === "list" ? () => setModelView("root") : undefined}
      >
        {modelView === "root" && (
          <SheetSeg
            label="Provider"
            activeId={pickProvider}
            onPick={setPickProvider}
            items={PROVIDERS.map((p) => ({
              id: p.id,
              icon: p.icon,
              label: p.name,
              health: providerHealth(plugin, p.id),
              blocked: providerBlockedReason(plugin, p.id),
            }))}
          />
        )}

        {modelView === "list" ? (
          <SheetGroup>
            {rest.map((m) => (
              <ModelRow
                key={m}
                provider={pickProvider}
                model={m}
                selected={m === cfg.model && pickProvider === cfg.provider}
                onClick={() => chooseModel(m)}
              />
            ))}
          </SheetGroup>
        ) : (
          <>
            <SheetGroup>
              {(favorites.length > 0 ? favorites : rest).map((m) => (
                <ModelRow
                  key={m}
                  provider={pickProvider}
                  model={m}
                  selected={m === cfg.model && pickProvider === cfg.provider}
                  onClick={() => chooseModel(m)}
                />
              ))}
              {favorites.length === 0 && rest.length === 0 && (
                <SheetNote>
                  Nothing marked to show for this provider yet — pick what
                  appears here in Settings → Providers.
                </SheetNote>
              )}
            </SheetGroup>
            {favorites.length > 0 && rest.length > 0 && (
              <SheetGroup>
                <SheetNavRow
                  icon="list"
                  title="Show list"
                  note={`${rest.length} more ${
                    rest.length === 1 ? "model" : "models"
                  }`}
                  onClick={() => setModelView("list")}
                />
              </SheetGroup>
            )}
          </>
        )}
      </Sheet>

      <Sheet title="Effort" open={sheet === "effort"} onClose={closeSheet}>
        <SheetGroup>
          {EFFORT_LEVELS.map((l) => (
            <SheetRow
              key={l}
              badge={EFFORT_EMOJIS[l]}
              title={EFFORT_LABELS[l]}
              note={EFFORT_DESCRIPTIONS[l]}
              selected={l === cfg.effort}
              onClick={() => {
                session.setEffort(l);
                closeSheet();
              }}
            />
          ))}
        </SheetGroup>
      </Sheet>
    </div>
  );
}

/** Linha de modelo: brasão da família + nome + o que ele faz. */
function ModelRow({
  provider,
  model,
  selected,
  onClick,
}: {
  provider: string;
  model: string;
  selected: boolean;
  onClick: () => void;
}) {
  const card = getModelCard(provider, model);
  return (
    <SheetRow
      icon={getModelFamily(model).icon}
      title={prettyModelName(model)}
      note={card.goodFor ?? card.description}
      selected={selected}
      onClick={onClick}
    />
  );
}

function Pill({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="axxa-pill" onClick={onClick}>
      {icon && <Icon name={icon} size={15} className="axxa-pill-mark" />}
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
