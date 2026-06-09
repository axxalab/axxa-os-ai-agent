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
    attachImageLabel: "Attach image",
    attachImageRemoveLabel: "Remove attachment",
    attachImageNoVision:
      "Selected model doesn't accept images. Pick a vision-capable model (e.g. gpt-4o, claude, gemini).",
    attachImagePastedNotice: "Pasted image attached",
    attachImageFailed: "Failed to process the image.",
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
    conversations: "Conversations",
    moreOptions: "More options",
    fullscreen: "Full-screen (mobile)",
    exitFullscreen: "Exit full-screen",
  },

  conversations: {
    title: "All conversations",
    back: "Back",
    searchPlaceholder: "Search by title, model or provider...",
    emptyAll: "No saved conversations yet. Send your first message!",
    emptySearch: "No conversations found for that search.",
    sortDateDesc: "Newest first",
    sortDateAsc: "Oldest first",
    sortTitleAsc: "Title A-Z",
    sortMsgsDesc: "Most messages",
    sortTokensDesc: "Most tokens",
    filterAll: "All",
    renameTitle: "Rename conversation",
    renameAria: "Rename conversation",
    renameModalTitle: "Rename conversation",
    renameInputLabel: "New title",
    renameSubmit: "Save",
    renameCancel: "Cancel",
    renameSuccess: (title: string) => `Renamed to "${title}".`,
    renameFailed: (msg: string) => `Failed to rename: ${msg}`,
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
    modelCapsAria: "Model capabilities",
    capVisionTooltip: "Accepts images (multimodal)",
    capToolsTooltip: "Supports tool calling (Agent Mode)",
    capStreamTooltip: "Real streaming (tokens arrive live)",
    capFreeTooltip: "Free model",
    capImageGenTooltip: "Generates images — saved to axxa-ai/generation/images",
    capAudioGenTooltip: "Generates audio — saved to axxa-ai/generation/audio",
    capVideoGenTooltip: "Generates video — saved to axxa-ai/generation/video",
  },

  modes: {
    chat: "Chat",
    chatDesc: "Direct conversation",
    vaultQa: "Vault Q&A",
    vaultQaDesc: "Search notes as context",
    agent: "Agent",
    agentDesc: "Reads, creates, edits and organizes vault files",
  },

  agent: {
    thinking: "🤖 Agent thinking...",
    needsOpenAI:
      "Agent Mode requires a provider with tool calling. Use OpenAI, Anthropic, Gemini, OpenRouter, Nvidia NIM, or Ollama (compatible model).",
    deniedAction: "🚫 Action denied by user",
    maxTurnsReached: (n: number) =>
      `Agent hit the limit of ${n} turns without finishing. Try rephrasing the task.`,
    permissionLevel: "Agent permission level",
    permissionLevelDesc:
      "How much control the Agent has over the vault. Delete always asks for confirmation regardless of the level.",
    permissionAsk: "Ask — confirm every action that modifies a file",
    permissionVault: "Vault — free read/write, only delete asks",
    permissionYolo: "YOLO — no modals, except delete (irreversible)",
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
    pickNoteEmpty: "No markdown notes in vault.",
    pickNotePrompt: "Paste the note path (e.g. folder/note.md):",
    pickNoteFailed: (msg: string) => `Failed to attach note: ${msg}`,
    pickNoteNotFound: (path: string) => `Note not found: ${path}`,
    pickPdfWrongType: "Select a PDF file.",
    pickPdfFailed: "Failed to attach PDF.",
    webSearchTitle: "Web search",
    webSearchDesc:
      "Provider/model decides when to search. Enabled when needed.",
    createImageTitle: "Create image",
    createImageDesc: "Lets the model generate images in its response.",
    createImageNoGen:
      "Current model can't generate images. Pick a model with 'img-gen' badge.",
    extendedThinkingTitle: "Extended thinking",
    extendedThinkingDesc:
      "Reasoning models show their thought process before answering.",
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
    topTabs: {
      providers: "Providers",
      appearance: "Appearance",
      usage: "Usage",
      outros: "Other",
    },
    tabs: {
      openai: "OpenAI",
      anthropic: "Anthropic",
      gemini: "Gemini",
      openrouter: "OpenRouter",
      nim: "Nvidia NIM",
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
    apiKeyDescGemini: "Key from aistudio.google.com/apikey — stored locally.",
    apiKeyDescOpenrouter: "sk-or-... — stored locally.",
    apiKeyDescNim: "nvapi-... (from build.nvidia.com) — stored locally.",
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
    geminiIntro:
      "Google Gemini via OpenAI-compatible endpoint. Tool calling works on 2.5+/3.x. Generous free tier on AI Studio.",
    openrouterIntro:
      "Multi-model proxy. Models prefixed by provider (e.g. anthropic/claude-3.5-sonnet).",
    nimIntro:
      "Nvidia NIM hosted (1k free credits). Models: Llama 3.3/3.1, Nemotron, Mixtral, Qwen2.5, DeepSeek R1, Phi-4 + image generation (SDXL, FLUX). If you get 404/403, go to build.nvidia.com → Organization → enable 'Public API Endpoints'.",
    ollamaIntro:
      "Local LLMs. Requires Ollama server running (https://ollama.com). Tool calling works on llama3.1+, qwen2.5+, mistral-large.",
    ollamaEndpoint: "Endpoint",
    ollamaEndpointDesc:
      "Ollama server URL (default: http://localhost:11434)",
    outrosIntro: "General settings — paths, language, appearance.",
    outrosTabs: {
      geral: "General",
      ui: "Interface",
      agent: "Agent",
      rag: "RAG",
      usage: "Usage",
    },
    outrosGeralIntro: "Language, vault paths and basic preferences.",
    outrosUiIntro: "Appearance, visible chips, code blocks.",
    outrosAgentIntro: "Permissions and Agent Mode behavior.",
    outrosRagIntro: "Semantic search across your notes with embeddings.",
    outrosUsageIntro:
      "Token accounting and estimated cost per conversation. Pricing based on official lab tables (see src/usage/pricing.ts). Exportable to PDF and Markdown.",
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
    generationPath: "Generation folder",
    generationPathDesc:
      "Where generated media (image/audio/video) is saved. Each output creates 2 files: the media + a .md sidecar with frontmatter (prompt, model, provider).",
    debugOverlay: "Debug overlay",
    debugOverlayDesc:
      "Draws colored outlines + labels on Obsidian/AXXA elements — useful for investigating layout issues. Each color = a different class. Applies directly in the sidebar.",
    comingSoon: "Coming soon",
    comingSoonItems: [
      "Audio recorder (mic) — Sprint E",
      "Agent Mode (file ops) — Module 6",
      "Skills management — Module 7",
      "MCP Connect (Notion, ClickUp, Figma) — Module 9",
    ],
    codeWrap: "Wrap lines in code blocks",
    codeWrapDesc:
      "When enabled, long code blocks wrap instead of scrolling horizontally. Useful on narrow screens (mobile).",
    appearance: "Appearance",
    appearanceDesc:
      "Pick a background for AXXA's interface. Colors and gradients (linear + radial).",
    backgroundLabels: {
      none: "Default",
      sunset: "Sunset",
      ocean: "Ocean",
      forest: "Forest",
      violet: "Violet",
      mono: "Mono",
      aurora: "Aurora",
      spotlight: "Spotlight",
      nebula: "Nebula",
      pulse: "Pulse · live",
      flow: "Flow · live",
      "aurora-live": "Aurora · live",
    },
    chips: "Visible chips",
    chipsDesc:
      "Pick which info shows in lists and the status line. Default is compact — check what you want to see.",
    chipsComposer: "Composer status line",
    chipsComposerDesc: "Appears under the message field (single line).",
    chipsList: "Chat list cards",
    chipsListDesc: "Appears on each Recent Chats and Conversations item.",
    chipsLabels: {
      mode: "Mode (chat / agent / vault-qa)",
      model: "Model",
      effort: "Effort",
      context: "Context used / total",
      in: "Tokens in",
      out: "Tokens out",
      total: "Tokens total",
      speed: "Tokens per second (live)",
      date: "Relative date",
      messages: "Message count",
      tokens: "Total tokens",
    },
    rag: "Vault Q&A (RAG)",
    ragDesc:
      "Semantic search over your notes using embeddings. Without this, Vault Q&A mode falls back to keyword search (faster but less accurate).",
    ragProvider: "Embedding provider",
    ragProviderDesc:
      "OpenAI = text only (paid). OpenRouter Nemotron VL = text + image (free, tight rate limit).",
    ragModel: "Embedding model",
    ragModelDesc:
      "Badges: [FREE] no cost, [🖼️] accepts images. Audio is not supported by any VL model — for audio you'd need Whisper API (own sprint).",
    ragIndexPath: "Index folder",
    ragIndexPathDesc:
      "Where the embeddings file (.json) is saved in the Vault.",
    ragIndexBtn: "Index vault",
    ragReindexBtn: "Reindex (from scratch)",
    ragClearBtn: "Clear index",
    ragStats: (chunks: number, files: number, lastAt: string) =>
      `${chunks} chunks in ${files} files · last: ${lastAt}`,
    ragStatsEmpty: "Empty index. Click 'Index vault' to start.",
    ragStatsMismatch:
      "⚠️ Configured model differs from saved index. Reindex to use the new model.",
    ragIndexingPhaseScanning: (done: number, total: number) =>
      `Scanning vault: ${done}/${total}`,
    ragIndexingPhaseEmbedding: (
      done: number,
      total: number,
      chunks: number
    ) => `Indexing: ${done}/${total} files · ${chunks} chunks embedded`,
    ragIndexingPhaseDone: (chunks: number, tokens: number) =>
      `Done. ${chunks} new chunks · ~${tokens} tokens used.`,
    ragIndexingCancel: "Cancel",
    ragIndexingCancelled: "Indexing cancelled.",
    ragIndexingFailed: (msg: string) => `Indexing failed: ${msg}`,
    ragNoApiKey:
      "OpenAI API key not configured. Go to Settings → Providers → OpenAI first.",
    ragNoOpenRouterKey:
      "OpenRouter API key not configured. Go to Settings → Providers → OpenRouter first.",
    ragClearConfirm:
      "Are you sure? This deletes the index. You'll need to reindex to use Vault Q&A with embeddings again.",
    usagePeriodLabel: "Period:",
    usagePeriod7d: "Last 7 days",
    usagePeriod30d: "Last 30 days",
    usagePeriod90d: "Last 90 days",
    usagePeriodAll: "All time",
    usageLoading: "Computing usage...",
    usageError: "Error aggregating usage",
    usageEmpty:
      "No saved conversations yet. Send your first message to start.",
    usageCostLabel: "Estimated spend",
    usageTokensInLabel: "Tokens in",
    usageTokensOutLabel: "Tokens out",
    usageChatsLabel: "Conversations",
    usageByProvider: "By provider",
    usageByModel: "By model (top 10)",
    usageByMode: "By mode",
    usageHeatmap: "Last 30 days",
    usageTopChats: "Top 10 most expensive conversations",
    usageColProvider: "Provider",
    usageColModel: "Model",
    usageColMode: "Mode",
    usageColTitle: "Title",
    usageColChats: "Conversations",
    usageColIn: "Tokens in",
    usageColOut: "Tokens out",
    usageColCost: "Cost",
    usageColTokens: "Tokens (in/out)",
    usagePartialFootnote:
      "* Partial cost — some model in the aggregation has no pricing configured. Edit src/usage/pricing.ts to add.",
    usageExport: "Export report",
    usageExportPdf: "PDF (print)",
    usageExportMarkdown: "Markdown",
    usageExportHtml: "HTML",
    usageExportSuccess: (path: string) => `Saved to ${path}`,
    usageExportFailed: "Failed to export",
  },
};
