// src/ui/AxxaView.tsx
// ItemView nativa do Obsidian que hospeda a casca (React/Preact). Cria uma
// ChatSession por view e a descarta ao fechar (flusha o save pendente).

import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import type AxxaPlugin from "../main";
import { ChatSession } from "../core/session";
import { App } from "./App";

export const VIEW_TYPE_AXXA = "axxa-os-ai-agent";

export class AxxaView extends ItemView {
  private root: Root | null = null;
  private session: ChatSession | null = null;

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
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
    this.session?.dispose();
    this.session = null;
  }
}
