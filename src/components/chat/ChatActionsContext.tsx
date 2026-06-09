// src/components/chat/ChatActionsContext.tsx
// Context React que expõe ações sobre mensagens do chat (regenerar, deletar)
// pros componentes folha da árvore (Messages.tsx). A lógica em si vive no
// AxxaApp.tsx (que tem acesso a provider, settings, abortRef, etc).
//
// Analogia: AxxaApp = "design system" que publica os tokens. Messages =
// componente final que CONSOME esses tokens via lookup direto, sem precisar
// receber em cadeia (prop drilling).

import { createContext, useContext } from "react";

export interface ChatActions {
  /** Re-roda a streamChat usando a user-msg que precede esse ai-response.
   *  Remove a resposta antiga e qualquer msg posterior antes do novo stream. */
  regenerate: (aiMessageId: string) => void;
  /** Remove a mensagem. Se for user-msg, remove também o ai-response logo a seguir. */
  deleteMessage: (messageId: string) => void;
  /** Continua uma resposta cortada no limite — emenda tokens na MESMA bolha. */
  continueResponse: (aiMessageId: string) => void;
}

export const ChatActionsContext = createContext<ChatActions | null>(null);

export function useChatActions(): ChatActions {
  const ctx = useContext(ChatActionsContext);
  if (!ctx) {
    throw new Error(
      "useChatActions chamado fora de <ChatActionsContext.Provider>. " +
        "AxxaApp tem que envolver os filhos com o provider."
    );
  }
  return ctx;
}
