// ModelBits.stories.tsx — peças visuais do card de modelo: logo do vendor + pills.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ModelVendorLogo, Pills } from "./StarterScreen";

const meta = {
  title: "Chat/Model Logo & Pills",
  component: ModelVendorLogo,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    axxaFrame: false,
    docs: {
      description: {
        component:
          "Peças do card de modelo: `ModelVendorLogo` resolve o logo do provider " +
          "(ou um placeholder roxo com o vendor) e `Pills` mostra as capabilities " +
          "(vision, tools, stream, free/paid, etc.).",
      },
    },
  },
  argTypes: {
    provider: { control: "text" },
    model: { control: "text" },
  },
  args: { provider: "openai", model: "gpt-4o" },
} satisfies Meta<typeof ModelVendorLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Logo de um vendor — troque provider/model nos Controls. */
export const VendorLogo: Story = {
  render: (args) => (
    <span style={{ fontSize: 32, display: "inline-flex" }}>
      <ModelVendorLogo {...args} />
    </span>
  ),
};

/** Logos de vários providers lado a lado. */
export const VendorGallery: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", gap: 18, fontSize: 30, alignItems: "center" }}>
      {[
        ["openai", "gpt-4o"],
        ["anthropic", "claude-3-5-sonnet"],
        ["gemini", "gemini-1.5-pro"],
        ["openrouter", "meta-llama/llama-3"],
        ["nim", "nvidia/nemotron"],
        ["ollama", "llama3"],
      ].map(([p, m]) => (
        <span key={p} title={p} style={{ display: "inline-flex" }}>
          <ModelVendorLogo provider={p} model={m} />
        </span>
      ))}
    </div>
  ),
};

/** Pills de capabilities do modelo. */
export const CapabilityPills: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Pills ids={["vision", "tools", "stream", "free"]} />
      <Pills ids={["multimodal", "tools", "stream", "paid"]} />
      <Pills ids={["img-gen", "paid"]} />
    </div>
  ),
};
