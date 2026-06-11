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

/** Anexo multimodal — imagem por enquanto, vídeo/áudio podem vir depois. */
export interface ImageAttachment {
  type: "image";
  /** Data URL (`data:image/png;base64,...`) ou URL externa (`https://...`). */
  dataUrl: string;
  /** Mime type — útil pra providers que exigem (Anthropic, Gemini nativo). */
  mimeType?: string;
}

/** Nota do vault anexada — inlinada como contexto markdown no prompt. */
export interface NoteAttachment {
  type: "note";
  /** Path relativo ao vault (com extensão .md). */
  path: string;
  /** Conteúdo da nota lido na hora do envio (cacheado no client). */
  content: string;
}

/** PDF — placeholder por enquanto, sem extração de texto wired ainda. */
export interface PdfAttachment {
  type: "pdf";
  path?: string;
  dataUrl?: string;
  name: string;
}

/** Áudio gravado (webm/ogg/m4a) — wikilink ao path no vault. */
export interface AudioAttachment {
  type: "audio";
  /** Path relativo ao vault. */
  path: string;
  /** Duração estimada em ms (mostrado no chip). */
  durationMs?: number;
}

export type MessageAttachment =
  | ImageAttachment
  | NoteAttachment
  | PdfAttachment
  | AudioAttachment;

export interface ProviderMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Set em role="assistant" quando o LLM chamou tools. */
  toolCalls?: ProviderToolCall[];
  /** Set em role="tool" — conecta o resultado à tool_call original. */
  toolCallId?: string;
  /** Anexos multimodais (imagens) — só passa se o modelo suporta vision. */
  attachments?: MessageAttachment[];
}

export interface ProviderRequest {
  model: string;
  messages: ProviderMessage[];
  maxTokens?: number;
  /** Tools disponíveis pro LLM. Agent mode envia, modos texto deixam vazio. */
  tools?: ProviderToolDefinition[];
  /** Temperatura 0..2 — se omitido, provider usa default próprio.
   *  Effort baixo = temp alta (criativo); effort alto = temp baixa (preciso). */
  temperature?: number;
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

/** Request pra geração de mídia (imagem/áudio/vídeo). */
export interface MediaGenerationRequest {
  model: string;
  prompt: string;
  /** Opcional: aspect ratio / dimensões. Cada provider mapeia conforme suporta. */
  size?: "1024x1024" | "1024x1792" | "1792x1024" | "512x512" | "auto";
  /** Quantas saídas (alguns providers aceitam n=1..N). Default 1. */
  n?: number;
  /** Seed determinística, se suportada. */
  seed?: number;
  /** Voz pra TTS (provider-specific). */
  voice?: string;
}

/** Result item de geração — UM arquivo binário + meta de retorno. */
export interface MediaGenerationItem {
  /** Bytes da mídia. */
  data: Uint8Array;
  /** Mime type retornado pelo provider. */
  mime: string;
  width?: number;
  height?: number;
  /** Pra audio/video em segundos. */
  duration?: number;
  /** Seed efetivamente usada (provider às vezes adjusts). */
  seed?: number;
  /** Texto auxiliar do modelo (descrição, alt, revised prompt, etc). */
  text?: string;
}

export interface Provider {
  id: string;
  name: string;
  /** true se este provider suporta tool/function calling no Agent mode. */
  supportsTools?: boolean;
  chat(request: ProviderRequest, apiKey: string): Promise<ProviderResponse>;
  /**
   * Streaming SSE — emite tokens via onToken e RETORNA o resumo final
   * (content acumulado + toolCalls + usage). Caller pode usar o retorno
   * pra detectar tool_calls no Agent mode.
   *
   * Caller antigo (chat mode) só descarta o retorno — compatível.
   */
  streamChat(
    request: ProviderRequest,
    apiKey: string,
    onToken: TokenHandler,
    onUsage?: UsageHandler,
    signal?: AbortSignal
  ): Promise<ProviderResponse>;
  /**
   * Gera mídia (imagem/áudio/vídeo) conforme suportado pelo modelo.
   * Provider que não suporta retorna lista vazia / lança erro.
   * Implementação opcional — só providers com modelos de geração precisam.
   */
  generateImage?(
    request: MediaGenerationRequest,
    apiKey: string
  ): Promise<MediaGenerationItem[]>;
  generateAudio?(
    request: MediaGenerationRequest,
    apiKey: string
  ): Promise<MediaGenerationItem[]>;
  generateVideo?(
    request: MediaGenerationRequest,
    apiKey: string
  ): Promise<MediaGenerationItem[]>;
}

/**
 * Erros de provider são mapeados pra mensagens amigáveis em PT-BR.
 * Quem chamar `chat()` deve fazer try/catch e exibir `err.message` direto.
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "no-key"
      | "invalid-key"
      | "rate-limit"
      | "network"
      // Gemini: API exige billing ativo (assinatura consumer não cobre a API). v0.1.162
      | "billing"
      | "unknown"
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
