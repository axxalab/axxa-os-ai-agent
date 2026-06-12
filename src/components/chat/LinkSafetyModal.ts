// src/components/chat/LinkSafetyModal.ts
// Modal de confirmação antes de abrir um link EXTERNO de uma resposta da IA.
// Ref: ChatGPT iOS 115 ("Check this link is safe"). Mostra o destino completo
// (links podem ter texto enganoso) + ações Abrir / Copiar / Cancelar.
//
// "native first": usa o Modal do Obsidian. Um mute por sessão evita atrito em
// quem clica muitos links — sem precisar de tela de Settings.

import { App, Modal, Notice } from "obsidian";

export interface LinkSafetyLabels {
  title: string;
  desc: string;
  open: string;
  copy: string;
  cancel: string;
  copied: string;
  muteSession: string;
}

// Mute por sessão (módulo-level) — resetado a cada reload do plugin.
let mutedThisSession = false;
export function isLinkSafetyMuted(): boolean {
  return mutedThisSession;
}

function openExternal(url: string): void {
  // window.open cobre desktop (Electron) e mobile (WebView) no Obsidian.
  window.open(url, "_blank");
}

export class LinkSafetyModal extends Modal {
  private url: string;
  private labels: LinkSafetyLabels;

  constructor(app: App, url: string, labels: LinkSafetyLabels) {
    super(app);
    this.url = url;
    this.labels = labels;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("axxa-linksafe-modal");

    contentEl.createEl("h3", {
      text: this.labels.title,
      cls: "axxa-linksafe-title",
    });
    contentEl.createEl("p", {
      text: this.labels.desc,
      cls: "axxa-linksafe-desc",
    });
    contentEl.createEl("div", {
      text: this.url,
      cls: "axxa-linksafe-url",
    });

    const actions = contentEl.createDiv({ cls: "axxa-linksafe-actions" });

    const openBtn = actions.createEl("button", {
      text: this.labels.open,
      cls: "axxa-linksafe-open mod-cta",
      attr: { type: "button" },
    });
    openBtn.onclick = () => {
      openExternal(this.url);
      this.close();
    };

    const copyBtn = actions.createEl("button", {
      text: this.labels.copy,
      cls: "axxa-linksafe-copy",
      attr: { type: "button" },
    });
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(this.url);
        new Notice(this.labels.copied);
      } catch (err) {
        console.error("[axxa] copy link falhou:", err);
      }
      this.close();
    };

    const cancelBtn = actions.createEl("button", {
      text: this.labels.cancel,
      cls: "axxa-linksafe-cancel",
      attr: { type: "button" },
    });
    cancelBtn.onclick = () => this.close();

    // Mute por sessão — checkbox discreto no rodapé.
    const muteRow = contentEl.createDiv({ cls: "axxa-linksafe-mute" });
    const cb = muteRow.createEl("input", {
      attr: { type: "checkbox", id: "axxa-linksafe-mute-cb" },
    });
    cb.onchange = () => {
      mutedThisSession = cb.checked;
    };
    muteRow.createEl("label", {
      text: this.labels.muteSession,
      attr: { for: "axxa-linksafe-mute-cb" },
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

/**
 * Intercepta cliques em links EXTERNOS dentro de um container renderizado.
 * Se o mute de sessão estiver ligado, abre direto; senão, mostra o modal.
 */
export function wireExternalLinkSafety(
  root: HTMLElement,
  app: App,
  labels: LinkSafetyLabels
): () => void {
  const wired: Array<{ el: HTMLAnchorElement; handler: (e: MouseEvent) => void }> = [];
  const links = root.querySelectorAll<HTMLAnchorElement>("a.external-link");
  links.forEach((a) => {
    if (a.dataset.axxaSafeWired) return;
    a.dataset.axxaSafeWired = "1";
    const handler = (e: MouseEvent) => {
      const href = a.getAttribute("href") || a.getAttribute("data-href") || "";
      if (!href || !/^https?:\/\//i.test(href)) return; // só http(s)
      e.preventDefault();
      e.stopPropagation();
      if (isLinkSafetyMuted()) {
        openExternal(href);
        return;
      }
      new LinkSafetyModal(app, href, labels).open();
    };
    a.addEventListener("click", handler);
    wired.push({ el: a, handler });
  });
  // Disposer: remove os listeners (chamado no cleanup do efeito do Markdown).
  return () => {
    for (const { el, handler } of wired) el.removeEventListener("click", handler);
  };
}
