// src/store/chat.ts
// Store Zustand do chat — fonte única de verdade pras mensagens.
// Analogia: pensa nele como o "Layers panel" no Figma — uma lista ordenada de
// elementos (mensagens), cada um com seu tipo. Componentes leem essa lista e
// renderizam o variant correto pra cada item.

import { create } from "zustand";

export type MessageType = "user" | "ai-response" | "ai-comment" | "ai-options";

interface BaseMessage {
  id: string;
  type: MessageType;
  timestamp: number;
}

export interface UserMessage extends BaseMessage {
  type: "user";
  content: string;
}

export interface AIResponseMessage extends BaseMessage {
  type: "ai-response";
  content: string;
  /** Reaction do user — persiste no .md, sobrevive a reload. */
  reaction?: "like" | "dislike" | null;
}

/**
 * Activity tracking — opcional. Quando presente, o ai-comment vira um
 * "activity step" com ícone animado durante phase="pending" e ícone fixo
 * + check quando phase="done"/"failed".
 *
 * Inspiração: estilo do Claude Code (timeline de tools que pulsa enquanto
 * roda e mostra resultado quando termina).
 */
export interface ActivityMeta {
  phase: "pending" | "done" | "failed";
  /** Ícone Lucide enquanto pending (pulsando). Ex: "eye", "file-pen-line". */
  iconPending: string;
  /** Ícone Lucide quando done (estático). Default: "check". */
  iconDone?: string;
  /** Ícone Lucide quando failed. Default: "x". */
  iconFailed?: string;
  /** Texto enquanto pending (ex: "Lendo notas/foo.md"). */
  pendingText: string;
  /** Texto quando done (ex: "Notas/foo.md lida — 1.2k chars"). Fallback: pendingText sem o gerúndio. */
  doneText?: string;
  /** Texto quando failed. Default: "Falhou: " + error message. */
  failedText?: string;
}

export interface AICommentMessage extends BaseMessage {
  type: "ai-comment";
  content: string;
  /** Quando set, renderiza como ActivityComment animado em vez de bubble simples. */
  activity?: ActivityMeta;
}

export interface AIOptionsMessage extends BaseMessage {
  type: "ai-options";
  prompt: string;
  options: string[];
  selectedIndex?: number;
}

export type ChatMessage =
  | UserMessage
  | AIResponseMessage
  | AICommentMessage
  | AIOptionsMessage;

// DistributiveOmit aplica o Omit em cada membro do union separadamente.
// Sem isso, Omit<ChatMessage, "id"> colapsa pros campos comuns dos 4 variants
// e perde a discriminação por `type`.
type DistributiveOmit<T, K extends keyof any> = T extends unknown
  ? Omit<T, K>
  : never;

export type NewMessageInput = DistributiveOmit<ChatMessage, "id" | "timestamp">;

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  /** Tokens acumulados da sessão atual (in = prompt, out = completion). */
  tokensIn: number;
  tokensOut: number;
  /** Última snapshot de prompt_tokens (usado pra estimar "contexto usado") */
  lastPromptTokens: number;
  /** Id da mensagem que tá sendo streamada agora (pra esconder footer durante stream). */
  streamingMessageId: string | null;
  /** Timestamp (ms) do primeiro token do stream atual. null entre streams. */
  streamStartedAt: number | null;
  /** Quantidade aproximada de tokens recebidos no stream atual (chars/3.5). */
  streamTokens: number;
  /** Tokens por segundo calculado durante streaming. Persiste após o fim. */
  tokensPerSec: number;
  /** Provider/model/mode TRAVADOS após primeira mensagem (session lock). null = não travado. */
  sessionProvider: string | null;
  sessionModel: string | null;
  sessionMode: string | null;
  /** ID do chat atual (UUID). null antes da primeira msg. Usado pra save/load. */
  currentChatId: string | null;
  /** Título do chat atual (auto-gerado da primeira msg do user). */
  currentChatTitle: string;
  addMessage: (msg: NewMessageInput) => string;
  removeMessage: (id: string) => void;
  appendToMessage: (id: string, text: string) => void;
  /** Atualiza meta `activity` de um ai-comment existente (transição
   *  pending → done / failed). No-op se a msg não for ai-comment.
   *  contentPatch opcional substitui o `content` na mesma operação (usado
   *  pra anexar meta-result como "1.2k chars"). */
  updateActivity: (
    id: string,
    patch: Partial<ActivityMeta>,
    contentPatch?: string
  ) => void;
  /** Toggle/seta reaction num ai-response. null = neutro, "like"/"dislike". */
  setReaction: (id: string, reaction: "like" | "dislike" | null) => void;
  selectOption: (messageId: string, optionIndex: number) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  addUsage: (input: number, output: number) => void;
  resetUsage: () => void;
  setStreamingMessageId: (id: string | null) => void;
  /** Marca início do stream (reset de tokensPerSec + start time). */
  startStreamTimer: () => void;
  /** Incrementa contagem aproximada de tokens + recomputa tokensPerSec.
   *  Recebe o texto do delta — estimamos tokens por chars/3.5. */
  tickStreamTokens: (chunk: string) => void;
  /** Encerra o timer mas mantém o último valor de tokensPerSec visível. */
  endStreamTimer: () => void;
  lockSession: (provider: string, model: string, mode?: string) => void;
  unlockSession: () => void;
  setCurrentChatId: (id: string | null) => void;
  setCurrentChatTitle: (title: string) => void;
  /** Substitui o array de mensagens inteiro (usado ao carregar chat do disco). */
  setMessages: (msgs: ChatMessage[]) => void;
  /** Reset completo pra "Nova conversa" — limpa msgs, lock, IDs, tokens. */
  newChat: () => void;
}

function makeId(): string {
  // crypto.randomUUID está disponível em Electron/Obsidian e em browsers modernos
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback simples (não precisa ser globally unique, só local-unique)
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  tokensIn: 0,
  tokensOut: 0,
  lastPromptTokens: 0,
  streamingMessageId: null,
  streamStartedAt: null,
  streamTokens: 0,
  tokensPerSec: 0,
  sessionProvider: null,
  sessionModel: null,
  sessionMode: null,
  currentChatId: null,
  currentChatTitle: "",
  addMessage: (msg) => {
    const id = makeId();
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id, timestamp: Date.now() } as ChatMessage,
      ],
    }));
    return id;
  },
  removeMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),
  // appendToMessage adiciona texto ao final de uma mensagem com content
  // (user, ai-response, ai-comment). Usado no streaming pra mostrar tokens
  // chegando um a um. Não-op em ai-options (não tem content).
  appendToMessage: (id, text) =>
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== id) return m;
        if (m.type === "ai-options") return m;
        return { ...m, content: m.content + text };
      }),
    })),
  // Patch atômico de campos do activity meta. Usado pelo agent loop pra
  // mudar phase=pending → done/failed mantendo iconPending/pendingText.
  updateActivity: (id, patch, contentPatch) =>
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== id) return m;
        if (m.type !== "ai-comment") return m;
        if (!m.activity) return m;
        return {
          ...m,
          activity: { ...m.activity, ...patch },
          ...(contentPatch !== undefined ? { content: contentPatch } : {}),
        };
      }),
    })),
  setReaction: (id, reaction) =>
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== id) return m;
        if (m.type !== "ai-response") return m;
        return { ...m, reaction };
      }),
    })),
  selectOption: (messageId, optionIndex) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId && m.type === "ai-options"
          ? { ...m, selectedIndex: optionIndex }
          : m
      ),
    })),
  clearMessages: () =>
    set({
      messages: [],
      isLoading: false,
      tokensIn: 0,
      tokensOut: 0,
      lastPromptTokens: 0,
      streamingMessageId: null,
      sessionProvider: null,
      sessionModel: null,
      sessionMode: null,
    }),
  setLoading: (loading) => set({ isLoading: loading }),
  addUsage: (input, output) =>
    set((state) => ({
      tokensIn: state.tokensIn + input,
      tokensOut: state.tokensOut + output,
      lastPromptTokens: input > 0 ? input : state.lastPromptTokens,
    })),
  resetUsage: () => set({ tokensIn: 0, tokensOut: 0, lastPromptTokens: 0 }),
  setStreamingMessageId: (id) => set({ streamingMessageId: id }),
  startStreamTimer: () =>
    set({ streamStartedAt: Date.now(), streamTokens: 0, tokensPerSec: 0 }),
  tickStreamTokens: (chunk) =>
    set((state) => {
      if (state.streamStartedAt === null) {
        // Primeiro tick — começa o timer agora se não foi iniciado antes
        const now = Date.now();
        const approx = Math.max(1, Math.ceil(chunk.length / 3.5));
        return {
          streamStartedAt: now,
          streamTokens: approx,
          tokensPerSec: 0,
        };
      }
      const approx = Math.ceil(chunk.length / 3.5);
      const newTokens = state.streamTokens + approx;
      const elapsedSec = (Date.now() - state.streamStartedAt) / 1000;
      const tps = elapsedSec > 0.05 ? newTokens / elapsedSec : 0;
      return {
        streamTokens: newTokens,
        tokensPerSec: tps,
      };
    }),
  endStreamTimer: () => set({ streamStartedAt: null }),
  lockSession: (provider, model, mode) =>
    set({
      sessionProvider: provider,
      sessionModel: model,
      sessionMode: mode ?? "chat",
    }),
  unlockSession: () =>
    set({ sessionProvider: null, sessionModel: null, sessionMode: null }),
  setCurrentChatId: (id) => set({ currentChatId: id }),
  setCurrentChatTitle: (title) => set({ currentChatTitle: title }),
  setMessages: (msgs) => set({ messages: msgs }),
  newChat: () =>
    set({
      messages: [],
      isLoading: false,
      tokensIn: 0,
      tokensOut: 0,
      lastPromptTokens: 0,
      streamingMessageId: null,
      sessionProvider: null,
      sessionModel: null,
      sessionMode: null,
      currentChatId: null,
      currentChatTitle: "",
    }),
}));
