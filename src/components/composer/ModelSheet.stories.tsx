// ModelSheet.stories.tsx — bottom sheet de seleção de modelo (estilo Claude).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ModelSheet } from "./ModelSheet";

const meta = {
  title: "Composer/ModelSheet",
  component: ModelSheet,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    axxaFrame: false,
    docs: {
      description: {
        component:
          "Bottom sheet de troca de modelo: favoritos (★, teto de 5/provider), " +
          "lista por categoria, slider de esforço e toggle de thinking. Aberto pelo " +
          "chip de modelo no composer.",
      },
    },
  },
  argTypes: {
    provider: { control: "text" },
    currentModel: { control: "text" },
    currentEffort: {
      control: "inline-radio",
      options: ["low", "med", "high", "xhigh", "max"],
    },
    thinkingOn: { control: "boolean" },
    thinkingCapable: { control: "boolean" },
    onToggleFavorite: { action: "toggleFavorite" },
    onSelectModel: { action: "selectModel" },
    onSelectEffort: { action: "selectEffort" },
    onToggleThinking: { action: "toggleThinking" },
    onClose: { action: "close" },
    onOpenSettings: { action: "openSettings" },
  },
  args: {
    provider: "openai",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini", "o1", "dall-e-3"],
    favorites: ["openai::gpt-4o", "openai::o3-mini"],
    currentModel: "gpt-4o",
    currentEffort: "med",
    thinkingOn: false,
    thinkingCapable: true,
    lang: "en-us",
    onToggleFavorite: fn(),
    onSelectModel: fn(),
    onSelectEffort: fn(),
    onToggleThinking: fn(),
    onClose: fn(),
    onOpenSettings: fn(),
  },
} satisfies Meta<typeof ModelSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sheet com favoritos + lista de modelos do provider. */
export const Default: Story = {};

/** Modelo que suporta thinking — a linha do toggle aparece, já ligada. */
export const ThinkingOn: Story = {
  args: { thinkingOn: true, thinkingCapable: true, currentModel: "o3-mini" },
};

/** Nenhum modelo adicionado — CTA pra abrir as Settings. */
export const Empty: Story = {
  args: { models: [], favorites: [] },
};
