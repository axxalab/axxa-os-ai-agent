// src/providers/compatibility.ts
// Analisa compatibilidade entre modo / provider / modelo / anexos e
// sugere alternativas. Usado pelo IncompatibleBanner no AxxaApp.

import { getModelCapabilities, type ModelCapabilities } from "./modelCapabilities";
import { getModelCard } from "./modelDescriptions";
import { generationSupported } from "../generation/save";

export type IncompatibleReason =
  | "agent-no-tools"
  | "vision-no-vision"
  | "generation-model-in-chat"
  | "image-gen-not-implemented"
  | null;

export interface CompatibilityResult {
  /** true se tudo OK pra enviar mensagem. */
  ok: boolean;
  /** Motivo principal da incompatibilidade. null = OK. */
  reason: IncompatibleReason;
  /** Texto curto humanizado explicando o problema. */
  message?: string;
  /** Modelos do mesmo provider que resolvem o problema (top 3, ordenados por relevância). */
  suggestions?: string[];
}

/**
 * Checa se a combinação modo + provider + modelo + anexos funciona.
 * Retorna o primeiro problema encontrado (não acumula múltiplos).
 *
 * mode: chat / vault-qa / agent
 * hasImageAttachment: true se user tem imagem no pending
 */
export function checkCompatibility(
  mode: string,
  provider: string,
  model: string,
  activeModels: string[],
  hasImageAttachment = false
): CompatibilityResult {
  const caps = getModelCapabilities(provider, model);

  // === 1. Modo Agent precisa de tools ===
  if (mode === "agent" && !caps.tools) {
    return {
      ok: false,
      reason: "agent-no-tools",
      message: `O modelo "${model}" não suporta tool calling — necessário pro Agent.`,
      suggestions: findCompatibleModels(provider, activeModels, "tools"),
    };
  }

  // === 2. Imagem anexada mas modelo sem vision ===
  if (hasImageAttachment && !caps.vision) {
    return {
      ok: false,
      reason: "vision-no-vision",
      message: `O modelo "${model}" não aceita imagens — imagens anexadas vão ser ignoradas.`,
      suggestions: findCompatibleModels(provider, activeModels, "vision"),
    };
  }

  // === 3. Modelo de generation em Agent Mode — BLOQUEIA mesmo (por design):
  //         geração não roda no loop de tools. Em chat normal não cai aqui —
  //         runGenerationTurn roteia automaticamente. (comentário corrigido v0.1.228) ===
  if ((caps.imageGen || caps.audioGen || caps.videoGen) && mode === "agent") {
    return {
      ok: false,
      reason: "generation-model-in-chat",
      message: `"${model}" é um modelo de geração — não roda em Agent Mode.`,
      suggestions: findCompatibleModels(provider, activeModels, "tools"),
    };
  }

  // === 4. Geração que o plugin AINDA NÃO suporta neste provider — avisa ANTES
  //         de gastar o clique (vídeo em todos; áudio fora da OpenAI; etc). #1
  if ((caps.imageGen || caps.audioGen || caps.videoGen) && mode !== "agent") {
    const mediaType = caps.imageGen ? "image" : caps.audioGen ? "audio" : "video";
    if (!generationSupported(provider, mediaType)) {
      const label =
        mediaType === "image" ? "imagem" : mediaType === "audio" ? "áudio" : "vídeo";
      return {
        ok: false,
        reason: "image-gen-not-implemented",
        message: `"${model}" gera ${label}, mas o AXXA ainda não suporta isso neste provider. Escolha outro modelo.`,
        suggestions: findCompatibleModels(provider, activeModels, "imageGen"),
      };
    }
  }

  return { ok: true, reason: null };
}

/**
 * Acha até 3 modelos do mesmo provider que tenham a capability requerida.
 * Ordena por relevância: prioriza modelos com a capability + boa categoria.
 */
function findCompatibleModels(
  provider: string,
  activeModels: string[],
  required: "tools" | "vision" | "imageGen"
): string[] {
  const candidates = activeModels
    .map((m) => {
      const caps = getModelCapabilities(provider, m);
      const card = getModelCard(provider, m, caps);
      let score = 0;
      // Filtra pelos que TÊM a capability
      if (required === "tools" && !caps.tools) return null;
      if (required === "vision" && !caps.vision) return null;
      if (required === "imageGen" && !caps.imageGen) return null;
      // Boost por outras capabilities (modelos versáteis primeiro)
      if (caps.tools) score += 3;
      if (caps.vision) score += 2;
      if (caps.streaming) score += 1;
      if (caps.free) score += 2;
      // Penaliza modelos de generation se buscamos chat/agent
      if (required === "tools" && (caps.imageGen || caps.audioGen)) score -= 5;
      // Boost categorias relevantes
      if (card.category === "chat-vision") score += 2;
      if (card.category === "agent") score += 3;
      return { model: m, score };
    })
    .filter((x): x is { model: string; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.model);

  return candidates;
}

/**
 * Versão simplificada pra usar como "preview" antes de tentar submit.
 * Retorna só a primeira sugestão (mais relevante).
 */
export function suggestPrimary(
  result: CompatibilityResult
): string | undefined {
  return result.suggestions?.[0];
}

/**
 * Helper UI: retorna ícone + cor por reason — pra IncompatibleBanner
 * usar no DS.
 */
export function bannerStyleFor(reason: IncompatibleReason): {
  icon: string;
  color: string;
} {
  switch (reason) {
    case "agent-no-tools":
      return { icon: "wrench", color: "var(--color-orange, #ec7b3e)" };
    case "vision-no-vision":
      return { icon: "image-off", color: "var(--color-purple, #a370f7)" };
    case "generation-model-in-chat":
      return { icon: "image-plus", color: "var(--color-pink, #f472b6)" };
    case "image-gen-not-implemented":
      return { icon: "alert-triangle", color: "var(--text-error, #f87171)" };
    default:
      return { icon: "info", color: "var(--text-muted)" };
  }
}

export type { ModelCapabilities };
