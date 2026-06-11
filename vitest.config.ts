import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Vitest config. Tests vivem em tests/ (fora de src/, então o `tsc` do build
// não os typecheck — build segue limpo e rápido). O alias `obsidian` aponta
// pra um stub: módulos que importam a API do Obsidian (providers, persistência)
// passam a ser testáveis sem o runtime real do app.
export default defineConfig({
  resolve: {
    alias: {
      obsidian: resolve(__dirname, "tests/obsidian-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
