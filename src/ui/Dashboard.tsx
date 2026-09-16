// src/ui/Dashboard.tsx
// A HOME do app: as conversas de todos os módulos numa lista só, filtrável
// por aba, e — embaixo — um cartão por modo pra começar outra.
//
// Ela existe porque abrir o plugin numa conversa vazia responde a pergunta
// errada. A primeira pergunta de quem abre não é "o que eu escrevo", é "onde
// eu estava" — tem resposta esperando no Agent? ficou algo sem ler? o que
// rodou ontem? O painel responde isso antes de pedir qualquer coisa.
//
// A ordem da tela não é decorativa: o que já existe fica ONDE O OLHO CAI, e a
// ação de criar fica onde a mão alcança — a base do telefone. Os cartões são
// ação, não navegação: tocar num deles já abre a conversa nova daquele modo
// com o cursor no campo, porque quem escolheu "Agent" já sabe o que vai pedir.

import { useState } from "react";
import type AxxaPlugin from "../main";
import type { ChatSession } from "../core/session";
import { CHAT_MODES, type ChatMode } from "../core/session";
import { useChatStore } from "../store/chat";
import { ChatList, useChatSummaries, useUnreadChats } from "./ChatList";
import { Icon } from "./Icon";
import { Segmented } from "./Segmented";
import { alertCount } from "./chatAlert";
import {
  MODULES,
  SEGMENT_ALL,
  filterSegment,
  moduleSegments,
} from "./modules";
import type { ChatSummary } from "../core/chatPersistence";

export function Dashboard({
  plugin,
  session,
  onOpenMenu,
  onNewChat,
  onOpenChat,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  onOpenMenu: () => void;
  /** Começar uma conversa naquele modo — já com o teclado aberto. */
  onNewChat: (mode: ChatMode) => void;
  onOpenChat: (chat: ChatSummary) => void;
}) {
  const [aba, setAba] = useState(SEGMENT_ALL);
  const chats = useChatSummaries(plugin);
  const naoLidas = useUnreadChats(plugin);
  const esperandoId = useChatStore((s) => s.waitingChatId);

  const abas = moduleSegments(chats);
  // A aba escolhida pode ter sumido (a última conversa dela foi apagada).
  // Cair em "All" é melhor do que uma lista vazia sem explicação.
  const atual = abas.some((s) => s.id === aba) ? aba : SEGMENT_ALL;
  const visiveis = filterSegment(chats, atual);

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
        <h1 className="axxa-home-title">AXXA OS</h1>

        {/* Com um módulo só em uso, o filtro filtraria a lista inteira em
            "All" e nada no resto: só ocuparia a linha. */}
        {abas.length > 2 && (
          <Segmented
            options={abas.map((s) => ({
              id: s.id,
              label: s.label,
              // O ponto diz em qual aba está o que pede você. Sem ele, o
              // filtro esconderia justamente o que não podia ser escondido.
              dot:
                s.id !== SEGMENT_ALL &&
                alertCount(chats, s.id, {
                  esperando: esperandoId,
                  naoLidas,
                }) > 0,
            }))}
            value={atual}
            label="Filter chats by mode"
            onChange={setAba}
          />
        )}

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
            <p>Nothing here yet. Start one below.</p>
          </div>
        )}

        {/* Grudado na base DENTRO do scroller, como o botão flutuante da home
            de módulo — fora dele precisaria de um ancestral posicionado, e
            `.axxa-chat` não é posicionado (ver o bloco do composer no CSS). */}
        <section className="axxa-start">
          <span className="axxa-section-label">Start something new</span>
          <div className="axxa-start-grid">
            {CHAT_MODES.map((m) => (
              <button
                key={m}
                type="button"
                className="axxa-start-card"
                onClick={() => onNewChat(m)}
              >
                <Icon name={MODULES[m].icon} size={20} />
                <span className="axxa-start-name">{MODULES[m].short}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
