// src/components/_shared/InfoChip.tsx
// Chip colorido com micro-ícone — mesmo padrão usado no status line do
// Composer (provider/model/effort/tokens). Reusado em recent chats list,
// ConversationsList items, e qualquer lugar que precise mostrar
// "atributo: valor" de forma compacta.
//
// Visual:
//   ●─icon─ valor          (cor controlada pelo `color` prop)
//
// Tipografia: 10px, truncate quando estoura. Pra cores ver paleta no
// DESIGN-SYSTEM.md — 6 cores semânticas (purple/orange/cyan/pink/blue/green).

import { ReactNode } from "react";
import { Icon } from "./Icon";

interface InfoChipProps {
  icon: string;
  color: string;
  children: ReactNode;
  /** Tooltip opcional (mostra ao hover) */
  title?: string;
}

export function InfoChip({ icon, color, children, title }: InfoChipProps) {
  return (
    <span className="axxa-info-chip" style={{ color }} title={title}>
      <Icon name={icon} />
      <span>{children}</span>
    </span>
  );
}
