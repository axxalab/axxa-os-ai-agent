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
import { buildLayoutReport } from "./layoutReport";

export const VIEW_TYPE_AXXA = "axxa-os-ai-agent";

/** Espera a animação da gaveta terminar antes de reavaliar a geometria. */
const DRAWER_SETTLE_MS = 260;

/** Abaixo disto é barra do OS / arredondamento, não teclado. */
const KEYBOARD_MIN_PX = 120;

export class AxxaView extends ItemView {
  private root: Root | null = null;
  private session: ChatSession | null = null;
  private keyboardObserver: MutationObserver | null = null;
  private drawerObserver: MutationObserver | null = null;
  private drawerCheckTimer: number | null = null;
  /** Último valor lido de --keyboard-height (early-return do observer). */
  private lastKeyboardHeight = -1;
  private viewportCleanup: (() => void) | null = null;
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
   * Observer do teclado — 1:1 com a casca 0.2.x (técnica do plugin Copilot).
   *
   * O Obsidian mobile publica `--keyboard-height` INLINE no `<html>` quando o
   * teclado abre/fecha; observamos o atributo `style` e reagimos. A classe
   * `axxa-keyboard-open` vai na gaveta (o CSS esconde o chrome dela) e no body
   * (modais vivem fora da gaveta, e é o body que aparece na faixa abaixo do
   * `.app-container` encolhido).
   *
   * O QUE ESTE OBSERVER NÃO FAZ — e é de propósito: mexer na altura da gaveta.
   * Quando o teclado abre, o próprio Obsidian já encolhe a gaveta até o topo
   * do teclado (documentado em docs/archive/MOBILE-FULLSCREEN.md, 0.1.255: é
   * o que mantém o composer correto sem fullscreen). Qualquer altura nossa
   * aqui briga com a dele ou conta o teclado duas vezes. A ÚNICA altura nossa
   * é a do fullscreen, onde a gaveta também ganha largura própria — e é lá,
   * no CSS, que o teclado é descontado.
   */
  private syncKeyboard = (): void => {
    const drawer = this.containerEl.closest(".workspace-drawer");
    if (!drawer) return;
    const win = this.containerEl.doc.defaultView;
    const vv = win?.visualViewport ?? null;

    // Sinal 1: a var do Obsidian. A casca antiga lia só o style INLINE do
    // <html> — era onde a versão daquela época escrevia. Se a versão atual
    // escrever de outro jeito (numa folha de estilo, ou no body), a leitura
    // inline devolve vazio e a gente acha que não há teclado. Então lemos o
    // valor COMPUTADO do <html> e do body também, e ficamos com o maior.
    const docEl = this.containerEl.doc.documentElement;
    const body = this.containerEl.doc.body;
    const readVar = (el: HTMLElement, computed: boolean): number => {
      const raw = computed
        ? win?.getComputedStyle(el).getPropertyValue("--keyboard-height")
        : el.style.getPropertyValue("--keyboard-height");
      const n = parseFloat(raw || "0");
      return Number.isFinite(n) ? n : 0;
    };
    const published = Math.max(
      readVar(docEl, false),
      readVar(docEl, true),
      readVar(body, true)
    );
    // Sinal 2: quanto da janela o teclado cobre, pelo visualViewport.
    const vvBottom = vv
      ? vv.height + vv.offsetTop
      : (win?.innerHeight ?? 0);
    const covered =
      vv && win ? Math.max(0, win.innerHeight - vvBottom) : 0;

    // Sinal 3, e o mais importante: quanto de `100dvh` ficou FORA da área
    // visível. É o único que enxerga o caso em que a janela encolhe mas o
    // `dvh` não acompanha — e é exatamente o valor que a altura do fullscreen
    // precisa descontar. Quando o dvh já encolheu sozinho, dá 0 (nada a
    // descontar, sem contar o teclado duas vezes).
    const shortfall = vv
      ? Math.max(0, Math.round(this.measureDvh() - vvBottom))
      : 0;

    const signal = Math.max(published, covered, shortfall);
    if (signal === this.lastKeyboardHeight) return;
    this.lastKeyboardHeight = signal;

    // Multi-tab: só vale com a AXXA na aba ativa da gaveta.
    const active = !!this.containerEl.closest(
      ".workspace-drawer-active-tab-content"
    );
    const open = active && signal >= KEYBOARD_MIN_PX;

    drawer.classList.toggle("axxa-keyboard-open", open);
    this.containerEl.doc.body.classList.toggle("axxa-keyboard-open", open);

    // O desconto do fullscreen é o shortfall medido acima.
    const el = drawer as HTMLElement;
    if (open) el.style.setProperty("--axxa-kb", `${shortfall}px`);
    else el.style.removeProperty("--axxa-kb");
  };

  /** Mede quanto vale `100dvh` agora (nenhuma API JS expõe isso direto). */
  private measureDvh(): number {
    const doc = this.containerEl.doc;
    const probe = doc.createElement("div");
    probe.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:100dvh;visibility:hidden;pointer-events:none";
    doc.body.appendChild(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h;
  }

  /** Relatório do layout no aparelho (comando "Copy mobile layout report"). */
  layoutReport(): string {
    return buildLayoutReport(this.containerEl);
  }

  private setupKeyboardObserver(): void {
    if (!Platform.isMobile) return;
    const docEl = this.containerEl.doc.documentElement;

    // Check inicial: cobre o teclado já aberto quando a view monta.
    this.syncKeyboard();

    // Observa SÓ o atributo `style` do <html> — é lá que o Obsidian mexe na
    // --keyboard-height. Mais barato que observar o DOM inteiro.
    this.keyboardObserver = new MutationObserver(this.syncKeyboard);
    this.keyboardObserver.observe(docEl, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    this.keyboardObserver.observe(this.containerEl.doc.body, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    // ...e o viewport visível, que é o sinal 2. A GEOMETRIA não sai daqui:
    // quem encolhe a gaveta é o Obsidian (e, no fullscreen, a nossa altura).
    const win = this.containerEl.doc.defaultView;
    const vv = win?.visualViewport;
    vv?.addEventListener("resize", this.syncKeyboard);
    vv?.addEventListener("scroll", this.syncKeyboard);
    win?.addEventListener("resize", this.syncKeyboard);
    this.viewportCleanup = () => {
      vv?.removeEventListener("resize", this.syncKeyboard);
      vv?.removeEventListener("scroll", this.syncKeyboard);
      win?.removeEventListener("resize", this.syncKeyboard);
    };
  }

  private teardownKeyboardObserver(): void {
    this.keyboardObserver?.disconnect();
    this.keyboardObserver = null;
    this.viewportCleanup?.();
    this.viewportCleanup = null;
    this.lastKeyboardHeight = -1;
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
