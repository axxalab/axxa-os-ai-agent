// src/components/_shared/AppContext.tsx
// Context React pra disponibilizar o App do Obsidian em qualquer componente
// (sem passar via prop drilling). Necessário pro MarkdownRenderer.render().

import { createContext, useContext } from "react";
import type { App } from "obsidian";

export const AppContext = createContext<App | null>(null);

export function useApp(): App {
  const app = useContext(AppContext);
  if (!app) {
    throw new Error(
      "AppContext não provido — envolva o componente em <AppContext.Provider value={plugin.app}>."
    );
  }
  return app;
}
