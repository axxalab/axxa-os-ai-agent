// IncompatibleBanner.stories.tsx — banner de incompatibilidade modo×modelo.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { IncompatibleBanner } from "./IncompatibleBanner";
import type { CompatibilityResult } from "../../providers/compatibility";

const meta = {
  title: "Composer/IncompatibleBanner",
  component: IncompatibleBanner,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    axxaFrame: { height: 220 },
    docs: {
      description: {
        component:
          "Banner que aparece acima do composer quando o combo modo + provider + " +
          "modelo + anexos é incompatível (ex.: modo agente num modelo sem tools, " +
          "imagem anexada num modelo sem visão). Oferece trocar pro modelo sugerido " +
          "ou dispensar.",
      },
    },
  },
  argTypes: {
    result: { control: "object", description: "Resultado da checagem de compatibilidade." },
    onSwapModel: { action: "swapModel" },
    onDismiss: { action: "dismiss" },
  },
  args: {
    onSwapModel: fn(),
    onDismiss: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 12, display: "flex", alignItems: "flex-end", height: "100%" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof IncompatibleBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

const result = (over: Partial<CompatibilityResult>): CompatibilityResult => ({
  ok: false,
  reason: "agent-no-tools",
  message: "Este modelo não suporta ferramentas.",
  suggestions: ["gpt-4o", "o3-mini"],
  ...over,
});

/** Modo agente num modelo sem suporte a tools. */
export const AgentNoTools: Story = {
  args: {
    result: result({
      reason: "agent-no-tools",
      message: "O modo Agente precisa de um modelo com ferramentas.",
      suggestions: ["gpt-4o", "claude-3-5-sonnet"],
    }),
  },
};

/** Imagem anexada num modelo sem visão. */
export const VisionNoVision: Story = {
  args: {
    result: result({
      reason: "vision-no-vision",
      message: "Este modelo não enxerga imagens — anexo será ignorado.",
      suggestions: ["gpt-4o", "gemini-1.5-pro"],
    }),
  },
};

/** Modelo de geração selecionado no modo chat. */
export const GenerationInChat: Story = {
  args: {
    result: result({
      reason: "generation-model-in-chat",
      message: "Modelos de geração não conversam — troque o modo ou o modelo.",
      suggestions: ["gpt-4o"],
    }),
  },
};

/** Sem sugestões disponíveis (só dispensar). */
export const NoSuggestions: Story = {
  args: {
    result: result({
      reason: "image-gen-not-implemented",
      message: "Geração de imagem ainda não disponível para este provider.",
      suggestions: [],
    }),
  },
};
