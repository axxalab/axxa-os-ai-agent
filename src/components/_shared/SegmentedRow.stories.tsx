// SegmentedRow.stories.tsx — controle segmentado com pílula deslizante (WAAPI).
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "@storybook/test";
import { SegmentedRow, type SegmentedItem } from "./SegmentedRow";

const MODE_ITEMS: SegmentedItem[] = [
  { id: "chat", icon: "message-circle", label: "Chat" },
  { id: "vault-qa", icon: "search", label: "Q&A" },
  { id: "agent", icon: "bot", label: "Agent" },
];

const FILTER_ITEMS: SegmentedItem[] = [
  { id: "all", icon: "layers", label: "Todos", iconOnly: true },
  { id: "chat", icon: "message-circle", label: "Chat" },
  { id: "vault-qa", icon: "search", label: "Q&A", dividerBefore: true },
  { id: "agent", icon: "bot", label: "Agent" },
];

const meta = {
  title: "Shared/SegmentedRow",
  component: SegmentedRow,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    axxaFrame: false,
    docs: {
      description: {
        component:
          "Controle segmentado (estilo nav do Threads) com indicador que DESLIZA " +
          "entre os slots. No modo `showActiveLabel`, só o slot ativo mostra o " +
          "texto e cresce — o slide+morph é dirigido pela Web Animations API e " +
          "respeita os tokens `[DS:motion]` (toolbar Motion) e `prefers-reduced-motion`.",
      },
    },
  },
  argTypes: {
    items: { control: "object", description: "Itens do segmented." },
    activeId: { control: "text", description: "Id do item ativo." },
    showActiveLabel: {
      control: "boolean",
      description: "Mostra o texto só no slot ativo (cresce na horizontal).",
    },
    onSelect: { action: "select", description: "Disparado ao escolher um item." },
  },
  args: {
    items: MODE_ITEMS,
    activeId: "chat",
    showActiveLabel: false,
    onSelect: fn(),
  },
  // Render controlado: o `activeId` vira estado interativo, mas ainda emite a
  // action onSelect (visível no painel Actions).
  render: function Render(args) {
    const [active, setActive] = useState(args.activeId);
    return (
      <div style={{ width: 320 }}>
        <SegmentedRow
          {...args}
          activeId={active}
          onSelect={(id) => {
            setActive(id);
            args.onSelect?.(id);
          }}
        />
      </div>
    );
  },
} satisfies Meta<typeof SegmentedRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Três modos, só ícones. */
export const IconsOnly: Story = {};

/** Slot ativo mostra o rótulo e cresce. */
export const WithActiveLabel: Story = {
  args: { showActiveLabel: true, activeId: "agent" },
};

/** Filtro com item "Todos" sempre só-ícone e um divisor entre grupos. */
export const WithDivider: Story = {
  args: { items: FILTER_ITEMS, activeId: "all", showActiveLabel: true },
};

/** Interação automatizada: clica em "Agent" e confere a seleção. */
export const Interaction: Story = {
  args: { showActiveLabel: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const agentTab = canvas.getByRole("tab", { name: "Agent" });
    await userEvent.click(agentTab);
    await expect(args.onSelect).toHaveBeenCalledWith("agent");
    await expect(agentTab).toHaveAttribute("aria-selected", "true");
  },
};
