// src/ui/chatAlert.ts
// O ESTADO de uma conversa numa lista: ela precisa de você, está trabalhando,
// ou terminou sem você ver?
//
// Três coisas de naturezas diferentes chegam aqui, e é de propósito que a
// decisão de qual mostrar viva num lugar só:
//
//   • "precisa de você" é AO VIVO e só existe no agente — o turno parou num
//     pedido de aprovação e não anda sem uma resposta sua;
//   • "respondendo" é AO VIVO — o turno está rodando, possivelmente fora da
//     tela (ver BackgroundRun em store/chat.ts);
//   • "não lida" é GRAVADO — a resposta chegou enquanto você estava em outro
//     lugar e você ainda não abriu aquela conversa.
//
// A prioridade não é estética: uma conversa parada esperando você é a única
// que não anda sozinha, então ela fala mais alto que as outras duas.

export type ChatAlert = "waiting" | "running" | "unread" | null;

export function chatAlert(p: {
  /** O turno desta conversa parou pedindo aprovação. */
  esperando: boolean;
  /** Esta conversa está respondendo agora. */
  rodando: boolean;
  /** Terminou de responder sem você ver. */
  naoLida: boolean;
}): ChatAlert {
  if (p.esperando) return "waiting";
  if (p.rodando) return "running";
  if (p.naoLida) return "unread";
  return null;
}

/** O que cada estado diz. Frases curtas: elas dividem a linha com o modelo. */
export const ALERT_LABEL: Record<Exclude<ChatAlert, null>, string> = {
  waiting: "Needs you",
  running: "Responding",
  unread: "New reply",
};

/**
 * Quantas conversas de um módulo pedem atenção — é o número que aparece na
 * linha do módulo, no menu.
 *
 * "Precisa de você" e "não lida" contam; "respondendo" NÃO. Uma conversa que
 * está trabalhando não está pedindo nada — marcar o menu por causa dela seria
 * chamar a pessoa pra ver uma coisa que ainda não aconteceu.
 */
export function alertCount(
  chats: ReadonlyArray<{ id: string; mode: string }>,
  mode: string,
  p: { esperando: string | null; naoLidas: ReadonlySet<string> }
): number {
  let n = 0;
  for (const c of chats) {
    if (c.mode !== mode) continue;
    if (c.id === p.esperando || p.naoLidas.has(c.id)) n += 1;
  }
  return n;
}
