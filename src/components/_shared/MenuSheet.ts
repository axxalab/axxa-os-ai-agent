// src/components/_shared/MenuSheet.ts
// EXPERIMENTAL (spike) — casca de bottom sheet usando o MENU nativo do Obsidian.
// No mobile o Menu JÁ nasce como bottom sheet (handle/backdrop/animação/dismiss
// de fábrica), sem a briga que o Modal deu (posição/scrim/X/header). Injetamos
// nosso conteúdo no `.dom` do menu; o caller portala React pro `contentEl`.
//
// MESMA interface do BottomSheetModal (constructor(app,onDismiss[,cls]), open(),
// close(), contentEl) pra troca ser 1 linha no AxxaApp.
//
// Por que taps DENTRO não fecham: o Obsidian só fecha o menu em tap FORA do
// `.dom` (checa containment), então favoritar / trocar sub-tela seguem abertos.
// Adicionamos a classe `axxa-sheet-modal` no `.dom` pra reusar as MESMAS regras
// de conteúdo (`.axxa-sheet-modal .axxa-sheet-row/star/...`) já replicadas — as
// regras de posição/bg do modal (`.modal.axxa-sheet-modal`) NÃO batem (menu não
// é `.modal`), e o menu nativo já cuida disso. Ver [[obsidian-native-modals]].

import { App, Menu } from "obsidian";

export class MenuSheet {
  private menu: Menu;
  private onDismiss: () => void;
  private notified = false;
  readonly contentEl: HTMLElement;

  constructor(_app: App, onDismiss: () => void, extraContentClass?: string) {
    this.onDismiss = onDismiss;
    this.menu = new Menu();
    // `.dom` é o elemento `.menu` (não tipado na API pública, mas existe).
    const dom = (this.menu as unknown as { dom: HTMLElement }).dom;
    dom.addClass("axxa-sheet-menu");
    dom.addClass("axxa-sheet-modal"); // reusa as regras de conteúdo replicadas
    this.contentEl = dom.createDiv({ cls: "axxa-sheet-menu-content" });
    if (extraContentClass) this.contentEl.addClass(extraContentClass);
    this.menu.onHide(() => {
      if (this.notified) return;
      this.notified = true;
      this.onDismiss();
    });
  }

  open() {
    // Mobile: o Menu vira BOTTOM SHEET nativo (a posição é ignorada no mobile).
    this.menu.showAtPosition({ x: 0, y: 0 });
  }

  close() {
    this.menu.close();
  }
}
