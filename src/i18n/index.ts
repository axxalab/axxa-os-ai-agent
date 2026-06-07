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
import { PT_BR, type Translations } from "./pt-br";
import { EN_US } from "./en-us";

export type { Translations } from "./pt-br";

export type Locale = "pt-br" | "en-us";

const TRANSLATIONS: Record<Locale, Translations> = {
  "pt-br": PT_BR,
  "en-us": EN_US,
};

/** Devolve o dicionário do locale ou PT-BR como fallback. */
export function getTranslations(locale: string): Translations {
  return TRANSLATIONS[locale as Locale] ?? PT_BR;
}

/** Context React — AxxaApp envolve toda a árvore com o locale ativo. */
export const TranslationsContext = createContext<Translations>(PT_BR);

/** Hook pra ler o dicionário do locale ativo. */
export function useT(): Translations {
  return useContext(TranslationsContext);
}
