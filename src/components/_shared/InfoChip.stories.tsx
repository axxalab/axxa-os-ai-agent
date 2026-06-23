// InfoChip.stories.tsx — chip compacto "ícone + valor" da status line do Composer.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { InfoChip } from "./InfoChip";

const meta = {
  title: "Shared/InfoChip",
  component: InfoChip,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    axxaFrame: false,
    docs: {
      description: {
        component:
          "Chip colorido com micro-ícone (10px). Usado na status line do Composer " +
          "(provider / model / effort / tokens) e em listas. A cor é controlada " +
          "pela prop `color` — a paleta semântica tem 6 cores.",
      },
    },
  },
  argTypes: {
    icon: { control: "text", description: "Nome do ícone Lucide." },
    color: { control: "color", description: "Cor do ícone + texto." },
    children: { control: "text", description: "Conteúdo (valor) do chip." },
    title: { control: "text", description: "Tooltip opcional (hover)." },
  },
  args: {
    icon: "cpu",
    color: "var(--color-purple)",
    children: "gpt-4o",
  },
} satisfies Meta<typeof InfoChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithTooltip: Story = {
  args: {
    icon: "coins",
    color: "var(--color-green)",
    children: "1.2k tokens",
    title: "1.234 tokens nesta resposta",
  },
};

/** As 6 cores semânticas do DS aplicadas ao chip. */
export const Palette: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, maxWidth: 420 }}>
      <InfoChip icon="cpu" color="var(--color-purple)">model</InfoChip>
      <InfoChip icon="zap" color="var(--color-orange)">effort</InfoChip>
      <InfoChip icon="sparkles" color="var(--color-cyan)">provider</InfoChip>
      <InfoChip icon="heart" color="var(--color-pink)">favorite</InfoChip>
      <InfoChip icon="coins" color="var(--color-blue)">tokens</InfoChip>
      <InfoChip icon="check" color="var(--color-green)">ready</InfoChip>
    </div>
  ),
};

/** Status line típica do Composer: vários chips em linha. */
export const StatusLine: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 10,
        background: "var(--axxa-pill-bg)",
      }}
    >
      <InfoChip icon="sparkles" color="var(--color-cyan)">OpenAI</InfoChip>
      <InfoChip icon="cpu" color="var(--color-purple)">gpt-4o</InfoChip>
      <InfoChip icon="zap" color="var(--color-orange)">balanced</InfoChip>
      <InfoChip icon="coins" color="var(--color-blue)">842</InfoChip>
    </div>
  ),
};
