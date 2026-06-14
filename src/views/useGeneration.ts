// src/views/useGeneration.ts
// Motor de GERAÇÃO de mídia (imagem/áudio/vídeo) extraído do AxxaApp (Frente 2 —
// base 1.0). Vertical isolado: gera via provider, salva no vault com sidecar e
// injeta wikilinks na conversa. Deps de UI/sessão injetadas via ctx; runGeneration
// Turn é retornado porque handleSend/regenerate/retry o reusam. Comportamento
// idêntico ao inline anterior.

import { type MutableRefObject } from "react";
import { useChatStore } from "../store/chat";
import { getProvider } from "../providers";
import { getModelCapabilities } from "../providers/modelCapabilities";
import { getPricing } from "../usage/pricing";
import {
  saveGeneration,
  generationSupported,
  generationSupportSummary,
  type GenerationMediaType,
} from "../generation/save";
import { ImageGenModal, type ImageModelOption } from "../generation/ImageGenModal";
import { generateTitle } from "../components/_shared/chatPersistence";
import { getTranslations } from "../i18n";
import { makeId, describeProviderError, providerNeedsKey } from "./axxaApp.helpers";
import type { PendingAttachmentEntry } from "./chatTypes";
import type AxxaPlugin from "../main";

interface GenerationCtx {
  plugin: AxxaPlugin;
  t: ReturnType<typeof getTranslations>;
  abortRef: MutableRefObject<AbortController | null>;
  composerDraftRef: MutableRefObject<string>;
  activeProviderId: string;
  activeModel: string;
  activeMode: string;
  apiKeyFor: (providerId: string) => string;
  pendingAttachments: PendingAttachmentEntry[];
  setPendingAttachments: (v: PendingAttachmentEntry[]) => void;
}

export function useGeneration(ctx: GenerationCtx) {
  const {
    plugin,
    t,
    abortRef,
    composerDraftRef,
    activeProviderId,
    activeModel,
    activeMode,
    apiKeyFor,
    pendingAttachments,
    setPendingAttachments,
  } = ctx;

  const runGenerationTurn = async (
    prompt: string,
    caps: ReturnType<typeof getModelCapabilities>
  ) => {
    const activeProvider = getProvider(activeProviderId);
    const { addMessage, updateActivity, setLoading } = useChatStore.getState();

    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const mediaType: GenerationMediaType = caps.imageGen
      ? "image"
      : caps.audioGen
        ? "audio"
        : "video";

    if (!generationSupported(activeProviderId, mediaType)) {
      setLoading(false);
      if (abortRef.current === controller) abortRef.current = null;
      addMessage({
        type: "ai-response",
        content: `${t.ai.errorPrefix} ${t.ai.genUnsupported(mediaType, generationSupportSummary())}`,
        isError: true,
        errorCode: "unknown",
      });
      return;
    }

    const activityId = addMessage({
      type: "ai-comment",
      content: "",
      activity: {
        phase: "pending",
        iconPending: mediaType === "image" ? "image-plus" : mediaType === "audio" ? "volume-2" : "video",
        iconDone: "check",
        pendingText: mediaType === "image"
          ? "Gerando imagem..."
          : mediaType === "audio"
            ? "Gerando áudio..."
            : "Gerando vídeo...",
        doneText: "",
      },
    });

    try {
      const provider = activeProvider;
      const apiKey = apiKeyFor(activeProviderId);
      let items;
      if (mediaType === "image") {
        if (!provider.generateImage) {
          throw new Error(`Provider "${provider.name}" não implementa generateImage.`);
        }
        items = await provider.generateImage(
          { model: activeModel, prompt, size: "1024x1024" },
          apiKey
        );
      } else if (mediaType === "audio") {
        if (!provider.generateAudio) {
          throw new Error(`Provider "${provider.name}" não implementa generateAudio.`);
        }
        items = await provider.generateAudio(
          { model: activeModel, prompt },
          apiKey
        );
      } else {
        if (!provider.generateVideo) {
          throw new Error(`Provider "${provider.name}" não implementa generateVideo.`);
        }
        items = await provider.generateVideo(
          { model: activeModel, prompt },
          apiKey
        );
      }

      const savedPaths: string[] = [];
      for (const item of items) {
        const result = await saveGeneration(
          plugin.app,
          plugin.settings.generationPath,
          item.data,
          {
            id: makeId(),
            type: mediaType,
            provider: activeProviderId,
            model: activeModel,
            prompt,
            created: new Date().toISOString(),
            size: item.data.byteLength,
            mime: item.mime,
            width: item.width,
            height: item.height,
            duration: item.duration,
            seed: item.seed,
            chatId: useChatStore.getState().currentChatId ?? undefined,
          }
        );
        savedPaths.push(result.mediaPath);
      }

      updateActivity(
        activityId,
        {
          phase: "done",
          doneText: `${items.length} ${mediaType === "image" ? "imagem" : mediaType === "audio" ? "áudio" : "vídeo"}${items.length > 1 ? "s" : ""} gerado${items.length > 1 ? "s" : ""}`,
        },
        savedPaths[0]
      );

      const responseContent = savedPaths
        .map((p) => mediaType === "image" ? `![[${p}]]` : `[[${p}]]`)
        .join("\n\n");
      addMessage({ type: "ai-response", content: responseContent });
    } catch (err) {
      const { message, code } = describeProviderError(
        err,
        t,
        activeProvider.name
      );
      updateActivity(
        activityId,
        {
          phase: "failed",
          iconFailed: "x-circle",
          failedText: t.ai.failed,
        },
        message
      );
      addMessage({
        type: "ai-response",
        content: `${t.ai.errorPrefix} ${message}`,
        isError: true,
        errorCode: code,
      });
    } finally {
      setLoading(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const buildImageModelOptions = (): ImageModelOption[] => {
    const opts: ImageModelOption[] = [];
    const active = plugin.settings.activeModels ?? {};
    for (const providerId of Object.keys(active)) {
      if (!generationSupported(providerId, "image")) continue;
      for (const model of active[providerId] ?? []) {
        if (!getModelCapabilities(providerId, model).imageGen) continue;
        const pricing = getPricing(providerId, model);
        opts.push({
          providerId,
          providerLabel: getProvider(providerId).name,
          model,
          pricePerImage: pricing.imagePerCall ?? undefined,
          connected:
            providerId === "ollama" ? true : apiKeyFor(providerId).trim().length > 0,
          supportsEdit:
            providerId === "gemini" && model.startsWith("gemini-2.5-flash-image"),
        });
      }
    }
    return opts;
  };

  const runImageGeneration = async (
    prompt: string,
    providerId: string,
    model: string,
    inputImage?: { data: string; mimeType: string }
  ): Promise<{ ok: boolean; paths: string[]; error?: string }> => {
    const { addMessage, updateActivity } = useChatStore.getState();
    const provider = getProvider(providerId);
    const apiKey = apiKeyFor(providerId);
    if (providerNeedsKey(providerId) && !apiKey.trim()) {
      const msg = t.ai.err.noKey(provider.name);
      addMessage({
        type: "ai-response",
        content: `${t.ai.errorPrefix} ${msg}`,
        isError: true,
        errorCode: "no-key",
      });
      return { ok: false, paths: [], error: msg };
    }
    if (!generationSupported(providerId, "image") || !provider.generateImage) {
      const msg = t.ai.genUnsupported("image", generationSupportSummary());
      addMessage({
        type: "ai-response",
        content: `${t.ai.errorPrefix} ${msg}`,
        isError: true,
        errorCode: "unknown",
      });
      return { ok: false, paths: [], error: msg };
    }
    const activityId = addMessage({
      type: "ai-comment",
      content: "",
      activity: {
        phase: "pending",
        iconPending: inputImage ? "wand-2" : "image-plus",
        iconDone: "check",
        pendingText: inputImage ? "Editando imagem..." : "Gerando imagem...",
        doneText: "",
        placeholder: "image",
      },
    });
    try {
      const items = await provider.generateImage(
        {
          model,
          prompt,
          size: "1024x1024",
          ...(inputImage ? { image: inputImage } : {}),
        },
        apiKey
      );
      const savedPaths: string[] = [];
      for (const item of items) {
        const r = await saveGeneration(
          plugin.app,
          plugin.settings.generationPath,
          item.data,
          {
            id: makeId(),
            type: "image",
            provider: providerId,
            model,
            prompt,
            created: new Date().toISOString(),
            size: item.data.byteLength,
            mime: item.mime,
            width: item.width,
            height: item.height,
            seed: item.seed,
            chatId: useChatStore.getState().currentChatId ?? undefined,
          }
        );
        savedPaths.push(r.mediaPath);
      }
      updateActivity(
        activityId,
        {
          phase: "done",
          doneText: `${items.length} imagem${items.length > 1 ? "ns" : ""} gerada${items.length > 1 ? "s" : ""}`,
        },
        savedPaths[0]
      );
      addMessage({
        type: "ai-response",
        content: savedPaths.map((p) => `![[${p}]]`).join("\n\n"),
      });
      return { ok: true, paths: savedPaths };
    } catch (err) {
      const { message, code } = describeProviderError(err, t, provider.name);
      updateActivity(
        activityId,
        { phase: "failed", iconFailed: "x-circle", failedText: t.ai.failed },
        message
      );
      addMessage({
        type: "ai-response",
        content: `${t.ai.errorPrefix} ${message}`,
        isError: true,
        errorCode: code,
      });
      return { ok: false, paths: [], error: message };
    }
  };

  const handleCreateImage = async () => {
    const imgAtt = pendingAttachments.find(
      (p) => p.attachment.type === "image"
    );
    let inputImage: { data: string; mimeType: string } | undefined;
    if (imgAtt && imgAtt.attachment.type === "image") {
      const m = /^data:([^;]+);base64,(.+)$/.exec(imgAtt.attachment.dataUrl);
      if (m) inputImage = { mimeType: m[1], data: m[2] };
    }
    const modal = new ImageGenModal(plugin.app, {
      options: buildImageModelOptions(),
      initialPrompt: composerDraftRef.current.trim(),
      hasInputImage: !!inputImage,
      strings: t.imageGen,
    });
    const choice = await modal.openAndWait();
    if (!choice) return;
    const store = useChatStore.getState();
    if (store.messages.length === 0) {
      const newId = makeId();
      store.setCurrentChatId(newId);
      store.setCurrentChatTitle(generateTitle(choice.prompt));
      store.lockSession(activeProviderId, activeModel, activeMode);
    }
    store.addMessage({ type: "user", content: `🖼️ ${choice.prompt}` });
    if (choice.useInputImage && inputImage) {
      setPendingAttachments([]);
    }
    store.setLoading(true);
    try {
      await runImageGeneration(
        choice.prompt,
        choice.providerId,
        choice.model,
        choice.useInputImage ? inputImage : undefined
      );
    } finally {
      store.setLoading(false);
    }
  };

  return {
    runGenerationTurn,
    buildImageModelOptions,
    runImageGeneration,
    handleCreateImage,
  };
}
