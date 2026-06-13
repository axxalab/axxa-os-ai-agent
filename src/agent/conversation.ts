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
  /** Instrução de estilo de resposta (Conciso/Explicativo/etc). Anexada ao
   *  head sem substituir a persona/base. Vazio = sem efeito. */
  styleInstruction?: string;
}

/** Monta o system prompt do CHAT/Vault-QA: (persona || base) + style + vault + notes. */
export function buildChatSystemPrompt(p: ChatSystemParts): string {
  const head = (p.persona && p.persona.trim()) || p.base;
  const style =
    p.styleInstruction && p.styleInstruction.trim()
      ? "\n\n" + p.styleInstruction.trim()
      : "";
  const vault =
    p.vaultBlock && p.vaultBlock.length > 0
      ? (p.vaultSuffix ?? "") + p.vaultBlock
      : "";
  return head + style + vault + (p.noteBlock ?? "");
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

// ── Flatten de agentSteps → texto (modos SEM tools) ────────
// Mandar `tool_calls`/`tool` num request que NÃO declara `tools` quebra em
// vários providers: Anthropic responde 400 ("tool_use/tool_result exigem tools
// definidas"); Gemini-compat / OpenRouter / NIM podem rejeitar. Então, fora do
// Agent mode, as ações do agent viram um BLOCO DE TEXTO no assistant — o modelo
// mantém a MEMÓRIA do que fez e funciona em TODO provider e modo. v0.1.161

function truncateInline(s: string, max: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max).trimEnd() + "…" : flat;
}

/** Arg mais significativo de um step pra rotular a ação no texto. */
function stepKeyArg(args: Record<string, unknown> | undefined): string {
  if (!args) return "";
  for (const k of ["path", "from", "to", "folder", "query", "note", "title"]) {
    const v = args[k];
    if (typeof v === "string" && v) return v;
  }
  return "";
}

function summarizeStepLine(s: AIToolStep, i: number): string {
  const arg = stepKeyArg(s.arguments);
  const head = arg ? `${s.name}(${truncateInline(arg, 80)})` : s.name;
  const status = s.ok ? "ok" : "ERRO";
  const excerpt = s.result ? ` — ${truncateInline(s.result, 160)}` : "";
  return `${i + 1}. ${head} → ${status}${excerpt}`;
}

/**
 * ai-response COM agentSteps → um único assistant em TEXTO que preserva a
 * memória do que o agent fez. Usado fora do Agent mode (request sem `tools`),
 * onde mandar tool_calls wire-level quebraria o provider. Puro/testável.
 */
export function flattenAgentResponse(
  finalText: string,
  steps: AIToolStep[]
): string {
  const lines = steps.map((s, i) => summarizeStepLine(s, i));
  const block =
    "〔memória do agente — ações já executadas nesta conversa:\n" +
    lines.join("\n") +
    "〕";
  const t = (finalText ?? "").trim();
  return t ? `${t}\n\n${block}` : block;
}

/**
 * Converte mensagens do store em ProviderMessage[] mandadas ao LLM:
 *   - mantém só `user` e `ai-response` SEM erro (isError não polui o contexto)
 *   - a ÚLTIMA user-msg recebe os attachments multimodais (quando passados)
 *   - ai-response COM agentSteps (Agent mode) recupera a memória do agent:
 *       · `toolMode=true`  (Agent mode — request declara tools): EXPANDE pro
 *         shape wire — assistant(tool_calls) + tool(results) + assistant(texto)
 *         — replay PRECISO, cross-provider. v0.1.160
 *       · `toolMode=false` (chat / vault-qa / regenerate / continue, ou
 *         qualquer provider sem tools na request): ACHATA num assistant de
 *         TEXTO. Portável em todo provider — não há tool_calls num request sem
 *         `tools` pra quebrar Anthropic/Gemini-compat. v0.1.161
 */
export function storeMessagesToProvider(
  messages: StoreMessageLike[],
  lastUserAttachments?: MessageAttachment[],
  toolMode = false
): ProviderMessage[] {
  const usable = messages.filter(
    (m) => m.type === "user" || (m.type === "ai-response" && !m.isError)
  );
  const out: ProviderMessage[] = [];
  usable.forEach((m, idx) => {
    if (m.type === "ai-response" && m.agentSteps && m.agentSteps.length > 0) {
      if (toolMode) {
        // Agent mode: assistant(tool_calls) + tool results + resposta final.
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
          // v0.1.228: garante content não-vazio (providers como Anthropic
          // rejeitam tool_result vazio) e sinaliza falha no próprio texto —
          // o shape do provider não tem flag isError pra role="tool".
          const body = s.result?.trim() ? s.result : "(sem saída)";
          out.push({
            role: "tool",
            toolCallId: s.id,
            content: s.ok ? body : `ERRO: ${body}`,
          });
        }
        if (m.content) out.push({ role: "assistant", content: m.content });
      } else {
        // Qualquer outro modo/provider: ações viram texto (memória portável).
        out.push({
          role: "assistant",
          content: flattenAgentResponse(m.content ?? "", m.agentSteps),
        });
      }
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
