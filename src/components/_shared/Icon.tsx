// src/components/_shared/Icon.tsx
// Wrapper React do setIcon do Obsidian.
// Obsidian já vem com a biblioteca Lucide bundleada — usar setIcon mantém
// consistência visual com o resto do app (tamanho, stroke, cor herdada).

import { useEffect, useRef } from "react";
import { setIcon } from "obsidian";

interface IconProps {
  name: string;
  className?: string;
}

export function Icon({ name, className }: IconProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Limpa filhos anteriores antes de re-renderizar o SVG.
    // replaceChildren() sem args é a forma segura (sem innerHTML).
    ref.current.replaceChildren();
    setIcon(ref.current, name);
  }, [name]);

  return <span ref={ref} className={`axxa-icon ${className ?? ""}`.trim()} />;
}
