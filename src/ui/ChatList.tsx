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
      setChats(plugin.chatSummaries ?? [])
    );
    return () => {
      vivo = false;
      unsub();
    };
  }, [plugin]);
  return chats;
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
        return (
          <div
            key={c.id}
            className={
              c.id === currentChatId
                ? "axxa-history-row is-current"
                : "axxa-history-row"
            }
          >
            <button
              type="button"
              className="axxa-history-open"
              onClick={() => abrir(c)}
            >
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
