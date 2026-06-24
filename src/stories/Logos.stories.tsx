// Logos.stories.tsx — TODOS os logos de marca (providers + vendors de modelo).
// Os SVGs são registrados via addIcon() (mock) no preview e rendem pelo <Icon>.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Icon } from "../components/_shared/Icon";
import { ModelVendorLogo } from "../components/chat/StarterScreen";
import { BRAND_LOGOS } from "../components/_shared/brandLogos";
import { BRAND_ICONS } from "../components/_shared/brandIcons";
import { PROVIDER_LOGO } from "../components/_shared/modelLogo";

function Tile({ id, label }: { id: string; label: string }) {
  return (
    <div
      title={id}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "14px 8px",
        borderRadius: 12,
        border: "1px solid var(--background-modifier-border)",
        background: "var(--background-secondary)",
      }}
    >
      <span style={{ fontSize: 34, display: "inline-flex", lineHeight: 1 }}>
        <Icon name={id} />
      </span>
      <span style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>
        {label}
      </span>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
        gap: 12,
        width: 760,
        maxWidth: "100%",
      }}
    >
      {children}
    </div>
  );
}

const meta = {
  tags: ["autodocs"],
  title: "Foundations/Logos",
  parameters: {
    layout: "centered",
    axxaFrame: false,
    controls: { disable: true },
    docs: {
      description: {
        component:
          "Todos os logos de marca do AXXA (SVGs em brandLogos/brandIcons, registrados " +
          "via addIcon). Coloridos preservam a cor; os mono herdam o currentColor do " +
          "tema (troque o Theme na toolbar pra ver). `ModelVendorLogo` resolve o logo " +
          "certo a partir do id do modelo.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Logos de provider (abas/fallback). */
export const Providers: Story = {
  render: () => (
    <Grid>
      {Object.entries(PROVIDER_LOGO).map(([provider, id]) => (
        <Tile key={provider} id={id} label={provider} />
      ))}
    </Grid>
  ),
};

/** Todos os logos de marca (providers + vendors de modelo, color + mono). */
export const AllBrandLogos: Story = {
  render: () => (
    <Grid>
      {Object.keys(BRAND_LOGOS).map((id) => (
        <Tile key={id} id={id} label={id.replace(/^logo-/, "")} />
      ))}
    </Grid>
  ),
};

/** Ícones de marca extra (apps/serviços) registrados via addIcon. */
export const BrandIcons: Story = {
  render: () => (
    <Grid>
      {Object.keys(BRAND_ICONS).map((id) => (
        <Tile key={id} id={id} label={id.replace(/^logo-/, "")} />
      ))}
    </Grid>
  ),
};

/** Resolução por MODELO: cada id de modelo cai no logo do vendor certo. */
export const ModelVendor: Story = {
  render: () => {
    const models: [string, string][] = [
      ["openai", "gpt-4o"],
      ["openai", "o3-mini"],
      ["anthropic", "claude-3-5-sonnet"],
      ["gemini", "gemini-1.5-pro"],
      ["gemini", "nano-banana"],
      ["openrouter", "meta-llama/llama-3.1-70b"],
      ["openrouter", "qwen/qwen-2.5"],
      ["openrouter", "mistralai/mixtral"],
      ["openrouter", "deepseek/deepseek-r1"],
      ["nim", "nvidia/nemotron-4"],
      ["openrouter", "black-forest-labs/flux"],
      ["openrouter", "stabilityai/sdxl"],
    ];
    return (
      <Grid>
        {models.map(([provider, model]) => (
          <div
            key={`${provider}/${model}`}
            title={`${provider} · ${model}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "14px 8px",
              borderRadius: 12,
              border: "1px solid var(--background-modifier-border)",
              background: "var(--background-secondary)",
            }}
          >
            <span style={{ fontSize: 34, display: "inline-flex", lineHeight: 1 }}>
              <ModelVendorLogo provider={provider} model={model} />
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>
              {model.split("/").pop()}
            </span>
          </div>
        ))}
      </Grid>
    );
  },
};
