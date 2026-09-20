// src/ui/Dashboard.tsx
// A HOME do app: uma pergunta com duas respostas — CONTINUAR de onde parou,
// ou COMEÇAR algo novo. Quem decide é quem abriu.
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
//
// E são QUATRO conversas, não todas. Quatro é o que responde "onde eu estava";
// a partir daí a lista deixa de ser uma resposta e vira um arquivo — que tem
// tela própria, com busca (ver History.tsx).
//
// As abas aqui são OS TRÊS MODOS, sem "All": a home é sobre um lugar de cada
// vez, e ela abre naquele em que se mexeu por último. "Tudo junto" — e as
// conversas de módulos que esta versão não conhece — é assunto do histórico,
// que é onde se garimpa.

import type AxxaPlugin from "../main";
import type { ChatSession } from "../core/session";
import { CHAT_MODES, isChatMode, type ChatMode } from "../core/session";
import { useChatStore } from "../store/chat";
import { ChatList, useChatSummaries, useUnreadChats } from "./ChatList";
import { Icon } from "./Icon";
import { Segmented } from "./Segmented";
import { RagLine } from "./RagLine";
import { UsageCard } from "./UsageCard";
import { alertCount } from "./chatAlert";
import { MODULES, chatsOfModule, defaultSegment } from "./modules";
import type { ChatSummary } from "../core/chatPersistence";

/** Quantas conversas a home mostra antes de mandar pro histórico. */
const RECENTES = 4;

export function Dashboard({
  plugin,
  session,
  aba,
  onAba,
  onOpenMenu,
  onNewChat,
  onOpenChat,
  onOpenHistory,
  onOpenUsage,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  /** A aba vale pras duas telas: filtrar aqui e pedir "ver tudo" leva o
   *  filtro junto. */
  aba: string;
  onAba: (id: string) => void;
  onOpenMenu: () => void;
  /** Começar uma conversa naquele modo — já com o teclado aberto. */
  onNewChat: (mode: ChatMode) => void;
  onOpenChat: (chat: ChatSummary) => void;
  onOpenHistory: () => void;
  onOpenUsage: () => void;
}) {
  const chats = useChatSummaries(plugin);
  const naoLidas = useUnreadChats(plugin);
  const esperandoId = useChatStore((s) => s.waitingChatId);

  // A aba compartilhada pode estar em "All" (o histórico tem essa) ou num
  // módulo que só existe no disco. Aqui isso vira o modo de quem se mexeu
  // por último — é o que "continuar de onde parou" quer dizer.
  const atual: ChatMode = isChatMode(aba)
    ? aba
    : defaultSegment(chats, plugin.settings.defaultMode);
  const visiveis = chatsOfModule(chats, atual);

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
        {/* O nome mora na BARRA, ao lado do menu, e não como título dentro da
            página: título de página serve pra dizer onde você está, e esta é
            a única tela que não é "um lugar" — é a casa. Como nome do app ele
            é assinatura, não cabeçalho, e o espaço que ele ocupava em cima
            virou quase uma conversa a mais na lista. */}
        <span className="axxa-brand axxa-topbar-brand">AXXA AI AGENT</span>
      </header>

      <div className="axxa-messages axxa-home axxa-dash">
        {/* O gasto vem ANTES da lista porque é a única coisa aqui que corre
            sozinha enquanto você usa o app: conversa velha continua onde
            estava, conta não. Ele conta a semana inteira, de todos os modos —
            por isso não obedece à aba. */}
        <UsageCard plugin={plugin} chats={chats} onOpen={onOpenUsage} />

        {/* Logo abaixo do cartão, e do mesmo assunto: o cartão conta o que
            saiu daqui pros modelos; esta linha conta o que FICA aqui. */}
        <RagLine plugin={plugin} />

        {/* Os três, sempre — inclusive o que ainda não tem conversa: aqui a
            aba não é só filtro, é o lugar onde se está. */}
        <Segmented
          options={CHAT_MODES.map((m) => ({
            id: m,
            label: MODULES[m].short,
            // O ponto diz em qual modo está o que pede você. Sem ele, a aba
            // esconderia justamente o que não podia ser escondido.
            dot:
              alertCount(chats, m, {
                esperando: esperandoId,
                naoLidas,
              }) > 0,
          }))}
          value={atual}
          label="Chat mode"
          onChange={onAba}
        />

        {visiveis.length > 0 && (
          <>
            <div className="axxa-home-headrow">
              <span className="axxa-section-label">
                Pick up where you left
              </span>
              {/* Só aparece quando há mesmo mais o que ver. Um "ver tudo" que
                  mostra o que já está na tela é um toque que não leva a
                  lugar nenhum. */}
              {visiveis.length > RECENTES && (
                <button
                  type="button"
                  // `is-accent` só aqui: este botão LEVA a algum lugar, e a
                  // cor do app é o que diz isso. O irmão de classe (o filtro
                  // de período do Agent) abre um menu no mesmo lugar — pintar
                  // os dois igual ensinaria que a cor não significa nada.
                  className="axxa-home-filter is-accent"
                  // Fixa a aba ANTES de sair: o histórico lê a mesma, e ela
                  // pode estar valendo por dedução (ver `atual`). Sem isto,
                  // "ver tudo" de Agent abriria o histórico em "All".
                  onClick={() => {
                    onAba(atual);
                    onOpenHistory();
                  }}
                >
                  <span>See all {visiveis.length}</span>
                  <Icon name="chevron-right" size={16} />
                </button>
              )}
            </div>
            <ChatList
              plugin={plugin}
              session={session}
              chats={visiveis.slice(0, RECENTES)}
              onOpen={onOpenChat}
            />
          </>
        )}

        {visiveis.length === 0 && (
          <div className="axxa-home-empty">
            <Icon name={MODULES[atual].icon} size={42} />
            <p>{MODULES[atual].emptyLine}</p>
          </div>
        )}

        {/* Grudado na base DENTRO do scroller, como o botão flutuante da home
            de módulo — fora dele precisaria de um ancestral posicionado, e
            `.axxa-chat` não é posicionado (ver o bloco do composer no CSS). */}
        <section className="axxa-start">
          {/* O "ou" é o ponto da tela: continuar OU começar, e quem decide é
              quem abriu. Sem ele os dois blocos viram uma lista comprida com
              um rodapé — a escolha existe, mas não se lê.

              Vive DENTRO da barra grudada na base, não solto no meio da
              página: com a lista rolando, um "ou" que sobe junto separaria
              duas coisas que já não estão mais uma de cada lado.

              E só aparece quando há o que continuar: sem conversa nenhuma não
              há bifurcação, há um caminho só. */}
          {visiveis.length > 0 && (
            <span className="axxa-or">
              <span>or</span>
            </span>
          )}
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
