// src/ui/layoutReport.ts
// "Inspector": relatório do layout mobile, copiado pro clipboard pelo comando
// "Copy mobile layout report".
//
// Existe porque os dois problemas difíceis desta casca — a gaveta com o
// teclado e a tela cheia — dependem de números que só o APARELHO conhece:
// se a WebView encolhe sozinha, se o Obsidian publica `--keyboard-height`,
// onde o safe-area já foi aplicado, quem pinta a faixa de baixo. Adivinhar
// isso pelo print custa uma release por tentativa; o relatório resolve numa.

const PROBE_ID = "axxa-safe-area-probe";

/** Lê os `env(safe-area-inset-*)` de verdade — não dá pra ler direto do JS. */
function readEnvInsets(doc: Document): Record<string, string> {
  let probe = doc.getElementById(PROBE_ID);
  if (!probe) {
    probe = doc.createElement("div");
    probe.id = PROBE_ID;
    probe.style.position = "fixed";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    probe.style.paddingTop = "env(safe-area-inset-top, 0px)";
    probe.style.paddingRight = "env(safe-area-inset-right, 0px)";
    probe.style.paddingBottom = "env(safe-area-inset-bottom, 0px)";
    probe.style.paddingLeft = "env(safe-area-inset-left, 0px)";
    doc.body.appendChild(probe);
  }
  const cs = doc.defaultView?.getComputedStyle(probe);
  const out = {
    top: cs?.paddingTop ?? "?",
    right: cs?.paddingRight ?? "?",
    bottom: cs?.paddingBottom ?? "?",
    left: cs?.paddingLeft ?? "?",
  };
  probe.remove();
  return out;
}

function rect(el: Element | null | undefined): string {
  if (!el) return "ausente";
  const b = el.getBoundingClientRect();
  return `x=${Math.round(b.x)} y=${Math.round(b.y)} w=${Math.round(
    b.width
  )} h=${Math.round(b.height)} bottom=${Math.round(b.bottom)}`;
}

function bg(el: Element | null | undefined, win: Window | null): string {
  if (!el || !win) return "?";
  return win.getComputedStyle(el).backgroundColor;
}

/**
 * Monta o relatório a partir do container da view. `containerEl` é o da
 * ItemView — daí se alcança a gaveta, o body e o documento.
 */
export function buildLayoutReport(containerEl: HTMLElement): string {
  const doc = containerEl.ownerDocument;
  const win = doc.defaultView;
  const vv = win?.visualViewport ?? null;
  const docEl = doc.documentElement;
  const body = doc.body;
  const drawer = containerEl.closest(".workspace-drawer");
  const cssVar = (name: string) =>
    (win?.getComputedStyle(docEl).getPropertyValue(name) || "").trim() || "—";

  const covered =
    vv && win ? Math.round(win.innerHeight - (vv.height + vv.offsetTop)) : 0;
  const env = readEnvInsets(doc);

  const lines = [
    "AXXA · mobile layout report",
    new Date().toISOString(),
    "",
    "[janela]",
    `  innerWidth/Height ....... ${win?.innerWidth} x ${win?.innerHeight}`,
    `  screen .................. ${win?.screen.width} x ${win?.screen.height}`,
    `  devicePixelRatio ........ ${win?.devicePixelRatio}`,
    `  visualViewport .......... ${
      vv
        ? `h=${Math.round(vv.height)} offsetTop=${Math.round(
            vv.offsetTop
          )} scale=${vv.scale}`
        : "indisponível"
    }`,
    `  coberto (teclado?) ...... ${covered}px`,
    "",
    "[variáveis]",
    `  --keyboard-height (inline no <html>) .. ${
      docEl.style.getPropertyValue("--keyboard-height") || "não setada"
    }`,
    `  --keyboard-height (computada) ......... ${cssVar("--keyboard-height")}`,
    `  --safe-area-inset-top/bottom .......... ${cssVar(
      "--safe-area-inset-top"
    )} / ${cssVar("--safe-area-inset-bottom")}`,
    `  env(safe-area-inset-*) t/r/b/l ........ ${env.top} / ${env.right} / ${env.bottom} / ${env.left}`,
    `  --navbar-height ....................... ${cssVar("--navbar-height")}`,
    `  --axxa-status-bar-clearance ........... ${cssVar(
      "--axxa-status-bar-clearance"
    )}`,
    "",
    "[classes]",
    `  body .................... ${body.className || "—"}`,
    `  gaveta .................. ${drawer?.className ?? "ausente"}`,
    `  --axxa-kb-viewport ...... ${
      (drawer as HTMLElement | null)?.style.getPropertyValue(
        "--axxa-kb-viewport"
      ) || "não setada"
    }`,
    "",
    "[geometria]  (bottom = distância do topo da tela)",
    `  gaveta .................. ${rect(drawer)}  bg=${bg(drawer, win)}`,
    `  tab-content ............. ${rect(
      doc.querySelector(".workspace-drawer-active-tab-content")
    )}`,
    `  leaf-content ............ ${rect(
      containerEl.querySelector(":scope") ? containerEl : null
    )}`,
    `  view-content ............ ${rect(
      containerEl.querySelector(".view-content") ??
        containerEl.children[1] ?? null
    )}`,
    `  .axxa-root .............. ${rect(
      containerEl.querySelector(".axxa-root")
    )}  bg=${bg(containerEl.querySelector(".axxa-root"), win)}`,
    `  .axxa-composer .......... ${rect(
      containerEl.querySelector(".axxa-composer")
    )}`,
    `  .mobile-navbar .......... ${rect(
      doc.querySelector(".mobile-navbar")
    )}  display=${
      win && doc.querySelector(".mobile-navbar")
        ? win.getComputedStyle(doc.querySelector(".mobile-navbar") as Element)
            .display
        : "—"
    }`,
    "",
    "[app]",
    `  .app-container .......... ${rect(
      doc.querySelector(".app-container")
    )}  bg=${bg(doc.querySelector(".app-container"), win)}`,
    `  body .................... bg=${bg(body, win)}`,
  ];
  return lines.join("\n");
}
