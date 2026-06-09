// src/views/AxxaView.tsx
// ItemView nativa do Obsidian que hospeda a árvore React.
// Pensa nela como o "frame" no Figma onde o conteúdo React vive dentro.
// Inclui o mobile keyboard observer (técnica do plugin Copilot).

import { ItemView, WorkspaceLeaf, Platform } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { AxxaApp } from "./AxxaApp";
import type AxxaPlugin from "../main";
import {
  applyThemeColor,
  restoreThemeColor,
} from "../components/_shared/themeColor";

export const VIEW_TYPE_AXXA = "axxa-os-ai-agent";

export class AxxaView extends ItemView {
  root: Root | null = null;
  plugin: AxxaPlugin;
  private keyboardObserver: MutationObserver | null = null;
  /** Referência ao drawer container que recebeu o nosso bg (mobile). */
  private drawerHostEl: HTMLElement | null = null;
  /** Unsubscribe das settings — usado pra atualizar bg quando o user troca. */
  private drawerHostUnsub: (() => void) | null = null;
  /** Unsubscribe do theme-color sync (OS status bar). */
  private themeColorUnsub: (() => void) | null = null;
  /** Observer pra detectar troca de tema claro/escuro do Obsidian. */
  private themeObserver: MutationObserver | null = null;
  /** Unsubscribe do navbar tint (mobile-navbar bottom). */
  private navbarTintUnsub: (() => void) | null = null;

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

    this.setupDrawerHost();
    this.setupThemeColor();
    this.setupNavbarTint();
    this.setupMobileKeyboardObserver();
  }

  async onClose() {
    this.teardownDrawerHost();
    this.teardownThemeColor();
    this.teardownNavbarTint();
    this.teardownMobileKeyboardObserver();
    this.root?.unmount();
  }

  /**
   * Navbar tint (mobile): planta `axxa-host-active` + `axxa-bg-{preset}`
   * no <body> enquanto AXXA está aberto. CSS então tinta a `.mobile-navbar`
   * matching a cor dominante do preset (mesmas cores do theme-color).
   *
   * Cleanup remove as classes no onClose pra navbar voltar ao default
   * quando o user fecha a view (ou troca pra outra leaf type).
   */
  private setupNavbarTint() {
    if (!Platform.isMobile) return;
    const body = this.containerEl.doc.body;

    const apply = () => {
      body.classList.add("axxa-host-active");
      // Remove qualquer axxa-bg-* anterior do body antes de plantar o novo
      Array.from(body.classList).forEach((c) => {
        if (c.startsWith("axxa-bg-")) body.classList.remove(c);
      });
      body.classList.add(
        "axxa-bg-" + (this.plugin.settings.background || "none")
      );
    };

    apply();
    this.navbarTintUnsub = this.plugin.onSettingsChange(apply);
  }

  private teardownNavbarTint() {
    this.navbarTintUnsub?.();
    this.navbarTintUnsub = null;
    const body = this.containerEl.doc.body;
    body.classList.remove("axxa-host-active");
    Array.from(body.classList).forEach((c) => {
      if (c.startsWith("axxa-bg-")) body.classList.remove(c);
    });
  }

  /**
   * Theme color OS status bar (mobile): seta <meta name="theme-color">
   * pra Android Chrome / Obsidian mobile colorir o status bar do sistema
   * (onde fica bateria/relógio) matching o preset atual do user.
   *
   * Sync em 3 momentos:
   *  - onOpen (initial apply)
   *  - settings change (user troca preset)
   *  - body.theme-dark toggle (user troca tema claro/escuro)
   *
   * Cleanup no onClose restaura o theme-color original do tema/Obsidian.
   */
  private setupThemeColor() {
    if (!Platform.isMobile) return;
    const doc = this.containerEl.doc;
    const body = doc.body;

    const update = () => {
      const isDark = body.classList.contains("theme-dark");
      applyThemeColor(
        doc,
        this.plugin.settings.background || "none",
        isDark
      );
    };

    update();
    this.themeColorUnsub = this.plugin.onSettingsChange(update);

    // Observa toggle de tema (Obsidian alterna body.theme-light/theme-dark)
    this.themeObserver = new MutationObserver(update);
    this.themeObserver.observe(body, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  private teardownThemeColor() {
    this.themeColorUnsub?.();
    this.themeColorUnsub = null;
    this.themeObserver?.disconnect();
    this.themeObserver = null;
    restoreThemeColor();
  }

  /**
   * Drawer host (mobile): pinta o bg do AXXA direto no
   * .workspace-drawer-active-tab-container — em vez de só na .axxa-root.
   *
   * Por quê? O drawer tem `margin-top` + `flex-direction:column-reverse` e
   * fica MAIOR que a área que .axxa-root consegue ocupar. Resultado: gap
   * visual no topo ou no fundo (40px típico) exibindo
   * `--background-modifier-hover` em vez do nosso bg/preset.
   *
   * Solução: plantamos classes `axxa-host` + `axxa-bg-{preset}` no drawer
   * container. CSS então pinta o bg/preset NELE (edge-to-edge) e força
   * .axxa-root como transparente — o bg da drawer mostra através.
   *
   * Mantém em sync via `onSettingsChange` quando o user muda preset.
   */
  private setupDrawerHost() {
    if (!Platform.isMobile) return;

    const apply = () => {
      const host = this.containerEl.closest(
        ".workspace-drawer-active-tab-container"
      ) as HTMLElement | null;
      if (!host) return;
      this.drawerHostEl = host;
      host.classList.add("axxa-host");
      // Limpa bg classes antigas e seta a atual
      Array.from(host.classList).forEach((c) => {
        if (c.startsWith("axxa-bg-")) host.classList.remove(c);
      });
      host.classList.add(
        "axxa-bg-" + (this.plugin.settings.background || "none")
      );
    };

    apply();
    // Re-aplica quando o user troca o preset nas Settings
    this.drawerHostUnsub = this.plugin.onSettingsChange(apply);
  }

  private teardownDrawerHost() {
    this.drawerHostUnsub?.();
    this.drawerHostUnsub = null;
    if (this.drawerHostEl) {
      this.drawerHostEl.classList.remove("axxa-host");
      Array.from(this.drawerHostEl.classList).forEach((c) => {
        if (c.startsWith("axxa-bg-")) this.drawerHostEl!.classList.remove(c);
      });
      this.drawerHostEl = null;
    }
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
