// storybook/stories.tsx
// Registro de stories: cada uma monta um componente real do plugin com dados
// mock. O shell (main.tsx) cuida de tema/densidade/viewport.

import { useState, type ReactNode } from "react";
import { useChatStore } from "../src/store/chat";
import { NewChatScreen } from "../src/components/chat/NewChatScreen";
import { ChatArea } from "../src/components/chat/ChatArea";
import { ConversationsList } from "../src/components/chat/ConversationsList";
import { Composer } from "../src/components/composer/Composer";
import { ModelSheet } from "../src/components/composer/ModelSheet";
import { Header } from "../src/components/layout/Header";
import { Sidebar } from "../src/components/layout/Sidebar";
import {
  StatisticsScreen,
  OnboardingScreen,
  PlansScreen,
  ProfileScreen,
  LockedScreen,
} from "../src/components/screens/Screens";
import { ProjectsListScreen } from "../src/components/screens/Projects";
import {
  ChatActionsContext,
  type ChatActions,
} from "../src/components/chat/ChatActionsContext";
import { mockPlugin, mockChats, mockMessages, mockErrorMessage } from "./mock";

const noop = () => {};

const mockChatActions: ChatActions = {
  regenerate: noop,
  deleteMessage: noop,
  continueResponse: noop,
  editMessage: noop,
  retryError: noop,
  openSettings: noop,
  saveResponseAsNote: noop,
};

export interface Story {
  id: string;
  title: string;
  group: string;
  render: () => ReactNode;
}

/** Composer com props default (reusado em várias stories). */
function ComposerMock({ mode = "chat", streaming = false }: { mode?: string; streaming?: boolean }) {
  return (
    <Composer
      onSend={noop}
      onStop={noop}
      onPlusClick={noop}
      onOpenModel={noop}
      onOpenVoice={noop}
      streaming={streaming}
      providerName="OpenAI"
      modelName="gpt-5"
      effort="med"
      tokensIn={5230}
      tokensOut={1810}
      tokensPerSec={streaming ? 42 : 0}
      contextUsed={7040}
      mode={mode}
      placeholder="Message AXXA…"
      visibleChips={["model", "effort", "speed", "in", "out"]}
      visionEnabled
      commands={[]}
    />
  );
}

function ChatStory({ withError = false }: { withError?: boolean }) {
  const msgs = withError ? [...mockMessages, mockErrorMessage] : mockMessages;
  useChatStore.setState({ messages: msgs });
  return (
    <ChatActionsContext.Provider value={mockChatActions}>
      <Header
        version="0.1.236"
        chatTitle="Pesquisa de usuários"
        onOpenSettings={noop}
        onNewChat={noop}
        onOpenSidebar={noop}
        onRenameChat={noop}
        onToggleSearch={noop}
        searchActive={false}
        onCopyConversation={noop}
        canCopy
        onEditPersona={noop}
        personaActive={false}
        modelName="gpt-5"
        modelOptions={["gpt-5", "gpt-4o", "o3"]}
        onSelectModel={noop}
        modelLocked
        onOpenVoice={noop}
      />
      <ChatArea />
      <ComposerMock />
    </ChatActionsContext.Provider>
  );
}

function SidebarStory() {
  return (
    <Sidebar
      open
      onClose={noop}
      chats={mockChats}
      onLoadChat={noop}
      onNewChatMode={noop}
      onOpenAll={noop}
      onOpenSettings={noop}
      onNavigate={noop}
      tier="pro"
      onDeleteChat={noop}
      activeView="chat"
      version="0.1.236"
      founder
    />
  );
}

function NewChatStory({ mode }: { mode: string }) {
  const [provider, setProvider] = useState("openai");
  return (
    <>
      <Header
        version="0.1.236"
        chatTitle=""
        onOpenSettings={noop}
        onNewChat={noop}
        onOpenSidebar={noop}
        onRenameChat={noop}
        onToggleSearch={noop}
        searchActive={false}
        onCopyConversation={noop}
        canCopy={false}
        onEditPersona={noop}
        personaActive={false}
        modelName="gpt-5"
        modelOptions={["gpt-5", "gpt-4o", "o3"]}
        onSelectModel={noop}
        modelLocked={false}
        onOpenVoice={noop}
      />
      <NewChatScreen
        mode={mode}
        plugin={mockPlugin}
        provider={provider}
        onProviderChange={setProvider}
        onOpenSettings={noop}
        onPickSuggestion={noop}
        onSeeMoreSuggestions={noop}
        showSuggestions
      />
      <ComposerMock mode={mode} />
    </>
  );
}

export const STORIES: Story[] = [
  {
    id: "chat",
    title: "Conversa (chat ativo)",
    group: "Telas principais",
    render: () => <ChatStory />,
  },
  {
    id: "chat-error",
    title: "Conversa com erro de key",
    group: "Telas principais",
    render: () => <ChatStory withError />,
  },
  {
    id: "newchat-chat",
    title: "New chat (modo Chat)",
    group: "Telas principais",
    render: () => <NewChatStory mode="chat" />,
  },
  {
    id: "newchat-qa",
    title: "New chat (Vault Q&A)",
    group: "Telas principais",
    render: () => <NewChatStory mode="vault-qa" />,
  },
  {
    id: "newchat-agent",
    title: "New chat (Agent)",
    group: "Telas principais",
    render: () => <NewChatStory mode="agent" />,
  },
  {
    id: "sidebar",
    title: "Sidebar (gaveta)",
    group: "Navegação",
    render: () => <SidebarStory />,
  },
  {
    id: "conversations",
    title: "Lista de conversas",
    group: "Navegação",
    render: () => (
      <ConversationsList
        chats={mockChats}
        onLoadChat={noop}
        onClose={noop}
        visibleChips={["mode", "model", "date"]}
        onRenameChat={noop}
        onDeleteChat={noop}
        onNewChat={noop}
      />
    ),
  },
  {
    id: "composer-idle",
    title: "Composer (idle)",
    group: "Composer",
    render: () => (
      <div style={{ marginTop: "auto" }}>
        <ComposerMock />
      </div>
    ),
  },
  {
    id: "composer-streaming",
    title: "Composer (streaming)",
    group: "Composer",
    render: () => (
      <div style={{ marginTop: "auto" }}>
        <ComposerMock streaming />
      </div>
    ),
  },
  {
    id: "modelsheet",
    title: "Model sheet",
    group: "Composer",
    render: () => (
      <ModelSheet
        provider="openai"
        models={mockPlugin.settings.activeModels.openai}
        favorites={mockPlugin.settings.favoriteModels}
        onToggleFavorite={noop}
        currentModel="gpt-5"
        onSelectModel={noop}
        currentEffort="med"
        onSelectEffort={noop}
        thinkingOn
        onToggleThinking={noop}
        onClose={noop}
        onOpenSettings={noop}
        thinkingCapable
      />
    ),
  },
  {
    id: "onboarding",
    title: "Onboarding",
    group: "Telas secundárias",
    render: () => (
      <OnboardingScreen onOpenSettings={noop} onDismiss={noop} />
    ),
  },
  {
    id: "statistics",
    title: "Statistics",
    group: "Telas secundárias",
    render: () => (
      <StatisticsScreen summaries={mockChats} onOpenUsage={noop} onClose={noop} />
    ),
  },
  {
    id: "profile",
    title: "Profile",
    group: "Telas secundárias",
    render: () => (
      <ProfileScreen
        tier="pro"
        email="rafael@exemplo.com"
        connectedProviders={["openai", "anthropic"]}
        totalChats={42}
        onClose={noop}
        onOpenPlans={noop}
        onOpenSettings={noop}
      />
    ),
  },
  {
    id: "plans",
    title: "Plans (upsell)",
    group: "Telas secundárias",
    render: () => (
      <PlansScreen tier="free" license="" onSetLicense={noop} onClose={noop} />
    ),
  },
  {
    id: "locked",
    title: "Locked (free tier)",
    group: "Telas secundárias",
    render: () => (
      <LockedScreen view="projects" onClose={noop} onSeePlans={noop} />
    ),
  },
  {
    id: "projects",
    title: "Projects (lista)",
    group: "Telas secundárias",
    render: () => (
      <ProjectsListScreen
        projects={[]}
        onOpen={noop}
        onCreate={noop}
        onClose={noop}
      />
    ),
  },
];
