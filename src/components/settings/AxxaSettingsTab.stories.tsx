// AxxaSettingsTab.stories.tsx — a aba de Settings NATIVA do Obsidian.
// A AxxaSettingsTab é construída imperativamente com a API `Setting` do Obsidian
// (não é React). Aqui instanciamos a classe REAL, chamamos display() e montamos
// o containerEl — com o mock fiel de Setting + o CSS estrutural do Obsidian, ela
// renderiza idêntica ao app. As abas (Connections/Setup/Appearance/…) são
// clicáveis (cada clique re-renderiza o tab).
import { useEffect, useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AxxaSettingsTab } from "./AxxaSettingsTab";
import { makeSettingsPlugin, mockObsidianApp } from "../../../.storybook/fixtures";

function SettingsHost() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const plugin = makeSettingsPlugin();
    const tab = new AxxaSettingsTab(mockObsidianApp as never, plugin as never);
    tab.display();
    host.replaceChildren(tab.containerEl);
    return () => {
      try {
        tab.hide?.();
      } catch {
        /* noop */
      }
      host.replaceChildren();
    };
  }, []);
  return <div ref={ref} style={{ height: "100%", overflow: "auto" }} />;
}

const meta = {
  title: "Obsidian/Settings",
  component: SettingsHost,
  parameters: {
    layout: "fullscreen",
    axxaFrame: { width: 520, height: 760 },
    controls: { disable: true },
    a11y: { test: "off" },
    docs: {
      description: {
        component:
          "A aba de Settings nativa do Obsidian (AxxaSettingsTab), renderizada de " +
          "verdade no Storybook via um mock fiel da API `Setting` + o CSS estrutural " +
          "do Obsidian (.setting-item, toggles, dropdowns, sliders). As abas do topo " +
          "(Connections / Setup / Appearance / Effort / Usage / Outros) são clicáveis.",
      },
    },
  },
} satisfies Meta<typeof SettingsHost>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Settings completo — comece em Connections e navegue pelas abas. */
export const Default: Story = {};
