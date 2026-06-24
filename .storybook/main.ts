// .storybook/main.ts
// Configuração do Storybook (builder Vite + React). O AXXA é um plugin Obsidian,
// então o `obsidian` é aliasado para um mock (.storybook/obsidian-mock.ts) — os
// componentes do DS importam `setIcon`, `MarkdownRenderer`, etc. de lá.
//
// Observação: ao contrário do bundle de produção (esbuild.config.mjs troca React
// por preact/compat), o Storybook roda no React REAL — é só ambiente de preview;
// o comportamento dos componentes é idêntico para o DS.

import type { StorybookConfig } from "@storybook/react-vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// O Storybook 10 carrega este arquivo como ESM puro — `__dirname` não existe.
const here = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(ts|tsx)",
  ],
  // Storybook 10: controls, actions, viewport, backgrounds, toolbars, measure,
  // outline e o painel de interactions agora são CORE (não precisam de addon).
  // Restam os addons "de verdade":
  addons: [
    "@storybook/addon-onboarding", // tour guiado de 1º uso do Storybook
    "@storybook/addon-links",
    "@storybook/addon-docs", // autodocs + páginas MDX (era parte do essentials)
    "@storybook/addon-a11y", // auditoria de acessibilidade por story
    "@storybook/addon-themes", // switcher de tema oficial (light/dark via classe)
    "@storybook/addon-designs", // embed de frames do Figma na aba "Design"
    "@storybook/addon-vitest", // roda as stories como testes (Vitest browser mode)
    "@storybook/addon-mcp", // servidor MCP: expõe o conhecimento das stories pra IA
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
      plugins: [
        // No build estático, o loader de MDX do addon-docs emite o import do
        // mdx-react-shim como uma URL `file://`, que o Rollup não resolve. Este
        // plugin normaliza qualquer specifier `file://` de volta pra caminho de
        // arquivo antes da resolução. (Inócuo no dev; só age em ids file://.)
        {
          name: "axxa-resolve-file-url",
          enforce: "pre" as const,
          resolveId(id: string) {
            if (id.startsWith("file://")) {
              try {
                return fileURLToPath(id);
              } catch {
                return null;
              }
            }
            return null;
          },
        },
      ],
      resolve: {
        alias: {
          // Componentes importam a API do Obsidian — no Storybook ela vira mock.
          obsidian: resolve(here, "./obsidian-mock.ts"),
        },
      },
    });
  },
};

export default config;
