// src/i18n/index.ts
// Setup do i18n: registry de locales + context React + hook useT.
//
// Uso em componente React:
//   const t = useT();
//   return <button>{t.menu.copy}</button>;
//
// Uso em código TS puro (ex.: AxxaSettingsTab):
//   const t = getTranslations(plugin.settings.language);
//   notice(t.settings.modelSetNotice(modelName));

import { createContext, useContext } from "react";
import { EN_US, type Translations } from "./en-us";

export type { Translations } from "./en-us";

// EN-US é o único locale por enquanto — PT-BR removido (i18n será refeito).
export function getTranslations(_locale: string): Translations {
  return EN_US;
}

/** Context React — AxxaApp envolve toda a árvore com o locale ativo. */
export const TranslationsContext = createContext<Translations>(EN_US);

/** Hook pra ler o dicionário do locale ativo. */
export function useT(): Translations {
  return useContext(TranslationsContext);
}
