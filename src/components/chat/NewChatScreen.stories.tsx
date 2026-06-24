// NewChatScreen.stories.tsx — base limpa da nova conversa (saudação + sugestões).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { NewChatScreen } from "./NewChatScreen";
import { mockPlugin } from "../../../.storybook/fixtures";

const meta = {
  title: "Chat/NewChatScreen",
  component: NewChatScreen,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    axxaFrame: { height: 560 },
    docs: {
      description: {
        component:
          "Tela inicial de uma conversa nova (aberta via 'nova conversa'): saudação, " +
          "seletor de provider e as sugestões do modo. Mais enxuta que a StarterScreen.",
      },
    },
  },
  argTypes: {
    mode: {
      control: "inline-radio",
      options: ["chat", "agent", "vault-qa"],
    },
    provider: { control: "text" },
    showSuggestions: { control: "boolean" },
    onProviderChange: { action: "providerChange" },
    onOpenSettings: { action: "openSettings" },
    onPickSuggestion: { action: "pickSuggestion" },
    onSeeMoreSuggestions: { action: "seeMore" },
  },
  args: {
    mode: "chat",
    plugin: mockPlugin,
    provider: "openai",
    showSuggestions: true,
    onProviderChange: fn(),
    onOpenSettings: fn(),
    onPickSuggestion: fn(),
    onSeeMoreSuggestions: fn(),
  },
} satisfies Meta<typeof NewChatScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Chat: Story = { args: { mode: "chat" } };
export const Agent: Story = { args: { mode: "agent" } };
export const VaultQA: Story = { args: { mode: "vault-qa" } };
