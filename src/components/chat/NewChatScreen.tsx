// src/components/chat/NewChatScreen.tsx
// Base LIMPA de "nova conversa" (v0.1.219). Substitui a StarterScreen quando o
// user abre um chat novo pela gaveta (New chat / New Q&A / New Agent): SEM
// seletor de provider, lista de modelos, card ou saudação-stat — só um respiro
// central com o modo + o Composer (renderizado por fora, embaixo).
//
// É de propósito minimalista: a "base" que vamos crescer juntos.

import { Icon } from "../_shared/Icon";
import { useT } from "../../i18n";

/** Ícone + textos por modo. chat | vault-qa | agent. */
function modeBits(mode: string, t: ReturnType<typeof useT>) {
  switch (mode) {
    case "vault-qa":
      return {
        icon: "library",
        title: t.newChatScreen.vaultQaTitle,
        sub: t.newChatScreen.vaultQaSub,
      };
    case "agent":
      return {
        icon: "bot",
        title: t.newChatScreen.agentTitle,
        sub: t.newChatScreen.agentSub,
      };
    default:
      return {
        icon: "message-square",
        title: t.newChatScreen.chatTitle,
        sub: t.newChatScreen.chatSub,
      };
  }
}

export function NewChatScreen({ mode }: { mode: string }) {
  const t = useT();
  const { icon, title, sub } = modeBits(mode, t);
  return (
    <div className="axxa-newchat" data-mode={mode}>
      <div className="axxa-newchat-center">
        <span className="axxa-newchat-icon">
          <Icon name={icon} />
        </span>
        <h2 className="axxa-newchat-title">{title}</h2>
        <p className="axxa-newchat-sub">{sub}</p>
      </div>
    </div>
  );
}
