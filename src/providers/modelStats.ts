// src/providers/modelStats.ts
// "Ficha de luta" de cada modelo (estilo Mortal Kombat) — 6 status 0-100 +
// poder geral (hotness/ranking). v0.1.223.
//
// Os valores são CURADOS a partir de benchmarks reais de jun/2026 (SWE-bench
// Verified, Arena Elo, GPQA Diamond) por FAMÍLIA de modelo (regex no id), com
// fallback derivado de categoria + caps + tier. Não é exato — é uma leitura
// relativa pra dar "personalidade" a cada modelo no seletor.
//   coding   = SWE-bench / coding agentic
//   thinking = reasoning (GPQA, math, AIME)
//   tooling  = tool calling / agent loops
//   research = conhecimento amplo / RAG / síntese
//   speed    = latência / throughput (inverso do "pensa muito")
//   vision   = multimodal (imagem/áudio/vídeo)

import type { ModelFullInfo } from "./modelDescriptions";

export interface ModelStats {
  coding: number;
  thinking: number;
  tooling: number;
  research: number;
  speed: number;
  vision: number;
  /** Poder geral 0-100 (média ponderada) — alimenta o ranking "hot". */
  power: number;
}

export const STAT_KEYS = [
  "coding",
  "thinking",
  "tooling",
  "research",
  "speed",
  "vision",
] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_META: Record<StatKey, { label: string; icon: string }> = {
  coding: { label: "Coding", icon: "code-2" },
  thinking: { label: "Thinking", icon: "brain" },
  tooling: { label: "Tooling", icon: "wrench" },
  research: { label: "Research", icon: "telescope" },
  speed: { label: "Speed", icon: "zap" },
  vision: { label: "Vision", icon: "eye" },
};

type Partial6 = Partial<Omit<ModelStats, "power">>;

// Perfis curados por família — 1ª regex que casa vence. Ordem do mais
// específico pro mais genérico.
const PROFILES: [RegExp, Partial6][] = [
  // ── Anthropic
  [/claude-opus-4-(8|9)/, { coding: 96, thinking: 93, tooling: 95, research: 89, speed: 52, vision: 82 }],
  [/claude-opus-4-(6|7)/, { coding: 93, thinking: 91, tooling: 93, research: 88, speed: 54, vision: 81 }],
  [/claude-opus-4/, { coding: 90, thinking: 90, tooling: 91, research: 87, speed: 56, vision: 80 }],
  [/claude-fable-5/, { coding: 94, thinking: 95, tooling: 93, research: 91, speed: 60, vision: 86 }],
  [/claude-mythos/, { coding: 90, thinking: 96, tooling: 88, research: 93, speed: 50, vision: 84 }],
  [/claude-sonnet-4/, { coding: 86, thinking: 83, tooling: 89, research: 81, speed: 80, vision: 81 }],
  [/claude-haiku-4/, { coding: 71, thinking: 66, tooling: 73, research: 68, speed: 96, vision: 72 }],
  [/claude-3-5-sonnet/, { coding: 82, thinking: 76, tooling: 84, research: 78, speed: 78, vision: 80 }],
  [/claude-3-5-haiku/, { coding: 64, thinking: 60, tooling: 66, research: 64, speed: 94, vision: 66 }],
  [/claude/, { coding: 78, thinking: 76, tooling: 80, research: 76, speed: 72, vision: 76 }],
  // ── OpenAI
  [/(^|[^a-z])o[1-9](-|$|\b)/, { coding: 88, thinking: 96, tooling: 66, research: 86, speed: 38, vision: 48 }],
  [/gpt-5[.\d]*-?codex/, { coding: 92, thinking: 90, tooling: 89, research: 88, speed: 58, vision: 82 }],
  [/gpt-5-(mini|nano)/, { coding: 74, thinking: 78, tooling: 76, research: 77, speed: 90, vision: 80 }],
  [/gpt-5/, { coding: 86, thinking: 94, tooling: 85, research: 91, speed: 64, vision: 88 }],
  [/gpt-4o-mini/, { coding: 67, thinking: 65, tooling: 74, research: 70, speed: 93, vision: 78 }],
  [/gpt-4o/, { coding: 78, thinking: 74, tooling: 82, research: 80, speed: 80, vision: 86 }],
  [/(dall-e|gpt-image)/, { coding: 8, thinking: 28, tooling: 8, research: 20, speed: 62, vision: 98 }],
  [/(tts|whisper|audio)/, { coding: 5, thinking: 20, tooling: 8, research: 14, speed: 86, vision: 40 }],
  [/gpt/, { coding: 76, thinking: 76, tooling: 80, research: 80, speed: 72, vision: 80 }],
  // ── Google
  [/(imagen|nano-?banana|gemini[\w.-]*image)/, { coding: 8, thinking: 24, tooling: 8, research: 18, speed: 76, vision: 98 }],
  [/(veo|sora)/, { coding: 5, thinking: 24, tooling: 5, research: 15, speed: 38, vision: 96 }],
  [/gemini-3/, { coding: 84, thinking: 88, tooling: 83, research: 92, speed: 68, vision: 95 }],
  [/gemini-[\d.]*pro/, { coding: 80, thinking: 86, tooling: 81, research: 90, speed: 70, vision: 94 }],
  [/gemini-[\d.]*flash/, { coding: 71, thinking: 73, tooling: 75, research: 78, speed: 94, vision: 90 }],
  [/(gemini|gemma)/, { coding: 74, thinking: 78, tooling: 76, research: 82, speed: 78, vision: 90 }],
  // ── Open / outros
  [/deepseek/, { coding: 86, thinking: 89, tooling: 76, research: 81, speed: 64, vision: 48 }],
  [/qwen/, { coding: 81, thinking: 80, tooling: 77, research: 79, speed: 74, vision: 74 }],
  [/(llama|meta-)/, { coding: 72, thinking: 74, tooling: 73, research: 77, speed: 78, vision: 70 }],
  [/(codestral|magistral|mistral|mixtral|ministral|pixtral)/, { coding: 78, thinking: 73, tooling: 76, research: 74, speed: 82, vision: 60 }],
  [/grok/, { coding: 80, thinking: 85, tooling: 79, research: 86, speed: 70, vision: 80 }],
  [/(nemotron|nvidia)/, { coding: 75, thinking: 77, tooling: 74, research: 76, speed: 72, vision: 60 }],
];

/** Baseline por categoria, quando nenhum perfil casa. */
function categoryBaseline(info: ModelFullInfo): Omit<ModelStats, "power"> {
  switch (info.card.category) {
    case "reasoning":
      return { coding: 82, thinking: 90, tooling: 60, research: 84, speed: 45, vision: 45 };
    case "agent":
      return { coding: 80, thinking: 76, tooling: 88, research: 76, speed: 74, vision: 72 };
    case "image-gen":
      return { coding: 8, thinking: 26, tooling: 8, research: 20, speed: 66, vision: 96 };
    case "audio-gen":
      return { coding: 5, thinking: 20, tooling: 8, research: 14, speed: 84, vision: 42 };
    case "video-gen":
      return { coding: 5, thinking: 24, tooling: 5, research: 15, speed: 36, vision: 95 };
    case "chat-text":
      return { coding: 70, thinking: 72, tooling: 74, research: 74, speed: 78, vision: 30 };
    default: // chat-vision / other
      return { coding: 74, thinking: 74, tooling: 78, research: 76, speed: 74, vision: 84 };
  }
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function powerOf(s: Omit<ModelStats, "power">): number {
  return clamp(
    s.coding * 0.24 +
      s.thinking * 0.24 +
      s.tooling * 0.2 +
      s.research * 0.16 +
      s.vision * 0.1 +
      s.speed * 0.06
  );
}

/** Ficha de status do modelo. Curado por família + ajustes pelas caps reais. */
export function getModelStats(
  provider: string,
  model: string,
  info: ModelFullInfo
): ModelStats {
  const id = (model || "").toLowerCase();
  const profile = PROFILES.find(([re]) => re.test(id))?.[1];
  const base = categoryBaseline(info);
  const s: Omit<ModelStats, "power"> = { ...base, ...profile };

  // Ajustes pelas capabilities REAIS do modelo (a curadoria pode estar genérica).
  const caps = info.caps;
  if (caps) {
    if (!caps.tools) s.tooling = Math.min(s.tooling, 42);
    if (!caps.vision && !caps.imageGen && !caps.videoGen) {
      s.vision = Math.min(s.vision, 34);
    }
  }
  return {
    coding: clamp(s.coding),
    thinking: clamp(s.thinking),
    tooling: clamp(s.tooling),
    research: clamp(s.research),
    speed: clamp(s.speed),
    vision: clamp(s.vision),
    power: powerOf(s),
  };
}
