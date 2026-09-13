// src/providers/elevenlabs.ts
// ElevenLabs — TTS, e o único caminho pra VOZ PRÓPRIA: quem clona a própria voz
// lá (no site/app deles) vê ela aparecer aqui na lista, como qualquer outra.
// A OpenAI não expõe voz custom pela API; é por isso que este arquivo existe.
//
// Não é um `Provider` do motor de propósito: aquele contrato é de CHAT
// (stream, tools, modelos). Aqui são duas chamadas — listar vozes e falar —
// e ambas por `requestUrl`, que fura o CORS do WebView mobile.

import { requestUrl } from "obsidian";
import { ProviderError } from "./base";

const API = "https://api.elevenlabs.io/v1";

/** Modelos deles, do mais caprichado ao mais rápido. */
export const ELEVEN_MODELS: { id: string; label: string }[] = [
  { id: "eleven_multilingual_v2", label: "Multilingual v2 — best quality" },
  { id: "eleven_turbo_v2_5", label: "Turbo v2.5 — faster, cheaper" },
  { id: "eleven_flash_v2_5", label: "Flash v2.5 — fastest" },
];

export interface ElevenVoice {
  id: string;
  name: string;
  /** "cloned" / "professional" = voz do próprio usuário. */
  category?: string;
}

function headers(key: string): Record<string, string> {
  return { "xi-api-key": key.trim() };
}

function fail(status: number, fallback: string): never {
  if (status === 401) throw new ProviderError("Invalid ElevenLabs key.", "invalid-key");
  if (status === 429) throw new ProviderError("ElevenLabs rate limit.", "rate-limit");
  throw new ProviderError(fallback, "unknown");
}

/** Vozes da conta — inclui as clonadas, que é o ponto. */
export async function elevenVoices(apiKey: string): Promise<ElevenVoice[]> {
  if (!apiKey?.trim()) {
    throw new ProviderError("ElevenLabs key not configured.", "no-key");
  }
  let res;
  try {
    res = await requestUrl({
      url: `${API}/voices`,
      method: "GET",
      headers: headers(apiKey),
      throw: false,
    });
  } catch {
    throw new ProviderError("ElevenLabs connection failed.", "network");
  }
  if (res.status < 200 || res.status >= 300) {
    fail(res.status, `ElevenLabs: HTTP ${res.status}`);
  }
  const list = (res.json as { voices?: unknown[] } | undefined)?.voices ?? [];
  return list
    .map((v) => v as { voice_id?: string; name?: string; category?: string })
    .filter((v) => !!v.voice_id)
    .map((v) => ({
      id: String(v.voice_id),
      name: v.name || String(v.voice_id),
      category: v.category,
    }));
}

/** Fala o texto com a voz escolhida. Devolve mp3 cru. */
export async function elevenSpeak(opts: {
  apiKey: string;
  voiceId: string;
  model: string;
  text: string;
}): Promise<{ data: Uint8Array; mime: string }> {
  if (!opts.apiKey?.trim()) {
    throw new ProviderError("ElevenLabs key not configured.", "no-key");
  }
  if (!opts.voiceId) {
    throw new ProviderError("Pick an ElevenLabs voice first.", "unknown");
  }
  let res;
  try {
    res = await requestUrl({
      url: `${API}/text-to-speech/${encodeURIComponent(opts.voiceId)}`,
      method: "POST",
      contentType: "application/json",
      headers: { ...headers(opts.apiKey), Accept: "audio/mpeg" },
      body: JSON.stringify({ text: opts.text, model_id: opts.model }),
      throw: false,
    });
  } catch {
    throw new ProviderError("ElevenLabs connection failed.", "network");
  }
  if (res.status < 200 || res.status >= 300) {
    const msg =
      (res.json as { detail?: { message?: string } } | undefined)?.detail
        ?.message ?? `HTTP ${res.status}`;
    fail(res.status, `ElevenLabs: ${msg}`);
  }
  return { data: new Uint8Array(res.arrayBuffer), mime: "audio/mpeg" };
}
