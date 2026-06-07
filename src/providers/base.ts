// src/providers/base.ts
// Interface comum a todos os providers de IA (OpenAI, Anthropic, OpenRouter, Ollama).
// Quando adicionarmos mais providers no Módulo 2, todos implementam esse contrato.
// Pensa nele como o "design token" do sistema de providers — quem encaixa aqui é compatível.

/** Tool definition genérica — providers convertem pro seu formato wire-level. */
export interface ProviderToolDefinition {
  name: string;
  description: string;
  parameters: object;
}

/** Chamada de tool que o LLM produziu na resposta. */
export interface ProviderToolCall {
  /** ID único — volta como tool_call_id no result. */
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ProviderMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Set em role="assistant" quando o LLM chamou tools. */
  toolCalls?: ProviderToolCall[];
  /** Set em role="tool" — conecta o resultado à tool_call original. */
  toolCallId?: string;
}

export interface ProviderRequest {
  model: string;
  messages: ProviderMessage[];
  maxTokens?: number;
  /** Tools disponíveis pro LLM. Agent mode envia, modos texto deixam vazio. */
  tools?: ProviderToolDefinition[];
}

export interface ProviderResponse {
  content: string;
  /** Set se LLM decidiu chamar tools em vez de devolver texto direto. */
  toolCalls?: ProviderToolCall[];
  usage?: { input: number; output: number };
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
  /** true se este provider suporta tool/function calling no Agent mode. */
  supportsTools?: boolean;
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
