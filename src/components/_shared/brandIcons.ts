// src/components/_shared/brandIcons.ts
// SVGs estilizados pra cada provider — marcas ORIGINAIS, semanticamente
// inspiradas em cada brand (sem reproduzir logos trademarked).
//
// Registrados via addIcon() do Obsidian no onload do plugin. Depois o
// componente <Icon name="brand-openai" /> resolve normalmente via setIcon.
//
// Padrão técnico:
//   - viewBox 0 0 100 100 (Obsidian default)
//   - stroke/fill = currentColor → herda cor do tema
//   - stroke-width 7-9 pra ficar visível em 18px sem virar borrão

import { addIcon } from "obsidian";

export const BRAND_ICONS: Record<string, string> = {
  // OpenAI — sunburst (8 raios + núcleo). Conceito de "centro irradiando IA".
  "brand-openai": `
    <g fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round">
      <line x1="50" y1="8" x2="50" y2="24"/>
      <line x1="50" y1="76" x2="50" y2="92"/>
      <line x1="8" y1="50" x2="24" y2="50"/>
      <line x1="76" y1="50" x2="92" y2="50"/>
      <line x1="20" y1="20" x2="32" y2="32"/>
      <line x1="68" y1="68" x2="80" y2="80"/>
      <line x1="20" y1="80" x2="32" y2="68"/>
      <line x1="68" y1="32" x2="80" y2="20"/>
    </g>
    <circle cx="50" cy="50" r="14" fill="currentColor"/>
  `,
  // Anthropic — pico triangular sólido (montanha / letra A simplificada).
  "brand-anthropic": `
    <g fill="currentColor">
      <path d="M50 14 L18 86 L34 86 L42 66 L58 66 L66 86 L82 86 Z M46 54 L54 54 L50 42 Z"/>
    </g>
  `,
  // Gemini — sparkle de 4 pontas (mark conceito universal de gen-AI).
  "brand-gemini": `
    <g fill="currentColor">
      <path d="M50 8 C53 38 62 47 92 50 C62 53 53 62 50 92 C47 62 38 53 8 50 C38 47 47 38 50 8 Z"/>
    </g>
  `,
  // OpenRouter — tri-fork com nós (rota dividindo entre múltiplos providers).
  "brand-openrouter": `
    <g fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M50 80 L50 50"/>
      <path d="M50 50 L22 22"/>
      <path d="M50 50 L78 22"/>
    </g>
    <circle cx="50" cy="82" r="9" fill="currentColor"/>
    <circle cx="22" cy="22" r="9" fill="currentColor"/>
    <circle cx="78" cy="22" r="9" fill="currentColor"/>
  `,
  // Nvidia NIM — hexágono (chip / silício) com circuito interno.
  "brand-nim": `
    <g fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="50,14 84,34 84,66 50,86 16,66 16,34"/>
      <path d="M38 38 L38 62 L62 62 L62 38 Z"/>
      <line x1="50" y1="14" x2="50" y2="38"/>
      <line x1="50" y1="62" x2="50" y2="86"/>
      <line x1="16" y1="50" x2="38" y2="50"/>
      <line x1="62" y1="50" x2="84" y2="50"/>
    </g>
  `,
  // Ollama — silhueta de lhama (cabeça + pescoço + corpo).
  "brand-ollama": `
    <g fill="currentColor">
      <path d="M38 86 L38 52 Q38 40 48 40 L48 26 Q48 18 56 18 Q64 18 64 26 L64 40 Q74 40 74 52 L74 86 L64 86 L64 60 L48 60 L48 86 Z"/>
      <circle cx="58" cy="30" r="3" fill="var(--background-primary, #fff)"/>
    </g>
  `,
};

/**
 * Registra todos os ícones de brand no Obsidian. Chamar UMA vez no onload.
 * Idempotente — chamar várias vezes não duplica nem quebra.
 */
export function registerBrandIcons(): void {
  for (const [id, svg] of Object.entries(BRAND_ICONS)) {
    addIcon(id, svg);
  }
}
