// .storybook/fixtures.tsx
// Mocks e dados de exemplo compartilhados pelas stories dos componentes mais
// acoplados (que dependem de `plugin`, do `app` do Obsidian, do store de chat
// ou do ChatActionsContext). Mantém as stories enxutas e consistentes.

import type { Decorator } from "@storybook/react-vite";
import { fn } from "storybook/test";
import {
  ChatActionsContext,
  type ChatActions,
} from "../src/components/chat/ChatActionsContext";
import { useChatStore, type ChatMessage } from "../src/store/chat";
import type { ChatSummary } from "../src/components/_shared/chatPersistence";
import type { Project } from "../src/projects";
import type AxxaPlugin from "../src/main";

/* ------------------------------ mock plugin ----------------------------- */
// Superfície mínima de AxxaPlugin que os componentes leem ao renderizar. Cast
// via unknown porque a classe real tem dezenas de campos que as stories não
// tocam.
export const mockPlugin = {
  settings: {
    language: "en-us",
    density: "normal",
    motion: "wave",
    background: "none",
    defaultProvider: "openai",
    defaultModel: "gpt-4o",
    openaiApiKey: "",
    anthropicApiKey: "",
    geminiApiKey: "",
    openrouterApiKey: "",
    nimApiKey: "",
    ollamaEndpoint: "",
    ragEmbeddingModel: "",
  },
  manifest: { version: "0.1.236" },
  fetchModelInfo: async () => null,
  vectorIndex: null,
  chatSummaries: [] as ChatSummary[],
  loadChatSummaries: async () => [] as ChatSummary[],
  onSettingsChange: () => () => {},
  onChatsChange: () => () => {},
  saveSettings: async () => {},
} as unknown as AxxaPlugin;

/* --------------------------- mocks de mídia ----------------------------- */
// CameraModal/PlusModal usam getUserMedia; o Composer usa MediaRecorder. Aqui
// fornecemos stubs pra a UI funcionar no Storybook sem hardware/permissão real.
export function installMediaMocks(): void {
  const makeStream = () =>
    typeof MediaStream !== "undefined"
      ? new MediaStream()
      : ({ getTracks: () => [], getVideoTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream);

  const md = (navigator.mediaDevices ?? ({} as MediaDevices)) as MediaDevices & Record<string, unknown>;
  md.getUserMedia = (async () => makeStream()) as MediaDevices["getUserMedia"];
  try {
    Object.defineProperty(navigator, "mediaDevices", { value: md, configurable: true });
  } catch {
    /* já definido */
  }

  if (typeof (globalThis as Record<string, unknown>).MediaRecorder === "undefined") {
    class MR {
      state = "inactive";
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob() });
        this.onstop?.();
      }
      static isTypeSupported() {
        return true;
      }
    }
    (globalThis as Record<string, unknown>).MediaRecorder = MR;
  }
}

/** Instala os mocks de mídia antes de renderizar (câmera/gravação). */
export const withMediaMocks: Decorator = (Story) => {
  installMediaMocks();
  return <Story />;
};

/* -------------------------------- mock app ------------------------------ */
// `App` do Obsidian para componentes que recebem `app` por prop (ex.: MediaScreen).
export const mockObsidianApp = {
  vault: {
    getFiles: () => [],
    getMarkdownFiles: () => [],
    getResourcePath: () => "",
    getAbstractFileByPath: () => null,
    cachedRead: async () => "",
    adapter: { exists: async () => false },
  },
  workspace: {
    openLinkText: () => {},
    getLeaf: () => ({ openFile: async () => {} }),
  },
  metadataCache: { getFirstLinkpathDest: () => null },
} as never;

/* ----------------------------- chat actions ----------------------------- */
export const mockChatActions: ChatActions = {
  regenerate: fn(),
  deleteMessage: fn(),
  continueResponse: fn(),
  editMessage: fn(),
  retryError: fn(),
  openSettings: fn(),
  saveResponseAsNote: fn(),
};

/** Provê o ChatActionsContext (UserBubble / AIResponse / ErrorMessage exigem). */
export const withChatActions: Decorator = (Story) => (
  <ChatActionsContext.Provider value={mockChatActions}>
    <Story />
  </ChatActionsContext.Provider>
);

/** Semeia o store de chat (ChatArea lê `messages` do store). Idempotente. */
export const withChatStore =
  (messages: ChatMessage[]): Decorator =>
  (Story) => {
    useChatStore.setState({ messages, streamingMessageId: null }, false);
    return <Story />;
  };

/* ------------------------------- fixtures ------------------------------- */

let summaryN = 0;
const day = (offsetDays: number): string =>
  new Date(2026, 5, 23 - offsetDays, 10, 0, 0).toISOString();

export function makeSummary(over: Partial<ChatSummary> = {}): ChatSummary {
  summaryN += 1;
  return {
    id: `chat-${summaryN}`,
    title: `Conversa de exemplo ${summaryN}`,
    date: day(summaryN % 5),
    mode: ["chat", "vault-qa", "agent"][summaryN % 3],
    provider: "openai",
    model: "gpt-4o",
    effort: "med",
    tokensIn: 1200 + summaryN * 30,
    tokensOut: 800 + summaryN * 20,
    messageCount: 4 + (summaryN % 6),
    filePath: `axxa-ai/chats/chat/chat-${summaryN}.md`,
    ...over,
  };
}

export const SUMMARIES: ChatSummary[] = [
  makeSummary({ title: "Resumo do artigo sobre RAG", mode: "chat" }),
  makeSummary({ title: "O que minhas notas dizem sobre hábitos", mode: "vault-qa" }),
  makeSummary({ title: "Organizar a pasta de projetos", mode: "agent" }),
  makeSummary({ title: "Brainstorm de nomes", mode: "chat" }),
  makeSummary({ title: "Plano de estudos de TypeScript", mode: "chat" }),
  makeSummary({ title: "Conectar ideias entre as notas", mode: "vault-qa" }),
];

export const PROJECTS: Project[] = [
  {
    id: "proj-1",
    name: "Pesquisa de Mestrado",
    icon: "graduation-cap",
    color: "#7c5cff",
    sources: ["Referências/Paper RAG.md", "Notas/Resumo.md"],
    chatIds: ["chat-1", "chat-5"],
    createdAt: day(20),
  },
  {
    id: "proj-2",
    name: "Lançamento do Produto",
    icon: "rocket",
    color: "#e9973f",
    sources: ["Marketing/Plano.md"],
    chatIds: ["chat-3"],
    createdAt: day(10),
  },
  {
    id: "proj-3",
    name: "Vault pessoal",
    icon: "notebook",
    color: "default",
    sources: [],
    chatIds: [],
    createdAt: day(2),
  },
];
