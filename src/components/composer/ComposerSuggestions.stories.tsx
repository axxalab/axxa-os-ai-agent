// ComposerSuggestions.stories.tsx — "balões" de sugestão da nova conversa.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within, fn } from "storybook/test";
import { ComposerSuggestions } from "./ComposerSuggestions";

const meta = {
  title: "Composer/Suggestions",
  component: ComposerSuggestions,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    axxaFrame: { height: 420 },
    docs: {
      description: {
        component:
          "Sugestões da nova conversa, com UM estilo por modo: `chat` → linhas " +
          "ícone+label, `agent` → cards horizontais, `vault-qa` → pills. Mostra as " +
          "3 primeiras + um \"See more\" que abre o bottom sheet com a lista completa.",
      },
    },
  },
  argTypes: {
    mode: {
      control: "inline-radio",
      options: ["chat", "agent", "vault-qa"],
      description: "Modo ativo — define o layout das sugestões.",
    },
    onPick: { action: "pick", description: "Injeta o prompt no editor." },
    onSeeMore: { action: "seeMore", description: "Abre a lista completa." },
  },
  args: {
    mode: "chat",
    onPick: fn(),
    onSeeMore: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 16, display: "flex", alignItems: "flex-end", height: "100%" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ComposerSuggestions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Modo chat — linhas verticais (escrita/raciocínio). */
export const Chat: Story = { args: { mode: "chat" } };

/** Modo agent — cards horizontais (lê e edita o vault). */
export const Agent: Story = { args: { mode: "agent" } };

/** Modo Q&A — pills (perguntas às próprias notas). */
export const VaultQA: Story = { args: { mode: "vault-qa" } };

/** Interação: tocar numa sugestão injeta o prompt correspondente. */
export const PickSuggestion: Story = {
  args: { mode: "chat" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Summarize a text"));
    await expect(args.onPick).toHaveBeenCalledWith("Summarize this text:\n");
  },
};
