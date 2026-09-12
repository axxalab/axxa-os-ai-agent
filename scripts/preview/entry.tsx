// scripts/preview/entry.tsx
// Entry do preview: monta um plugin + uma ChatSession falsos e renderiza a
// casca REAL (App.tsx -> ChatView / StarterScreen / Drawer). Os imports sao
// relativos a RAIZ do projeto: o esbuild do preview.mjs usa resolveDir=ROOT.

import { createRoot } from "react-dom/client";
import { App as AxxaApp } from "./src/ui/App";
import { useChatStore } from "./src/store/chat";
import type { ChatSession } from "./src/core/session";
import type AxxaPlugin from "./src/main";

declare const PREVIEW_VERSION: string;

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
    { id: "s1", name: "Daily note", description: "Start today's note", icon: "calendar", body: "", path: "" },
    { id: "s2", name: "Summarize", description: "Summarize a note", icon: "align-left", body: "", path: "" },
  ],
  chatSummaries: chats,
  settings: {
    openaiApiKey: "sk-test",
    anthropicApiKey: "",
    activeModels: { openai: ["gpt-5", "gpt-4o", "gpt-4o-mini"] },
    projects: [],
  },
  loadChatSummaries: async () => chats,
  onChatsChange: () => () => {},
  onSettingsChange: () => () => {},
  providerCredential: (id: string) => (id === "openai" ? "sk-test" : ""),
  reloadSkills: async () => {},
  seedExampleSkills: async () => {},
} as unknown as AxxaPlugin;

let mode = "chat";
let effort = "med";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const session = {
  get config() {
    const st = useChatStore.getState();
    return {
      provider: st.sessionProvider ?? "openai",
      model: st.sessionModel ?? "gpt-5",
      mode: st.sessionMode ?? mode,
      effort,
      locked: st.sessionProvider !== null,
    };
  },
  setMode: (m: string) => {
    mode = m;
    emit();
  },
  setProvider: emit,
  setModel: emit,
  setEffort: (e: string) => {
    effort = e;
    emit();
  },
  modelOptions: () => ["gpt-5", "gpt-4o", "gpt-4o-mini"],
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
    { id: "m5", type: "ai-response", content: "Splitting by difficulty is the better fit for how you review — topic decks recreate the cramming pattern you flagged in June.", timestamp: Date.now() - 10000 },
  ] as never);
  st.setCurrentChatId("2");
  st.setCurrentChatTitle("What did I write about spaced repetition?");
  st.lockSession("openai", "gpt-5", "vault-qa");
}

const host = document.getElementById("app");
if (host) createRoot(host).render(<AxxaApp plugin={plugin} session={session} />);
