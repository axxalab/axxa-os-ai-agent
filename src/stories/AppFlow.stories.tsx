// AppFlow.stories.tsx — FLUXO COMPLETO "funcionando": os componentes reais do DS
// ligados ao store de chat de verdade, com um motor de IA FAKE que faz streaming.
// Dá pra usar de ponta a ponta dentro do Storybook: nova conversa → sugestão →
// enviar → ver a resposta streamando → reagir / regenerar / continuar → abrir a
// gaveta → navegar conversas → trocar de modelo.
//
// Não é o AxxaApp real (que é acoplado a providers/persistência/geração) — é uma
// orquestração enxuta que demonstra o DS inteiro interagindo.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Header } from "../components/layout/Header";
import { Sidebar } from "../components/layout/Sidebar";
import { ChatArea } from "../components/chat/ChatArea";
import { ConversationsList } from "../components/chat/ConversationsList";
import { NewChatScreen } from "../components/chat/NewChatScreen";
import { ModelSheet } from "../components/composer/ModelSheet";
import { SuggestionsSheet } from "../components/composer/SuggestionsSheet";
import { Icon } from "../components/_shared/Icon";
import { InfoChip } from "../components/_shared/InfoChip";
import {
  ChatActionsContext,
  type ChatActions,
} from "../components/chat/ChatActionsContext";
import { useChatStore, type ChatMessage } from "../store/chat";
import { generateTitle } from "../components/_shared/chatPersistence";
import { mockPlugin, SUMMARIES } from "../../.storybook/fixtures";

/* ----------------------------- IA fake ---------------------------------- */

const REPLIES: Record<string, string[]> = {
  chat: [
    "Claro! Em resumo: **RAG** busca trechos relevantes e os injeta no prompt, " +
      "então a resposta fica ancorada no seu material.\n\n- Recupera\n- Aumenta o contexto\n- Gera\n\nQuer um exemplo prático?",
    "Boa pergunta. Pensando em voz alta: o ponto central é equilibrar *clareza* e " +
      "*profundidade*. Eu começaria pelo objetivo e depois detalharia os passos.",
  ],
  "vault-qa": [
    "Pelas suas notas, você registrou isso em **Notas/Reunião.md**: a decisão foi " +
      "adiar o deploy para depois dos testes de carga.",
    "Cruzando as notas, há duas menções ao tema — uma em *Ideias.md* e outra em " +
      "*Diário/2026-06.md*. Ambas apontam na mesma direção.",
  ],
  agent: [
    "Pronto — criei a nota e adicionei os links. Veja os passos acima.",
    "Organizei a pasta: movi 3 arquivos e renomeei 2 para o padrão `kebab-case`.",
  ],
};

function pickReply(mode: string): string {
  const pool = REPLIES[mode] ?? REPLIES.chat;
  return pool[Math.floor(Math.random() * pool.length)];
}

const tokenize = (s: string): string[] => s.match(/\S+\s*/g) ?? [s];

/* --------------------------- conversa pré-pronta ------------------------ */

const CANNED: ChatMessage[] = [
  { id: "p1", type: "user", content: "Me explique RAG em duas frases.", timestamp: Date.now() },
  {
    id: "p2",
    type: "ai-response",
    content:
      "**RAG** busca trechos relevantes das suas notas e os injeta no prompt.\n\n" +
      "Assim a resposta fica ancorada no seu material, não só no conhecimento geral.",
    timestamp: Date.now(),
    reaction: null,
  },
];

/* ------------------------------- o app ---------------------------------- */

function FlowApp({ preload }: { preload?: boolean }) {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const currentChatTitle = useChatStore((s) => s.currentChatTitle);
  const sessionModel = useChatStore((s) => s.sessionModel);

  const [view, setView] = useState<"chat" | "conversations">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [mode, setMode] = useState("chat");
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o");
  const [effort, setEffort] = useState("med");
  const [favorites, setFavorites] = useState<string[]>(["openai::gpt-4o", "openai::o3-mini"]);
  const [draft, setDraft] = useState("");
  const timer = useRef<number | null>(null);

  const tokensIn = useChatStore((s) => s.tokensIn);
  const tokensOut = useChatStore((s) => s.tokensOut);

  // Reset ao montar a story (store é global). Opcionalmente pré-carrega.
  useEffect(() => {
    const s = useChatStore.getState();
    s.newChat();
    if (preload) {
      s.setMessages(CANNED);
      s.setCurrentChatId("demo-canned");
      s.setCurrentChatTitle("Resumo sobre RAG");
      s.lockSession("openai", "gpt-4o", "chat");
    }
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      useChatStore.getState().newChat();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preload]);

  const isLocked = sessionModel !== null;
  const activeModel = sessionModel ?? model;

  /* streaming fake de tokens dentro de uma ai-response */
  const streamInto = (aiId: string, reply: string, onDone?: () => void) => {
    const s = useChatStore.getState();
    s.setStreamingMessageId(aiId);
    s.setLoading(true);
    s.startStreamTimer();
    const tokens = tokenize(reply);
    let i = 0;
    timer.current = window.setInterval(() => {
      const st = useChatStore.getState();
      if (i >= tokens.length) {
        if (timer.current) window.clearInterval(timer.current);
        timer.current = null;
        st.setStreamingMessageId(null);
        st.setLoading(false);
        st.endStreamTimer();
        st.addUsage(Math.ceil(reply.length / 6), Math.ceil(reply.length / 4));
        onDone?.();
        return;
      }
      st.appendToMessage(aiId, tokens[i]);
      st.tickStreamTokens(tokens[i]);
      i += 1;
    }, 38);
  };

  const startReply = (modeNow: string) => {
    const s = useChatStore.getState();
    // No modo agente, mostra um "activity step" antes da resposta.
    if (modeNow === "agent") {
      const cId = s.addMessage({
        type: "ai-comment",
        content: "Lendo o vault…",
        activity: {
          phase: "pending",
          iconPending: "folder-search",
          iconDone: "check",
          pendingText: "Lendo o vault…",
          doneText: "Vault lido — 3 notas",
        },
      });
      window.setTimeout(() => {
        useChatStore.getState().updateActivity(cId, { phase: "done" }, "Vault lido — 3 notas");
      }, 900);
    }
    const aiId = s.addMessage({ type: "ai-response", content: "" });
    streamInto(aiId, pickReply(modeNow));
  };

  const handleSend = (text: string) => {
    const clean = text.trim();
    if (!clean || isLoading) return;
    const s = useChatStore.getState();
    if (s.messages.length === 0) {
      s.setCurrentChatId(`demo-${Date.now()}`);
      s.setCurrentChatTitle(generateTitle(clean));
      s.lockSession(provider, activeModel, mode);
    }
    s.addMessage({ type: "user", content: clean });
    setDraft("");
    window.setTimeout(() => startReply(mode), 120);
  };

  const loadCanned = (chatId: string) => {
    const summary = SUMMARIES.find((c) => c.id === chatId);
    const s = useChatStore.getState();
    s.setMessages(CANNED.map((m) => ({ ...m, id: `${chatId}-${m.id}` })));
    s.setCurrentChatId(chatId);
    s.setCurrentChatTitle(summary?.title ?? "Conversa");
    s.lockSession(summary?.provider ?? "openai", summary?.model ?? "gpt-4o", summary?.mode ?? "chat");
    setSidebarOpen(false);
    setView("chat");
  };

  const resetChat = () => {
    if (timer.current) window.clearInterval(timer.current);
    useChatStore.getState().newChat();
    setSidebarOpen(false);
    setView("chat");
  };

  /* ações da bolha (footer da AIResponse) ligadas ao store */
  const chatActions: ChatActions = {
    regenerate: (aiId) => {
      const st = useChatStore.getState();
      const idx = st.messages.findIndex((m) => m.id === aiId);
      if (idx < 0) return;
      st.setMessages(st.messages.slice(0, idx + 1));
      st.beginVariant(aiId);
      streamInto(aiId, pickReply(mode), () => useChatStore.getState().syncVariant(aiId));
    },
    continueResponse: (aiId) => {
      streamInto(aiId, " E, complementando: vale revisar os exemplos antes de aplicar.");
    },
    deleteMessage: (id) => {
      const st = useChatStore.getState();
      const idx = st.messages.findIndex((m) => m.id === id);
      if (idx < 0) return;
      const next = st.messages[idx + 1];
      if (st.messages[idx].type === "user" && next?.type === "ai-response") {
        st.setMessages([...st.messages.slice(0, idx), ...st.messages.slice(idx + 2)]);
      } else {
        st.removeMessage(id);
      }
    },
    editMessage: (id, content) => {
      const st = useChatStore.getState();
      const idx = st.messages.findIndex((m) => m.id === id);
      if (idx < 0) return;
      st.setMessages(st.messages.slice(0, idx));
      st.addMessage({ type: "user", content });
      window.setTimeout(() => startReply(mode), 120);
    },
    retryError: () => startReply(mode),
    openSettings: () => {},
    saveResponseAsNote: () => {},
  };

  const isEmpty = messages.length === 0;
  const canCopy = messages.some((m) => m.type === "user" || m.type === "ai-response");

  return (
    <ChatActionsContext.Provider value={chatActions}>
      <Header
        version="0.1.236"
        chatTitle={currentChatTitle}
        onOpenSettings={() => {}}
        onNewChat={resetChat}
        onOpenSidebar={() => setSidebarOpen(true)}
        onRenameChat={(t) => useChatStore.getState().setCurrentChatTitle(t)}
        onToggleSearch={() => {}}
        searchActive={false}
        onCopyConversation={() => {}}
        canCopy={canCopy}
        onEditPersona={() => {}}
        personaActive={false}
        modelName={activeModel}
        modelOptions={["gpt-4o", "gpt-4o-mini", "o3-mini"]}
        onSelectModel={(m) => setModel(m)}
        modelLocked={isLocked}
        onOpenVoice={() => {}}
      />

      {view === "conversations" ? (
        <ConversationsList
          chats={SUMMARIES}
          onLoadChat={loadCanned}
          onClose={() => setView("chat")}
          visibleChips={["provider", "model", "tokens"]}
          onRenameChat={() => {}}
          onDeleteChat={() => {}}
          onNewChat={resetChat}
        />
      ) : (
        <>
          <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
            {isEmpty ? (
              <NewChatScreen
                mode={mode}
                plugin={mockPlugin}
                provider={provider}
                onProviderChange={setProvider}
                onOpenSettings={() => {}}
                onPickSuggestion={(t) => setDraft(t)}
                onSeeMoreSuggestions={() => setSuggestOpen(true)}
                showSuggestions={draft.trim() === ""}
              />
            ) : (
              <ChatArea />
            )}
          </div>

          {/* Composer enxuto (o real usa CodeMirror — aqui um input fiel ao visual). */}
          <div
            style={{
              flex: "0 0 auto",
              borderTop: "1px solid var(--background-modifier-border)",
              padding: "8px 12px 12px",
              background: "var(--background-primary)",
            }}
          >
            <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <InfoChip icon="sparkles" color="var(--color-cyan)">{provider}</InfoChip>
              <InfoChip icon="cpu" color="var(--color-purple)">{activeModel}</InfoChip>
              <InfoChip icon="zap" color="var(--color-orange)">{effort}</InfoChip>
              <InfoChip icon="coins" color="var(--color-blue)">{tokensIn + tokensOut}</InfoChip>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                background: "var(--background-secondary)",
                border: "1px solid var(--background-modifier-border)",
                borderRadius: 14,
                padding: 8,
              }}
            >
              <button
                type="button"
                title="Trocar modelo"
                onClick={() => setModelSheetOpen(true)}
                style={btnStyle}
              >
                <Icon name="sliders-horizontal" />
              </button>
              <textarea
                value={draft}
                onChange={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(draft);
                  }
                }}
                placeholder={
                  mode === "agent"
                    ? "Peça uma ação no vault…"
                    : mode === "vault-qa"
                      ? "Pergunte às suas notas…"
                      : "Mensagem para o AXXA…"
                }
                rows={1}
                style={{
                  flex: 1,
                  resize: "none",
                  border: "none",
                  background: "transparent",
                  color: "var(--text-normal)",
                  font: "inherit",
                  outline: "none",
                  padding: "6px 4px",
                  maxHeight: 120,
                }}
              />
              <button
                type="button"
                title={isLoading ? "Parar" : "Enviar"}
                onClick={() => (isLoading ? null : handleSend(draft))}
                style={{
                  ...btnStyle,
                  background: "var(--interactive-accent)",
                  color: "var(--text-on-accent)",
                }}
              >
                <Icon name={isLoading ? "square" : "arrow-up"} />
              </button>
            </div>
          </div>
        </>
      )}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        chats={SUMMARIES}
        onLoadChat={loadCanned}
        onNewChatMode={(m) => {
          setMode(m);
          resetChat();
        }}
        onOpenAll={() => {
          setSidebarOpen(false);
          setView("conversations");
        }}
        onOpenSettings={() => {}}
        onNavigate={() => setSidebarOpen(false)}
        tier="pro"
        onDeleteChat={() => {}}
        activeView="chat"
        version="0.1.236"
        founder
      />

      {modelSheetOpen && (
        <ModelSheet
          provider={provider}
          models={["gpt-4o", "gpt-4o-mini", "o3-mini", "o1", "dall-e-3"]}
          favorites={favorites}
          onToggleFavorite={(m) => {
            const key = `${provider}::${m}`;
            setFavorites((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
          }}
          currentModel={model}
          onSelectModel={(m) => {
            setModel(m);
            setModelSheetOpen(false);
          }}
          currentEffort={effort}
          onSelectEffort={(lvl) => setEffort(lvl)}
          thinkingOn={false}
          onToggleThinking={() => {}}
          onClose={() => setModelSheetOpen(false)}
          thinkingCapable
          lang="en-us"
        />
      )}

      {suggestOpen && (
        <SuggestionsSheet
          mode={mode}
          onPick={(t) => {
            setDraft(t);
            setSuggestOpen(false);
          }}
          onClose={() => setSuggestOpen(false)}
        />
      )}
    </ChatActionsContext.Provider>
  );
}

const btnStyle: CSSProperties = {
  flex: "0 0 auto",
  width: 36,
  height: 36,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  border: "none",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};

/* ------------------------------- meta ----------------------------------- */

const meta = {
  title: "Flows/Full App",
  component: FlowApp,
  parameters: {
    layout: "fullscreen",
    axxaFrame: { width: 420, height: 760 },
    controls: { disable: true },
    a11y: { test: "off" },
    docs: {
      description: {
        component:
          "FLUXO completo e interativo: os componentes reais do DS ligados ao store " +
          "de chat, com um motor de IA FAKE que faz streaming. Experimente: escolha " +
          "uma sugestão (ou digite) e envie → veja a resposta streamar → use o footer " +
          "(copiar/regenerar/like) → abra a gaveta (avatar) → 'ver todas' → troque o " +
          "modelo (ícone à esquerda do composer). Troque tema/densidade/motion pela toolbar.",
      },
    },
  },
} satisfies Meta<typeof FlowApp>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Começa numa conversa nova (tela de sugestões). Digite e envie. */
export const NewConversation: Story = {
  args: { preload: false },
};

/** Já começa com uma conversa carregada — continue mandando mensagens. */
export const WithConversation: Story = {
  args: { preload: true },
};
