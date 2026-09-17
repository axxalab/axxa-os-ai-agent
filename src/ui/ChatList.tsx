// src/ui/ChatList.tsx
// A lista de conversas de uma home: cartão com brasão, título, uma linha de
// estado e a idade na ponta direita — o formato dos prints da referência.
//
// Ela morava dentro da gaveta, como linha apertada de menu. Saiu de lá porque
// a lista de um módulo pertence à HOME daquele módulo, e numa página inteira
// cabe dizer o que cada conversa É: quantas ações rodou, com qual modelo, e
// quando foi.

import { useEffect, useState } from "react";
import type AxxaPlugin from "../main";
import type { ChatSession } from "../core/session";
import type { ChatSummary } from "../core/chatPersistence";
import { useChatStore } from "../store/chat";
import { PROVIDERS } from "../core/providersMeta";
import { Icon } from "./Icon";
import { openActions } from "./menu";
import { PromptModal, ConfirmModal } from "./modals";
import { relativeShort } from "./modules";
import { ALERT_LABEL, chatAlert } from "./chatAlert";

/** Logo do provider da conversa. Desconhecido cai num ícone neutro em vez de
 *  quebrar o setIcon com um nome que não existe. */
function providerIcon(id: string): string {
  return PROVIDERS.find((p) => p.id === id)?.icon ?? "message-square";
}

/**
 * As conversas gravadas, sempre frescas. O cache mora no plugin (índice em
 * disco + varredura em segundo plano); aqui só se assina a mudança.
 */
export function useChatSummaries(plugin: AxxaPlugin): ChatSummary[] {
  const [chats, setChats] = useState<ChatSummary[]>(plugin.chatSummaries ?? []);
  useEffect(() => {
    let vivo = true;
    void plugin.loadChatSummaries().then((all) => {
      if (vivo) setChats(all);
    });
    const unsub = plugin.onChatsChange(() =>
      setChats(plugin.chatSummaries ?? []),
    );
    return () => {
      vivo = false;
      unsub();
    };
  }, [plugin]);
  return chats;
}

/**
 * As conversas que responderam sem ninguém ver.
 *
 * Guarda um Set NOVO a cada aviso de propósito: é a identidade diferente que
 * faz o React redesenhar. Ler `plugin.settings.unreadChats` direto no render
 * lia o valor certo e não redesenhava nunca.
 */
export function useUnreadChats(plugin: AxxaPlugin): Set<string> {
  const [naoLidas, setNaoLidas] = useState<Set<string>>(() =>
    plugin.unreadSet(),
  );
  useEffect(() => {
    setNaoLidas(plugin.unreadSet());
    return plugin.onUnreadChange(() => setNaoLidas(plugin.unreadSet()));
  }, [plugin]);
  return naoLidas;
}

/**
 * O que a sessão do Agent FEZ. Só o Agent tem essa linha: numa lista de
 * sessões o que distingue uma da outra é o trabalho que rodou. Nos outros
 * módulos o cartão diz só o modelo, que é o que a pessoa pediu.
 *
 * Nada aqui é decorativo: o verde só aparece quando houve ação de verdade.
 */
function acoes(c: ChatSummary): { texto: string; ativo: boolean } | null {
  if (c.mode !== "agent") return null;
  if (c.toolCount > 0) {
    return {
      texto: c.toolCount === 1 ? "1 action" : `${c.toolCount} actions`,
      ativo: true,
    };
  }
  return { texto: "No actions", ativo: false };
}

export function ChatList({
  plugin,
  session,
  chats,
  onOpen,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  chats: ChatSummary[];
  /** Chamado DEPOIS de mandar carregar — pra quem precisa fechar algo. */
  onOpen?: (chat: ChatSummary) => void;
}) {
  const currentChatId = useChatStore((s) => s.currentChatId);
  // Quem está respondendo AGORA — inclusive se for uma conversa que não está
  // na tela. É a única informação desta lista que não vem do disco.
  const respondendo = useChatStore((s) => s.isLoading);
  const turnChatId = useChatStore((s) => s.turnChatId);
  const esperandoId = useChatStore((s) => s.waitingChatId);
  const naoLidas = useUnreadChats(plugin);

  const abrir = (c: ChatSummary) => {
    void session.load(c);
    onOpen?.(c);
  };

  const renomear = async (c: ChatSummary) => {
    const title = await new PromptModal(plugin.app, {
      title: "Rename chat",
      label: "Title",
      initial: c.title,
      submitLabel: "Rename",
    }).openAndWait();
    if (title && title !== c.title) await session.rename(c, title);
  };

  const apagar = async (c: ChatSummary) => {
    const ok = await new ConfirmModal(plugin.app, {
      title: `Delete "${c.title || "Untitled"}"?`,
      body: "The chat file goes to the system trash (recoverable).",
      confirmLabel: "Delete",
      danger: true,
    }).openAndWait();
    if (ok) await session.delete(c);
  };

  return (
    <div className="axxa-history">
      {chats.map((c) => {
        const st = acoes(c);
        const alerta = chatAlert({
          esperando: esperandoId === c.id,
          rodando: respondendo && turnChatId === c.id,
          naoLida: naoLidas.has(c.id),
        });
        return (
          <div
            key={c.id}
            className={[
              "axxa-history-row",
              // A roupa vem do MÓDULO, não da tela onde a lista está:
              // conversa é fala e vira LINHA; sessão de vault ou de agente é
              // um objeto com estado e vira CARTÃO. Assim a mesma conversa
              // se parece consigo mesma em qualquer lugar do app — inclusive
              // no histórico, onde os três se misturam.
              c.mode === "chat" ? "is-flat" : "",
              // Cartão alto: o ⋯ precisa saber disso pra ficar na faixa de
              // cima em vez de boiar no meio da altura.
              c.mode === "agent" && c.preview ? "has-preview" : "",
              c.id === currentChatId ? "is-current" : "",
              alerta ? `has-alert is-${alerta}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <button
              type="button"
              className="axxa-history-open"
              onClick={() => abrir(c)}
            >
              <span className="axxa-card-top">
                {/* O brasão é o LOGO DO PROVIDER, colorido: é o que diz de
                  relance com quem a conversa foi, sem gastar uma palavra. */}
                <span className="axxa-card-mark" aria-hidden="true">
                  <Icon name={providerIcon(c.provider)} size={20} />
                </span>

                <span className="axxa-card-text">
                  <span className="axxa-history-title">
                    {c.title || "Untitled"}
                  </span>
                  <span className="axxa-history-meta">
                    {/* O ponto pulsa e a palavra diz o que ele significa — um
                      ponto sozinho não se explica. */}
                    {alerta && (
                      <span className={`axxa-card-live is-${alerta}`}>
                        <span className="axxa-card-pulse" aria-hidden="true" />
                        {ALERT_LABEL[alerta]}
                      </span>
                    )}
                    {alerta && <span className="axxa-card-dot">·</span>}
                    {st && (
                      <span
                        className={
                          st.ativo ? "axxa-card-state is-on" : "axxa-card-state"
                        }
                      >
                        {st.texto}
                      </span>
                    )}
                    {st && c.model && <span className="axxa-card-dot">·</span>}
                    {c.model && <span>{c.model}</span>}
                  </span>
                </span>

                {/* Tempo desde a ÚLTIMA interação: `date` é reescrito a cada
                  gravação da conversa, não é a data de criação. Fica na ponta,
                  a coluna que se lê de cima a baixo pra achar "a de hoje". */}
                <span className="axxa-card-age">{relativeShort(c.date)}</span>
              </span>

              {/* A última fala, no cartão da SESSÃO. Título e modelo dizem o
                  que ela é; isto diz onde ela parou — a pergunta de quem está
                  decidindo se volta. Só no Agent: numa conversa, o título já
                  é a primeira frase, e repetir a fala embaixo dele seria dizer
                  a mesma coisa duas vezes. */}
              {c.mode === "agent" && c.preview && (
                <span className="axxa-card-preview">{c.preview}</span>
              )}
            </button>

            <button
              type="button"
              className="axxa-icon-btn axxa-history-more"
              aria-label={`Actions for ${c.title || "Untitled"}`}
              onClick={(e) =>
                openActions(e as unknown as MouseEvent, [
                  {
                    label: "Rename",
                    icon: "pencil",
                    run: () => void renomear(c),
                  },
                  {
                    label: "Delete",
                    icon: "trash-2",
                    danger: true,
                    run: () => void apagar(c),
                  },
                ])
              }
            >
              <Icon name="more-horizontal" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
