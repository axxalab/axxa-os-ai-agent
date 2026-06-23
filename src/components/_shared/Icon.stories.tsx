// Icon.stories.tsx — wrapper do setIcon (Lucide) do Obsidian.
import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "./Icon";

const meta = {
  title: "Shared/Icon",
  component: Icon,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    axxaFrame: false,
    docs: {
      description: {
        component:
          "Wrapper React do `setIcon` do Obsidian — desenha um ícone Lucide " +
          "(mesma biblioteca bundleada pelo app). O ícone herda `currentColor` e " +
          "é dimensionado pela classe `.svg-icon` via tokens de CSS por contexto.",
      },
    },
  },
  argTypes: {
    name: {
      control: "text",
      description: "Nome do ícone Lucide (kebab-case), ex.: `sparkles`.",
    },
    className: {
      control: "text",
      description: "Classes extras aplicadas ao `<span>` wrapper.",
    },
  },
  args: {
    name: "sparkles",
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Um ícone isolado — mude o `name` no painel de Controls. */
export const Default: Story = {};

/** O ícone escala com o `font-size` do contexto (herda `1em`). */
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      {[14, 18, 24, 32, 48].map((size) => (
        <span key={size} style={{ fontSize: size, lineHeight: 1 }}>
          <Icon {...args} />
        </span>
      ))}
    </div>
  ),
};

/** O ícone herda `currentColor` — basta pintar o container. */
export const Colored: Story = {
  args: { name: "heart" },
  render: (args) => (
    <div style={{ display: "flex", gap: 18, fontSize: 28 }}>
      <span style={{ color: "var(--color-red)" }}><Icon {...args} /></span>
      <span style={{ color: "var(--color-green)" }}><Icon {...args} /></span>
      <span style={{ color: "var(--interactive-accent)" }}><Icon {...args} /></span>
      <span style={{ color: "var(--text-faint)" }}><Icon {...args} /></span>
    </div>
  ),
};

const GALLERY = [
  "sparkles", "bot", "message-square-plus", "user-round", "search",
  "settings", "more-vertical", "lock", "chevron-down", "chevron-right",
  "send", "mic", "image", "paperclip", "wand", "lightbulb", "pen-line",
  "list", "globe", "scissors", "scale", "graduation-cap", "mail",
  "file-plus", "folder-tree", "list-todo", "git-merge", "tags", "calendar",
  "network", "link", "history", "quote", "trending-up", "check-circle",
  "copy", "check", "circle", "drama", "align-left",
];

/** Galeria dos ícones usados pelo app — referência rápida de nomes. */
export const Gallery: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
        gap: 8,
        width: 560,
        maxWidth: "100%",
      }}
    >
      {GALLERY.map((name) => (
        <div
          key={name}
          title={name}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            padding: "12px 6px",
            borderRadius: 10,
            border: "1px solid var(--background-modifier-border)",
            background: "var(--background-secondary)",
          }}
        >
          <span style={{ fontSize: 22 }}>
            <Icon name={name} />
          </span>
          <span
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {name}
          </span>
        </div>
      ))}
    </div>
  ),
};
