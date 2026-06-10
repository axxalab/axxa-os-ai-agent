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
    edit: "Edit",
    cancel: "Cancel",
    saveResend: "Save & resend",
  },

  header: {
    newChat: "New conversation",
    openSettings: "Settings",
    conversations: "Conversations",
    moreOptions: "More options",
    fullscreen: "Full-screen (mobile)",
    exitFullscreen: "Exit full-screen",
    search: "Search conversation",
    copyConversation: "Copy conversation",
    copyConversationDone: "Conversation copied",
    persona: "Chat persona",
    personaActive: "Chat persona (active)",
  },

  chat: {
    searchPlaceholder: "Search this conversation…",
    searchResults: (n: number) => `${n} result${n === 1 ? "" : "s"}`,
    searchNoResults: "No results in this conversation.",
    continueLabel: "Continue",
    continueTitle: "Response cut at the limit — continue where it stopped",
    personaTitle: "Chat persona",
    personaDesc:
      "Custom system instruction for this conversation — sets role, tone and rules. Empty = use the default.",
    personaPlaceholder:
      "E.g.: You are a skeptical tech reviewer. Be concise, flag risks first.",
    personaSave: "Save",
    personaClear: "Clear",
    personaSet: "Persona set for this chat",
    personaCleared: "Persona removed — using the default",
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
    today: "Today",
    yesterday: "Yesterday",
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

  // Dashboard — starter became the plugin home (v0.1.103): usage stats,
  // activity, new-chat setup and RAG/provider status.
  dashboard: {
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    tagline: "Your AI hub in the vault — configure below and send the first message.",
    overviewLabel: "Overview",
    statChats: "Chats",
    statMessages: "Messages",
    statTokens: "Tokens",
    statCost: "Estimated spend",
    activityLabel: "Activity · 7 days",
    activitySpend: "Spend · 3 days",
    activityEmpty: "No activity yet — your first conversation shows up here.",
    activitySpendEmpty: "No spend in this period.",
    activityDay: (chats: number, tokens: string) =>
      `${chats} chat${chats === 1 ? "" : "s"} · ${tokens} tokens`,
    activityBlock: (chats: number, cost: string) =>
      `${chats} chat${chats === 1 ? "" : "s"} · ${cost}`,
    activityToday: "today",
    newChatLabel: "New conversation",
    viewAll: "View all",
    statusLabel: "Status",
    ragTitle: "RAG index",
    ragStats: (chunks: string, files: number) =>
      `${chunks} chunks · ${files} notes`,
    ragLast: (when: string) => `last indexed: ${when}`,
    ragEmpty: "No notes indexed yet",
    ragMismatch: "Embedding model changed — reindex",
    providersTitle: "Providers",
    providersCount: (n: number, total: number) =>
      `${n}/${total} configured`,
    // Relative dates (formatRelativeDate) — locale-aware (v0.1.103)
    relNow: "now",
    dateLocale: "en-US",
    // Tactile effort (v0.1.122)
    effortHold: "hold & drag",
    effortAdjusting: "adjusting…",
    // Model card (v0.1.122)
    modelSeeMore: "See more",
    modelFlipHint: "tap for details",
    // Model card v2 (v0.1.130)
    modelExpand: "Expand",
    modelCollapse: "Collapse",
    modelSpecs: "tap for specs",
    modelFlipBack: "back",
    modelFetch: "Fetch specs",
    modelFetching: "fetching…",
    modelFetchNone: "No specs from this source yet",
    modelFetchErr: "Failed to fetch specs",
    // StarterScreen v2 (v0.1.131)
    resume: "Resume",
    providerAdd: "Add",
    launcherHint: "Start here",
    todayLine: (chats: number, cost: string) =>
      `${chats} chat${chats === 1 ? "" : "s"} today · ${cost}`,
    starters: {
      chat: ["Summarize this text…", "Explain it simply:", "Draft a plan for…"],
      vaultQa: ["What do my notes say about…", "Connect ideas across…", "Summarize my notes on…"],
      agent: ["Create a note about…", "Organize the folder…", "List to-dos in…"],
    },
    // Free onboarding + trust (v0.1.138)
    freeStartTitle: "Start free, no card",
    freeStartSub:
      "Gemini free tier · OpenRouter free models · local Ollama. Tap to set up.",
    trustLine: "Everything stays in your vault · no telemetry · offline with Ollama",
  },

  modes: {
    chat: "Chat",
    chatDesc: "Direct conversation",
    vaultQa: "Vault Q&A",
    vaultQaDesc: "Search notes as context",
    agent: "Agent",
    agentDesc: "Reads, creates, edits and organizes vault files",
    coder: "Coder",
    coderDesc: "Edit code with diff preview (coming soon)",
    study: "Study",
    studyDesc: "Flashcards, quizzes and study summaries (coming soon)",
    soonBadge: "soon",
    comingSoon: (name: string) => `${name} mode is coming soon.`,
  },

  agent: {
    thinking: "🤖 Agent thinking...",
    systemPrompt:
      "You are AXXA Agent, an assistant integrated into Obsidian with direct access " +
      "to the user's vault via tools. Respond in English. " +
      "To FIND notes about a topic or question, use vault_search FIRST " +
      "(semantic search) instead of listing folders and reading file by file — it's " +
      "much more efficient. " +
      "Use the tools to accomplish the requested task — read, create, edit, move, or " +
      "delete files when the user asks. Ask FIRST if the intent is ambiguous. " +
      "When done, return a text response summarizing what you did. " +
      "To edit files, ALWAYS use vault_read first to see the exact content. " +
      "If a tool fails, ADJUST your strategy (wrong path? format? permission?) " +
      "before retrying — never repeat the EXACT same call that just failed. " +
      "When you need to list many files, prefer parallel tool calls (same turn).",
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
      "extracted from their vault. Use them as the main source to answer. " +
      "ALWAYS cite the notes you used inline, in the [[Title]] format, using " +
      "EXACTLY the title shown in each block's ### header (the text inside " +
      "[[ ]]). Do not invent notes that are not listed below. When an answer " +
      "comes from a specific note, cite it right after the sentence.\n\nNotes:\n\n",
  },

  settings: {
    title: "AXXA OS — AI Agent",
    topTabs: {
      providers: "Providers",
      appearance: "Appearance",
      effort: "Effort",
      usage: "Usage",
      outros: "Other",
    },
    appearanceTabs: {
      background: "Background",
      chips: "Chips",
      ui: "Interface",
    },
    effortTabs: {
      low: "Low 🐢",
      med: "Med ⚖️",
      high: "High ⚡",
      xhigh: "xHigh 🔥",
      max: "Max 🚀",
    },
    effortIntro:
      "Fine-tune each Effort level. Each level has its own sub-tab — empty fields fall back to built-in defaults. Max is uncapped by default (200 turns, 80% of context).",
    effortReset: "Reset this level to defaults",
    effortResetConfirm: "Reset this level to default values? Your overrides will be lost.",
    effortResetDone: "Restored to defaults.",
    effortFields: {
      maxTokens: "max_tokens (response)",
      maxTokensDesc:
        "Max tokens the model can generate. 0 = uncapped (uses % of model's context window).",
      agentMaxTurns: "Agent: max turns",
      agentMaxTurnsDesc:
        "How many tool-calling rounds the Agent can do before giving up. 0 = unlimited (only anti-loop detection caps it). Was hardcoded to 10 — now each effort has its own.",
      temperature: "Temperature",
      temperatureDesc:
        "Response randomness (0-2). Low = precise/repetitive, high = creative/varied. -1 = don't send (provider's default).",
      vaultTopK: "Vault Q&A: top-K notes",
      vaultTopKDesc:
        "How many notes Vault Q&A mode injects as context.",
      vaultExcerptChars: "Vault Q&A: chars per excerpt",
      vaultExcerptCharsDesc:
        "Excerpt size from each note injected into the system prompt.",
      parallelToolCalls: "Parallel tool calls",
      parallelToolCallsDesc:
        "When the Agent requests multiple tools in the same turn, run them in parallel (faster). Default on for high+.",
      toolRetryOnError: "Retry tools on error",
      toolRetryOnErrorDesc:
        "How many times to retry tools that fail with transient errors (network/timeout/locked). Structural errors (wrong path) are not retried.",
      contextReservePercent: "Context reserve (max)",
      contextReservePercentDesc:
        "When max_tokens=0 (uncapped), how much % of the model's window to use for the response. 80% = leaves 20% for prompt+system.",
      loopDetectionWindow: "Loop detection (turns)",
      loopDetectionWindowDesc:
        "How many identical repeated calls in a row trigger an auto-nudge for the Agent to reconsider. 0 = disabled.",
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
      // Static
      dawn: "Dawn",
      ocean: "Ocean",
      forest: "Forest",
      violet: "Violet",
      rose: "Rose",
      amber: "Amber",
      slate: "Slate",
      mono: "Mono",
      // Live
      aurora: "Aurora · live",
      nebula: "Nebula · live",
      pulse: "Pulse · live",
      flow: "Flow · live",
      tide: "Tide · live",
      ember: "Ember · live",
      spectrum: "Spectrum · live",
      lagoon: "Lagoon · live",
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
    ragProfileLabel: "Index profile (quantization)",
    ragProfileRecommend: (count: number, name: string) =>
      `Your vault: ${count} notes → recommended: ${name}`,
    ragProfileNoDim:
      "This model doesn't support reduced dim — using full dim with int8.",
    ragAutoReindexLabel: "Auto-reindex",
    ragAutoReindexDesc:
      "Re-embeds modified notes in the background (4s after editing). Only runs with an existing index. Each re-embed consumes tokens.",
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
