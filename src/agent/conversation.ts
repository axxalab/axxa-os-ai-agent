// src/agent/conversation.ts
// Montagem do SYSTEM PROMPT e do history — antes copiada em 4 lugares do
// AxxaApp (streamReply / runAgentTurn / regenerate / continue). Centralizado
// aqui, puro e testável.

import type { ProviderMessage, MessageAttachment } from "../providers/base";
import type { AIToolStep } from "./types";

// ── System prompt ──────────────────────────────────────────

export interface ChatSystemParts {
  /** Persona custom do chat (sessionPersona). Se truthy, SUBSTITUI o base. */
  persona?: string;
  /** System prompt padrão (t.systemPrompt.base). */
  base: string;
  /** Sufixo do modo Vault Q&A (t.systemPrompt.vaultQaSuffix). */
  vaultSuffix?: string;
  /** Bloco de notas recuperadas (RAG). Só entra se não-vazio. */
  vaultBlock?: string;
  /** Bloco de notas anexadas pelo user. */
  noteBlock?: string;
}

/** Monta o system prompt do CHAT/Vault-QA: (persona || base) + vault + notes. */
export function buildChatSystemPrompt(p: ChatSystemParts): string {
  const head = (p.persona && p.persona.trim()) || p.base;
  const vault =
    p.vaultBlock && p.vaultBlock.length > 0
      ? (p.vaultSuffix ?? "") + p.vaultBlock
      : "";
  return head + vault + (p.noteBlock ?? "");
}

/** Monta o system prompt do AGENT: persona é PREPENDIDA (não substitui). */
export function buildAgentSystemPrompt(
  persona: string | undefined,
  agentPrompt: string
): string {
  const p = persona && persona.trim();
  return (p ? p + "\n\n" : "") + agentPrompt;
}

// ── History (store → provider) ─────────────────────────────

/** Forma mínima de uma mensagem do store que vira mensagem de provider.
 *  content é opcional pois o store tem variantes sem ele (ai-options) — elas
 *  são filtradas fora de qualquer jeito. */
export interface StoreMessageLike {
  type: string;
  content?: string;
  isError?: boolean;
  /** Ações do agent (Agent mode) — reconstruídas no history pra continuidade. */
  agentSteps?: AIToolStep[];
}

/**
 * Converte mensagens do store em ProviderMessage[] mandadas ao LLM:
 *   - mantém só `user` e `ai-response` SEM erro (isError não polui o contexto)
 *   - a ÚLTIMA user-msg recebe os attachments multimodais (quando passados)
 *   - ai-response COM agentSteps (Agent mode) é EXPANDIDA pro shape que o LLM
 *     espera — assistant(tool_calls) + tool(results) + assistant(texto final) —
 *     dando ao agent a memória do que já fez ao reabrir o chat. v0.1.160
 */
export function storeMessagesToProvider(
  messages: StoreMessageLike[],
  lastUserAttachments?: MessageAttachment[]
): ProviderMessage[] {
  const usable = messages.filter(
    (m) => m.type === "user" || (m.type === "ai-response" && !m.isError)
  );
  const out: ProviderMessage[] = [];
  usable.forEach((m, idx) => {
    if (m.type === "ai-response" && m.agentSteps && m.agentSteps.length > 0) {
      // assistant com as tool_calls + os tool results + a resposta final.
      out.push({
        role: "assistant",
        content: "",
        toolCalls: m.agentSteps.map((s) => ({
          id: s.id,
          name: s.name,
          arguments: s.arguments,
        })),
      });
      for (const s of m.agentSteps) {
        out.push({ role: "tool", toolCallId: s.id, content: s.result });
      }
      if (m.content) out.push({ role: "assistant", content: m.content });
      return;
    }
    const base: ProviderMessage = {
      role: m.type === "user" ? "user" : "assistant",
      content: m.content ?? "",
    };
    const isLastUser = idx === usable.length - 1 && m.type === "user";
    if (isLastUser && lastUserAttachments && lastUserAttachments.length > 0) {
      out.push({ ...base, attachments: lastUserAttachments });
    } else {
      out.push(base);
    }
  });
  return out;
}
