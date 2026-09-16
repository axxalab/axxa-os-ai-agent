// src/ui/History.tsx
// O HISTÓRICO inteiro — todas as conversas, de todos os modos, com as mesmas
// abas da home e busca.
//
// Ele existe porque a home passou a mostrar só as ÚLTIMAS quatro. Quatro é o
// que responde "onde eu estava"; a vigésima terceira conversa não responde
// pergunta nenhuma ali — mas responde aqui, onde se PROCURA, e por isso esta
// tela tem campo de busca e a home não.
//
// A aba escolhida vem junto da home: quem filtrou por Agent e pediu pra ver
// tudo quer todo o Agent, não tudo de novo.

import { useMemo, useState } from "react";
import type AxxaPlugin from "../main";
import type { ChatSession } from "../core/session";
import type { ChatSummary } from "../core/chatPersistence";
import { useChatStore } from "../store/chat";
import { ChatList, useChatSummaries, useUnreadChats } from "./ChatList";
import { Icon } from "./Icon";
import { SearchField } from "./SearchField";
import { Segmented } from "./Segmented";
import { alertCount } from "./chatAlert";
import {
  SEGMENT_ALL,
  filterSegment,
  moduleSegments,
  searchChats,
} from "./modules";

export function History({
  plugin,
  session,
  aba,
  onAba,
  onBack,
  onOpenChat,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  aba: string;
  onAba: (id: string) => void;
  onBack: () => void;
  onOpenChat: (chat: ChatSummary) => void;
}) {
  const [query, setQuery] = useState("");
  const chats = useChatSummaries(plugin);
  const naoLidas = useUnreadChats(plugin);
  const esperandoId = useChatStore((s) => s.waitingChatId);

  const abas = moduleSegments(chats);
  const atual = abas.some((s) => s.id === aba) ? aba : SEGMENT_ALL;

  // Aba primeiro, busca depois: a busca procura DENTRO do que está sendo
  // mostrado, senão a aba viraria mentira na tela.
  const doSeg = useMemo(() => filterSegment(chats, atual), [chats, atual]);
  const busca = useMemo(() => searchChats(doSeg, query), [doSeg, query]);
  const visiveis = busca.hits;

  return (
    <div className="axxa-chat">
      <header className="axxa-topbar is-bare">
        <button
          type="button"
          className="axxa-icon-btn"
          aria-label="Back"
          onClick={onBack}
        >
          <Icon name="arrow-left" />
        </button>
      </header>

      <div className="axxa-messages axxa-home">
        <h1 className="axxa-home-title">History</h1>

        {abas.length > 2 && (
          <Segmented
            options={abas.map((s) => ({
              id: s.id,
              label: s.label,
              dot:
                s.id !== SEGMENT_ALL &&
                alertCount(chats, s.id, {
                  esperando: esperandoId,
                  naoLidas,
                }) > 0,
            }))}
            value={atual}
            label="Filter chats by mode"
            onChange={onAba}
          />
        )}

        {/* Regex, como nas outras buscas do app — e sem anunciar isso: termo
            comum também é regex válida (ver modules.searchChats). */}
        <SearchField
          value={query}
          placeholder="Search"
          label="Search chats"
          found={visiveis.length}
          invalid={busca.invalida}
          onChange={setQuery}
        />

        {visiveis.length > 0 && (
          <ChatList
            plugin={plugin}
            session={session}
            chats={visiveis}
            onOpen={onOpenChat}
          />
        )}

        {visiveis.length === 0 && (
          <div className="axxa-home-empty">
            <Icon name="message-circle" size={42} />
            <p>
              {query.trim()
                ? "Nothing matches that search."
                : "Nothing here yet."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
