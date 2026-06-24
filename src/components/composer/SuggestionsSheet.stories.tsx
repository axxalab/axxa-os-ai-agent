// SuggestionsSheet.stories.tsx — bottom sheet com a lista completa de sugestões.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, within, userEvent, expect } from "storybook/test";
import { SuggestionsSheet } from "./SuggestionsSheet";

const meta = {
  title: "Composer/SuggestionsSheet",
  component: SuggestionsSheet,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    axxaFrame: false,
    docs: {
      description: {
        component:
          'Bottom sheet (arrastável) com a lista COMPLETA de sugestões do modo, ' +
          'aberto pelo "See more" das sugestões do composer. Tocar numa sugestão ' +
          "injeta o prompt no editor.",
      },
    },
  },
  argTypes: {
    mode: {
      control: "inline-radio",
      options: ["chat", "agent", "vault-qa"],
    },
    onPick: { action: "pick" },
    onClose: { action: "close" },
  },
  args: {
    mode: "chat",
    onPick: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof SuggestionsSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Chat: Story = { args: { mode: "chat" } };
export const Agent: Story = { args: { mode: "agent" } };
export const VaultQA: Story = { args: { mode: "vault-qa" } };

/** Interação: tocar numa sugestão dispara onPick com o prompt. */
export const PickInteraction: Story = {
  args: { mode: "chat" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Summarize a text"));
    await expect(args.onPick).toHaveBeenCalled();
  },
};
