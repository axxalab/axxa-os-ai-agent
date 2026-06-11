// src/entitlements.ts
// Plano (free vs pro) + navegação das telas. Centraliza O QUE é pago e qual
// telas existem, pra UI gatear num lugar só. v0.1.174
//
// Telas pagas: media / projects / statistics / profile. Livres: chat,
// conversations e settings. O entitlement REAL vem de `accountTier` (futuro:
// billing); por enquanto default "pro". O admin testa o free via
// `devTierOverride` ("auto" | "free" | "pro") sem mexer no entitlement real.

export type Tier = "free" | "pro";

export type AppView =
  | "chat"
  | "conversations"
  | "media"
  | "projects"
  | "statistics"
  | "profile";

/** Telas que exigem plano pago. */
export const PAID_VIEWS: AppView[] = [
  "media",
  "projects",
  "statistics",
  "profile",
];

export interface TierSettings {
  accountTier?: string;
  devTierOverride?: string;
}

/** Tier efetivo: override de admin tem prioridade; senão o entitlement real. */
export function getEffectiveTier(s: TierSettings): Tier {
  const ov = s.devTierOverride;
  if (ov === "free" || ov === "pro") return ov;
  return s.accountTier === "free" ? "free" : "pro";
}

export function viewRequiresPro(view: AppView): boolean {
  return PAID_VIEWS.includes(view);
}

/** O tier atual pode abrir essa tela? */
export function canAccess(view: AppView, tier: Tier): boolean {
  return tier === "pro" || !viewRequiresPro(view);
}

/** Metadados de um item de navegação (label vem do i18n por `view`). */
export interface NavItemMeta {
  view: AppView;
  icon: string;
}

// Ordem da navegação. Os PRIMARY_COUNT primeiros aparecem sempre; o resto fica
// atrás do "Ver mais" (colapsado). Settings fica no rodapé (abre o nativo).
export const NAV_ITEMS: NavItemMeta[] = [
  { view: "conversations", icon: "messages-square" },
  { view: "media", icon: "image" },
  { view: "statistics", icon: "bar-chart-3" },
  { view: "projects", icon: "folder-kanban" },
  { view: "profile", icon: "user-round" },
];

export const PRIMARY_COUNT = 3;
