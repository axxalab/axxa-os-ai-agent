import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { playwright } from "@vitest/browser-playwright";
import storybookTest from "@storybook/addon-vitest/vitest-plugin";

// Vitest config com DOIS projetos (Vitest 4 `test.projects`):
//
//   1. "unit"      — os testes de tests/ (node), inalterados. O alias `obsidian`
//                    aponta pro stub leve (tests/obsidian-stub.ts).
//   2. "storybook" — as stories rodando como testes no Chromium (Playwright),
//                    via @storybook/addon-vitest. O alias `obsidian` aponta pro
//                    mock do Storybook (desenha ícones, renderiza markdown).
//
// Rodar tudo:        npm test
// Só os unitários:   npx vitest --project unit
// Só as stories:     npx vitest --project storybook   (requer Chromium do Playwright:
//                                                      npx playwright install chromium)
export default defineConfig(async () => ({
  test: {
    projects: [
      {
        resolve: {
          alias: { obsidian: resolve(__dirname, "tests/obsidian-stub.ts") },
        },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/**/*.test.ts"],
        },
      },
      {
        plugins: [
          await storybookTest({ configDir: resolve(__dirname, ".storybook") }),
        ],
        resolve: {
          alias: { obsidian: resolve(__dirname, ".storybook/obsidian-mock.ts") },
        },
        // Desde a Storybook 10.3 o addon-vitest provisiona as anotações do
        // preview automaticamente — não é preciso setupFile com
        // setProjectAnnotations.
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
}));
