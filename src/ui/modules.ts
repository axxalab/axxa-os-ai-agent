// src/ui/modules.ts
// Os MÓDULOS do app — chat, vault-qa e agent — num lugar só.
//
// Eles já existiam como `ChatMode` no motor (e como PASTA no vault: uma
// conversa mora em `axxa-ai/chats/<modo>/<id>.md`, então o módulo dela é o
// caminho, não um campo qualquer). O que não existia era um lugar onde o
// módulo se descrevesse: o rótulo estava escrito à mão na tela inicial, de
// novo no ChatView, e a gaveta mostrava o id cru ("vault-qa") pro usuário.
// Três cópias que já discordavam entre si.
//
// Aqui fica a descrição, e as contas de lista que a gaveta precisa. Tudo puro:
// recebe as conversas, devolve o recorte.

import { CHAT_MODES, isChatMode, type ChatMode } from "../core/session";
import type { ChatSummary } from "../core/chatPersistence";

export interface ModuleMeta {
  /** `ChatMode` pros três que o motor conhece; um id qualquer pros que só
   *  existem no disco (ver `modulesInUse`). */
  id: string;
  /** Nome humano. Nunca mostre o id pro usuário. */
  label: string;
  icon: string;
  /** Uma linha dizendo o que o módulo faz — usada na tela inicial. */
  tagline: string;
  /** Placeholder do campo de texto naquele módulo. */
  placeholder: string;
  /** O que a home diz quando não há nenhuma conversa ainda. */
  emptyLine: string;
}

export const MODULES: Record<ChatMode, ModuleMeta> = {
  chat: {
    id: "chat",
    label: "Chat",
    icon: "message-circle",
    tagline: "Just you and the model. Your notes stay out of it.",
    placeholder: "Message the model…",
    emptyLine: "Ask anything. Your chats show up here.",
  },
  "vault-qa": {
    id: "vault-qa",
    label: "Vault Q&A",
    icon: "library",
    tagline: "Answers grounded in your notes, found by local search.",
    placeholder: "Ask something about your notes…",
    emptyLine: "Ask about your notes. The answers land here.",
  },
  agent: {
    id: "agent",
    label: "Agent",
    icon: "bot",
    tagline: "Reads and edits your vault — every change asks first.",
    placeholder: "Tell the agent what to do in your vault…",
    emptyLine: "Put the agent to work in your vault. Runs show up here.",
  },
};

/** Na ordem em que aparecem no menu e na tela inicial. */
export const MODULE_LIST: ModuleMeta[] = CHAT_MODES.map((m) => MODULES[m]);

/**
 * Os módulos que o menu deve mostrar: os três do motor MAIS qualquer outro
 * que apareça nas conversas gravadas.
 *
 * Sem isso, uma conversa com modo desconhecido — gravada por uma versão mais
 * nova, ou numa pasta criada na mão dentro de `axxa-ai/chats/` — ficaria
 * INALCANÇÁVEL: o menu só teria portas pros modos que esta versão conhece, e
 * o arquivo estaria lá, invisível. O menu lista o que os dados dizem.
 */
export function modulesInUse(chats: readonly ChatSummary[]): ModuleMeta[] {
  const extras = new Map<string, ModuleMeta>();
  for (const c of chats) {
    if (!c.mode || isChatMode(c.mode) || extras.has(c.mode)) continue;
    extras.set(c.mode, {
      id: c.mode,
      label: moduleLabel(c.mode),
      icon: moduleIcon(c.mode),
      tagline: "",
      placeholder: MODULES.chat.placeholder,
      emptyLine: MODULES.chat.emptyLine,
    });
  }
  return [...MODULE_LIST, ...extras.values()];
}

/**
 * Nome humano de um modo. Um modo DESCONHECIDO (conversa gravada por uma
 * versão futura, ou pasta criada na mão) devolve o próprio id em vez de
 * sumir: melhor o usuário ver "pesquisa" do que ver nada.
 */
export function moduleLabel(id: string | undefined | null): string {
  if (isChatMode(id)) return MODULES[id].label;
  return (id ?? "").trim() || "Chat";
}

/** Ícone do modo; desconhecido cai num genérico em vez de quebrar o Lucide. */
export function moduleIcon(id: string | undefined | null): string {
  return isChatMode(id) ? MODULES[id].icon : "message-square";
}

export function modulePlaceholder(id: string | undefined | null): string {
  return isChatMode(id) ? MODULES[id].placeholder : MODULES.chat.placeholder;
}

/** Frase da home quando o módulo ainda não tem conversa nenhuma. */
export function moduleEmptyLine(id: string | undefined | null): string {
  if (isChatMode(id)) return MODULES[id].emptyLine;
  // Módulo que só existe no disco: o texto explica por que não há botão.
  return "Chats saved here by another version. This one can't start new ones.";
}

/**
 * As conversas de um módulo, na ordem em que já vieram (o plugin mantém tudo
 * ordenado por data decrescente). Não reordena: reordenar aqui seria uma
 * segunda verdade sobre "mais recente".
 */
export function chatsOfModule(
  chats: readonly ChatSummary[],
  mode: string
): ChatSummary[] {
  return chats.filter((c) => c.mode === mode);
}

/** O que a linha do módulo mostra sem precisar entrar nele. */
export interface ModuleStats {
  count: number;
  /** Data da conversa mais recente (ISO), ou undefined se não houver nenhuma. */
  last?: string;
}

export function moduleStats(
  chats: readonly ChatSummary[],
  mode: string
): ModuleStats {
  const minhas = chatsOfModule(chats, mode);
  if (minhas.length === 0) return { count: 0 };
  // Mais recente = maior data. Não confia na ordem de quem passou a lista.
  let last = minhas[0].date;
  for (const c of minhas) if (c.date > last) last = c.date;
  return { count: minhas.length, last };
}

/**
 * "Today" / "Yesterday" / "5 days ago" / a data, pra datas velhas.
 *
 * A comparação é por DIA DO CALENDÁRIO local, não por 24 horas corridas: às
 * 00:30 a conversa das 23:50 é "Yesterday", e dizer "0 days ago" seria
 * tecnicamente certo e humanamente errado.
 */
export function relativeDay(iso: string, agora: number = Date.now()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dia = (x: Date) =>
    Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) / 86400000;
  const diff = dia(new Date(agora)) - dia(d);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return iso.slice(0, 10);
}

/** Resumo de uma linha pra a linha do módulo no menu. */
export function moduleHint(stats: ModuleStats, agora?: number): string {
  if (stats.count === 0) return "No chats yet";
  const quantos = stats.count === 1 ? "1 chat" : `${stats.count} chats`;
  const quando = stats.last ? relativeDay(stats.last, agora) : "";
  return quando ? `${quantos} · ${quando}` : quantos;
}
