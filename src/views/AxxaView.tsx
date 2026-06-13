// src/views/AxxaView.tsx
// ItemView nativa do Obsidian que hospeda a árvore React.
// Pensa nela como o "frame" no Figma onde o conteúdo React vive dentro.
// Inclui o mobile keyboard observer (técnica do plugin Copilot).

import { ItemView, WorkspaceLeaf, Platform } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { AxxaApp } from "./AxxaApp";
import { ErrorBoundary } from "../components/_shared/ErrorBoundary";
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
    this.root.render(
      <ErrorBoundary>
        <AxxaApp plugin={this.plugin} />
      </ErrorBoundary>
    );

    // v0.1.127: o preset/tema vive SÓ dentro da .axxa-root (pintada pela
    // própria classe axxa-bg-<preset> no AxxaApp). Não tintamos mais
    // body / drawer / leaf-content / navbar, nem o theme-color do OS —
    // zero toque em elemento ou variável nativa do Obsidian.
    this.setupMobileKeyboardObserver();
  }

  async onClose() {
    this.teardownMobileKeyboardObserver();
    this.root?.unmount();
    this.root = null; // v0.1.228: zera a ref pra não segurar Root já desmontado
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

    // v0.1.228: o MutationObserver dispara em TODA mudança de `style` global
    // do <html>, mas só nos importa quando `--keyboard-height` muda. Cacheamos
    // o último valor lido pra dar early-return e evitar closest()/toggle()
    // redundantes nas mudanças de style que não mexem no teclado.
    let lastKeyboardHeight = -1;

    const update = () => {
      // Lê o valor atual da variável CSS (Obsidian seta inline no style)
      const keyboardHeight = parseFloat(
        docEl.style.getPropertyValue("--keyboard-height") || "0"
      );
      if (keyboardHeight === lastKeyboardHeight) return;
      lastKeyboardHeight = keyboardHeight;

      // Re-busca o drawer a cada update — sobrevive a migração entre janelas
      const drawer = this.containerEl.closest(".workspace-drawer");
      if (!drawer) return;

      // Confere se a view está na aba ativa do drawer (multi-tab support)
      const active = !!this.containerEl.closest(
        ".workspace-drawer-active-tab-content"
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
