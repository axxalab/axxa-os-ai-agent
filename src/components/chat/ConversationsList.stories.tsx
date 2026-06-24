// ConversationsList.stories.tsx — tela cheia de todas as conversas (busca/sort/filtro).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, within, userEvent, expect } from "storybook/test";
import { ConversationsList } from "./ConversationsList";
import { SUMMARIES } from "../../../.storybook/fixtures";

const meta = {
  title: "Chat/ConversationsList",
  component: ConversationsList,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    axxaFrame: { height: 620 },
    docs: {
      description: {
        component:
          "Tela cheia com todas as conversas: busca, filtro por modo (SegmentedRow), " +
          "ordenação e agrupamento por dia. Cada item mostra chips configuráveis " +
          "(provider/model/tokens). Right-click abre menu de renomear/excluir.",
      },
    },
  },
  argTypes: {
    chats: { control: "object", description: "Conversas a listar (ChatSummary[])." },
    visibleChips: { control: "object" },
    onLoadChat: { action: "loadChat" },
    onClose: { action: "close" },
    onRenameChat: { action: "renameChat" },
    onDeleteChat: { action: "deleteChat" },
    onNewChat: { action: "newChat" },
  },
  args: {
    chats: SUMMARIES,
    visibleChips: ["provider", "model", "tokens"],
    onLoadChat: fn(),
    onClose: fn(),
    onRenameChat: fn(),
    onDeleteChat: fn(),
    onNewChat: fn(),
  },
} satisfies Meta<typeof ConversationsList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Lista populada com conversas de exemplo. */
export const Default: Story = {};

/** Estado vazio — nenhuma conversa ainda. */
export const Empty: Story = {
  args: { chats: [] },
};

/** Interação: clicar numa conversa dispara onLoadChat com o id certo. */
export const LoadChatInteraction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText(SUMMARIES[0].title));
    await expect(args.onLoadChat).toHaveBeenCalledWith(SUMMARIES[0].id);
  },
};
