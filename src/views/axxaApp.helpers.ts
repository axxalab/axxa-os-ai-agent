// src/views/axxaApp.helpers.ts
// Helpers PUROS extraídos do AxxaApp (v0.1.234) — sem estado de componente, sem
// React. Ficavam no topo do AxxaApp.tsx (god-file de 3300+ linhas); vivem aqui
// agora pra (1) encolher o componente e (2) ganhar testes (eram lógica sem
// cobertura). Comportamento idêntico — extração mecânica, zero mudança.

import { ProviderError } from "../providers/base";
import { getTranslations } from "../i18n";
import type { AIErrorCode } from "../store/chat";

/** ID único — randomUUID quando disponível, fallback time+random. */
export function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Spec de activity para cada tool — define ícone Lucide + textos pending/done
 * que aparecem na timeline estilo Claude Code.
 *
 * iconPending: ícone semântico que pulsa enquanto a tool roda
 * iconDone:    troca pra check com pop animation no fim (default global "check-circle-2")
 * pendingText: ação em gerúndio + path resumido
 * doneText:    ação no particípio + path resumido (sem "✓", o ícone faz isso)
 */
export function agentActivitySpec(
  toolName: string,
  args: Record<string, unknown>
): {
  iconPending: string;
  iconDone: string;
  pendingText: string;
  doneText: string;
} {
  const path = String(args.path ?? args.from ?? args.folder ?? "");
  // Encurta path long pra cabe na timeline (mantém basename)
  const shorten = (p: string) => (p.length > 48 ? "…" + p.slice(-46) : p);
  const shortPath = shorten(path);
  // v0.1.228: aplica o mesmo encurtamento ao destino do move (`to`).
  const shortTo = args.to ? shorten(String(args.to)) : "?";

  switch (toolName) {
    case "vault_search":
      return {
        iconPending: "radar",
        iconDone: "search-check",
        pendingText: `Buscando "${String(args.query ?? "").slice(0, 40)}"`,
        doneText: `Buscou "${String(args.query ?? "").slice(0, 40)}"`,
      };
    case "vault_list":
      return {
        iconPending: "folder-search",
        iconDone: "folder-check",
        pendingText: `Listando ${shortPath || "raiz"}`,
        doneText: `Listou ${shortPath || "raiz"}`,
      };
    case "vault_read":
      return {
        iconPending: "eye",
        iconDone: "file-check-2",
        pendingText: `Lendo ${shortPath}`,
        doneText: `Leu ${shortPath}`,
      };
    case "vault_create":
      return {
        iconPending: "file-plus-2",
        iconDone: "file-check-2",
        pendingText: `Criando ${shortPath}`,
        doneText: `Criou ${shortPath}`,
      };
    case "vault_edit":
      return {
        iconPending: "file-pen-line",
        iconDone: "file-check-2",
        pendingText: `Editando ${shortPath}`,
        doneText: `Editou ${shortPath}`,
      };
    case "vault_move":
      return {
        iconPending: "move",
        iconDone: "check-circle-2",
        pendingText: `Movendo ${shortPath} → ${shortTo}`,
        doneText: `Moveu ${shortPath} → ${shortTo}`,
      };
    case "vault_delete":
      return {
        iconPending: "trash-2",
        iconDone: "circle-check-big",
        pendingText: `Deletando ${shortPath}`,
        doneText: `Deletou ${shortPath}`,
      };
    case "vault_create_folder":
      return {
        iconPending: "folder-plus",
        iconDone: "folder-check",
        pendingText: `Criando pasta ${shortPath}`,
        doneText: `Criou pasta ${shortPath}`,
      };
    default:
      return {
        iconPending: "wrench",
        iconDone: "check-circle-2",
        pendingText: `Executando ${toolName}`,
        doneText: `${toolName} concluído`,
      };
  }
}

/**
 * Extrai uma métrica curta do resultado de uma tool — usado como `content`
 * do ai-comment depois que vira "done". Exemplos:
 *   vault_list  → "8 itens"
 *   vault_read  → "1.2k chars"
 *   vault_edit  → "+12 chars" (tirado da string de retorno se possível)
 */
export function summarizeToolResult(toolName: string, result: string): string {
  if (!result) return "";
  switch (toolName) {
    case "vault_list": {
      // Padrão: "Conteúdo de X (Y itens):"
      const m = /\((\d+)\s+itens?\)/.exec(result);
      return m ? `${m[1]} item${m[1] === "1" ? "" : "s"}` : "";
    }
    case "vault_read":
      return `${result.length >= 1000 ? (result.length / 1000).toFixed(1) + "k" : result.length} chars`;
    case "vault_create": {
      const m = /\((\d+)\s+chars\)/.exec(result);
      return m ? `${m[1]} chars` : "";
    }
    case "vault_edit": {
      const m = /\(([+-]\d+)\s+chars\)/.exec(result);
      return m ? `${m[1]} chars` : "";
    }
    default:
      return "";
  }
}

// Placeholder do composer varia pelo modo da sessão — feedback visual de
// que o "papel" do AXXA muda (assistente geral vs. focado no vault, etc.)
// Strings vêm do dicionário i18n (PT-BR / EN-US) — `t.composer.placeholderXxx`.
export function placeholderForMode(
  mode: string,
  composer: {
    placeholderChat: string;
    placeholderVaultQa: string;
    placeholderAgent: string;
    placeholderCoder: string;
  }
): string {
  switch (mode) {
    case "vault-qa":
      return composer.placeholderVaultQa;
    case "agent":
      return composer.placeholderAgent;
    case "coder":
      return composer.placeholderCoder;
    default:
      return composer.placeholderChat;
  }
}

/**
 * Traduz qualquer erro de stream/chat numa mensagem amigável + localizada e no
 * código correspondente. Centraliza a tradução (os providers lançam texto
 * PT-only cru; aqui ele vira PT ou EN conforme a UI) e dá à bolha de erro a
 * info pra oferecer a ação certa ("Abrir Configurações" só p/ key inválida/
 * ausente). v0.1.147.
 */
export function describeProviderError(
  err: unknown,
  t: ReturnType<typeof getTranslations>,
  providerName: string
): { message: string; code: AIErrorCode } {
  if (err instanceof ProviderError) {
    switch (err.code) {
      case "no-key":
        return { message: t.ai.err.noKey(providerName), code: "no-key" };
      case "invalid-key":
        return { message: t.ai.err.invalidKey(providerName), code: "invalid-key" };
      case "rate-limit":
        return { message: t.ai.err.rateLimit, code: "rate-limit" };
      case "network":
        return { message: t.ai.err.network, code: "network" };
      case "billing":
        return { message: t.ai.err.billing, code: "billing" };
      default:
        // "unknown" carrega a msg detalhada do provider (única com info real).
        return { message: err.message || t.ai.unknownError, code: "unknown" };
    }
  }
  if (err instanceof Error) {
    return { message: err.message || t.ai.unknownError, code: "unknown" };
  }
  return { message: t.ai.unknownError, code: "unknown" };
}

/** Providers que exigem API key (Ollama roda local via endpoint, dispensa). */
export function providerNeedsKey(providerId: string): boolean {
  return providerId !== "ollama";
}
