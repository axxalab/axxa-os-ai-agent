// src/ui/Dashboard.tsx
// A HOME do app: os três módulos num painel, e o estado de cada um.
//
// Ela existe porque abrir o plugin numa conversa vazia responde a pergunta
// errada. A primeira pergunta de quem abre não é "o que eu escrevo", é "onde
// eu estava" — tem resposta esperando no Agent? ficou algo sem ler? o que
// rodou ontem? O painel responde isso antes de pedir qualquer coisa.
//
// O toque leva à TELA DO MÓDULO, não direto a uma conversa nova: lá estão as
// conversas dele e o botão de começar outra. Pular pra conversa nova faria a
// seta de voltar cair num lugar diferente de onde a pessoa veio.

import type AxxaPlugin from "../main";
import type { ChatSession } from "../core/session";
import { useChatStore } from "../store/chat";
import { ChatList, useChatSummaries, useUnreadChats } from "./ChatList";
import { Icon } from "./Icon";
import { alertCount } from "./chatAlert";
import {
  chatsOfModule,
  moduleHint,
  moduleStats,
  modulesInUse,
} from "./modules";
import type { ChatSummary } from "../core/chatPersistence";

/** Quantas conversas recentes o painel mostra abaixo dos módulos. */
const RECENTES = 3;

export function Dashboard({
  plugin,
  session,
  onOpenMenu,
  onEnterModule,
  onOpenChat,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  onOpenMenu: () => void;
  onEnterModule: (mode: string) => void;
  onOpenChat: (chat: ChatSummary) => void;
}) {
  const chats = useChatSummaries(plugin);
  const naoLidas = useUnreadChats(plugin);
  const esperandoId = useChatStore((s) => s.waitingChatId);
  const rodando = useChatStore((s) => s.isLoading);
  const turnChatId = useChatStore((s) => s.turnChatId);
  const modulos = modulesInUse(chats);

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

        <div className="axxa-dash-grid">
          {modulos.map((m) => {
            const stats = moduleStats(chats, m.id);
            const pedindo = alertCount(chats, m.id, {
              esperando: esperandoId,
              naoLidas,
            });
            const daqui = chatsOfModule(chats, m.id);
            const respondendoAqui =
              rodando && daqui.some((c) => c.id === turnChatId);
            return (
              <button
                key={m.id}
                type="button"
                className={
                  respondendoAqui
                    ? "axxa-dash-card is-running"
                    : "axxa-dash-card"
                }
                onClick={() => onEnterModule(m.id)}
              >
                <span className="axxa-dash-head">
                  <Icon name={m.icon} size={22} />
                  {/* O número só aparece quando há o que atender. Um "0"
                      permanente ensina a ignorar o lugar onde ele fica. */}
                  {pedindo > 0 && (
                    <span className="axxa-module-badge">{pedindo}</span>
                  )}
                </span>
                <span className="axxa-dash-name">{m.label}</span>
                <span className="axxa-dash-hint">
                  {respondendoAqui ? "Responding…" : moduleHint(stats)}
                </span>
              </button>
            );
          })}
        </div>

        {chats.length > 0 && (
          <section className="axxa-home-block">
            <span className="axxa-section-label">Pick up where you left</span>
            <ChatList
              plugin={plugin}
              session={session}
              chats={chats.slice(0, RECENTES)}
              onOpen={onOpenChat}
            />
          </section>
        )}

        {chats.length === 0 && (
          <div className="axxa-home-empty">
            <Icon name="message-circle" size={42} />
            <p>Nothing here yet. Pick a mode above to start.</p>
          </div>
        )}
      </div>
    </div>
  );
}
