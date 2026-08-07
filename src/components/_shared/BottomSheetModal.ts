// src/components/_shared/BottomSheetModal.ts
// Casca GLOBAL de bottom sheet sobre o Modal NATIVO do Obsidian. Reutilizável por
// QUALQUER sheet do app — o conteúdo (React) é portalado pro contentEl pelo caller
// (createPortal), então segue vivo/reativo. A casca dá:
//   - formato bottom sheet no mobile (colado embaixo, cantos no topo)
//   - superfície na cor do tema (primary no light / secondary no dark)
//   - scrim + blur no fundo
//   - animação de subida (CSS na classe global .axxa-sheet-modal → atinge TODOS
//     os sheets de uma vez)
//   - X próprio na LINHA DO TÍTULO: removemos o X nativo do Obsidian (que, no
//     mobile, é um button.mod-raised.clickable-icon numa área de header ACIMA do
//     conteúdo — impossível alinhar só com CSS) e montamos o nosso X posicionado
//     relativo ao contentEl, na linha do título. Determinístico.
// Classes: .axxa-sheet-modal (modalEl) · .axxa-sheet-modal-container (containerEl,
// pro scrim/blur) · .axxa-sheet-modal-content (contentEl) · .axxa-sheet-x (X).
// Ver memória obsidian-native-modals (o modal vive fora do .axxa-root).

import { App, Modal, setIcon } from "obsidian";

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
    // Remove o X nativo (classe varia por versão: .modal-close-button OU
    // button.mod-raised.clickable-icon) — pega QUALQUER botão do modalEl que NÃO
    // esteja no conteúdo portalado. Robusto a versão/estrutura.
    Array.from(this.modalEl.querySelectorAll("button"))
      .filter((b) => !this.contentEl.contains(b))
      .forEach((b) => b.remove());
    // Nosso X, na LINHA DO TÍTULO (position relativa ao contentEl no CSS). Como
    // o portal do React não remove filhos pré-existentes do container, este botão
    // sobrevive ao mount do conteúdo.
    const x = this.contentEl.createEl("button", {
      cls: "axxa-sheet-x",
      attr: { type: "button", "aria-label": "Close" },
    });
    setIcon(x, "x");
    x.addEventListener("click", () => this.close());
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
