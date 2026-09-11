// src/i18n/en-us.ts
// Strings do MOTOR (v0.4.0, base CRUD): erros/estados do chat (`ai`), agente
// (`agent` — inclui o ConfirmationModal), Vault Q&A (`vault`), system prompts
// (`systemPrompt`) e os poucos avisos de CRUD (`chat`, `conversations`).
// A casca nova usa strings inline; quando a UI for redesenhada, o i18n volta
// a crescer daqui. Shape canônico = typeof EN_US.

export const EN_US = {












  // Clean "new conversation" base screen (no starter screen) — per mode. v0.1.219

  // Redesigned model selector (category tabs + modal + favorites). v0.1.222

  // (ModelArena removida na limpeza pós-DS-1.0 — a tela que consumia estas
  // strings saiu junto com a StarterScreen. Bloco removido em 0.1.247 para o
  // dicionário refletir só o que existe na UI; o histórico do git guarda o
  // texto original se a arena voltar.)


  chat: {
    deletedToTrash: "Conversation moved to trash.",
  },

  conversations: {
    renameSuccess: (title: string) => `Renamed to "${title}".`,
    renameFailed: (msg: string) => `Failed to rename: ${msg}`,
  },


  // Dashboard — starter became the plugin home (v0.1.103): usage stats,
  // activity, new-chat setup and RAG/provider status.


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
    // Chips de activity do agent loop (P1-03/P1-27) — antes hardcoded em PT.
    unknownTool: (name: string) => `Unknown tool: ${name}`,
    deniedTool: (name: string) => `Denied: ${name}`,
    loopDetectedPending: "Loop detected — asking the agent to reconsider",
    loopDetectedDone: "Loop detected — asked the agent to reconsider",
    stepsSummary: (n: number) => `${n} agent action${n === 1 ? "" : "s"}`,
    // ConfirmationModal (aprovação de mudanças do Agent) — P1-03.
    confirmTitle: "Review Agent change",
    confirmTitleIrreversible: "⚠️ Irreversible action",
    confirmDeny: "Deny",
    confirmApproveAll: "Approve all",
    confirmApprove: "Approve",
    confirmDelete: "Yes, delete",
    confirmLabelEdit: "Edit",
    confirmLabelCreate: "Create",
    confirmLabelCreateFolder: "Create folder",
    confirmLabelFrom: "From",
    confirmLabelTo: "To",
    confirmLabelDelete: "Delete",
    permissionLevel: "Agent permission level",
    permissionLevelDesc:
      "How much control the Agent has over the vault. Delete always asks for confirmation regardless of the level.",
    permissionAsk: "Ask — confirm every action that modifies a file",
    permissionVault: "Vault — free read/write, only delete asks",
    permissionYolo: "YOLO — no modals, except delete (irreversible)",
    diffApproval: "Show diff in confirmations",
    diffApprovalDesc:
      "When the Agent asks for confirmation (per the permission level above), include a before/after diff of the change. Off = a simpler confirmation without the preview. Deletes always ask, on every level.",
  },


  vault: {
    searching: (topK: number, effort: string) =>
      `Searching up to ${topK} notes in vault (effort: ${effort})...`,
    searchDone: "Search complete",
    foundContext: (count: number) =>
      // v0.1.228: plural por count !== 1 (inglês usa plural para 0: "0 notes")
      `${count} note${count !== 1 ? "s" : ""} found as context`,
    foundContextSemantic: (count: number) =>
      `${count} note${count !== 1 ? "s" : ""} found (semantic + keyword)`,
    foundContextKeyword: (count: number) =>
      `${count} note${count !== 1 ? "s" : ""} found (keyword — no semantic index)`,
    foundContextKeywordFallback: (count: number) =>
      `${count} note${count !== 1 ? "s" : ""} found (keyword — semantic search failed)`,
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
      contextOverflow:
        "This conversation no longer fits the model's context window. Start a new chat (this one stays saved), or delete some messages/attachments before retrying.",
    },
    retry: "Try again",
    startNewChat: "Start new chat",
    regenNotForGeneration:
      "Regenerate isn't available for media generation — send the prompt again instead.",
    openSettings: "Open Settings",
    openBilling: "Enable billing in AI Studio",
    genUnsupported: (type: "image" | "audio" | "video", supported: string) => {
      // v0.1.228: identificadores em inglês na locale en-us
      const label = type === "image" ? "Image" : type === "audio" ? "Audio" : "Video";
      return `${label} generation isn't supported in AXXA yet with this provider/model. Available today: ${supported}.`;
    },
  },


  // Activities/erros do motor de geração de mídia (useGeneration) — P1-27.

  // ErrorBoundary (painel de erro de render) — P1-27.




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

};

export type Translations = typeof EN_US;
