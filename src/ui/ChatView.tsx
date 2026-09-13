// src/ui/ChatView.tsx
// A tela do chat: barra do topo (menu · título · nova conversa), o corpo
// (StarterScreen enquanto vazio, timeline depois) e o composer. O MODO se
// escolhe na tela inicial; provider e modelo ficam nos pills do composer e
// somem quando a sessão trava (1º envio) — o effort continua livre sempre.
//
// O histórico de conversas NÃO mora aqui: é o menu lateral (Drawer.tsx).

import { useEffect, useMemo, useRef, useState } from "react";
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
import type { AIToolStep } from "../agent/types";
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
  /** Ações do agente abertas na folha (null = fechada) e qual delas está
   *  aberta no segundo nível. */
  const [tools, setTools] = useState<TurnAction[] | null>(null);
  const [toolAt, setToolAt] = useState<number | null>(null);
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

  // As narrações ("Listed root — 7 items") de uma rodada JÁ TERMINADA saem da
  // conversa e vão pra folha, junto das tool calls: elas são o passo a passo,
  // e passo a passo é auditoria. A que ainda está rodando FICA — é ela que diz
  // que tem coisa acontecendo.
  const { hiddenIds, actionsByResponse } = useMemo(() => {
    const hiddenIds = new Set<string>();
    const actionsByResponse = new Map<string, TurnAction[]>();
    let bucket: ChatMessage[] = [];
    for (const m of messages) {
      if (m.type === "ai-comment" && m.activity) {
        bucket.push(m);
        continue;
      }
      if (m.type === "ai-response") {
        const narradas: TurnAction[] = bucket
          .map((c) =>
            c.type === "ai-comment" && c.activity
              ? ({ kind: "activity", activity: c.activity } as TurnAction)
              : null
          )
          .filter((a): a is TurnAction => a !== null);
        const passos: TurnAction[] = (m.agentSteps ?? []).map((step) => ({
          kind: "step",
          step,
        }));
        const todas = [...narradas, ...passos];
        if (todas.length > 0) actionsByResponse.set(m.id, todas);
        for (const c of bucket) hiddenIds.add(c.id);
        bucket = [];
      } else if (m.type === "user") {
        bucket = [];
      }
    }
    return { hiddenIds, actionsByResponse };
  }, [messages]);

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
          <StarterScreen plugin={plugin} session={session} />
        ) : (
          messages
            .filter((m) => !hiddenIds.has(m.id))
            .map((m) => (
            <MessageRow
              key={m.id}
              msg={m}
              plugin={plugin}
              streaming={m.id === streamingId}
              actions={actionsByResponse.get(m.id)}
              onOpenTools={(acoes) => {
                setTools(acoes);
                // Lista de UM item é uma parada a mais sem informação: abre
                // direto no detalhe.
                setToolAt(acoes.length === 1 ? 0 : null);
              }}
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

      {/* O que o agente fez: lista numa folha, e cada ação abre a sua com
          argumentos e resultado — o mesmo vai-e-volta da folha de modelos. */}
      <Sheet
        title={
          toolAt !== null && tools
            ? actionTitle(tools[toolAt])
            : `Ran ${tools?.length ?? 0} ${
                (tools?.length ?? 0) === 1 ? "action" : "actions"
              }`
        }
        open={tools !== null}
        onClose={() => {
          setTools(null);
          setToolAt(null);
        }}
        onBack={
          toolAt !== null && (tools?.length ?? 0) > 1
            ? () => setToolAt(null)
            : undefined
        }
      >
        {toolAt !== null && tools ? (
          <ToolDetail action={tools[toolAt]} />
        ) : (
          <SheetGroup>
            {(tools ?? []).map((a, i) => (
              <SheetRow
                key={i}
                dense
                title={actionTitle(a)}
                note={actionNote(a)}
                tag={actionFailed(a) ? "failed" : undefined}
                onClick={() => setToolAt(i)}
              />
            ))}
          </SheetGroup>
        )}
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

/** O que o agente fez numa rodada: a chamada de tool OU a narração dela. As
 *  duas coisas moram na mesma folha porque, pra quem lê, são a mesma pergunta:
 *  "o que ele fez aí?". */
export type TurnAction =
  | { kind: "step"; step: AIToolStep }
  | { kind: "activity"; activity: ActivityMeta }
  /** O raciocínio do modelo. Mesma natureza: texto gerado que interessa ter,
   *  não ter na frente. */
  | { kind: "reasoning"; text: string };

function actionTitle(a: TurnAction): string {
  if (a.kind === "step") return a.step.name;
  if (a.kind === "activity") return activityText(a.activity);
  return "Reasoning";
}

function actionNote(a: TurnAction): string | undefined {
  if (a.kind === "step") return toolSummary(a.step);
  if (a.kind === "reasoning") return `${a.text.length} chars`;
  return undefined;
}

function actionFailed(a: TurnAction): boolean {
  if (a.kind === "step") return !a.step.ok;
  if (a.kind === "activity") return a.activity.phase === "failed";
  return false;
}

/** Resumo de uma linha dos argumentos — o suficiente pra reconhecer a ação. */
function toolSummary(step: AIToolStep): string {
  const args = Object.entries(step.arguments ?? {});
  if (args.length === 0) return step.ok ? "done" : "failed";
  const [chave, valor] = args[0];
  const texto = typeof valor === "string" ? valor : JSON.stringify(valor);
  return `${chave}: ${texto}`.slice(0, 80);
}

/** Detalhe de uma ação: o que foi pedido e o que voltou. */
function ToolDetail({ action }: { action: TurnAction }) {
  const ok = !actionFailed(action);
  return (
    <div className="axxa-tool-detail">
      {action.kind !== "reasoning" && (
        <p className={ok ? "axxa-tool-state is-ok" : "axxa-tool-state"}>
          <Icon name={ok ? "check" : "x"} size={14} />
          {ok ? "Completed" : "Failed"}
        </p>
      )}
      {action.kind === "step" ? (
        <>
          <p className="axxa-tool-label">Arguments</p>
          <pre className="axxa-tool-block">
            {JSON.stringify(action.step.arguments ?? {}, null, 2)}
          </pre>
          <p className="axxa-tool-label">Result</p>
          <pre className="axxa-tool-block">
            {action.step.result || "(empty)"}
          </pre>
        </>
      ) : action.kind === "activity" ? (
        <>
          <p className="axxa-tool-label">What happened</p>
          <pre className="axxa-tool-block">
            {action.activity.detail || activityText(action.activity)}
          </pre>
        </>
      ) : (
        <pre className="axxa-tool-block is-prose">{action.text}</pre>
      )}
    </div>
  );
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
  actions,
  onOpenTools,
}: {
  msg: ChatMessage;
  plugin: AxxaPlugin;
  streaming: boolean;
  /** Tudo que o agente fez nesta rodada — narrações + tool calls. */
  actions?: TurnAction[];
  onOpenTools?: (actions: TurnAction[]) => void;
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
            <button
              type="button"
              className="axxa-tools-chip"
              onClick={() =>
                onOpenTools?.([{ kind: "reasoning", text: msg.reasoning ?? "" }])
              }
            >
              <span>Reasoning</span>
              <Icon name="chevron-right" size={15} />
            </button>
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
          {actions && actions.length > 0 && (
            // O que o agente FEZ vira um chip: quem quer ver abre a folha, e
            // quem não quer não leva um <details> no meio da leitura.
            <button
              type="button"
              className="axxa-tools-chip"
              onClick={() => onOpenTools?.(actions)}
            >
              <span>
                Ran {actions.length}{" "}
                {actions.length === 1 ? "action" : "actions"}
              </span>
              <Icon name="chevron-right" size={15} />
            </button>
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
            // Mesmo caminho de tudo o mais: abre na folha. Um <details> aqui
            // empurrava a conversa toda pra baixo no meio de uma rodada.
            <button
              type="button"
              className="axxa-tools-chip is-inline"
              onClick={() =>
                msg.activity &&
                onOpenTools?.([{ kind: "activity", activity: msg.activity }])
              }
            >
              <span>details</span>
              <Icon name="chevron-right" size={14} />
            </button>
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
