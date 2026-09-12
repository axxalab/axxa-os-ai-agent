// src/ui/menu.ts
// Seletores via Menu NATIVO do Obsidian. No mobile o Menu vira sheet do
// próprio app — melhor alvo de toque e zero CSS nosso — e no desktop é o
// popup de sempre. Substitui os <select> da casca crua.

import { Menu } from "obsidian";

export interface PickOption {
  value: string;
  label: string;
  /** Linha secundária (modelo ativo, "no key", descrição do effort…). */
  note?: string;
  icon?: string;
  disabled?: boolean;
}

/** Abre o menu de escolha ancorado no elemento clicado. */
export function openPicker(
  ev: { clientX?: number; clientY?: number; currentTarget?: unknown },
  options: PickOption[],
  current: string,
  onPick: (value: string) => void
): void {
  const menu = new Menu();
  for (const opt of options) {
    menu.addItem((item) => {
      item
        .setTitle(opt.note ? `${opt.label} · ${opt.note}` : opt.label)
        .setChecked(opt.value === current)
        .onClick(() => {
          if (!opt.disabled) onPick(opt.value);
        });
      if (opt.icon) item.setIcon(opt.icon);
      if (opt.disabled) item.setDisabled(true);
    });
  }
  showMenu(menu, ev);
}

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
