// .storybook/main.ts
// Configuração do Storybook (builder Vite + React). O AXXA é um plugin Obsidian,
// então o `obsidian` é aliasado para um mock (.storybook/obsidian-mock.ts) — os
// componentes do DS importam `setIcon`, `MarkdownRenderer`, etc. de lá.
//
// Observação: ao contrário do bundle de produção (esbuild.config.mjs troca React
// por preact/compat), o Storybook roda no React REAL — é só ambiente de preview;
// o comportamento dos componentes é idêntico para o DS.

import type { StorybookConfig } from "@storybook/react-vite";
import { resolve } from "node:path";

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(ts|tsx)",
  ],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials", // controls, actions, docs, viewport, backgrounds, toolbars, measure, outline
    "@storybook/addon-interactions", // play() + assertions
    "@storybook/addon-a11y", // auditoria de acessibilidade por story
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  docs: {
    // Autodocs ligado por padrão — cada componente com `tags: ['autodocs']`
    // ganha uma página de documentação com tabela de props/args.
    defaultName: "Docs",
  },
  typescript: {
    // Extrai props/descrições direto das interfaces TS → tabela de args nos Docs.
    reactDocgen: "react-docgen-typescript",
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop) =>
        prop.parent ? !/node_modules/.test(prop.parent.fileName) : true,
    },
  },
  async viteFinal(viteConfig) {
    const { mergeConfig } = await import("vite");
    return mergeConfig(viteConfig, {
      resolve: {
        alias: {
          // Componentes importam a API do Obsidian — no Storybook ela vira mock.
          obsidian: resolve(__dirname, "./obsidian-mock.ts"),
        },
      },
    });
  },
};

export default config;
