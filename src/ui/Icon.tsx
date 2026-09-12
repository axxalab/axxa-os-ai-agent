// src/ui/Icon.tsx
// Ícone Lucide via `setIcon` do Obsidian — o mesmo set que o app usa, então
// herda tema, peso e tamanho nativos. Sem SVG nosso, sem innerHTML.

import { setIcon } from "obsidian";
import { useEffect, useRef } from "react";

export function Icon({
  name,
  size,
  className,
}: {
  name: string;
  /** Lado do quadrado em px (default: o do Obsidian). */
  size?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    setIcon(el, name);
    if (size) {
      const svg = el.querySelector("svg");
      svg?.setAttribute("width", String(size));
      svg?.setAttribute("height", String(size));
    }
  }, [name, size]);

  return (
    <span
      ref={ref}
      className={className ? `axxa-icon ${className}` : "axxa-icon"}
      aria-hidden="true"
    />
  );
}
