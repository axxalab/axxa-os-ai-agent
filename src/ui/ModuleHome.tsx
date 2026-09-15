// src/ui/ModuleHome.tsx
// A HOME de um módulo — a porta de entrada de Chat, Vault Q&A ou Agent.
//
// É uma página inteira e independente, não um painel dentro do menu nem a
// tela de uma conversa vazia: nome grande, busca, as conversas daquele módulo
// e um botão flutuante pra começar outra. Quem escreve é a tela de conversa,
// que só abre quando se escolhe uma ou se cria uma nova — aqui não há campo de
// texto de propósito, porque esta tela é sobre ESCOLHER, não sobre escrever.

import { useMemo, useState } from "react";
import type AxxaPlugin from "../main";
import type { ChatSession } from "../core/session";
import { isChatMode } from "../core/session";
import type { ChatSummary } from "../core/chatPersistence";
import { ChatList, useChatSummaries } from "./ChatList";
import { Icon } from "./Icon";
import { chatsOfModule, moduleEmptyLine, moduleIcon, moduleLabel } from "./modules";

/** A partir de quantas conversas a busca aparece. Abaixo disso ela é um
 *  campo pedindo pra filtrar cinco linhas que já cabem na tela. */
const SEARCH_FROM = 6;

export function ModuleHome({
  plugin,
  session,
  modulo,
  onOpenMenu,
  onOpenChat,
  onNewChat,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  modulo: string;
  onOpenMenu: () => void;
  onOpenChat: (chat: ChatSummary) => void;
  onNewChat: () => void;
}) {
  const [query, setQuery] = useState("");
  const todas = useChatSummaries(plugin);
  const minhas = useMemo(() => chatsOfModule(todas, modulo), [todas, modulo]);
  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return minhas;
    return minhas.filter((c) =>
      (c.title || "Untitled").toLowerCase().includes(q)
    );
  }, [minhas, query]);

  // Módulo que este código não conhece (pasta criada por outra versão): dá pra
  // ler o que está lá, não dá pra criar — o motor não sabe rodar nesse modo.
  const podeCriar = isChatMode(modulo);

  return (
    <div className="axxa-chat">
      <header className="axxa-topbar is-bare">
        <button
          type="button"
          className="axxa-icon-btn"
          aria-label="Open menu"
          onClick={onOpenMenu}
        >
          <Icon name="menu" />
        </button>
      </header>

      <div className="axxa-messages axxa-home">
        <h1 className="axxa-home-title">{moduleLabel(modulo)}</h1>

        {minhas.length >= SEARCH_FROM && (
          <label className="axxa-home-search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={query}
              placeholder="Search"
              aria-label={`Search ${moduleLabel(modulo)}`}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
          </label>
        )}

        {filtradas.length > 0 && (
          <ChatList
            plugin={plugin}
            session={session}
            chats={filtradas}
            onOpen={onOpenChat}
          />
        )}

        {filtradas.length === 0 && (
          <div className="axxa-home-empty">
            <Icon name={moduleIcon(modulo)} size={42} />
            <p>
              {minhas.length === 0
                ? moduleEmptyLine(modulo)
                : "No chats match that search."}
            </p>
          </div>
        )}

        {/* DENTRO do scroller, grudado na base com `sticky`. Fora dele ele
            precisaria de um ancestral posicionado — e `.axxa-chat` não é
            posicionado: foi assim que o composer `absolute` foi parar colado
            no header do aparelho (ver o bloco do composer no CSS). */}
        {podeCriar && (
          <button type="button" className="axxa-fab" onClick={onNewChat}>
            <Icon name="plus" size={20} />
            {/* "New chat" e não "New Agent chat": o nome do módulo está em
                letra garrafal no topo da mesma tela. */}
            <span>New chat</span>
          </button>
        )}
      </div>
    </div>
  );
}
