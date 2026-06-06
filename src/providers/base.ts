// src/providers/base.ts
// Interface comum a todos os providers de IA (OpenAI, Anthropic, OpenRouter, Ollama).
// Quando adicionarmos mais providers no Módulo 2, todos implementam esse contrato.
// Pensa nele como o "design token" do sistema de providers — quem encaixa aqui é compatível.

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ProviderRequest {
  model: string;
  messages: ProviderMessage[];
  maxTokens?: number;
}

export interface ProviderResponse {
  content: string;
}

/** Callback que recebe cada delta de token vindo do streaming. */
export type TokenHandler = (token: string) => void;

/** Usage tokens (prompt+completion) — vem no final do stream / no response. */
export interface Usage {
  input: number;
  output: number;
}

/** Callback opcional pra receber usage quando o provider informar. */
export type UsageHandler = (usage: Usage) => void;

export interface Provider {
  id: string;
  name: string;
  chat(request: ProviderRequest, apiKey: string): Promise<ProviderResponse>;
  streamChat(
    request: ProviderRequest,
    apiKey: string,
    onToken: TokenHandler,
    onUsage?: UsageHandler,
    signal?: AbortSignal
  ): Promise<void>;
}

/**
 * Erros de provider são mapeados pra mensagens amigáveis em PT-BR.
 * Quem chamar `chat()` deve fazer try/catch e exibir `err.message` direto.
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "no-key" | "invalid-key" | "rate-limit" | "network" | "unknown"
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
