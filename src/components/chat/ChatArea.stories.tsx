// ChatArea.stories.tsx — a área de mensagens completa (lê o store de chat).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatArea } from "./ChatArea";
import { withChatActions, withChatStore } from "../../../.storybook/fixtures";
import type { ChatMessage } from "../../store/chat";

const TS = new Date(2026, 5, 23, 14, 30).getTime();

const CONVERSATION: ChatMessage[] = [
  { id: "u1", type: "user", content: "Me explique RAG em duas frases.", timestamp: TS },
  {
    id: "a1",
    type: "ai-response",
    content:
      "**RAG** busca trechos relevantes das suas notas e os injeta no prompt.\n\n" +
      "Assim a resposta fica ancorada no seu material.",
    timestamp: TS + 1000,
    reaction: null,
  },
  { id: "u2", type: "user", content: "Dá um exemplo prático?", timestamp: TS + 2000 },
  {
    id: "c1",
    type: "ai-comment",
    content: "Lendo Notas/RAG.md",
    timestamp: TS + 2500,
    activity: {
      phase: "done",
      iconPending: "eye",
      iconDone: "check",
      pendingText: "Lendo Notas/RAG.md",
      doneText: "Notas/RAG.md lida — 1.2k chars",
    },
  },
  {
    id: "a2",
    type: "ai-response",
    content:
      "Claro. Você pergunta *“o que decidi sobre o deploy?”* → o RAG recupera a nota " +
      "da reunião e responde citando a decisão registrada lá.",
    timestamp: TS + 3000,
    reaction: "like",
  },
];

const meta = {
  title: "Chat/ChatArea",
  component: ChatArea,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    axxaFrame: { height: 600 },
    docs: {
      description: {
        component:
          "Área de mensagens completa: lê a lista do store de chat e renderiza a " +
          "variante certa pra cada item (user / ai-response / activity / options), " +
          "com separadores de dia e botão 'voltar ao fim'.",
      },
    },
  },
  argTypes: {
    highlightTarget: { control: false },
  },
} satisfies Meta<typeof ChatArea>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Conversa de exemplo com vários tipos de mensagem. */
export const Conversation: Story = {
  decorators: [withChatActions, withChatStore(CONVERSATION)],
};

/** Conversa vazia. */
export const Empty: Story = {
  decorators: [withChatActions, withChatStore([])],
};
