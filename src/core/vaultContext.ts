// src/core/vaultContext.ts
// Quem decide se as SUAS NOTAS entram na conversa.
//
// Até aqui isso era o modo: "vault-qa" buscava no vault, o resto não. Modo é
// uma escolha grossa demais pra uma coisa que muda de mensagem pra mensagem —
// tem conversa de Chat em que você quer citar suas notas, e tem sessão de
// Agent em que a busca só atrapalha (ele já lê o vault com as ferramentas).
//
// Agora é um interruptor por conversa, com um PADRÃO por modo:
//
//   • Vault Q&A nasce LIGADO — responder com base nas notas é o que ele é;
//   • Agent nasce LIGADO — ele trabalha dentro do vault, e chegar sabendo o
//     que já está escrito evita refazer o que existe;
//   • Chat nasce DESLIGADO — "só você e o modelo" é a promessa dele, e uma
//     busca silenciosa no vault quebraria essa promessa sem avisar.
//
// O padrão não é uma trava: é o estado inicial de quem nunca tocou no
// interruptor. Tocou uma vez, a escolha é da pessoa e acompanha a conversa.

import type { ChatMode } from "./session";

/** O interruptor nasce assim em cada modo. */
export function vaultDefault(mode: string): boolean {
  return mode === "vault-qa" || mode === "agent";
}

/**
 * O estado do interruptor: a escolha da pessoa, se houver; senão o padrão do
 * modo.
 *
 * `null` (e não `false`) é o que distingue "desliguei" de "nunca mexi": sem
 * essa diferença, trocar de Chat pra Vault Q&A não conseguiria ligar sozinho,
 * porque um `false` de nascença seria indistinguível de uma escolha.
 */
export function vaultAtivo(mode: string, escolha: boolean | null): boolean {
  return escolha ?? vaultDefault(mode);
}
