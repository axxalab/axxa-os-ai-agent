// src/ui/ModuleHome.tsx
// A HOME de um módulo — a porta de entrada de Chat, Vault Q&A ou Agent.
//
// É uma página inteira e independente, não um painel dentro do menu nem a
// tela de uma conversa vazia: nome grande, as conversas daquele módulo em
// cartões e um botão flutuante pra começar outra. Não há campo de texto de
// propósito — esta tela é sobre ESCOLHER, não sobre escrever.
//
// E cada uma tem a SUA mobília, como na referência (lá Chats, Code e Cowork
// não se parecem): o Agent abre com as skills à mão e a lista de sessões
// filtrável por período, porque uma sessão de agente é trabalho datado; Chat
// e Vault Q&A abrem com busca, porque ali o que se procura é assunto.

import { useMemo, useState } from "react";
import type AxxaPlugin from "../main";
import type { ChatSession } from "../core/session";
import { isChatMode } from "../core/session";
import type { ChatSummary } from "../core/chatPersistence";
import { ChatList, useChatSummaries } from "./ChatList";
import { Icon } from "./Icon";
import { SearchField } from "./SearchField";
import { SearchSheet } from "./SearchSheet";
import { openActions } from "./menu";
import {
  chatsOfModule,
  moduleEmptyLine,
  moduleFabLabel,
  moduleIcon,
  moduleLabel,
  searchChats,
} from "./modules";

/** Janelas do filtro de período do Agent, em dias (0 = tudo). */
const PERIODOS: Array<{ id: string; label: string; dias: number }> = [
  { id: "all", label: "All", dias: 0 },
  { id: "today", label: "Today", dias: 1 },
  { id: "week", label: "This week", dias: 7 },
  { id: "month", label: "This month", dias: 30 },
];

export function ModuleHome({
  plugin,
  session,
  modulo,
  onOpenMenu,
  onOpenChat,
  onNewChat,
  onOpenSkills,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  modulo: string;
  onOpenMenu: () => void;
  onOpenChat: (chat: ChatSummary) => void;
  onNewChat: () => void;
  onOpenSkills: () => void;
}) {
  const [query, setQuery] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [periodo, setPeriodo] = useState(PERIODOS[0]);
  const todas = useChatSummaries(plugin);
  const minhas = useMemo(() => chatsOfModule(todas, modulo), [todas, modulo]);

  const ehAgent = modulo === "agent";

  // Período primeiro (só o Agent tem), busca depois: a busca procura DENTRO
  // do que está sendo mostrado, senão o filtro viraria mentira na tela.
  const noPeriodo = useMemo(() => {
    if (!ehAgent || periodo.dias === 0) return minhas;
    const corte = Date.now() - periodo.dias * 86400000;
    return minhas.filter((c) => new Date(c.date).getTime() >= corte);
  }, [ehAgent, minhas, periodo]);

  const busca = useMemo(
    () => searchChats(noPeriodo, query),
    [noPeriodo, query]
  );
  const visiveis = busca.hits;
  const procurando = query.trim().length > 0;

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

        {ehAgent && (
          <section className="axxa-home-block">
            <span className="axxa-section-label">Skills</span>
            {/* O que o agente sabe fazer é o que ele TEM à mão — por isso as
                skills abrem a home dele, do mesmo jeito que os aparelhos
                abrem a tela de Code na referência. */}
            <button
              type="button"
              className="axxa-home-pill"
              onClick={onOpenSkills}
            >
              <Icon name="plus" size={18} />
              <span>Add skill</span>
            </button>
          </section>
        )}

        {/* A pílula é GATILHO: quem toca vai pra folha de busca, onde o
            teclado não cobre o resultado (ver SearchSheet.tsx). */}
        <SearchField
          value={query}
          placeholder="Search"
          label={`Search ${moduleLabel(modulo)}`}
          found={visiveis.length}
          onChange={setQuery}
          onOpen={() => setBuscando(true)}
        />

        {ehAgent && (
          <div className="axxa-home-headrow">
            <span className="axxa-section-label">Sessions</span>
            <button
              type="button"
              className="axxa-home-filter"
              aria-label="Filter sessions by period"
              onClick={(e) =>
                openActions(
                  e as unknown as MouseEvent,
                  PERIODOS.map((p) => ({
                    label: p.label,
                    checked: p.id === periodo.id,
                    run: () => setPeriodo(p),
                  }))
                )
              }
            >
              <span>{periodo.label}</span>
              <Icon name="chevron-down" size={16} />
            </button>
          </div>
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
            <Icon name={moduleIcon(modulo)} size={42} />
            <p>
              {minhas.length === 0
                ? moduleEmptyLine(modulo)
                : procurando
                  ? "Nothing matches that search."
                  : `Nothing in ${periodo.label.toLowerCase()}.`}
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
            <span>{moduleFabLabel(modulo)}</span>
          </button>
        )}
      </div>

      {/* Busca com regex: `^draft`, `readme|changelog`, `gpt-5$`. O campo NÃO
          anuncia isso: termo comum também é regex válida, então pra quem só
          quer procurar palavra a palavra "regex" no rótulo é uma instrução a
          mais pra ler e ignorar. Quem precisa, digita e funciona. */}
      <SearchSheet
        open={buscando}
        title={`Search ${moduleLabel(modulo)}`}
        placeholder="Search"
        value={query}
        found={visiveis.length}
        invalid={busca.invalida}
        onChange={setQuery}
        onClose={() => setBuscando(false)}
      >
        {visiveis.length > 0 ? (
          <ChatList
            plugin={plugin}
            session={session}
            chats={visiveis}
            onOpen={(c) => {
              // Fecha a busca ANTES de sair: voltar da conversa e encontrar a
              // folha ainda aberta por cima seria um fantasma.
              setBuscando(false);
              onOpenChat(c);
            }}
          />
        ) : (
          <div className="axxa-home-empty">
            <Icon name="search" size={42} />
            <p>
              {query.trim()
                ? "Nothing matches that search."
                : `Type to search ${moduleLabel(modulo)}.`}
            </p>
          </div>
        )}
      </SearchSheet>
    </div>
  );
}
