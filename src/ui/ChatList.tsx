// src/ui/ChatList.tsx
// A lista de conversas — título, modelo, data e o ⋯ com renomear/apagar.
//
// Ela morava dentro da gaveta. Saiu de lá porque a lista de um módulo pertence
// à TELA daquele módulo, ao lado do campo de texto: o menu leva você ao lugar,
// e é no lugar que estão as suas conversas. Como componente, serve a quem
// precisar dela — hoje a tela inicial.

import { useEffect, useState } from "react";
import type AxxaPlugin from "../main";
import type { ChatSession } from "../core/session";
import type { ChatSummary } from "../core/chatPersistence";
import { useChatStore } from "../store/chat";
import { Icon } from "./Icon";
import { openActions } from "./menu";
import { PromptModal, ConfirmModal } from "./modals";

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
      {chats.map((c) => (
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
            <span className="axxa-history-title">{c.title || "Untitled"}</span>
            {/* Sem etiqueta de modo: a tela inteira já é daquele módulo. */}
            <span className="axxa-history-meta">
              {c.model} · {c.date.slice(0, 10)}
            </span>
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
      ))}
    </div>
  );
}
