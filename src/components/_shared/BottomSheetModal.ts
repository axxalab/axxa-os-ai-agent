// src/components/_shared/BottomSheetModal.ts
// Casca GLOBAL de bottom sheet sobre o Modal NATIVO do Obsidian. Reutilizável por
// QUALQUER sheet do app — o conteúdo (React) é portalado pro contentEl pelo caller
// (createPortal), então segue vivo/reativo. A casca dá:
//   - formato bottom sheet no mobile (colado embaixo, cantos no topo)
//   - superfície na cor do tema (primary no light / secondary no dark)
//   - scrim + blur no fundo
//   - animação de subida (CSS na classe global .axxa-sheet-modal → atinge TODOS
//     os sheets de uma vez)
// O X nativo do Obsidian (top-right) é MANTIDO — é ele quem fecha (os sheets não
// trazem X próprio). Classes: .axxa-sheet-modal (modalEl) ·
// .axxa-sheet-modal-container (containerEl, pro scrim/blur) ·
// .axxa-sheet-modal-content (contentEl). Ver memória obsidian-native-modals (o
// modal vive fora do .axxa-root).

import { App, Modal } from "obsidian";

export class BottomSheetModal extends Modal {
  private onDismiss: () => void;
  private extraContentClass?: string;
  private notified = false;

  /** onDismiss: chamado UMA vez ao fechar (fechar o state no React).
   *  extraContentClass: classe opcional no contentEl pra tweaks por-sheet. */
  constructor(app: App, onDismiss: () => void, extraContentClass?: string) {
    super(app);
    this.onDismiss = onDismiss;
    this.extraContentClass = extraContentClass;
  }

  onOpen() {
    this.modalEl.addClass("axxa-sheet-modal");
    this.containerEl.addClass("axxa-sheet-modal-container");
    this.contentEl.addClass("axxa-sheet-modal-content");
    if (this.extraContentClass) this.contentEl.addClass(this.extraContentClass);
    // X nativo do Obsidian é mantido (fecha o sheet) — não removemos nem escondemos.
  }

  onClose() {
    // Dispara UMA vez. Fechamento pelo usuário (backdrop/back/swipe) chega aqui
    // → avisa o React pra baixar o state → o portal desmonta sozinho. NÃO
    // esvaziamos o contentEl: quem é dono daqueles nós é o React (portal).
    if (!this.notified) {
      this.notified = true;
      this.onDismiss();
    }
  }
}
