// Backgrounds.stories.tsx — presets de fundo (axxa-bg-*) da .axxa-root.
import type { Meta, StoryObj } from "@storybook/react-vite";

const PRESETS = [
  "none", "dawn", "ocean", "forest", "violet", "rose",
  "amber", "slate", "mono", "aurora", "nebula", "pulse", "flow",
];

/**
 * Cada tile recria uma `.axxa-root.axxa-bg-<preset>` em miniatura — o preview
 * pinta o fundo de verdade (incluindo os presets animados aurora/nebula/pulse/flow).
 */
function PresetTile({ preset }: { preset: string }) {
  return (
    <div
      style={{
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid var(--background-modifier-border)",
      }}
    >
      <div
        className={`axxa-root axxa-bg-${preset} axxa-bg-active`}
        style={{ height: 120, position: "relative" }}
      >
        <span
          style={{
            position: "absolute",
            left: 10,
            bottom: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-normal)",
            background: "var(--axxa-pill-bg)",
            padding: "2px 8px",
            borderRadius: 8,
          }}
        >
          {preset}
        </span>
      </div>
    </div>
  );
}

const meta = {
  title: "Foundations/Backgrounds",
  parameters: {
    layout: "centered",
    // Estes tiles trazem a própria .axxa-root — não queremos o frame ao redor.
    axxaFrame: false,
    controls: { disable: true },
    docs: {
      description: {
        component:
          "Presets de fundo aplicados como classe `axxa-bg-<id>` na `.axxa-root`. " +
          "Alguns são animados (aurora, nebula, pulse, flow) — a animação respeita " +
          "a toolbar **Motion** e `prefers-reduced-motion`. Você também pode aplicar " +
          "qualquer preset globalmente pela toolbar **Background**.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllPresets: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 12,
        width: 760,
        maxWidth: "100%",
      }}
    >
      {PRESETS.map((p) => (
        <PresetTile key={p} preset={p} />
      ))}
    </div>
  ),
};
