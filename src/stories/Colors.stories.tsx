// Colors.stories.tsx — paleta do DS (tokens nativos + cores semânticas).
import type { Meta, StoryObj } from "@storybook/react-vite";

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid var(--background-modifier-border)",
        background: "var(--background-secondary)",
      }}
    >
      <div style={{ height: 56, background: value }} />
      <div style={{ padding: "8px 10px" }}>
        <div style={{ fontSize: 12, color: "var(--text-normal)", fontWeight: 600 }}>
          {name}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{value}</div>
      </div>
    </div>
  );
}

function Grid({ tokens }: { tokens: [string, string][] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gap: 12,
        width: 720,
        maxWidth: "100%",
      }}
    >
      {tokens.map(([name, value]) => (
        <Swatch key={name} name={name} value={value} />
      ))}
    </div>
  );
}

const meta = {
  tags: ["autodocs"],
  title: "Foundations/Colors",
  parameters: {
    layout: "centered",
    axxaFrame: false,
    controls: { disable: true },
    docs: {
      description: {
        component:
          "Cores do tema (herdadas do Obsidian) + a paleta semântica do DS. " +
          "Alterne a toolbar **Theme** para ver os valores em light/dark.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Superfícies e texto — os tokens estruturais do tema. */
export const Surfaces: Story = {
  render: () => (
    <Grid
      tokens={[
        ["--background-primary", "var(--background-primary)"],
        ["--background-secondary", "var(--background-secondary)"],
        ["--background-modifier-hover", "var(--background-modifier-hover)"],
        ["--background-modifier-border", "var(--background-modifier-border)"],
        ["--text-normal", "var(--text-normal)"],
        ["--text-muted", "var(--text-muted)"],
        ["--text-faint", "var(--text-faint)"],
        ["--interactive-accent", "var(--interactive-accent)"],
      ]}
    />
  ),
};

/** As 6 cores semânticas usadas em chips, badges e realces. */
export const Semantic: Story = {
  render: () => (
    <Grid
      tokens={[
        ["--color-purple", "var(--color-purple)"],
        ["--color-orange", "var(--color-orange)"],
        ["--color-cyan", "var(--color-cyan)"],
        ["--color-pink", "var(--color-pink)"],
        ["--color-blue", "var(--color-blue)"],
        ["--color-green", "var(--color-green)"],
        ["--color-red", "var(--color-red)"],
      ]}
    />
  ),
};
