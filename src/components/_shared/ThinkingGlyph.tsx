// src/components/_shared/ThinkingGlyph.tsx
// Glyph animado estilo "clauding" — uma FAÍSCA que gira + respira + brilha.
// Animação REAL (transform: rotate no svg + scale na faísca), não só opacity.
// É o elemento que prende o olho enquanto a IA pensa/responde. v0.1.173
//
// Usos:
//   - thinking / activities pending  → como ícone
//   - streaming de texto             → como caret (className="axxa-stream-caret")
// Respeita prefers-reduced-motion (CSS desliga a animação).

import * as React from "react";

export function ThinkingGlyph({ className }: { className?: string }) {
  return (
    <span
      className={"axxa-glyph" + (className ? " " + className : "")}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="axxa-glyph-svg">
        <path
          className="axxa-glyph-spark"
          d="M12 2 C 12.9 8.2 15.8 11.1 22 12 C 15.8 12.9 12.9 15.8 12 22 C 11.1 15.8 8.2 12.9 2 12 C 8.2 11.1 11.1 8.2 12 2 Z"
        />
      </svg>
    </span>
  );
}
