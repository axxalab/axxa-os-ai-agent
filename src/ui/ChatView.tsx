// src/ui/ChatView.tsx
// A tela do chat: barra do topo (menu · título · nova conversa), o corpo
// (StarterScreen enquanto vazio, timeline depois) e o composer. O MODO se
// escolhe na tela inicial; provider e modelo ficam nos pills do composer e
// somem quando a sessão trava (1º envio) — o effort continua livre sempre.
//
// O histórico de conversas NÃO mora aqui: é o menu lateral (Drawer.tsx).

import { useEffect, useRef, useState } from "react";
import { Notice } from "obsidian";
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
  EFFORT_DESCRIPTIONS,
  type EffortLevel,
} from "../core/effort";
import type { Skill } from "../skills/skills";
import { Markdown } from "./Markdown";
import { Icon } from "./Icon";
import { useVoice } from "./useVoice";
import { speak, stopSpeaking } from "./readAloud";
import { commit, screen, warn } from "./haptics";
import { VoiceDock } from "./VoiceBar";
import {
  Sheet,
  SheetGroup,
  SheetNavRow,
  SheetNote,
  SheetRow,
  SheetSeg,
} from "./Sheet";
import { StarterScreen } from "./StarterScreen";
import type { ComposerInject } from "./App";

const MODE_PLACEHOLDER: Record<string, string> = {
  chat: "Message the model…",
  "vault-qa": "Ask something about your notes…",
  agent: "Tell the agent what to do in your vault…",
};

/** Título da folha de modelos em cada nível. */
const MODEL_SHEET_TITLE: Record<string, string> = {
  root: "Select model",
  list: "Show list",
  effort: "Effort",
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
  const [sheet, setSheet] = useState<"model" | "effort" | "plus" | null>(
    null
  );
  /** Provider que a folha de modelos está MOSTRANDO — não é o da sessão até
   *  alguém tocar num modelo. Dá pra espiar o catálogo de outro provider sem
   *  trocar nada por engano. */
  const [pickProvider, setPickProvider] = useState(cfg.provider);
  /** Nível da folha de modelos: os favoritos, ou a lista inteira. */
  const [modelView, setModelView] = useState<"root" | "list" | "effort">(
    "root"
  );
  /** O que já foi reconhecido nesta gravação (parcial ou final). */
  const [liveText, setLiveText] = useState("");
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
    commit();
    setDraft("");
    await session.send(text);
  };

  // Abrir uma sheet tira o foco do campo — senão o teclado sobe por cima dela.
  const openSheet = (which: "model" | "effort" | "plus") => {
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

  // ── modo de voz ─────────────────────────────────────────────────────────
  // O gravador mora em useVoice; aqui fica só o GESTO do botão (segurar pra
  // gravar, arrastar pra cancelar, pra cima pra travar) e o rascunho.
  // O texto reconhecido aparece ACIMA do dock enquanto se fala (é o que a
  // referência faz) e só vira rascunho quando a gravação termina. Antes ele ia
  // direto pro textarea — que fica colapsado durante a gravação, então ninguém
  // via nada enquanto falava.
  const voice = useVoice({
    apiKey: () => plugin.providerCredential("openai"),
    model: () => plugin.settings.voiceModel,
    language: () => plugin.settings.voiceLanguage,
    onTranscript: setLiveText,
    onNotice: (m) => {
      new Notice(m);
    },
    onCancel: () => setLiveText(""),
  });

  // Acabou a gravação com texto na mão: agora sim ele entra no rascunho,
  // depois do que já estava escrito.
  useEffect(() => {
    if (voice.state !== "idle" || !liveText) return;
    setDraft((d) => (d.trim() ? `${d.trim()} ${liveText}` : liveText));
    setLiveText("");
  }, [voice.state, liveText]);

  // Um CLIQUE começa a gravar; o dock cuida do resto (✕ joga fora, ✓ usa o
  // texto). O gesto de segurar/arrastar saiu: dependia de o microfone abrir
  // antes do dedo sair, e essa corrida travava a tela no aparelho.
  //
  // A troca começa NO CLIQUE, não quando o gravador fica pronto: abrir o
  // microfone ocupa a thread principal, e a animação de altura é main-thread —
  // disparada junto, ela era atropelada e virava um pulo. Assim ela roda
  // enquanto o microfone abre, e o dock já aparece (onda parada) de imediato.
  const [arming, setArming] = useState(false);
  const startVoice = async () => {
    if (arming || voice.state !== "idle") return;
    setLiveText("");
    setArming(true);
    screen();
    const ok = await voice.start();
    if (!ok) {
      setArming(false);
      warn();
    }
  };
  useEffect(() => {
    if (voice.state === "idle") setArming(false);
  }, [voice.state]);

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
          {/* A TROCA: o composer de texto desce e o dock de áudio sobe no
              lugar. As duas linhas do grid (1fr/0fr) animam a altura — é o que
              faz um encolher enquanto o outro cresce, em vez de um sumir e o
              outro aparecer. */}
          <div
            className="axxa-swap"
            data-mode={voice.state !== "idle" || arming ? "voice" : "text"}
          >
            <div className="axxa-swap-row">
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

              {/* + à esquerda, o modelo ao lado, e à direita voz e enviar. */}
              <div className="axxa-input-bar">
                <button
                  type="button"
                  className="axxa-round-btn"
                  aria-label="Add to chat"
                  onClick={() => openSheet("plus")}
                >
                  <Icon name="plus" size={22} />
                </button>

                <div className="axxa-pills">
                  <Pill
                    label={prettyModelName(cfg.model) || "no model"}
                    onClick={() => openSheet("model")}
                  />
                </div>

                {plugin.settings.voiceEnabled && (
                  <button
                    type="button"
                    className="axxa-round-btn"
                    aria-label="Voice mode"
                    onClick={() => void startVoice()}
                  >
                    <Icon name="mic" size={20} />
                  </button>
                )}

                {isLoading ? (
                  <button
                    type="button"
                    className="axxa-send is-stop"
                    aria-label="Stop"
                    onClick={() => session.stop()}
                  >
                    <Icon name="square" size={18} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="axxa-send"
                    aria-label="Send"
                    disabled={!draft.trim()}
                    onClick={() => void submit()}
                  >
                    <Icon name="arrow-up" size={20} />
                  </button>
                )}
              </div>
            </div>
            </div>

            <div className="axxa-swap-row">
              <div className="axxa-voice-side">
                {liveText && <p className="axxa-voice-live">{liveText}</p>}
                <VoiceDock voice={voice} />
              </div>
            </div>
          </div>
      </section>

      {/* Bottom sheets do composer — modelo · effort. */}
      {/* Dois níveis na MESMA folha, como o app da Claude: em cima os
          favoritos (o atalho), e "Show list" é uma linha que abre a lista
          inteira aqui dentro — com seta pra voltar. Sem favorito não há de
          onde descer, então a lista já vem no primeiro nível. */}
      <Sheet
        title={MODEL_SHEET_TITLE[modelView]}
        open={sheet === "model"}
        onClose={closeSheet}
        onBack={modelView === "root" ? undefined : () => setModelView("root")}
      >
        {modelView === "root" && !locked && (
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

        {modelView === "effort" ? (
          <SheetGroup>
            {EFFORT_LEVELS.map((l) => (
              <SheetRow
                key={l}
                title={EFFORT_LABELS[l]}
                note={EFFORT_DESCRIPTIONS[l]}
                tag={l === plugin.settings.defaultEffort ? "Default" : undefined}
                selected={l === cfg.effort}
                onClick={() => {
                  session.setEffort(l);
                  closeSheet();
                }}
              />
            ))}
          </SheetGroup>
        ) : modelView === "list" ? (
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
            {locked ? (
              <SheetGroup>
                <SheetNote>
                  This chat is locked to {prettyModelName(cfg.model)} — start a
                  new chat to pick another model. Effort still changes freely.
                </SheetNote>
              </SheetGroup>
            ) : (
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
            )}
            {/* Navegação num cartão só, abaixo dos modelos: a lista inteira e
                o effort. Os dois abrem OUTRO nível desta mesma folha. */}
            <SheetGroup>
              {!locked && favorites.length > 0 && rest.length > 0 && (
                <SheetNavRow
                  title="Show list"
                  note={`${rest.length} more ${
                    rest.length === 1 ? "model" : "models"
                  }`}
                  onClick={() => setModelView("list")}
                />
              )}
              <SheetNavRow
                title="Effort"
                note={EFFORT_LABELS[effort] ?? cfg.effort}
                onClick={() => setModelView("effort")}
              />
            </SheetGroup>
          </>
        )}
      </Sheet>

      {/* O "+" abre o que dá pra ACRESCENTAR à conversa. Hoje são as skills —
          o mesmo atalho da tela inicial, alcançável no meio do papo. */}
      <Sheet title="Add to chat" open={sheet === "plus"} onClose={closeSheet}>
        <SheetGroup>
          {plugin.skills.map((sk) => (
            <SheetRow
              key={sk.id}
              title={sk.name}
              note={sk.description}
              onClick={() => {
                onUseSkill(sk);
                closeSheet();
              }}
            />
          ))}
          {plugin.skills.length === 0 && (
            <SheetNote>
              No skills yet — they live as notes in your vault, and show up here
              once you create one.
            </SheetNote>
          )}
        </SheetGroup>
      </Sheet>

      <Sheet title="Effort" open={sheet === "effort"} onClose={closeSheet}>
        <SheetGroup>
          {EFFORT_LEVELS.map((l) => (
            <SheetRow
              key={l}
              title={EFFORT_LABELS[l]}
              note={EFFORT_DESCRIPTIONS[l]}
              tag={l === plugin.settings.defaultEffort ? "Default" : undefined}
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
      title={prettyModelName(model)}
      note={card.goodFor ?? card.description}
      selected={selected}
      onClick={onClick}
    />
  );
}

function Pill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="axxa-pill" onClick={onClick}>
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

/** Ouvir a resposta. O motor já tinha o TTS; faltava o botão. */
function ReadAloudButton({
  plugin,
  text,
}: {
  plugin: AxxaPlugin;
  text: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  return (
    <button
      type="button"
      className={speaking ? "axxa-msg-listen is-on" : "axxa-msg-listen"}
      aria-label={speaking ? "Stop" : "Read aloud"}
      onClick={async () => {
        if (speaking) {
          stopSpeaking();
          setSpeaking(false);
          return;
        }
        setSpeaking(true);
        await speak(plugin, text);
        setSpeaking(false);
      }}
    >
      <Icon name={speaking ? "square" : "volume-2"} size={15} />
      <span>{speaking ? "Stop" : "Listen"}</span>
    </button>
  );
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
          {plugin.settings.ttsEnabled && !msg.isError && msg.content.trim() && (
            <ReadAloudButton plugin={plugin} text={msg.content} />
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
