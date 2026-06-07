// src/i18n/en-us.ts
// English (US) strings. Mirror of pt-br.ts — TypeScript enforces shape match
// via `Translations` type, so any divergence breaks the build.

import type { Translations } from "./pt-br";

export const EN_US: Translations = {
  composer: {
    placeholderChat: "Ask AXXA Agent...",
    placeholderVaultQa: "Ask about your Vault...",
    placeholderAgent: "Tell the Agent to organize your vault...",
    placeholderCoder: "Paste code or ask a dev question...",
    sendLabel: "Send message",
    stopLabel: "Stop generation",
    micLabel: "Hold to record audio",
    micRecording: "Release to stop",
    plusLabel: "More options",
  },

  recording: {
    micDenied: "Microphone permission denied — enable it in system settings.",
    micUnsupported: "Microphone not supported on this device.",
    saved: (duration: string) => `Audio saved (${duration})`,
    saveFailed: "Failed to save audio.",
    cancelled: "Recording cancelled.",
    alias: (duration: string) => `Audio ${duration}`,
  },

  menu: {
    copy: "Copy",
    regenerate: "Regenerate",
    delete: "Delete",
  },

  header: {
    newChat: "New conversation",
    openSettings: "Settings",
  },

  starter: {
    title: "New conversation",
    subtitle:
      "Configure before starting — provider and model lock when you send the first message.",
    modeLabel: "Mode",
    providerLabel: "Provider",
    modelLabel: "Model",
    effortLabel: "Effort",
    recentChatsLabel: "Recent conversations",
    hint: 'Send the first message to start. Provider and model lock — only Effort can change later (via "+").',
  },

  modes: {
    chat: "Chat",
    chatDesc: "Direct conversation",
    vaultQa: "Vault Q&A",
    vaultQaDesc: "Search notes as context",
  },

  plus: {
    dialogLabel: "Conversation options",
    title: "Conversation options",
    attachTitle: "Attach file",
    attachSub: "PDFs, images, vault notes — coming in Module 5",
    attachSoonBadge: "soon",
    attachPdf: "PDF",
    attachImage: "Image",
    attachNote: "Note",
    attachPdfNotice: "Attach PDF is coming in Module 5",
    attachImageNotice: "Attach image is coming in Module 5",
    attachNoteNotice: "Reference note is coming in Module 5",
    effortTitle: "Effort",
    effortSub: "Processing intensity — affects max_tokens",
  },

  vault: {
    searching: (topK: number, effort: string) =>
      `Searching up to ${topK} notes in vault (effort: ${effort})...`,
    foundContext: (count: number) =>
      `${count} note${count > 1 ? "s" : ""} found as context`,
    notFound:
      "No relevant notes found — answering without vault context",
  },

  ai: {
    thinking: "Thinking...",
    emptyResponse: "[Empty response received]",
    errorPrefix: "[Error]",
    unknownError: "Unknown error.",
  },

  systemPrompt: {
    base:
      "You are AXXA Agent, an assistant integrated into Obsidian. " +
      "Answer in English, clearly, directly, and helpfully. " +
      "Use Markdown when it makes sense.",
    vaultQaSuffix:
      "\n\nThe user is in Vault Q&A mode — below are relevant notes " +
      "extracted from their vault. Use them as the main source to answer, " +
      "and cite the note title when referencing.\n\nNotes:\n\n",
  },

  settings: {
    title: "AXXA OS — AI Agent",
    tabs: {
      openai: "OpenAI",
      anthropic: "Anthropic",
      openrouter: "OpenRouter",
      ollama: "Ollama",
      outros: "Other",
    },
    providerIntro:
      "Configure the API key and select the active models for the chosen provider.",
    defaultProvider: "Default provider",
    defaultProviderDesc: "Which API to use in conversations",
    apiKey: "API Key",
    apiKeyDescOpenai: "sk-... — stored locally in the vault.",
    apiKeyDescAnthropic: "sk-ant-... — stored locally.",
    apiKeyDescOpenrouter: "sk-or-... — stored locally.",
    model: "Default model",
    modelDesc: (provider: string) =>
      `Default model for ${provider}. Use 'Fetch' to see what's available.`,
    modelFetchTooltip: "Fetch models via API",
    modelSearchingNotice: (provider: string) =>
      `Fetching ${provider} models...`,
    modelNoneNotice: (provider: string) =>
      `No models returned by ${provider}.`,
    modelLoadedNotice: (count: number) => `${count} models loaded.`,
    modelFailedNotice: (msg: string) => `Failed to fetch models: ${msg}`,
    modelSetNotice: (model: string) => `Model set: ${model}`,
    activeModels: "Active models",
    activeModelsDesc: (provider: string) =>
      `Which ${provider} models appear in the starter screen picker. Add manually to include legacy models.`,
    activeModelsEmpty: "No active models. Add below.",
    activeModelsAddBtn: "Add",
    activeModelsAddPlaceholder: (example: string) => `e.g. ${example}`,
    activeModelsFetchBtn: "Fetch from API",
    activeModelsFetchingBtn: "Fetching...",
    activeModelsAlready: (model: string) => `"${model}" is already in the list.`,
    activeModelsAdded: (model: string) => `Model "${model}" added.`,
    activeModelsAvailable: (count: number) =>
      `${count} models available. Check the ones to appear in the picker:`,
    activeModelsRemoveTitle: "Remove",
    openrouterIntro:
      "Multi-model proxy. Models prefixed by provider (e.g. anthropic/claude-3.5-sonnet).",
    ollamaIntro:
      "Local LLMs. Requires Ollama server running (https://ollama.com).",
    ollamaEndpoint: "Endpoint",
    ollamaEndpointDesc:
      "Ollama server URL (default: http://localhost:11434)",
    outrosIntro: "General settings — paths, language, appearance.",
    language: "Language",
    languageDesc:
      "Plugin language. The UI updates immediately.",
    languagePtBr: "Português (Brasil)",
    languageEnUs: "English (US)",
    chatsPath: "Chats folder",
    chatsPathDesc: "Where chats are saved in the Vault",
    skillsPath: "Skills folder",
    skillsPathDesc: "Where skills are saved in the Vault (coming in Module 7)",
    recordingsPath: "Recordings folder",
    recordingsPathDesc: "Where audio recordings from the mic button are saved",
    comingSoon: "Coming soon",
    comingSoonItems: [
      "Audio recorder (mic) — Sprint E",
      "Agent Mode (file ops) — Module 6",
      "Skills management — Module 7",
      "MCP Connect (Notion, ClickUp, Figma) — Module 9",
    ],
    appearance: "Appearance",
    appearanceDesc:
      "Pick a background for AXXA's interface. Subtle colors that don't hurt reading.",
    backgroundLabels: {
      none: "Default",
      sunset: "Sunset",
      ocean: "Ocean",
      forest: "Forest",
      violet: "Violet",
      mono: "Mono",
    },
  },
};
