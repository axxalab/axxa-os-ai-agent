// src/ui/follow.ts
// "Seguir o fim da conversa" — a regra que decide se a tela acompanha o texto
// que está chegando ou se fica onde o usuário deixou.
//
// O caso que importa: a resposta é longa, a pessoa sobe pra reler o começo e
// desce devagar lendo. Se a tela continuar colada no fim, ela é arrancada de
// onde estava a cada pedaço de texto — o que era uma conversa vira um elevador.
//
// A decisão é só distância: perto do fim = seguindo; longe = a pessoa está
// lendo, não mexe. Isso resolve sozinho o problema de distinguir a nossa
// rolagem da dela — depois que a NOSSA rolagem acontece, a posição está no
// fim, então continua "seguindo".

/** Folga pra contar como "no fim". Uma linha e pouco: a rolagem do dedo quase
 *  nunca para no pixel exato, e no Android o scrollTop chega a vir fracionado. */
export const FOLLOW_SLACK = 72;

export interface ScrollLike {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/** Quanto falta pra chegar no fim, em px (0 = colado). */
export function distanceFromBottom(el: ScrollLike): number {
  return Math.max(0, el.scrollHeight - el.scrollTop - el.clientHeight);
}

/** A tela deve continuar acompanhando o fim? */
export function shouldFollow(el: ScrollLike, slack = FOLLOW_SLACK): boolean {
  return distanceFromBottom(el) <= slack;
}

/**
 * A pergunta que vale na hora de decidir se a tela desce: o usuário estava no
 * fim ANTES deste conteúdo chegar?
 *
 * Perguntar "está no fim agora" não serve: o texto que acabou de entrar já
 * empurrou o fim pra longe, e a resposta seria sempre "não" — a tela pararia
 * de acompanhar no primeiro pedaço. Com a altura ANTERIOR, a conta é sobre
 * onde a pessoa estava, que é o que importa.
 *
 * E isto não depende de evento de scroll nenhum: a decisão sai do DOM no
 * momento em que o conteúdo muda. Evento de scroll chega atrasado, é engolido
 * quando a janela não está pintando, e num fling vem em rajada.
 */
export function wasAtBottom(
  alturaAnterior: number,
  scrollTop: number,
  clientHeight: number,
  slack = FOLLOW_SLACK
): boolean {
  const distancia = Math.max(0, alturaAnterior - scrollTop - clientHeight);
  return distancia <= slack;
}

/**
 * O aviso flutuante ("desceu?") só faz sentido quando a pessoa está longe do
 * fim E tem coisa nova lá embaixo: durante a resposta, ou quando ela acabou de
 * terminar longe dos olhos dela.
 */
export function shouldShowJump(
  seguindo: boolean,
  respondendo: boolean,
  terminouLonge: boolean
): boolean {
  if (seguindo) return false;
  return respondendo || terminouLonge;
}

/**
 * A decisão inteira, num lugar só.
 *
 * `gesto` é o que conserta o bug que dava "não dá pra subir": com o dedo na
 * tela, a régua passa a ser a altura ATUAL e a tela nunca desce sozinha. Sem
 * isso, o dedo anda uns 40px entre um pedaço de texto e outro — menos que a
 * folga — e cada pedaço colava a tela no fim de novo, então o deslocamento
 * nunca acumulava: a conversa parecia grudada.
 */
export function decideScroll(p: {
  /** Tem dedo (ou roda) mexendo agora? */
  gesto: boolean;
  /** Altura antes do conteúdo que acabou de entrar. */
  alturaAnterior: number;
  /** Altura agora. */
  alturaAtual: number;
  scrollTop: number;
  clientHeight: number;
  slack?: number;
}): { pin: boolean; seguindo: boolean } {
  const base = p.gesto ? p.alturaAtual : p.alturaAnterior || p.alturaAtual;
  const noFim = wasAtBottom(base, p.scrollTop, p.clientHeight, p.slack);
  return { pin: noFim && !p.gesto, seguindo: noFim };
}
