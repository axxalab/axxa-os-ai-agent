// Messages.stories.tsx — as bolhas de conversa (núcleo visual do chat).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { UserBubble, AIResponse, ErrorMessage, AIComment, AIOptions } from "./Messages";
import { withChatActions } from "../../../.storybook/fixtures";
import type {
  UserMessage,
  AIResponseMessage,
  AICommentMessage,
  AIOptionsMessage,
} from "../../store/chat";

const TS = new Date(2026, 5, 23, 14, 30).getTime();

const meta = {
  title: "Chat/Messages",
  tags: ["autodocs"],
  decorators: [
    withChatActions,
    (Story) => (
      <div style={{ padding: 16, height: "100%", overflow: "auto" }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    axxaFrame: { height: 480 },
    docs: {
      description: {
        component:
          "As bolhas que compõem a conversa: mensagem do usuário, resposta da IA " +
          "(com markdown, footer de ações, reasoning, variantes), erro, comentário/" +
          "activity e opções. Renderizadas isoladas, com ChatActionsContext mockado.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const userMsg: UserMessage = {
  id: "u1",
  type: "user",
  content: "Me explique o que é RAG em duas frases.",
  timestamp: TS,
};

const aiMsg: AIResponseMessage = {
  id: "a1",
  type: "ai-response",
  content:
    "**RAG** (Retrieval-Augmented Generation) busca trechos relevantes das suas " +
    "notas e os injeta no prompt do modelo.\n\nAssim a resposta fica ancorada no " +
    "seu material, em vez de só no conhecimento geral do modelo.",
  timestamp: TS,
  reaction: null,
};

/** Mensagem do usuário (bolha à direita). */
export const User: Story = {
  render: () => <UserBubble msg={userMsg} />,
};

/** Resposta da IA com markdown + footer de ações. */
export const AI: Story = {
  render: () => <AIResponse msg={aiMsg} />,
};

/** Resposta da IA com reasoning (painel colapsável) e marcada como truncada. */
export const AIWithReasoning: Story = {
  render: () => (
    <AIResponse
      msg={{
        ...aiMsg,
        id: "a2",
        reasoning:
          "O usuário quer uma definição curta. Vou cobrir retrieval + augmentation " +
          "e por que ancora a resposta.",
        truncated: true,
      }}
    />
  ),
};

/** Resposta com variantes (regeneração) — navegação ‹ 1/2 ›. */
export const AIWithVariants: Story = {
  render: () => (
    <AIResponse
      msg={{
        ...aiMsg,
        id: "a3",
        variants: [aiMsg.content, "Versão alternativa, mais curta: RAG = buscar + gerar."],
        variantIndex: 1,
        content: "Versão alternativa, mais curta: RAG = buscar + gerar.",
      }}
    />
  ),
};

/** Bolha de erro com ação de retry / abrir settings. */
export const Error: Story = {
  render: () => (
    <ErrorMessage
      msg={{
        id: "e1",
        type: "ai-response",
        content: "Sua chave de API parece inválida.",
        timestamp: TS,
        isError: true,
        errorCode: "invalid-key",
      }}
    />
  ),
};

/** Comentário/“pensando” simples da IA. */
export const Comment: Story = {
  render: () => {
    const msg: AICommentMessage = {
      id: "c1",
      type: "ai-comment",
      content: "Deixa eu pensar nisso…",
      timestamp: TS,
    };
    return <AIComment msg={msg} />;
  },
};

/** Activity step (estilo Claude Code): pulsa enquanto roda, check ao terminar. */
export const Activity: Story = {
  render: () => {
    const msg: AICommentMessage = {
      id: "c2",
      type: "ai-comment",
      content: "Notas/RAG.md lida — 1.2k chars",
      timestamp: TS,
      activity: {
        phase: "done",
        iconPending: "eye",
        iconDone: "check",
        pendingText: "Lendo Notas/RAG.md",
        doneText: "Notas/RAG.md lida — 1.2k chars",
        detail: "## RAG\nRetrieval-Augmented Generation combina busca + geração…",
      },
    };
    return <AIComment msg={msg} />;
  },
};

/** Opções clicáveis propostas pela IA. */
export const Options: Story = {
  render: () => {
    const msg: AIOptionsMessage = {
      id: "o1",
      type: "ai-options",
      prompt: "Como você prefere o resumo?",
      options: ["Bem curto (1 frase)", "Médio (1 parágrafo)", "Detalhado (com exemplos)"],
      selectedIndex: 1,
      timestamp: TS,
    };
    return <AIOptions msg={msg} />;
  },
};
