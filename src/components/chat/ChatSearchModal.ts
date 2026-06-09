// src/components/chat/ChatSearchModal.ts
// Busca dentro da conversa atual via SuggestModal nativo do Obsidian (mesma
// engine do Quick Switcher). Filtra mensagens user/assistant pelo termo; ao
// escolher, o caller pula + destaca a mensagem na ChatArea.

import { App, SuggestModal } from "obsidian";

export interface ChatSearchHit {
  id: string;
  role: string;
  text: string;
}

export class ChatSearchModal extends SuggestModal<ChatSearchHit> {
  private readonly hits: ChatSearchHit[];
  private readonly onChoose: (id: string) => void;

  constructor(
    app: App,
    hits: ChatSearchHit[],
    placeholder: string,
    emptyText: string,
    onChoose: (id: string) => void
  ) {
    super(app);
    this.hits = hits;
    this.onChoose = onChoose;
    this.setPlaceholder(placeholder);
    this.emptyStateText = emptyText;
  }

  getSuggestions(query: string): ChatSearchHit[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.hits;
    return this.hits.filter((h) => h.text.toLowerCase().includes(q));
  }

  renderSuggestion(hit: ChatSearchHit, el: HTMLElement) {
    el.addClass("axxa-search-hit");
    el.createDiv({ cls: "axxa-search-hit-role", text: hit.role });
    el.createDiv({
      cls: "axxa-search-hit-text",
      text: hit.text.length > 180 ? hit.text.slice(0, 180) + "…" : hit.text,
    });
  }

  onChooseSuggestion(hit: ChatSearchHit) {
    this.onChoose(hit.id);
  }
}
