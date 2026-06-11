// src/components/_shared/modelLogo.ts
// Resolução de logo por MODELO (não por provider): um llama no OpenRouter
// mostra a Meta, um gpt mostra a OpenAI. Fonte única das regras vendor →
// usada pelo StarterScreen (card) E pelos Settings (lista de modelos).
//
// `modelVendorLogoId` devolve o id do logo SÓ se a gente realmente tem o SVG
// (registrado em brandLogos). Senão devolve null → o caller mostra o 🟣 pra
// sinalizar "falta o SVG desse vendor".

import { hasBrandLogo } from "./brandLogos";

/** Logo de marca por provider (abas + fallback). */
export const PROVIDER_LOGO: Record<string, string> = {
  openai: "logo-openai",
  anthropic: "logo-anthropic",
  gemini: "logo-gemini",
  openrouter: "logo-openrouter",
  nim: "logo-nvidia",
  ollama: "logo-ollama",
};

// model-id → logo do VENDOR real. 1ª regra que casa vence. (v0.1.92, movido
// pra cá em v0.1.150). Ao adicionar um vendor novo, cadastre o SVG em
// assets/svg + rode genLogos.mjs, e adicione a regra aqui.
export const MODEL_LOGO_RULES: [RegExp, string][] = [
  [/claude/, "logo-claude-color"],
  [/(gemini[\w.-]*image|nano-?banana)/, "logo-nanobanana-color"],
  [/(gemini|imagen|gemma|palm|bison)/, "logo-gemini-color"],
  [/(llama|meta-)/, "logo-meta-color"],
  [/qwen/, "logo-qwen-color"],
  [/(mistral|mixtral|codestral|pixtral|ministral)/, "logo-mistral-color"],
  [/deepseek/, "logo-deepseek-color"],
  [/flux/, "logo-flux"],
  [/(stable-?diffusion|sdxl|stability)/, "logo-stability-color"],
  [/(gpt|^o[1-9]|davinci|dall|whisper|tts|chatgpt|text-embedding)/, "logo-openai"],
  [/(nemotron|nvidia)/, "logo-nvidia-color"],
];

/**
 * Logo do vendor do modelo SE existir o SVG; senão null (caller mostra 🟣).
 * Não cai no logo do provider de propósito — o null é o sinal de "falta SVG".
 */
export function modelVendorLogoId(provider: string, model: string): string | null {
  const id = (model || "").toLowerCase();
  const tail = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id;
  for (const [re, logo] of MODEL_LOGO_RULES) {
    if (re.test(tail) || re.test(id)) {
      return hasBrandLogo(logo) ? logo : null;
    }
  }
  return null;
}

/** Label curto do vendor pro tooltip do placeholder (ex: "MISTRAL"). */
export function modelVendorLabel(provider: string, model: string): string {
  const raw =
    model && model.includes("/")
      ? model.slice(0, model.indexOf("/"))
      : (model || provider).split(/[-.\s:]/)[0];
  return (raw || provider).toUpperCase().slice(0, 12);
}
