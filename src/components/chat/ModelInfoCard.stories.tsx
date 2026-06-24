// ModelInfoCard.stories.tsx — card do modelo (logo + categoria + tier + specs +
// dropdown de troca + modal de detalhes).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ModelInfoCard } from "./StarterScreen";
import { mockPlugin } from "../../../.storybook/fixtures";

const meta = {
  title: "Chat/ModelInfoCard",
  component: ModelInfoCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    axxaFrame: { height: 360 },
    docs: {
      description: {
        component:
          "Card do modelo ativo: logo do vendor, nome/categoria, tier (free/paid), " +
          "descrição e dropdown pra trocar entre os modelos conectados. O botão de " +
          "expandir abre um modal com as specs (mockadas como 'sem fetch' aqui).",
      },
    },
  },
  argTypes: {
    provider: { control: "text" },
    model: { control: "text" },
    modelOptions: { control: "object" },
    onModelChange: { action: "modelChange" },
  },
  args: {
    provider: "openai",
    model: "gpt-4o",
    modelOptions: ["gpt-4o", "gpt-4o-mini", "o3-mini", "o1"],
    onModelChange: fn(),
    plugin: mockPlugin,
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 16, width: "100%" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ModelInfoCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenAI: Story = {};
export const Anthropic: Story = {
  args: { provider: "anthropic", model: "claude-3-5-sonnet", modelOptions: ["claude-3-5-sonnet", "claude-3-5-haiku"] },
};
export const Gemini: Story = {
  args: { provider: "gemini", model: "gemini-1.5-pro", modelOptions: ["gemini-1.5-pro", "gemini-1.5-flash"] },
};
