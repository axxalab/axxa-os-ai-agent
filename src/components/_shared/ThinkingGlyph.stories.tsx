// ThinkingGlyph.stories.tsx — faísca animada "clauding" (pensa/responde).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThinkingGlyph } from "./ThinkingGlyph";

const meta = {
  title: "Shared/ThinkingGlyph",
  component: ThinkingGlyph,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    axxaFrame: false,
    docs: {
      description: {
        component:
          "Glyph animado (gira + respira + brilha) que prende o olho enquanto a IA " +
          "pensa/responde. Usado como ícone (thinking/activities) e como caret de " +
          "streaming (`className=\"axxa-stream-caret\"`). Respeita `prefers-reduced-motion`.",
      },
    },
  },
  argTypes: {
    className: { control: "text", description: "Classes extras (ex.: caret)." },
  },
} satisfies Meta<typeof ThinkingGlyph>;

export default meta;
type Story = StoryObj<typeof meta>;

/** O glyph em destaque. */
export const Default: Story = {
  render: (args) => (
    <span style={{ fontSize: 40, color: "var(--interactive-accent)" }}>
      <ThinkingGlyph {...args} />
    </span>
  ),
};

/** Em contexto: linha de "pensando…" como aparece no chat. */
export const Thinking: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: "var(--text-muted)",
        fontSize: 15,
      }}
    >
      <span style={{ fontSize: 18, color: "var(--interactive-accent)" }}>
        <ThinkingGlyph />
      </span>
      <span>Thinking…</span>
    </div>
  ),
};

/** Como caret de streaming, emendado ao final do texto que está chegando. */
export const StreamCaret: Story = {
  render: () => (
    <p style={{ maxWidth: 360, fontSize: 15, lineHeight: 1.6 }}>
      The quick brown fox jumps over the lazy dog
      <span style={{ color: "var(--interactive-accent)" }}>
        <ThinkingGlyph className="axxa-stream-caret" />
      </span>
    </p>
  ),
};
