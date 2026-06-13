// src/i18n/en-us.ts
// English (US) strings. Mirror of pt-br.ts — TypeScript enforces shape match
// via `Translations` type, so any divergence breaks the build.

import type { Translations } from "./pt-br";

export const EN_US: Translations = {
  composer: {
    attachImageNoneValid: "No valid image was attached.",
    attachImageTooLarge: "Image too large (max 20MB).",
    attachmentsLabel: "Pending attachments",
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

  camera: {
    title: "Camera",
    previewAlt: "Captured photo",
    close: "Close camera",
    flash: "Flashlight",
    retake: "Retake",
    use: "Use photo",
    useSystem: "System camera",
    shutter: "Take photo",
    flip: "Flip camera",
    unsupported: "Camera not available on this device.",
    denied: "Couldn't access the camera. Allow access or use the system camera.",
    fileName: (stamp: string) => `Photo ${stamp}.jpg`,
  },

  skills: {
    title: "Apps & Skills",
    subtitle: "Templates from your vault — tap to use in the chat.",
    close: "Back",
    use: "Use",
    openNote: "Open note",
    emptyTitle: "No skills yet",
    emptySub:
      "Create .md notes in the skills folder (axxa-ai/skills) — each becomes an app here.",
  },

  allSet: {
    title: "You're all set!",
    sub: "You're ready to get started.",
  },

  voice: {
    title: "Voice mode",
    introTitle: "Meet Voice mode",
    feat1Title: "Natural conversations",
    feat1Desc: "Speak and hear answers — no typing.",
    feat2Title: "Reads aloud",
    feat2Desc: "AXXA's answers are spoken back to you.",
    feat3Title: "Voice and speed",
    feat3Desc: "Pick the voice and reading pace.",
    feat4Title: "Local and private",
    feat4Desc: "Voice and speech processed on your device.",
    start: "Get started",
    close: "Close",
    settings: "Voice settings",
    talk: "Tap to talk",
    stop: "Stop",
    statusListening: "Listening…",
    statusThinking: "Thinking…",
    statusSpeaking: "Speaking…",
    statusTapToTalk: "Tap the mic to talk",
    statusTtsOnly: "Dictation unavailable — I'll read answers aloud",
    sttUnavailable:
      "Voice dictation isn't available on this device. Answers are still read aloud.",
    voiceLabel: "Voice",
    voiceDefault: "System default",
    speedLabel: "Speed",
    test: "Test voice",
    testPhrase: "Hi! This is the AXXA voice.",
  },

  projects: {
    sourcesMissing: (names: string) => `Some sources were not found and were skipped: ${names}`,
    title: "Projects",
    back: "Back",
    newProject: "New project",
    emptyTitle: "No projects yet",
    emptySub: "Create a project to group conversations and context notes.",
    rowMeta: (chats: number, sources: number) =>
      `${chats} chat${chats === 1 ? "" : "s"} · ${sources} source${sources === 1 ? "" : "s"}`,
    editorNewTitle: "New project",
    editorEditTitle: "Edit project",
    nameLabel: "Name",
    namePlaceholder: "Project name",
    chooseIcon: "Choose icon",
    chooseColor: "Color",
    save: "Save",
    cancel: "Cancel",
    done: "Done",
    deleteProject: "Delete project",
    tabChats: "Chats",
    tabSources: "Sources",
    chatsEmpty: "No conversations in this project yet.",
    sourcesEmpty: "No sources. Add vault notes as context.",
    addSource: "Add source",
    removeSource: "Remove source",
    newChatInProject: "New chat in this project",
    created: (name: string) => `Project "${name}" created`,
    deleted: "Project deleted",
    sourceAdded: "Source added to project",
  },

  inspire: {
    openLabel: "Get inspired",
    title: "Get inspired",
    subtitle: "Tap an idea to start",
    close: "Close",
    catAll: "All",
    catCreate: "Create",
    catLearn: "Learn",
    catPlay: "Play",
    cards: [
      { title: "Writing editor", desc: "Improves clarity, tone and grammar", icon: "pen-line", cat: "create", prompt: "Revise the text below improving clarity, tone and grammar, keeping the meaning:\n\n" },
      { title: "Brainstorm", desc: "10 creative ideas on a topic", icon: "lightbulb", cat: "create", prompt: "Give me 10 creative, varied ideas about: " },
      { title: "Commented code", desc: "Writes and explains step by step", icon: "code", cat: "create", prompt: "Write and comment, step by step, code that: " },
      { title: "Summarize note", desc: "Key points as bullets", icon: "list", cat: "learn", prompt: "Summarize the key points as short bullets:\n\n" },
      { title: "Explain simply", desc: "Like I'm five", icon: "graduation-cap", cat: "learn", prompt: "Explain very simply, like to a child: " },
      { title: "Flashcards", desc: "Q&A to study", icon: "layers", cat: "learn", prompt: "Create 10 flashcards (question → answer) about: " },
      { title: "Study plan", desc: "A 7-day roadmap", icon: "calendar-days", cat: "learn", prompt: "Build a 7-day study plan with daily goals about: " },
      { title: "Quick quiz", desc: "5 questions to test you", icon: "puzzle", cat: "play", prompt: "Create a 5-question quiz (with the answer key at the end) about: " },
      { title: "Guess the word", desc: "A yes/no game", icon: "gamepad-2", cat: "play", prompt: "Let's play: think of a word and I'll guess it by asking yes/no questions. Go ahead." },
    ],
  },

  responseStyle: {
    menuLabel: "Choose style",
    normal: "Normal",
    concise: "Concise",
    explanatory: "Explanatory",
    formal: "Formal",
    friendly: "Friendly",
    instrConcise:
      "Answer concisely and directly, with no preamble or repetition.",
    instrExplanatory:
      "Explain in depth: lay out the reasoning, give examples, and break it into steps.",
    instrFormal: "Use a formal, professional tone with precise language.",
    instrFriendly:
      "Use a friendly, approachable tone, like a conversation between friends.",
  },

  linkSafety: {
    title: "Is this link safe?",
    desc: "This link isn't verified and may lead to a third-party site. Check the full address before opening.",
    open: "Open link",
    copy: "Copy link",
    cancel: "Cancel",
    copied: "Link copied",
    muteSession: "Don't ask again this session",
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
    copyConversationFailed: "Could not copy the conversation.",
    newChat: "New chat",
    newQa: "New Q&A",
    newAgent: "New Agent",
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
    modelSwitcherLabel: "Switch model",
    modelLockedHint: "Choosing another model opens a new conversation.",
    recents: "Recents",
  },

  // Clean "new conversation" base screen (no starter screen) — per mode. v0.1.219
  newChatScreen: {
    chatTitle: "New chat",
    chatSub: "Send the first message and we're off.",
    vaultQaTitle: "New Q&A",
    vaultQaSub: "Ask anything about your notes.",
    agentTitle: "New Agent",
    agentSub: "Tell me what to do — I read and edit your vault.",
  },

  // Redesigned model selector (category tabs + modal + favorites). v0.1.222
  modelPicker: {
    title: "All models",
    expand: "See all models",
    close: "Close",
    favorites: "Favorites",
    fav: "Add to favorites",
    unfav: "Remove from favorites",
    empty: "No models in this category.",
  },

  // "Mortal Kombat" model selector (ModelArena). v0.1.223
  arena: {
    scan: "Scan new",
    scanning: "Scanning…",
    scanNone: "No new models found.",
    scanFound: (n: number) =>
      `${n} new ${n === 1 ? "fighter" : "fighters"} on the roster!`,
    scanErr: "Scan failed (check the provider API key).",
    close: "Close",
    prev: "Previous",
    next: "Next",
    prevProvider: "Previous provider",
    nextProvider: "Next provider",
    choose: "Choose",
    power: "Power",
    hall: "Hall of Fame",
    creators: "Creators",
    soldiers: "Soldiers",
  },

  account: {
    label: "Your account",
    badgeFree: "Free",
    badgePremium: "Premium",
    badgeFounder: "Founder",
    stats: (chats: number, tokens: string) =>
      `${chats} ${chats === 1 ? "chat" : "chats"} · ${tokens} tokens`,
  },

  chat: {
    copyCode: "Copy code",
    upgradePro: "Upgrade to PRO",
    variantNext: "Next version",
    variantPrev: "Previous version",
    variantNav: "Response versions",
    readAloudUnsupported: "Read aloud isn't supported on this device.",
    searchPlaceholder: "Search this conversation…",
    searchResults: (n: number) => `${n} result${n === 1 ? "" : "s"}`,
    searchNoResults: "No results in this conversation.",
    continueLabel: "Continue",
    continueTitle: "Response cut at the limit — continue where it stopped",
    deletedToTrash: "Conversation moved to trash.",
    personaTitle: "Chat persona",
    personaDesc:
      "Custom system instruction for this conversation — sets role, tone and rules. Empty = use the default.",
    personaPlaceholder:
      "E.g.: You are a skeptical tech reviewer. Be concise, flag risks first.",
    personaSave: "Save",
    personaClear: "Clear",
    personaSet: "Persona set for this chat",
    personaCleared: "Persona removed — using the default",
    copied: "Response copied",
    savedAsNote: (path: string) => `Note created: ${path}`,
    saveAsNoteFailed: "Failed to save the note.",
    disclaimer: "AXXA can make mistakes. Check important info.",
    actionCopy: "Copy",
    actionRegen: "Regenerate",
    actionLike: "Like",
    actionDislike: "Dislike",
    actionReadAloud: "Read aloud",
    actionStopReading: "Stop reading",
    actionSaveNote: "Save as note",
    reasoningLive: "Thinking…",
    reasoningDone: "Reasoning",
  },

  conversations: {
    sortLabel: "Sort by",
    clearSearch: "Clear search",
    title: "All conversations",
    back: "Back",
    searchPlaceholder: "Search by title, model or provider...",
    emptyAll: "No saved conversations yet. Send your first message!",
    emptyFilter: "No conversations in this mode yet.",
    emptySearch: "No conversations found for that search.",
    endOfList: "end of list",
    untitled: "Untitled",
    scrollTop: "Scroll to top",
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
    modelCardDialog: (model: string) => `Model details: ${model}`,
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
    loopAborted: "Agent kept repeating the same action and was stopped. Try rephrasing the task or giving more context.",
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
    diffApproval: "Approve changes (diff)",
    diffApprovalDesc:
      "Every action that WRITES to the vault (edit/create/move/delete) shows a diff/preview to approve before saving. 'Approve all' clears the rest of the run. Recommended on.",
  },

  plus: {
    dialogLabel: "Conversation options",
    title: "Conversation options",
    addToChat: "Add to chat",
    attachCamera: "Camera",
    attachPhotos: "Photos",
    attachFiles: "File",
    attachNoteDesc: "Reference a note from your vault",
    styleDesc: "Tone and format of responses",
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
    failed: "Failed",
    interrupted: "Interrupted",
    err: {
      noKey: (provider: string) =>
        `No API key for ${provider}. Add your key in Settings to get started.`,
      invalidKey: (provider: string) =>
        `Your ${provider} API key looks invalid or expired. Check it in Settings.`,
      rateLimit: "Rate limit reached. Wait a few seconds and try again.",
      network: "Connection failed. Check your internet and try again.",
      billing:
        "Gemini needs active API billing for this model. Your Google AI Pro/Ultra subscription does NOT cover the API — it's billed separately in AI Studio. Enable billing (Prepay plan, min $10) and try again.",
    },
    retry: "Try again",
    openSettings: "Open Settings",
    openBilling: "Enable billing in AI Studio",
    genUnsupported: (type: "image" | "audio" | "video", suportado: string) => {
      const tipo = type === "image" ? "Image" : type === "audio" ? "Audio" : "Video";
      return `${tipo} generation isn't supported in AXXA yet with this provider/model. Available today: ${suportado}.`;
    },
  },

  imageGen: {
    noneConnected: "No image provider connected. Add a key in Settings → Providers to generate.",
    inputImageDecodeFailed: "The attached image could not be decoded — generating from text only.",
    title: "Generate image",
    editTitle: "Edit image",
    promptLabel: "Prompt",
    promptPlaceholder: "Describe the image you want…",
    modelLabel: "Model",
    generate: "Generate",
    cancel: "Cancel",
    connected: "connected",
    notConnected: "no key",
    noModels:
      "No image model enabled. Enable one in Settings → Providers (e.g. gemini-2.5-flash-image, gpt-image-1).",
    free: "free",
    useAttached: "Edit the attached image (IMG2IMG)",
    editOnlyNano: "editing only on Nano Banana",
    perImage: (usd: string) => `~${usd}/img`,
    menuLabel: "Create image",
    menuDesc: "Generates an image in the current chat — no model switch.",
  },

  plans: {
    title: "Plans",
    current: "current",
    freeFeats: [
      "Chat with 6 providers (BYO key)",
      "Vault Q&A + local RAG with citations",
      "Agent with diff approval",
      "Image generation in the chat",
      "Personas, skills and modes",
    ],
    proFeats: [
      "Everything in Free",
      "Media — vault gallery",
      "Advanced statistics",
      "Projects (coming soon)",
      "Priority support",
    ],
    licenseLabel: "License key",
    apply: "Apply",
    licenseHint: "Paste your license to unlock Pro. (test: AXXA-PRO-TEST-2026)",
    licenseValid: "✓ Valid key — Pro active.",
    licenseInvalid: "✗ Invalid format. Use AXXA-PRO-XXXX-XXXX.",
  },

  onboarding: {
    title: "Welcome to AXXA OS",
    sub: "Your AI workspace, native to Obsidian.",
    features: [
      { title: "6 providers, your key", desc: "OpenAI, Claude, Gemini, OpenRouter, NIM and Ollama — bring your own key." },
      { title: "Talk to your vault", desc: "Vault Q&A with local RAG and clickable note citations." },
      { title: "An agent that acts", desc: "Reads and edits your notes, always with diff approval." },
      { title: "Generate images in chat", desc: "Right in the conversation, no model switch." },
      { title: "All local-first", desc: "Chats, personas and skills (.md) live in your vault." },
    ],
    byoNote:
      "Your API key is stored in the OS keychain. Got Ollama? runs local, no key.",
    cta: "Add my first key",
    skip: "Skip for now",
  },

  nav: {
    conversations: "Conversations",
    media: "Media",
    statistics: "Statistics",
    projects: "Projects",
    profile: "Profile",
    settings: "Settings",
    more: "Show more",
    less: "Show less",
  },
  screens: {
    mediaEmptyTitle: "No media",
    mediaEmptySub: "Generated or attached images, audio and video show up here.",
    mediaScopeAxxa: "AXXA only",
    mediaScopeAll: "Whole vault",
    statSpend: "Spend",
    statChats: "Chats",
    statTokens: "Tokens",
    statTopModels: "Top models",
    statEmptyTitle: "No data yet",
    statEmptySub: "Use the chat to start generating stats.",
    statOpenUsage: "See details in Settings → Usage",
    profileAccount: "Account",
    profilePlan: "Plan",
    profileSettings: "Settings",
    profileProviders: "Connected providers",
    profileChats: "Chats",
    lockedTitle: "Pro feature",
    lockedSub: "This screen is part of AXXA Pro. Upgrade to unlock.",
    lockedCta: "See plans",
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
    confirmCancel: "Cancel",
    confirmProceed: "Confirm",
    title: "AXXA OS — AI Agent",
    topTabs: {
      providers: "Providers",
      setup: "Setup & RAG",
      appearance: "Appearance",
      effort: "Effort",
      usage: "Usage",
      outros: "Other",
    },
    setupIntro:
      "Folders where AXXA saves everything in your vault + semantic search (RAG) over your notes.",
    setupFoldersTitle: "Folders",
    setupRagTitle: "Vault Q&A / RAG",
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
    openaiDataSharing: "Data-sharing program",
    openaiDataSharingDesc:
      "Sharing your API traffic with OpenAI earns free daily tokens on TEXT models. Check this if you're enrolled.",
    openaiTier: "Usage tier",
    openaiTierDesc: "Your OpenAI tier (1–5). Sets the free daily token volume from data-sharing.",
    openaiFreeHint: (eligible: boolean, bigK: number, miniM: number) =>
      eligible
        ? `Free tokens/day (data-sharing): ~${bigK}k on large models · ~${miniM}M on mini. ⚠️ IMAGE generation isn't covered — billed normally (~$0.04/img).`
        : "Enable data-sharing (Tier 1+) to earn free daily tokens on TEXT models. Image generation is never covered.",
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
    modelSetDefault: "Set as default model",
    modelDefaultTag: "default",
    modelsFetchedWithEmbeds: (chat: number, emb: number) =>
      `${chat} models + ${emb} embedding (RAG) found.`,
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
    skillsPathDesc:
      "Vault folder with skills (.md). Each skill becomes a /command in the composer.",
    skillsManage: "Skills",
    skillsManageDesc: (n: number) =>
      `${n} skill${n === 1 ? "" : "s"} loaded. Each .md note (frontmatter name/description/icon/mode) becomes a /command.`,
    skillsCreateExamples: "Create examples",
    skillsReload: "Reload skills",
    skillsSeeded: (n: number) =>
      n > 0
        ? `${n} example skill${n === 1 ? "" : "s"} created`
        : "Example skills already exist",
    skillsReloaded: (n: number) =>
      `${n} skill${n === 1 ? "" : "s"} loaded`,
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
    density: "Interface density",
    densityDesc:
      "Scales spacing across the whole app — lists, pills, segments and corners. Compact tightens everything; Large gives more room.",
    densityLarge: "Large",
    densityNormal: "Normal",
    densityCompact: "Compact",
    motion: "Motion",
    motionDesc:
      "The personality of the app's animations — applies to everything we animate from here on. Soft is subtle; Chaotic is pure spring.",
    motionSoft: "Soft",
    motionWave: "Wave",
    motionIntense: "Intense",
    motionChaotic: "Chaotic",
    reduceMotion: "Reduce motion",
    reduceMotionDesc:
      "Turns off ALL app animations — you decide animated or not (independent of the OS). Leave off to see the effects.",
    reducedMotionMobile: "Reduce motion on mobile",
    reducedMotionMobileDesc:
      "On phone/tablet, turns off motion animations (saves battery, avoids motion sickness). Doesn't affect desktop.",
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
    ragEmbDim: "Dimension",
    ragEmbImage: "Images",
    ragEmbYes: "Yes",
    ragEmbNo: "No",
    ragEmbCost: "Cost",
    ragEmbCtx: "Context",
    ragEmbPerChunk: "Per chunk",
    ragEmbMobileNote:
      "More dimensions = more accurate, but a bigger index. On mobile the index is separate (mobile builds and uses its own) with a 16 MB cap — above that it falls back to keyword. Tip: the Light/Minimal profile (int8 + reduced dim) shrinks it ~4–8×.",
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
    ragStatsFormat: (fmt: string) => `On-disk format: ${fmt}`,
    ragFormatStreamed: "streamed (shards)",
    ragFormatSingle: "single file",
    ragStatsFormatMismatch:
      "⚠️ On-disk format differs from the setting. Reindex to apply.",
    ragProfileLabel: "Index profile (quantization)",
    ragProfileRecommend: (count: number, name: string) =>
      `Your vault: ${count} notes → recommended: ${name}`,
    ragProfileNoDim:
      "This model doesn't support reduced dim — using full dim with int8.",
    ragStreamShardsLabel: "Streamed index (shards)",
    ragStreamShardsDesc:
      "Saves the index in several pieces and reads ONE at a time during search, instead of loading it all into memory. Bounded memory (recommended for large vaults or mobile); each search reads from disk — slightly slower. Requires reindexing to apply; in this mode reindex is always full (no incremental).",
    ragStreamShardsHint: (n: number) =>
      `On: ~${n} chunks per shard. The index never sits fully in RAM — search scans the shards and keeps only the best. Reindex to (re)build in this format.`,
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
    usageCostBilledLabel: "Billed (data-sharing)",
    usageDsTitle: (tier: number) => `Data-sharing — Tier ${tier}`,
    usageDsGross: (v: string) => `Gross: ${v}`,
    usageDsBilled: (v: string) => `Billed: ${v}`,
    usageDsSaved: (v: string) => `Saved: ${v}`,
    usageDsBig: "Large models — today",
    usageDsMini: "Mini/nano — today",
    usageDsNote:
      "Estimate. The free allowance is daily (resets at midnight) and per pool. ⚠️ It's shared across ALL your OpenAI API usage — the plugin only sees vault chats, so 'free remaining' is optimistic if you use the API elsewhere. Images never count toward the allowance.",
    usageBillingTitle: "Real billing (cross-check)",
    usageBillingCross: "Cross-check with API",
    usageBillingCrossing: "Checking…",
    usageBillingEstimate: "Estimated",
    usageBillingReal: "Real",
    usageBillingStatusCol: "Status",
    usageBillingLeft: "left",
    usageBillingNoLive:
      "To cross-check real billing: an OpenRouter key (normal) and/or an OpenAI Admin key in the API key field.",
    usageBillingOrgNote:
      "REAL cost of the whole org (all your OpenAI usage), not just this plugin.",
    keyKindNormal:
      "🔑 Project key — chat & generation OK. Real costs need an Admin key.",
    keyKindAdmin:
      "🛡️ Admin key — real costs ON in Usage. ⚠️ Admin keys can't do chat; use a project key to talk.",
    keyKindUnknown: "⚠️ Unrecognized key format — double-check what you pasted.",
    keyAdminReady: "Admin key detected — click “Cross-check with API”.",
    keyAdminSoon: "Admin key detected — Anthropic real costs coming soon.",
    keyAdminAntExp:
      "Admin key detected — Anthropic is EXPERIMENTAL (cost_report shape unverified). Click “Cross-check”.",
    balanceRealExp: "real (exp)",
    adminKeyName: "Admin key (optional)",
    adminKeyDesc:
      "Only for real costs/balance (Admin API). Can't do chat — your project key stays in the field above.",
    planOverrideName: "Plan (admin test)",
    planOverrideDesc:
      "Simulates the plan to test paid screens. 'Auto' uses the account's real plan; 'Free'/'Pro' force the behavior. Doesn't change your real plan.",
    planAuto: "Auto (real plan)",
    openaiProjectName: "Project ID (optional)",
    openaiProjectDesc:
      "Attributes the real cost to this project only. Create a dedicated AXXA project in the OpenAI dashboard and use a key from it — then balance/cost reflects only the plugin, not the whole org.",
    usageBillingProjNote: "REAL cost of this OpenAI project only (attribution).",
    anthropicWorkspaceName: "Workspace ID (optional)",
    anthropicWorkspaceDesc:
      "Attributes the real cost to this workspace only. Create a dedicated AXXA workspace in the Anthropic Console and use a key from it — cost reflects only the plugin.",
    balanceTitle: "Balance",
    balanceRefresh: "Refresh balance",
    balanceSetAnchor: "set an anchor →",
    balanceEstimate: "estimated",
    balanceReal: "real",
    balanceLiveHint: "real balance straight from the API (click Refresh)",
    balanceNote:
      "Balance = anchor − spend since that date. “real” uses the provider's billing (OpenAI/Anthropic admin · OpenRouter native); otherwise it's “estimated” from vault chats. Credit is separate per provider.",
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
