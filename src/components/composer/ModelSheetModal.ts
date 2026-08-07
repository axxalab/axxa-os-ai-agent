// src/components/composer/ModelSheetModal.ts
// Casca NATIVA do Obsidian pro seletor de modelo. No mobile o Obsidian já
// renderiza o .modal como bottom sheet (sobe de baixo, backdrop/animação/foco
// de fábrica, e FECHA o teclado ao abrir) — o sheet custom em React portalado
// pro body abria no topo e brigava com o teclado. Mesmo caminho do ReasoningModal.
//
// O CONTEÚDO (React ModelSheet) é portalado pro contentEl pelo AxxaApp, então o
// estado (favoritos/effort/thinking) continua vivo e reativo. Por isso NÃO
// esvaziamos o contentEl aqui: quem é dono daqueles nós é o React (o unmount do
// portal remove os próprios nós). Só avisamos o React pra fechar o state.

import { App, Modal } from "obsidian";

export class ModelSheetModal extends Modal {
  private onDismiss: () => void;
  private notified = false;

  constructor(app: App, onDismiss: () => void) {
    super(app);
    this.onDismiss = onDismiss;
  }

  onOpen() {
    this.modalEl.addClass("axxa-model-modal");
    this.contentEl.addClass("axxa-model-modal-content");
  }

  onClose() {
    // Dispara UMA vez. Fechamento pelo usuário (backdrop/back/swipe) chega aqui
    // → avisa o React pra baixar o state → o portal desmonta sozinho. Fechamento
    // programático (cleanup do effect) também passa aqui, mas o guard evita
    // re-notificar em loop.
    if (!this.notified) {
      this.notified = true;
      this.onDismiss();
    }
  }
}
