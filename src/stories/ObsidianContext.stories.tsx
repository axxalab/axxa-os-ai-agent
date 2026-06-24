// ObsidianContext.stories.tsx — a view do AXXA DENTRO do "chrome" do Obsidian:
// cabeçalho do drawer em cima e a barra de navegação (mobile-navbar) embaixo —
// como aparece no Obsidian mobile.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Header } from "../components/layout/Header";
import { ChatArea } from "../components/chat/ChatArea";
import { Icon } from "../components/_shared/Icon";
import { withChatActions, withChatStore } from "../../.storybook/fixtures";
import { useChatStore, type ChatMessage } from "../store/chat";

const TS = Date.now();
const CONVERSATION: ChatMessage[] = [
  { id: "u1", type: "user", content: "Resuma minhas notas sobre hábitos.", timestamp: TS },
  {
    id: "a1",
    type: "ai-response",
    content:
      "Pelas suas notas: você associa **hábitos** a *gatilhos* e *recompensas*. " +
      "O ponto recorrente é começar pequeno e medir.",
    timestamp: TS + 1000,
    reaction: "like",
  },
];

const NAV = [
  { icon: "folder", label: "Files" },
  { icon: "search", label: "Search" },
  { icon: "bot", label: "AXXA", active: true },
  { icon: "bookmark", label: "Bookmarks" },
  { icon: "menu", label: "Menu" },
];

function ObsidianWindow() {
  // Sincroniza o título do header com o chat carregado.
  const title = useChatStore((s) => s.currentChatTitle);
  return (
    <div className="axxa-ob-window">
      {/* Cabeçalho do drawer (nativo do Obsidian) */}
      <div className="workspace-drawer-header">
        <span className="clickable-icon"><Icon name="menu" /></span>
        <span className="titlebar-text">AXXA OS</span>
        <span className="clickable-icon"><Icon name="more-horizontal" /></span>
      </div>

      {/* Conteúdo da aba ativa = a view do AXXA */}
      <div className="workspace-drawer-active-tab-content">
        <Header
          version="0.1.236"
          chatTitle={title}
          onOpenSettings={() => {}}
          onNewChat={() => {}}
          onOpenSidebar={() => {}}
          onRenameChat={() => {}}
          onToggleSearch={() => {}}
          searchActive={false}
          onCopyConversation={() => {}}
          canCopy
          onEditPersona={() => {}}
          personaActive={false}
          modelName="gpt-4o"
          modelOptions={["gpt-4o", "o3-mini"]}
          onSelectModel={() => {}}
          modelLocked
          onOpenVoice={() => {}}
        />
        <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
          <ChatArea />
        </div>
      </div>

      {/* A BARRA DEBAIXO do drawer — mobile-navbar nativo do Obsidian */}
      <nav className="mobile-navbar">
        {NAV.map((n) => (
          <button key={n.label} className={"mobile-navbar-action" + (n.active ? " is-active" : "")}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

const meta = {
  title: "Obsidian/In Context",
  component: ObsidianWindow,
  decorators: [withChatActions, withChatStore(CONVERSATION)],
  parameters: {
    layout: "fullscreen",
    axxaFrame: { width: 390, height: 740 },
    controls: { disable: true },
    a11y: { test: "off" },
    docs: {
      description: {
        component:
          "A view do AXXA renderizada dentro do 'chrome' do Obsidian mobile: o " +
          "cabeçalho do workspace-drawer em cima e a barra de navegação inferior " +
          "(mobile-navbar) embaixo — os elementos nativos do Obsidian em volta do plugin.",
      },
    },
  },
} satisfies Meta<typeof ObsidianWindow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MobileDrawer: Story = {};
