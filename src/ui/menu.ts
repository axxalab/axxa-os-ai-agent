// src/ui/menu.ts
// Menu NATIVO do Obsidian para AÇÕES (o ⋯ de um chat no menu lateral). No
// mobile ele vira sheet do próprio app, no desktop é o popup de sempre.
//
// Escolher provider/modelo/effort NÃO passa por aqui: esses são bottom sheets
// nossos, em Sheet.tsx — o Menu não dá conta de linha com título + legenda,
// check e cartões agrupados.

import { Menu } from "obsidian";

/** Menu de ações (⋯ de um chat, de um projeto). */
export interface MenuAction {
  label: string;
  icon?: string;
  danger?: boolean;
  run: () => void;
}

export function openActions(
  ev: { clientX?: number; clientY?: number },
  actions: MenuAction[]
): void {
  const menu = new Menu();
  for (const a of actions) {
    menu.addItem((item) => {
      item.setTitle(a.label).onClick(a.run);
      if (a.icon) item.setIcon(a.icon);
      if (a.danger) item.setWarning(true);
    });
  }
  showMenu(menu, ev);
}

function showMenu(menu: Menu, ev: { clientX?: number; clientY?: number }): void {
  const x = typeof ev.clientX === "number" ? ev.clientX : 0;
  const y = typeof ev.clientY === "number" ? ev.clientY : 0;
  menu.showAtPosition({ x, y });
}
