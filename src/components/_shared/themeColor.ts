// src/components/_shared/themeColor.ts
// Controle do <meta name="theme-color"> — Android Chrome / Obsidian mobile
// lê esse meta tag pra colorir o OS status bar (topo do celular onde fica
// bateria/relógio). Apple Safari também lê pra Safari mobile UI.
//
// Por preset: cor aproximada do TOPO do gradient (linear) ou da região
// dominante (radial/live), em mix com bg-primary. Light/dark variants
// pra acompanhar tema do user.
//
// Lifecycle: AxxaView chama applyThemeColor() no onOpen + cada
// settings change; restoreThemeColor() no onClose pra devolver o que
// Obsidian tinha antes (cor do tema dele).

export interface ThemeColorPair {
  light: string;
  dark: string;
}

/**
 * Cores aproximam o topo visual de cada preset depois de mixar com
 * bg-primary do tema padrão (#ffffff light / #1e1e1e dark).
 *
 * null = preset "none" preserva o theme-color original do Obsidian/tema.
 */
// v0.1.106: novo conjunto (8 static + 8 live). Cores espelham as vars
// --axxa-navbar-tint em styles/main.css — mantenha os dois em sincronia.
export const PRESET_THEME_COLORS: Record<string, ThemeColorPair | null> = {
  none: null,
  // === Static (8) ===
  dawn: { light: "#ffe9e0", dark: "#2a1f1c" },
  ocean: { light: "#dff0f5", dark: "#172a32" },
  forest: { light: "#dff2e8", dark: "#152e26" },
  violet: { light: "#e9e0f7", dark: "#221a38" },
  rose: { light: "#fbe2ef", dark: "#2e1a28" },
  amber: { light: "#f7eed3", dark: "#322a18" },
  slate: { light: "#e6eaf0", dark: "#1c2230" },
  mono: { light: "#eaeaea", dark: "#1c1c1c" },
  // === Live (animadas) ===
  aurora: { light: "#dff2e6", dark: "#16261d" },
  nebula: { light: "#ece0f2", dark: "#221a30" },
  pulse: { light: "#e0e2f5", dark: "#1b1d33" },
  flow: { light: "#e6e2f5", dark: "#221d33" },
  tide: { light: "#dceff2", dark: "#15282c" },
  ember: { light: "#f7e6db", dark: "#2e1f18" },
  spectrum: { light: "#e9e6f2", dark: "#221f30" },
  lagoon: { light: "#dcf0ec", dark: "#142724" },
};

// Estado module-level pra um único AxxaView na sessão. Se mais de uma
// view abrir simultaneamente, o último ganha — comportamento aceitável
// já que só uma OS status bar existe.
let savedThemeColor: string | null = null;
let metaEl: HTMLMetaElement | null = null;

function findOrCreateMeta(doc: Document): HTMLMetaElement {
  if (metaEl && metaEl.isConnected && metaEl.ownerDocument === doc) {
    return metaEl;
  }
  metaEl = doc.querySelector(
    'meta[name="theme-color"]'
  ) as HTMLMetaElement | null;
  if (!metaEl) {
    metaEl = doc.createElement("meta");
    metaEl.name = "theme-color";
    doc.head.appendChild(metaEl);
  }
  return metaEl;
}

/**
 * Aplica o theme-color baseado no preset + dark mode. Salva o original
 * na primeira chamada pra restoreThemeColor() depois devolver.
 */
export function applyThemeColor(
  doc: Document,
  preset: string,
  isDark: boolean
): void {
  const meta = findOrCreateMeta(doc);
  if (savedThemeColor === null) {
    savedThemeColor = meta.content || "";
  }

  const pair = PRESET_THEME_COLORS[preset];
  if (!pair) {
    // Preset "none" ou desconhecido — restaura o original do tema
    meta.content = savedThemeColor;
    return;
  }
  meta.content = isDark ? pair.dark : pair.light;
}

/**
 * Restaura o theme-color que o Obsidian/tema tinha antes do AXXA mudar.
 * Idempotente — chamar duas vezes não quebra.
 */
export function restoreThemeColor(): void {
  if (metaEl && savedThemeColor !== null) {
    metaEl.content = savedThemeColor;
  }
  savedThemeColor = null;
}
