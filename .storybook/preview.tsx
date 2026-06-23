// .storybook/preview.tsx
// Preview global do Storybook: estilos, providers e DECORATORS que recriam o
// ambiente de runtime do plugin (tema do Obsidian + .axxa-root + tokens de
// densidade/motion + preset de background). Tudo isso é controlável pela
// toolbar (globalTypes) pra inspecionar qualquer componente em qualquer estado.

import * as React from "react";
import type { Preview, Decorator } from "@storybook/react";

// Ordem importa: primeiro as variáveis nativas do Obsidian, depois o CSS do DS
// que as consome.
import "./obsidian-theme.css";
import "../styles/main.css";

import { AppContext } from "../src/components/_shared/AppContext";
import { TranslationsContext, getTranslations } from "../src/i18n";
import { createMockApp } from "./obsidian-mock";

/* ---------------------------- toolbar globals --------------------------- */

const BACKGROUND_PRESETS = [
  "none",
  "dawn",
  "ocean",
  "forest",
  "violet",
  "rose",
  "amber",
  "slate",
  "mono",
  "aurora",
  "nebula",
  "pulse",
  "flow",
];

export const globalTypes = {
  theme: {
    name: "Theme",
    description: "Tema do Obsidian (light / dark)",
    defaultValue: "light",
    toolbar: {
      icon: "contrast",
      dynamicTitle: true,
      items: [
        { value: "light", title: "Light", icon: "sun" },
        { value: "dark", title: "Dark", icon: "moon" },
      ],
    },
  },
  background: {
    name: "Background",
    description: "Preset de fundo do AXXA (axxa-bg-*)",
    defaultValue: "none",
    toolbar: {
      icon: "photo",
      dynamicTitle: true,
      items: BACKGROUND_PRESETS.map((p) => ({ value: p, title: p })),
    },
  },
  density: {
    name: "Density",
    description: "Densidade global do DS (data-axxa-density)",
    defaultValue: "normal",
    toolbar: {
      icon: "component",
      dynamicTitle: true,
      items: [
        { value: "large", title: "Large" },
        { value: "normal", title: "Normal" },
        { value: "compact", title: "Compact" },
      ],
    },
  },
  motion: {
    name: "Motion",
    description: "Personalidade das animações (data-axxa-motion)",
    defaultValue: "wave",
    toolbar: {
      icon: "lightning",
      dynamicTitle: true,
      items: [
        { value: "soft", title: "Soft" },
        { value: "wave", title: "Wave" },
        { value: "intense", title: "Intense" },
        { value: "chaotic", title: "Chaotic" },
      ],
    },
  },
};

/* ------------------------------ decorators ------------------------------ */

const mockApp = createMockApp();
const translations = getTranslations("en-us");

/**
 * Decorator-mestre: aplica o tema no <body>, monta a `.axxa-root` com o preset
 * de background + tokens de densidade/motion, e injeta os Contexts (App + i18n)
 * que os componentes esperam. Um "frame" opcional imita o painel lateral do
 * Obsidian (controlável por `parameters.axxaFrame`).
 */
const withAxxaEnvironment: Decorator = (Story, context) => {
  const { theme, background, density, motion } = context.globals;

  // Tema vive no <body> (o styles/main.css usa `body.theme-dark .axxa-root`).
  React.useEffect(() => {
    const body = document.body;
    body.classList.toggle("theme-dark", theme === "dark");
    body.classList.toggle("theme-light", theme !== "dark");
  }, [theme]);

  // `axxaFrame: false` desliga o painel; objeto permite custom width/height.
  const frameParam = context.parameters.axxaFrame as
    | false
    | { width?: number | string; height?: number | string }
    | undefined;

  const root = (
    <AppContext.Provider value={mockApp as never}>
      <TranslationsContext.Provider value={translations}>
        <div
          className={`axxa-root axxa-bg-${background}`}
          data-axxa-density={density}
          data-axxa-motion={motion}
        >
          <Story />
        </div>
      </TranslationsContext.Provider>
    </AppContext.Provider>
  );

  if (frameParam === false) return root;

  const width = frameParam?.width ?? 392;
  const height = frameParam?.height ?? 560;

  return (
    <div
      style={{
        width,
        maxWidth: "100%",
        height,
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 14,
        border: "1px solid var(--background-modifier-border)",
        boxShadow: "var(--shadow-l)",
        margin: "0 auto",
      }}
    >
      {root}
    </div>
  );
};

/* ------------------------------- preview -------------------------------- */

const preview: Preview = {
  decorators: [withAxxaEnvironment],
  parameters: {
    layout: "centered",
    controls: {
      expanded: true,
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    // Pintamos a superfície via .axxa-root/tema — desligamos o grid de fundo
    // padrão do addon-backgrounds pra não competir com o preset do AXXA.
    backgrounds: { disable: true },
    options: {
      storySort: {
        order: [
          "Introduction",
          "Foundations",
          ["Design Tokens", "Backgrounds"],
          "Shared",
          "Composer",
          "Layout",
          "*",
        ],
      },
    },
    a11y: {
      // Auditoria roda por padrão; troque para "off" numa story específica
      // se um padrão for intencional.
      test: "todo",
    },
  },
};

export default preview;
