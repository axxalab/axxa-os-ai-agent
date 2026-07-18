// src/providers/modelModality.ts
// Modalidade I/O do modelo — o "tipo" dele expresso como par ENTRADA→SAÍDA
// (TXT2TXT, IMG2TXT, TXT2IMG, IMG2IMG, TXT2AUD, …). Deriva das ModelCapabilities
// (flags soltas: vision/imageGen/…) num vocabulário único e explicável.
//
// Por quê: "imageGen + vision" não diz ao user que o modelo EDITA imagem
// (IMG2IMG); "vision" sozinho não deixa claro que é IMG→TXT. O par I/O comunica
// o que o modelo realmente faz, e a legenda explica cada um.
//
// Referência de UX: o app do Claude mostra capacidade de forma limpa e legível —
// aqui cada chip é um código curto + tooltip com a explicação completa.

import type { ModelCapabilities } from "./modelCapabilities";

export type Modality =
  | "TXT2TXT"
  | "IMG2TXT"
  | "TXT2IMG"
  | "IMG2IMG"
  | "TXT2AUD"
  | "AUD2TXT"
  | "TXT2VID"
  | "IMG2VID"
  | "AUD2AUD";

export interface ModalityInfo {
  code: Modality;
  /** Rótulo legível com seta de fluxo. */
  label: string;
  /** Explicação curta — vai no tooltip e na legenda. */
  description: string;
  /** Ícone Lucide. */
  icon: string;
}

// Catálogo COMPLETO — fonte da legenda. Cobre os tipos que existem no mundo,
// mesmo os que o plugin ainda não gera (marcados na descrição).
export const MODALITY_INFO: Record<Modality, ModalityInfo> = {
  TXT2TXT: {
    code: "TXT2TXT",
    label: "Text → Text",
    description: "Chat, writing, reasoning and code. The foundation of everything.",
    icon: "message-square",
  },
  IMG2TXT: {
    code: "IMG2TXT",
    label: "Image → Text",
    description: "Reads and describes images (vision). Attach an image and the model understands its content.",
    icon: "eye",
  },
  TXT2IMG: {
    code: "TXT2IMG",
    label: "Text → Image",
    description: "Generates an image from a text prompt.",
    icon: "image-plus",
  },
  IMG2IMG: {
    code: "IMG2IMG",
    label: "Image → Image",
    description: "Edits or transforms an existing image following a prompt (e.g. Nano Banana).",
    icon: "images",
  },
  TXT2AUD: {
    code: "TXT2AUD",
    label: "Text → Audio",
    description: "Converts text to speech/voice (TTS).",
    icon: "volume-2",
  },
  AUD2TXT: {
    code: "AUD2TXT",
    label: "Audio → Text",
    description: "Transcribes and understands audio (STT). Not yet supported in AXXA.",
    icon: "mic",
  },
  TXT2VID: {
    code: "TXT2VID",
    label: "Text → Video",
    description: "Generates video from text (e.g. Veo, Sora).",
    icon: "clapperboard",
  },
  IMG2VID: {
    code: "IMG2VID",
    label: "Image → Video",
    description: "Animates a starting image into video.",
    icon: "film",
  },
  AUD2AUD: {
    code: "AUD2AUD",
    label: "Audio → Audio",
    description: "Real-time voice-to-voice (speech → speech). Not yet supported in AXXA.",
    icon: "audio-lines",
  },
};

/** Ordem canônica pra exibição da legenda. */
export const ALL_MODALITIES: Modality[] = [
  "TXT2TXT",
  "IMG2TXT",
  "TXT2IMG",
  "IMG2IMG",
  "TXT2AUD",
  "AUD2TXT",
  "TXT2VID",
  "IMG2VID",
  "AUD2AUD",
];

/**
 * Deriva as modalidades de um modelo a partir das caps (+ id pra heurísticas).
 *
 * Lógica: ENTRADAS = sempre texto, + imagem se `vision`. SAÍDA depende do tipo:
 *   - imageGen → cada entrada vira `*2IMG` (TXT2IMG e, se aceita imagem, IMG2IMG)
 *   - audioGen → TXT2AUD
 *   - videoGen → TXT2VID (+ IMG2VID se aceita imagem OU é um animador de img conhecido)
 *   - senão (chat/LLM) → cada entrada vira `*2TXT` (TXT2TXT e, se vision, IMG2TXT)
 */
export function modelModalities(
  caps: ModelCapabilities,
  modelId?: string
): Modality[] {
  const inputs: Array<"TXT" | "IMG"> = ["TXT"];
  if (caps.vision) inputs.push("IMG");

  const out: Modality[] = [];
  if (caps.imageGen) {
    for (const i of inputs) out.push((i + "2IMG") as Modality); // TXT2IMG, IMG2IMG
  } else if (caps.audioGen) {
    out.push("TXT2AUD");
  } else if (caps.videoGen) {
    out.push("TXT2VID");
    // v0.1.228: generaliza o IMG2VID — além do `vision`, reconhece os
    // animadores de imagem conhecidos por prefixo (Veo/Sora/Kling/Runway/Luma/
    // Pika) em vez de só Veo/Sora. Cosmos fica de fora: capacidade img2vid
    // incerta e o catálogo o trata como TXT2VID genérico.
    if (caps.vision || /veo|sora|kling|runway|luma|pika/i.test(modelId ?? ""))
      out.push("IMG2VID");
  } else {
    for (const i of inputs) out.push((i + "2TXT") as Modality); // TXT2TXT, IMG2TXT
  }
  return out;
}
