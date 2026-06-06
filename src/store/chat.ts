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
}

export interface AICommentMessage extends BaseMessage {
  type: "ai-comment";
  content: string;
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
  addMessage: (msg: NewMessageInput) => string;
  removeMessage: (id: string) => void;
  appendToMessage: (id: string, text: string) => void;
  selectOption: (messageId: string, optionIndex: number) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  addUsage: (input: number, output: number) => void;
  resetUsage: () => void;
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
  selectOption: (messageId, optionIndex) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId && m.type === "ai-options"
          ? { ...m, selectedIndex: optionIndex }
          : m
      ),
    })),
  clearMessages: () =>
    set({ messages: [], isLoading: false, tokensIn: 0, tokensOut: 0, lastPromptTokens: 0 }),
  setLoading: (loading) => set({ isLoading: loading }),
  addUsage: (input, output) =>
    set((state) => ({
      tokensIn: state.tokensIn + input,
      tokensOut: state.tokensOut + output,
      // lastPromptTokens reflete o prompt_tokens da ULTIMA chamada
      // (usado pra estimar "contexto usado atualmente").
      lastPromptTokens: input > 0 ? input : state.lastPromptTokens,
    })),
  resetUsage: () => set({ tokensIn: 0, tokensOut: 0, lastPromptTokens: 0 }),
}));
