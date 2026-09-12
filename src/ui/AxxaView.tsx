// src/ui/AxxaView.tsx
// ItemView nativa do Obsidian que hospeda a casca (React/Preact). Cria uma
// ChatSession por view e a descarta ao fechar (flusha o save pendente).
//
// Além disso mora aqui tudo que precisa mexer em ancestrais da view — nunca em
// API interna do Obsidian, só em classes:
//   • observer do teclado mobile  → .axxa-keyboard-open
//   • fullscreen mobile (opt-in)  → .axxa-fullscreen
// Ambos são portados da casca anterior (0.3.0), onde já tinham rodado no
// aparelho; as regras de escopo do fullscreen vivem em fullscreenScope.ts
// (puras e testadas).

import { ItemView, Platform, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import type AxxaPlugin from "../main";
import { ChatSession } from "../core/session";
import { App } from "./App";
import { isDrawerOnScreen, isRightDrawer } from "./fullscreenScope";

export const VIEW_TYPE_AXXA = "axxa-os-ai-agent";

/** Espera a animação da gaveta terminar antes de reavaliar a geometria. */
const DRAWER_SETTLE_MS = 260;

export class AxxaView extends ItemView {
  private root: Root | null = null;
  private session: ChatSession | null = null;
  private keyboardObserver: MutationObserver | null = null;
  private drawerObserver: MutationObserver | null = null;
  private drawerCheckTimer: number | null = null;
  private settingsUnsub: (() => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: AxxaPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_AXXA;
  }

  getDisplayText(): string {
    return "AXXA OS";
  }

  getIcon(): string {
    return "bot";
  }

  async onOpen(): Promise<void> {
    // containerEl.children[1] é o miolo da view (o [0] é o header nativo).
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    this.session = new ChatSession(this.plugin);
    this.root = createRoot(container);
    this.root.render(<App plugin={this.plugin} session={this.session} />);

    this.setupKeyboardObserver();

    // Fullscreen é opt-in e reativo: re-aplica a cada saveSettings (o toggle
    // vive no menu lateral) e a cada troca de aba/layout — senão a classe
    // ficaria na gaveta com OUTRA view ativa, escondendo o chrome dela.
    this.applyFullscreen();
    this.settingsUnsub = this.plugin.onSettingsChange(() =>
      this.applyFullscreen()
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.applyFullscreen())
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.applyFullscreen())
    );
    this.registerEvent(
      this.app.workspace.on("resize", () => this.applyFullscreen())
    );
    this.setupDrawerObserver();
  }

  async onClose(): Promise<void> {
    this.teardownKeyboardObserver();
    this.teardownDrawerObserver();
    this.settingsUnsub?.();
    this.settingsUnsub = null;
    // Fechar a view devolve o chrome do app mesmo se algo acima deu errado.
    this.clearFullscreen();
    this.root?.unmount();
    this.root = null;
    this.session?.dispose();
    this.session = null;
  }

  // ── teclado ───────────────────────────────────────────────────────────────

  /**
   * O Obsidian mobile publica `--keyboard-height` INLINE no `<html>` quando o
   * teclado abre/fecha. Em vez de tentar detectar o teclado (inconsistente
   * entre iOS e Android), observamos o atributo `style` do `<html>` e reagimos
   * — a mesma técnica do plugin Copilot.
   *
   * Com o teclado aberto marcamos `.axxa-keyboard-open` na gaveta (o CSS
   * esconde o header dela e o composer ganha a altura de volta) e no body,
   * pros modais, que vivem FORA da gaveta, poderem se reposicionar.
   */
  private setupKeyboardObserver(): void {
    if (!Platform.isMobile) return;
    const docEl = this.containerEl.doc.documentElement;
    // O observer dispara em TODA mudança de `style` do <html>; só nos importa
    // quando --keyboard-height muda de valor.
    let last = -1;

    const update = () => {
      const height = parseFloat(
        docEl.style.getPropertyValue("--keyboard-height") || "0"
      );
      if (height === last) return;
      last = height;

      // Re-busca a gaveta a cada update — sobrevive a migração entre janelas.
      const drawer = this.containerEl.closest(".workspace-drawer");
      if (!drawer) return;
      const active = !!this.containerEl.closest(
        ".workspace-drawer-active-tab-content"
      );
      const open = active && height > 0;
      drawer.classList.toggle("axxa-keyboard-open", open);
      this.containerEl.doc.body.classList.toggle("axxa-keyboard-open", open);
    };

    // Check inicial: cobre o teclado já aberto quando a view monta.
    update();
    this.keyboardObserver = new MutationObserver(update);
    this.keyboardObserver.observe(docEl, {
      attributes: true,
      attributeFilter: ["style"],
    });
  }

  private teardownKeyboardObserver(): void {
    this.keyboardObserver?.disconnect();
    this.keyboardObserver = null;
    const drawer = this.containerEl.closest(".workspace-drawer");
    drawer?.classList.remove("axxa-keyboard-open");
    this.containerEl.doc.body.classList.remove("axxa-keyboard-open");
  }

  // ── fullscreen ────────────────────────────────────────────────────────────

  /**
   * Fullscreen mobile (opt-in, default OFF) — mesma técnica do observer do
   * teclado: só alterna classes em ancestrais, sem tocar em API interna nem em
   * variável nativa do Obsidian.
   *
   * - `.workspace-drawer.axxa-fullscreen` esconde o header da gaveta, que é
   *   redundante quando a AXXA está ativa (temos topbar e menu próprios).
   * - `body.axxa-fullscreen` esconde a navbar global e desliga a reserva de
   *   espaço do composer (a regra `:not(.axxa-fullscreen)` no CSS).
   *
   * Garantias anti-armadilha: só mobile, só na aba ativa da gaveta DIREITA, só
   * enquanto essa gaveta está de fato na tela, saída sempre visível (a topbar
   * e o menu lateral são nossos e continuam lá) e classes removidas no
   * onClose.
   */
  applyFullscreen(): void {
    if (!Platform.isMobile) return;
    const drawer = this.containerEl.closest(".workspace-drawer");
    // Multi-tab: só vale quando a AXXA é a aba ativa da gaveta.
    const active = !!this.containerEl.closest(
      ".workspace-drawer-active-tab-content"
    );
    const on =
      active && isRightDrawer(drawer) && !!this.plugin.settings.mobileFullscreen;
    drawer?.classList.toggle("axxa-fullscreen", on);
    // A navbar global é IRMÃ das gavetas (mora no body). Some só ENQUANTO a
    // gaveta da AXXA está na tela: abrir a gaveta esquerda (ou fechar a nossa
    // no swipe) devolve a navegação global na hora, em vez de deixar o
    // Obsidian sem chrome.
    this.containerEl.doc.body.classList.toggle(
      "axxa-fullscreen",
      on && this.hostDrawerVisible(drawer)
    );
  }

  private clearFullscreen(): void {
    const drawer = this.containerEl.closest(".workspace-drawer");
    drawer?.classList.remove("axxa-fullscreen");
    this.containerEl.doc.body.classList.remove("axxa-fullscreen");
  }

  /**
   * A gaveta que hospeda a AXXA está VISÍVEL agora? Pergunta geométrica de
   * propósito: nome de classe de ESTADO da gaveta muda entre versões do
   * Obsidian, "o retângulo intersecta a viewport" não. Falha pro lado seguro:
   * qualquer dúvida conta como visível, então o modo continua funcionando em
   * vez de virar um fullscreen que não liga.
   */
  private hostDrawerVisible(host: Element | null): boolean {
    if (!host) return false;
    const win = this.containerEl.doc.defaultView;
    if (!win) return true;
    const style = win.getComputedStyle(host);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return isDrawerOnScreen(host.getBoundingClientRect(), win.innerWidth);
  }

  /**
   * Observa abrir/fechar das gavetas pra devolver a navbar assim que a gaveta
   * esquerda entra em cena (e tirá-la de novo quando ela sai). O Obsidian anima
   * as gavetas por transform/classe no próprio elemento — então observamos
   * atributos, a mesma técnica não-invasiva do observer do teclado.
   */
  private setupDrawerObserver(): void {
    if (!Platform.isMobile) return;
    const host = this.containerEl.closest(".workspace-drawer")?.parentElement;
    if (!host) return;
    this.drawerObserver = new MutationObserver(() => {
      if (this.drawerCheckTimer !== null) {
        window.clearTimeout(this.drawerCheckTimer);
      }
      // A checagem roda DEPOIS da animação: durante o transform a geometria
      // ainda diz "aberto" mesmo indo pra fora da tela.
      this.drawerCheckTimer = window.setTimeout(() => {
        this.drawerCheckTimer = null;
        this.applyFullscreen();
      }, DRAWER_SETTLE_MS);
    });
    this.drawerObserver.observe(host, {
      attributes: true,
      attributeFilter: ["class", "style"],
      subtree: true,
    });
  }

  private teardownDrawerObserver(): void {
    this.drawerObserver?.disconnect();
    this.drawerObserver = null;
    if (this.drawerCheckTimer !== null) {
      window.clearTimeout(this.drawerCheckTimer);
      this.drawerCheckTimer = null;
    }
  }
}
