// AppFlow.stories.tsx — FLUXO COMPLETO com TODAS as telas conectadas e navegáveis.
// Header + Chat (NewChatScreen/ChatArea/Composer real) + Sidebar + ConversationsList
// + ModelSheet + SuggestionsSheet + PlusModal + VoiceScreen + SkillsScreen +
// InspireScreen + MediaScreen + StatisticsScreen + ProfileScreen + PlansScreen +
// ProjectsListScreen → ProjectDetailScreen → ProjectEditor.
//
// Ligados ao store de chat real + motor de IA FAKE que faz streaming.
// Navegação: a gaveta (avatar) abre a Sidebar → escolha a tela; cada tela tem
// onClose/onBack que volta pro chat. Overlays (voz/skills/inspire/plus) coexistem.
import { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Header } from "../components/layout/Header";
import { Sidebar } from "../components/layout/Sidebar";
import { ChatArea } from "../components/chat/ChatArea";
import { ConversationsList } from "../components/chat/ConversationsList";
import { NewChatScreen } from "../components/chat/NewChatScreen";
import { Composer } from "../components/composer/Composer";
import { ModelSheet } from "../components/composer/ModelSheet";
import { SuggestionsSheet } from "../components/composer/SuggestionsSheet";
import { PlusModal } from "../components/composer/PlusModal";
import { VoiceScreen } from "../components/chat/VoiceScreen";
import { SkillsScreen } from "../components/chat/SkillsScreen";
import { InspireScreen } from "../components/chat/InspireScreen";
import {
  MediaScreen,
  StatisticsScreen,
  ProfileScreen,
  PlansScreen,
} from "../components/screens/Screens";
import {
  ProjectsListScreen,
  ProjectDetailScreen,
  ProjectEditor,
} from "../components/screens/Projects";
import {
  ChatActionsContext,
  type ChatActions,
} from "../components/chat/ChatActionsContext";
import { useChatStore, type ChatMessage } from "../store/chat";
import { generateTitle } from "../components/_shared/chatPersistence";
import { mockPlugin, mockObsidianApp, SUMMARIES, PROJECTS } from "../../.storybook/fixtures";
import type { AppView } from "../entitlements";
import type { Project } from "../projects";
import type { Skill } from "../skills/skills";

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
      "*Diário/2026-06.md*.",
  ],
  agent: [
    "Pronto — criei a nota e adicionei os links. Veja os passos acima.",
    "Organizei a pasta: movi 3 arquivos e renomeei 2 para o padrão `kebab-case`.",
  ],
};
const pickReply = (mode: string): string => {
  const pool = REPLIES[mode] ?? REPLIES.chat;
  return pool[Math.floor(Math.random() * pool.length)];
};
const tokenize = (s: string): string[] => s.match(/\S+\s*/g) ?? [s];

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

const SKILLS: Skill[] = [
  {
    id: "blog",
    name: "Rascunho de post",
    description: "Transforma um tópico em rascunho estruturado.",
    icon: "pen-line",
    mode: "chat",
    body: "Escreva um rascunho de post sobre: ",
    path: "axxa-ai/skills/blog.md",
  },
  {
    id: "review",
    name: "Revisão diária",
    description: "Resume e organiza as notas do dia.",
    icon: "calendar-check",
    mode: "vault-qa",
    body: "Revise minhas notas de hoje e liste as ações.",
    path: "axxa-ai/skills/review.md",
  },
];

/* ------------------------------- o app ---------------------------------- */

function FlowApp({ preload }: { preload?: boolean }) {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const currentChatTitle = useChatStore((s) => s.currentChatTitle);
  const sessionModel = useChatStore((s) => s.sessionModel);
  const tokensIn = useChatStore((s) => s.tokensIn);
  const tokensOut = useChatStore((s) => s.tokensOut);
  const tokensPerSec = useChatStore((s) => s.tokensPerSec);

  const [view, setView] = useState<AppView>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [inspireOpen, setInspireOpen] = useState(false);

  const [projects, setProjects] = useState<Project[]>(PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectEditor, setProjectEditor] = useState<null | { project?: Project }>(null);

  const [mode, setMode] = useState("chat");
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o");
  const [effort, setEffort] = useState("med");
  const [favorites, setFavorites] = useState<string[]>(["openai::gpt-4o", "openai::o3-mini"]);
  const [draftEmpty, setDraftEmpty] = useState(true);
  const [inject, setInject] = useState<{ text: string; nonce: number } | undefined>(undefined);

  const [voiceURI, setVoiceURI] = useState("");
  const [voiceRate, setVoiceRate] = useState(1);
  const [voiceIntroDone, setVoiceIntroDone] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");

  const timer = useRef<number | null>(null);

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
  const injectPrompt = (text: string) =>
    setInject((prev) => ({ text, nonce: (prev?.nonce ?? 0) + 1 }));

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
      window.setTimeout(
        () => useChatStore.getState().updateActivity(cId, { phase: "done" }, "Vault lido — 3 notas"),
        900
      );
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
    window.setTimeout(() => startReply(mode), 120);
  };

  const handleStop = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    const s = useChatStore.getState();
    s.setStreamingMessageId(null);
    s.setLoading(false);
    s.endStreamTimer();
  };

  const loadCanned = (chatId: string) => {
    const summary = SUMMARIES.find((c) => c.id === chatId);
    const s = useChatStore.getState();
    s.setMessages(CANNED.map((m) => ({ ...m, id: `${chatId}-${m.id}` })));
    s.setCurrentChatId(chatId);
    s.setCurrentChatTitle(summary?.title ?? "Conversa");
    s.lockSession(summary?.provider ?? "openai", summary?.model ?? "gpt-4o", summary?.mode ?? "chat");
    setSelectedProjectId(null);
    setSidebarOpen(false);
    setView("chat");
  };

  const resetChat = () => {
    if (timer.current) window.clearInterval(timer.current);
    useChatStore.getState().newChat();
    setSelectedProjectId(null);
    setSidebarOpen(false);
    setView("chat");
  };

  const handleNavigate = (v: AppView) => {
    setSelectedProjectId(null);
    setView(v);
    setSidebarOpen(false);
  };

  const chatActions: ChatActions = {
    regenerate: (aiId) => {
      const st = useChatStore.getState();
      const idx = st.messages.findIndex((m) => m.id === aiId);
      if (idx < 0) return;
      st.setMessages(st.messages.slice(0, idx + 1));
      st.beginVariant(aiId);
      streamInto(aiId, pickReply(mode), () => useChatStore.getState().syncVariant(aiId));
    },
    continueResponse: (aiId) =>
      streamInto(aiId, " E, complementando: vale revisar os exemplos antes de aplicar."),
    deleteMessage: (id) => {
      const st = useChatStore.getState();
      const idx = st.messages.findIndex((m) => m.id === id);
      if (idx < 0) return;
      const next = st.messages[idx + 1];
      if (st.messages[idx].type === "user" && next?.type === "ai-response") {
        st.setMessages([...st.messages.slice(0, idx), ...st.messages.slice(idx + 2)]);
      } else st.removeMessage(id);
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
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  /* tela principal conforme `view` */
  const renderMainView = () => {
    if (view === "conversations")
      return (
        <ConversationsList
          chats={SUMMARIES}
          onLoadChat={loadCanned}
          onClose={() => setView("chat")}
          visibleChips={["provider", "model", "tokens"]}
          onRenameChat={() => {}}
          onDeleteChat={() => {}}
          onNewChat={resetChat}
        />
      );

    if (view === "media")
      return (
        <MediaScreen
          app={mockObsidianApp}
          axxaPaths={["axxa-ai/generation", "axxa-ai/recordings"]}
          onClose={() => setView("chat")}
        />
      );

    if (view === "statistics")
      return (
        <StatisticsScreen summaries={SUMMARIES} onOpenUsage={() => {}} onClose={() => setView("chat")} />
      );

    if (view === "profile")
      return (
        <ProfileScreen
          tier="pro"
          email="voce@exemplo.com"
          connectedProviders={["openai", "anthropic"]}
          totalChats={SUMMARIES.length}
          onClose={() => setView("chat")}
          onOpenPlans={() => setView("plans")}
          onOpenSettings={() => {}}
        />
      );

    if (view === "plans")
      return (
        <PlansScreen
          tier="pro"
          license={licenseKey}
          onSetLicense={setLicenseKey}
          onClose={() => setView("chat")}
        />
      );

    if (view === "projects") {
      if (selectedProject)
        return (
          <ProjectDetailScreen
            project={selectedProject}
            chats={SUMMARIES.filter((s) => selectedProject.chatIds.includes(s.id))}
            onBack={() => setSelectedProjectId(null)}
            onEdit={() => setProjectEditor({ project: selectedProject })}
            onNewChat={resetChat}
            onOpenChat={loadCanned}
            onAddSource={() => {}}
            onRemoveSource={() => {}}
            onOpenSource={() => {}}
          />
        );
      return (
        <ProjectsListScreen
          projects={projects}
          onOpen={(id) => setSelectedProjectId(id)}
          onCreate={() => setProjectEditor({})}
          onClose={() => setView("chat")}
        />
      );
    }

    // chat (default)
    return (
      <>
        <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
          {isEmpty ? (
            <NewChatScreen
              mode={mode}
              plugin={mockPlugin}
              provider={provider}
              onProviderChange={setProvider}
              onOpenSettings={() => {}}
              onPickSuggestion={injectPrompt}
              onSeeMoreSuggestions={() => setSuggestOpen(true)}
              showSuggestions={draftEmpty}
            />
          ) : (
            <ChatArea />
          )}
        </div>
        <Composer
          onSend={handleSend}
          onStop={handleStop}
          streaming={isLoading}
          providerName={provider}
          modelName={activeModel}
          effort={effort}
          tokensIn={tokensIn}
          tokensOut={tokensOut}
          tokensPerSec={tokensPerSec}
          contextUsed={tokensIn + tokensOut}
          locked={isLocked}
          mode={mode}
          visibleChips={["provider", "model", "effort", "tokens", "context"]}
          visionEnabled
          onPlusClick={() => setPlusOpen(true)}
          onOpenModel={() => setModelSheetOpen(true)}
          onOpenVoice={() => setVoiceOpen(true)}
          onDraftChange={(t) => setDraftEmpty(t.trim() === "")}
          injectText={inject}
          commands={[]}
        />
      </>
    );
  };

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
        onSelectModel={setModel}
        modelLocked={isLocked}
        onOpenVoice={() => setVoiceOpen(true)}
      />

      {renderMainView()}

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
        onNavigate={handleNavigate}
        tier="pro"
        onDeleteChat={() => {}}
        activeView={view}
        version="0.1.236"
        founder
      />

      {projectEditor && (
        <ProjectEditor
          initial={projectEditor.project}
          onSave={(data) => {
            if (projectEditor.project) {
              const id = projectEditor.project.id;
              setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
            } else {
              setProjects((prev) => [
                ...prev,
                { id: `proj-${Date.now()}`, ...data, sources: [], chatIds: [], createdAt: new Date().toISOString() },
              ]);
            }
            setProjectEditor(null);
          }}
          onDelete={
            projectEditor.project
              ? () => {
                  const id = projectEditor.project!.id;
                  setProjects((prev) => prev.filter((p) => p.id !== id));
                  setSelectedProjectId(null);
                  setProjectEditor(null);
                }
              : undefined
          }
          onClose={() => setProjectEditor(null)}
        />
      )}

      {voiceOpen && (
        <VoiceScreen
          onSend={handleSend}
          onClose={() => setVoiceOpen(false)}
          lastAi={null}
          isStreaming={isLoading}
          lang="en-us"
          voiceURI={voiceURI}
          voiceRate={voiceRate}
          onChangeVoice={setVoiceURI}
          onChangeRate={setVoiceRate}
          introDone={voiceIntroDone}
          onIntroDone={() => setVoiceIntroDone(true)}
        />
      )}

      {skillsOpen && (
        <SkillsScreen
          skills={SKILLS}
          onUse={(skill) => {
            injectPrompt(skill.body || "");
            setSkillsOpen(false);
          }}
          onOpenNote={() => {}}
          onClose={() => setSkillsOpen(false)}
        />
      )}

      {inspireOpen && (
        <InspireScreen
          onPick={(prompt) => {
            injectPrompt(prompt);
            setInspireOpen(false);
          }}
          onClose={() => setInspireOpen(false)}
        />
      )}

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
          onSelectEffort={setEffort}
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
            injectPrompt(t);
            setSuggestOpen(false);
          }}
          onClose={() => setSuggestOpen(false)}
        />
      )}

      {plusOpen && (
        <PlusModal
          currentEffort={effort}
          onSelectEffort={setEffort}
          onClose={() => setPlusOpen(false)}
          visionEnabled
          imageGenEnabled
          createImageAvailable
          responseStyle="normal"
          toggles={{ webSearch: false, createImage: false, extendedThinking: true }}
          onAttachPicked={() => {}}
          onToggle={() => {}}
          onCreateImage={() => {}}
          onSelectStyle={() => {}}
          onExploreSkills={() => {
            setPlusOpen(false);
            setSkillsOpen(true);
          }}
        />
      )}
    </ChatActionsContext.Provider>
  );
}

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
          "FLUXO completo e NAVEGÁVEL com os componentes REAIS (Composer com CodeMirror) " +
          "+ todas as telas conectadas: chat, conversations, media, statistics, profile, " +
          "plans, projects (lista→detalhe→editor) e os overlays voz/skills/inspire/plus. " +
          "A gaveta (avatar) abre a navegação; cada tela volta pro chat. Motor de IA fake " +
          "com streaming. Toolbar Theme/Background/Density/Motion afeta tudo.",
      },
    },
  },
} satisfies Meta<typeof FlowApp>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Começa numa conversa nova (sugestões). Digite e envie; abra a gaveta e navegue. */
export const NewConversation: Story = { args: { preload: false } };

/** Já começa com uma conversa carregada — continue mandando mensagens. */
export const WithConversation: Story = { args: { preload: true } };
