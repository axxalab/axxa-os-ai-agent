// InspireScreen.stories.tsx — galeria de prompts pra inspirar a próxima conversa.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { InspireScreen } from "./InspireScreen";

const meta = {
  title: "Chat/InspireScreen",
  component: InspireScreen,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    axxaFrame: { height: 620 },
    docs: {
      description: {
        component:
          "Tela de inspiração: cards de prompts por categoria. Tocar num card " +
          "injeta o prompt no composer e fecha a tela.",
      },
    },
  },
  argTypes: {
    onPick: { action: "pick" },
    onClose: { action: "close" },
  },
  args: {
    onPick: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof InspireScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
