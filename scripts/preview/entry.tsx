// scripts/preview/entry.tsx
// Entry do preview: monta um plugin + uma ChatSession falsos e renderiza a
// casca REAL (App.tsx -> ChatView / StarterScreen / Drawer). Os imports sao
// relativos a RAIZ do projeto: o esbuild do preview.mjs usa resolveDir=ROOT.

import { createRoot } from "react-dom/client";
import { App as AxxaApp } from "./src/ui/App";
import { useChatStore } from "./src/store/chat";
import { registerBrandLogos } from "./src/ui/brandLogos";
import type { ChatSession } from "./src/core/session";
import type AxxaPlugin from "./src/main";

declare const PREVIEW_VERSION: string;

registerBrandLogos(); // igual ao onload do plugin

const params = new URLSearchParams(location.search);
const scenario = params.get("s") ?? "empty";

const chats = [
  { id: "1", title: "Weekly review plan", date: "2026-09-11T09:12:00", mode: "agent", provider: "anthropic", model: "claude-sonnet-4-6", messageCount: 14, filePath: "", tokensIn: 0, tokensOut: 0 },
  { id: "2", title: "What did I write about spaced repetition?", date: "2026-09-10T21:03:00", mode: "vault-qa", provider: "openai", model: "gpt-5", messageCount: 6, filePath: "", tokensIn: 0, tokensOut: 0 },
  { id: "3", title: "Outline for the Axxa landing page", date: "2026-09-09T14:44:00", mode: "chat", provider: "openai", model: "gpt-4o", messageCount: 22, filePath: "", tokensIn: 0, tokensOut: 0 },
  { id: "4", title: "Clean up the inbox folder", date: "2026-09-08T08:20:00", mode: "agent", provider: "gemini", model: "gemini-2.5-flash", messageCount: 9, filePath: "", tokensIn: 0, tokensOut: 0 },
];

const plugin = {
  manifest: { version: PREVIEW_VERSION, id: "axxa-os-ai-agent" },
  app: {},
  skills: [
    // `body` preenchido de propósito: é ele que cai no composer. Com body
    // vazio (como estava) o atalho "funcionava" sem escrever nada, e o preview
    // não conseguia mostrar a diferença entre certo e quebrado.
    { id: "s1", name: "Daily note", description: "Start today's note", icon: "calendar", body: "Open today's daily note and list what's still open.", path: "" },
    { id: "s2", name: "Summarize", description: "Summarize a note", icon: "align-left", body: "Summarize the note I'm looking at in five bullets.", path: "" },
  ],
  chatSummaries: chats,
  settings: {
    openaiApiKey: "sk-test",
    anthropicApiKey: "sk-ant",
    activeModels: {
      // Longa DE PROPÓSITO: é com a lista rolando que dá pra ver se o cartão
      // chega no fim da tela ou morre atrás de uma faixa.
      openai: [
        "gpt-5", "gpt-4o", "gpt-4o-mini", "gpt-5-mini", "gpt-5-nano",
        "gpt-4.1", "gpt-4.1-mini", "o3", "o3-mini", "o4-mini", "dall-e-3",
        "tts-1", "tts-1-hd",
      ],
      anthropic: ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"],
    },
    favoriteModels: {
      openai: ["gpt-5", "gpt-4o"],
      anthropic: ["claude-opus-5"],
    },
    // Um de cada estado, pra ver as quatro bolinhas de uma vez:
    // openai testado OK · gemini reprovado · anthropic com chave sem teste ·
    // o resto sem credencial.
    geminiApiKey: "gm-test",
    providerStatus: {
      openai: { ok: true, at: Date.now(), detail: "24 models available." },
      gemini: { ok: false, at: Date.now(), detail: "401 invalid key" },
    },
    defaultEffort: "med",
    voiceEnabled: true,
    voiceModel: "gpt-4o-mini-transcribe",
    voiceLanguage: "pt",
    ttsEnabled: true,
    ttsModel: "gpt-4o-mini-tts",
    ttsVoice: "alloy",
    ttsProvider: "openai",
    elevenApiKey: "",
    elevenModel: "eleven_multilingual_v2",
    elevenVoice: "",
    elevenVoices: [],
    projects: [],
  },
  // A casca grava em quase toda interação; sem isto o clique morre num
  // TypeError e o preview mente dizendo que o botão não faz nada.
  saveSettings: async () => {},
  loadChatSummaries: async () => chats,
  onChatsChange: () => () => {},
  onSettingsChange: () => () => {},
  providerCredential: (id: string) =>
    ({ openai: "sk-test", anthropic: "sk-ant", gemini: "gm-test" })[id] ?? "",
  // Catálogo falso: o preview não fala com a rede. Grande e bagunçado DE
  // PROPÓSITO — é assim que o catálogo real chega, e é o que o agrupamento
  // por papel/família tem que domar.
  scanModels: async (id: string) =>
    id === "openai"
      ? [
          "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-5", "gpt-5-mini",
          "gpt-5-nano", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini",
          "gpt-4o-2024-08-06", "gpt-4-turbo", "o1", "o1-mini", "o3", "o3-mini",
          "o4-mini", "dall-e-2", "dall-e-3", "gpt-image-1", "tts-1", "tts-1-hd",
          "text-embedding-3-small", "text-embedding-3-large",
        ]
      : [
          "meta/llama-3.3-70b-instruct:free",
          "qwen/qwen-2.5-7b:free",
          "deepseek/deepseek-r1",
        ],
  reloadSkills: async () => {},
  seedExampleSkills: async () => {},
} as unknown as AxxaPlugin;

/** Modelo padrão de cada provider — o que o motor tira do settings. */
const FAKE_DEFAULT_MODEL: Record<string, string> = {
  openai: "gpt-5",
  anthropic: "claude-sonnet-5",
  gemini: "gemini-2.5-flash",
  openrouter: "meta/llama-3.3-70b-instruct:free",
  nim: "nvidia/llama-3.3-nemotron-super-49b",
  ollama: "llama3.2",
};

let mode = "chat";
let effort = "med";
// Provider/modelo da sessão falsa. Guardar de verdade importa: é o que prova
// que escolher um modelo de OUTRO provider na folha comita os dois.
let provider = "openai";
let model = "gpt-5";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const session = {
  get config() {
    const st = useChatStore.getState();
    return {
      provider: st.sessionProvider ?? provider,
      model: st.sessionModel ?? model,
      mode: st.sessionMode ?? mode,
      effort,
      locked: st.sessionProvider !== null,
    };
  },
  setMode: (m: string) => {
    mode = m;
    emit();
  },
  setProvider: (p: string) => {
    provider = p;
    model = FAKE_DEFAULT_MODEL[p] ?? "";
    emit();
  },
  setModel: (m: string) => {
    model = m;
    emit();
  },
  setEffort: (e: string) => {
    effort = e;
    emit();
  },
  // Igual ao motor: a lista marcada como Show DAQUELE provider (+ o atual).
  // A versão que ignorava o argumento mostrava modelo da OpenAI dentro da
  // Anthropic — o preview mentindo de novo.
  modelOptions: (provider: string) => {
    const shown = plugin.settings.activeModels?.[provider] ?? [];
    const cur = FAKE_DEFAULT_MODEL[provider];
    return cur && !shown.includes(cur) ? [cur, ...shown] : shown;
  },
  apiKeyFor: () => "sk-test",
  send: async () => {},
  stop: () => {},
  newChat: () => {
    useChatStore.getState().newChat();
    emit();
  },
  newChatInProject: async () => {},
  load: async () => {},
  delete: async () => {},
  rename: async () => {},
  updateProjects: async () => {},
  onChange: (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
} as unknown as ChatSession;

if (scenario === "thread") {
  const st = useChatStore.getState();
  st.setMessages([
    { id: "m1", type: "user", content: "Which of my notes talk about spaced repetition, and what did I conclude?", timestamp: Date.now() - 60000 },
    { id: "m2", type: "ai-comment", content: "", timestamp: Date.now() - 55000, activity: { phase: "done", pendingText: "Searching the vault…", doneText: "Read 4 notes" } },
    { id: "m3", type: "ai-response", content: "Three notes cover it. In **Learning/Spaced repetition.md** you settled on a 2-day → 1-week → 1-month ladder, and noted that the jump to a month was where recall broke down.\n\nThe open question you left in **Inbox/Anki backlog.md** was whether to split decks by topic or by difficulty.", timestamp: Date.now() - 50000 },
    { id: "m4", type: "user", content: "Draft a note that answers that open question.", timestamp: Date.now() - 20000 },
    { id: "m5", type: "ai-response", reasoning: "O usuário quer uma nota que responda à pergunta em aberto. Vale olhar as duas notas citadas antes de escrever, porque a conclusão de junho contradiz a hipótese de dividir por tópico — e é essa contradição que a nota precisa resolver.", content: "Splitting by difficulty is the better fit for how you review — topic decks recreate the cramming pattern you flagged in June.", timestamp: Date.now() - 10000,
      // Ações de agente: é o que alimenta o chip e a folha de auditoria.
      // Lista LONGA de propósito: é com onze linhas que dá pra ver se a folha
      // rola sem fim ou se cabe na tela.
      agentSteps: [
        { id: "t1", name: "vault_list", arguments: {}, result: "7 items", ok: true },
        { id: "t2", name: "vault_list", arguments: { folder: "PROJECTS" }, result: "16 items", ok: true },
        { id: "t3", name: "vault_list", arguments: { folder: "TASKS" }, result: "4 items", ok: true },
        { id: "t4", name: "vault_list", arguments: { folder: "DAILY" }, result: "8 items", ok: true },
        { id: "t5", name: "vault_list", arguments: { folder: "NUTRITION 1.0" }, result: "12 items", ok: true },
        { id: "t6", name: "vault_list", arguments: { folder: "axxa-ai" }, result: "1 item", ok: true },
        { id: "t7", name: "vault_read", arguments: { path: "PROJECTS/FRAMEWORKS.md" }, result: "# Frameworks…", ok: true },
        { id: "t8", name: "vault_search", arguments: { query: "spaced repetition" }, result: ["4 notes matched:", "Learning/Spaced repetition.md"].join("\n"), ok: true },
        { id: "t9", name: "vault_edit", arguments: { path: "PROJECTS/FRAMEWORKS.md" }, result: "edited", ok: true },
        { id: "t10", name: "vault_create", arguments: { path: "PROJECTS/CREATIVE SYSTEMS.md", content: "…" }, result: "created", ok: true },
        { id: "t11", name: "vault_create", arguments: { path: "Inbox/Decks por dificuldade.md", content: "…" }, result: "Permission denied: destructive action needs confirmation", ok: false },
      ] },
  ] as never);
  st.setCurrentChatId("2");
  st.setCurrentChatTitle("What did I write about spaced repetition?");
  st.lockSession("openai", "gpt-5", "vault-qa");
}

// O store fica alcançável pelo console do preview: é assim que dá pra simular
// um STREAM de verdade (token a token) e conferir se o markdown formata
// enquanto chega, em vez de só no fim.
(window as unknown as { __chat: unknown }).__chat = useChatStore;

const host = document.getElementById("app");

if (scenario === "confirm") {
  // Espelha o markup do ConfirmationModal (mesmas classes) dentro da árvore de
  // modal do Obsidian — é o único jeito de OLHAR esse desenho sem rodar o
  // agente de verdade.
  const wrap = document.createElement("div");
  wrap.className = "modal-container mod-dim";
  const modal = document.createElement("div");
  modal.className = "modal";
  const content = document.createElement("div");
  content.className = "modal-content axxa-confirm-modal";
  content.innerHTML = [
    "<h2>Review Agent change</h2>",
    '<div class="axxa-confirm-summary">',
    '<div class="axxa-confirm-tool-name">vault_create</div>',
    '<div class="axxa-confirm-tool-desc">Creates a new vault file with the given content.</div>',
    "</div>",
    '<div class="axxa-confirm-preview">',
    '<div class="axxa-confirm-path axxa-confirm-path-add">',
    '<span class="axxa-confirm-path-label">Create</span>',
    '<span class="axxa-confirm-path-val">PROJECTS/CREATIVE SYSTEMS.md</span>',
    "</div>",
    '<pre class="axxa-diff-block axxa-diff-add"># CREATIVE SYSTEMS',
    "",
    "## Purpose",
    "This note was created to capture a broad, practical view of how creative systems work in day to day practice, with enough text to prove that long lines wrap instead of running off the screen.",
    "",
    "## Core Principles",
    "Creative work improves when it is treated as a system instead of a mood.",
    "[+803 chars]</pre>",
    "</div>",
    '<div class="setting-item"><div class="setting-item-info"></div><div class="setting-item-control">',
    '<button class="axxa-confirm-deny">Deny</button>',
    '<button class="axxa-confirm-approveall">Approve all</button>',
    '<button class="mod-cta">Approve</button>',
    "</div></div>",
  ].join("\n");
  modal.appendChild(content);
  wrap.appendChild(modal);
  document.body.appendChild(wrap);
}
if (scenario === "settings") {
  // Renderiza a ABA DE SETTINGS (que é Setting API nativa, não React) dentro
  // do mesmo painel, pra dar pra olhar o desenho das abas.
  void (async () => {
    const { AxxaSettingsTab } = await import("./src/ui/SettingsTab");
    const tab = new AxxaSettingsTab(
      {} as never,
      plugin as never
    ) as unknown as { containerEl: HTMLElement; display: () => void };
    // A ÁRVORE REAL das settings: o app.css tem regras presas a
    // `.is-phone .modal .setting-item-control …`. Um div solto no #app não
    // recebia nenhuma delas — o preview mostrava uma linha de controle que o
    // celular nunca teve.
    const modal = document.createElement("div");
    modal.className = "modal mod-settings preview-settings-modal";
    const content = document.createElement("div");
    content.className = "modal-content vertical-tabs-container";
    const tabContent = document.createElement("div");
    tabContent.className = "vertical-tab-content-container";
    const inner = document.createElement("div");
    inner.className = "vertical-tab-content";
    tab.containerEl = document.createElement("div");
    tab.containerEl.className = "axxa-settings-preview";
    inner.appendChild(tab.containerEl);
    tabContent.appendChild(inner);
    content.appendChild(tabContent);
    modal.appendChild(content);
    host?.appendChild(modal);
    tab.display();
  })();
} else if (host) {
  createRoot(host).render(<AxxaApp plugin={plugin} session={session} />);
  // O mesmo que a AxxaView faz no aparelho: um ouvinte de tato na raiz. Sem
  // isto o preview mostrava só os pulsos "com nome" e escondia os toques.
  void import("./src/ui/haptics").then(({ hapticsOn, setHapticsEnabled }) => {
    setHapticsEnabled(true);
    hapticsOn(host);
  });
}
