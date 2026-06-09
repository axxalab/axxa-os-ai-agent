// src/views/AxxaView.tsx
// ItemView nativa do Obsidian que hospeda a árvore React.
// Pensa nela como o "frame" no Figma onde o conteúdo React vive dentro.
// Inclui o mobile keyboard observer (técnica do plugin Copilot).

import { ItemView, WorkspaceLeaf, Platform } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { AxxaApp } from "./AxxaApp";
import type AxxaPlugin from "../main";

export const VIEW_TYPE_AXXA = "axxa-os-ai-agent";

export class AxxaView extends ItemView {
  root: Root | null = null;
  plugin: AxxaPlugin;
  private keyboardObserver: MutationObserver | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: AxxaPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_AXXA;
  }

  getDisplayText() {
    return "AXXA OS";
  }

  getIcon() {
    return "bot";
  }

  async onOpen() {
    // containerEl.children[1] é o "miolo" da view (o [0] é o header).
    const container = this.containerEl.children[1] as HTMLElement;
    this.root = createRoot(container);
    this.root.render(<AxxaApp plugin={this.plugin} />);

    this.setupMobileKeyboardObserver();
    this.setupActiveLeafObserver();
  }

  async onClose() {
    this.teardownMobileKeyboardObserver();
    this.teardownActiveLeafObserver();
    this.root?.unmount();
  }

  /**
   * Observer de active-leaf — controla quando body.axxa-fullscreen-active
   * fica ativo. Permite que o CSS de fullscreen so afete a UI quando AXXA
   * for a leaf ativa, evitando vazar pra editor de notes etc.
   */
  private activeLeafUnsubscribe: (() => void) | null = null;
  private setupActiveLeafObserver() {
    if (!Platform.isMobile) return;

    const update = () => {
      const activeLeaf = this.app.workspace.activeLeaf;
      const isAxxaActive = activeLeaf?.view?.getViewType() === VIEW_TYPE_AXXA;
      this.containerEl.doc.body.classList.toggle(
        "axxa-fullscreen-active",
        Boolean(isAxxaActive && this.plugin.settings.mobileFullscreen)
      );
    };

    update();
    const evt = this.app.workspace.on("active-leaf-change", update);
    this.activeLeafUnsubscribe = () => this.app.workspace.offref(evt);
  }

  private teardownActiveLeafObserver() {
    this.activeLeafUnsubscribe?.();
    this.activeLeafUnsubscribe = null;
    this.containerEl.doc.body.classList.remove("axxa-fullscreen-active");
  }

  /**
   * Observer do teclado mobile — réplica da técnica usada pelo plugin Copilot.
   *
   * O Obsidian mobile expõe a variável CSS `--keyboard-height` no <html>
   * sempre que o teclado virtual abre/fecha. Em vez de tentar detectar o
   * teclado diretamente (que é inconsistente entre iOS/Android), observamos
   * essa variável e reagimos.
   *
   * Quando o teclado está aberto E essa view é a aba ativa do drawer,
   * adicionamos a classe `axxa-keyboard-open` no `.workspace-drawer`.
   * O CSS reage escondendo header/tab-options do drawer pra dar mais espaço.
   */
  private setupMobileKeyboardObserver() {
    if (!Platform.isMobile) return;

    const docEl = this.containerEl.doc.documentElement;

    const update = () => {
      // Re-busca o drawer a cada update — sobrevive a migração entre janelas
      const drawer = this.containerEl.closest(".workspace-drawer");
      if (!drawer) return;

      // Confere se a view está na aba ativa do drawer (multi-tab support)
      const active = !!this.containerEl.closest(
        ".workspace-drawer-active-tab-content"
      );

      // Lê o valor atual da variável CSS (Obsidian seta inline no style)
      const keyboardHeight = parseFloat(
        docEl.style.getPropertyValue("--keyboard-height") || "0"
      );

      const isOpen = active && keyboardHeight > 0;
      drawer.classList.toggle("axxa-keyboard-open", isOpen);
      // Marca também o body pra modais (que ficam FORA do drawer) poderem
      // se reposicionar quando teclado virtual abre. Sem isso, modal
      // central no mobile fica atrás do teclado.
      this.containerEl.doc.body.classList.toggle("axxa-keyboard-open", isOpen);
    };

    // Check inicial — cobre o caso do teclado já estar aberto na hora da view abrir
    update();

    // Observa só o atributo `style` do <html> — é onde o Obsidian altera
    // --keyboard-height. Mais barato que observar todo o DOM.
    this.keyboardObserver = new MutationObserver(update);
    this.keyboardObserver.observe(docEl, {
      attributes: true,
      attributeFilter: ["style"],
    });
  }

  private teardownMobileKeyboardObserver() {
    this.keyboardObserver?.disconnect();
    this.keyboardObserver = null;

    // Garante que a classe não vaza pra outras views se essa fechar
    // com o teclado ainda aberto
    const drawer = this.containerEl.closest(".workspace-drawer");
    drawer?.classList.remove("axxa-keyboard-open");
    this.containerEl.doc.body.classList.remove("axxa-keyboard-open");
  }
}
