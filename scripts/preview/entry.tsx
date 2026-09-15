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

// Conversas falsas. Precisam ser MUITAS e espalhadas pelos três módulos:
// com quatro no total, a tela de cada módulo tinha uma linha e a busca (que
// só aparece a partir de oito) nunca nascia — ou seja, metade do menu não
// dava pra ver. As datas são relativas a hoje pra "Today/Yesterday" valerem
// alguma coisa.
const dias = (n: number, h = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};

const chats = [
  { id: "1", title: "Weekly review plan", date: "2026-09-11T09:12:00", mode: "agent", provider: "anthropic", model: "claude-sonnet-4-6", messageCount: 14, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 14 },
  { id: "2", title: "What did I write about spaced repetition?", date: "2026-09-10T21:03:00", mode: "vault-qa", provider: "openai", model: "gpt-5", messageCount: 6, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 0 },
  { id: "3", title: "Outline for the Axxa landing page", date: "2026-09-09T14:44:00", mode: "chat", provider: "openai", model: "gpt-4o", messageCount: 22, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 0 },
  { id: "4", title: "Clean up the inbox folder", date: "2026-09-08T08:20:00", mode: "agent", provider: "gemini", model: "gemini-2.5-flash", messageCount: 9, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 9 },
  { id: "5", title: "Rewrite the plugin README", date: dias(0, 8), mode: "chat", provider: "openai", model: "gpt-5", messageCount: 11, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 0 },
  { id: "6", title: "Which notes mention the Anki backlog?", date: dias(1, 19), mode: "vault-qa", provider: "openai", model: "gpt-5", messageCount: 4, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 0 },
  { id: "7", title: "Move last month's meeting notes", date: dias(2, 11), mode: "agent", provider: "anthropic", model: "claude-sonnet-4-6", messageCount: 18, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 18 },
  { id: "8", title: "Names for the voice feature", date: dias(3, 15), mode: "chat", provider: "openai", model: "gpt-4o", messageCount: 7, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 0 },
  { id: "9", title: "What did I decide about pricing?", date: dias(4, 9), mode: "vault-qa", provider: "anthropic", model: "claude-sonnet-4-6", messageCount: 5, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 0 },
  { id: "10", title: "Tag every note from the São Paulo trip", date: dias(5, 20), mode: "agent", provider: "openai", model: "gpt-5", messageCount: 26, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 26 },
  { id: "11", title: "Explain event loops like I'm tired", date: dias(6, 23), mode: "chat", provider: "openai", model: "gpt-5", messageCount: 9, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 0 },
  { id: "12", title: "Summarise the reading list", date: dias(9, 12), mode: "vault-qa", provider: "openai", model: "gpt-4o", messageCount: 8, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 0 },
  { id: "13", title: "Draft the changelog for 0.5", date: dias(12, 16), mode: "chat", provider: "anthropic", model: "claude-sonnet-4-6", messageCount: 13, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 0 },
  { id: "14", title: "Split the daily notes by quarter", date: dias(15, 10), mode: "agent", provider: "openai", model: "gpt-5", messageCount: 31, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 31 },
  { id: "15", title: "Where did I write about sleep debt?", date: dias(21, 7), mode: "vault-qa", provider: "openai", model: "gpt-5", messageCount: 3, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 0 },
  // O módulo Chat passa de OITO conversas de propósito: é a partir daí que a
  // busca da tela nasce, e sem um módulo gordo esse caminho não existiria no
  // preview.
  { id: "17", title: "Regex for the daily note template", date: dias(7, 11), mode: "chat", provider: "openai", model: "gpt-5", messageCount: 6, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 0 },
  { id: "18", title: "Ideas for the onboarding screen", date: dias(10, 17), mode: "chat", provider: "anthropic", model: "claude-sonnet-4-6", messageCount: 15, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 0 },
  { id: "19", title: "Why is my build 300KB?", date: dias(14, 21), mode: "chat", provider: "openai", model: "gpt-4o", messageCount: 10, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 0 },
  { id: "20", title: "Translate the README to Portuguese", date: dias(18, 9), mode: "chat", provider: "openai", model: "gpt-5", messageCount: 4, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 0 },
  // Modo DESCONHECIDO: uma conversa gravada por uma versão que ainda não
  // existe. Não pode sumir nem quebrar a tela — tem que aparecer com o nome
  // que tem.
  { id: "16", title: "Deep research on spaced repetition", date: dias(8, 13), mode: "research", provider: "openai", model: "gpt-5", messageCount: 5, filePath: "", tokensIn: 0, tokensOut: 0 , toolCount: 0 },
].sort((a, b) => b.date.localeCompare(a.date));

const plugin = {
  manifest: { version: PREVIEW_VERSION, id: "axxa-os-ai-agent" },
  // VAULT de mentira, com forma de verdade: é dele que sai a lista de notas do
  // "+" e do `[[`. Com `app: {}` o buscador não tinha o que buscar — e um
  // buscador vazio "passa" em qualquer teste.
  app: {
    vault: {
      getMarkdownFiles: () => FAKE_NOTES,
      // getFiles inclui a MÍDIA — é dela que sai a lista de artefatos.
      getFiles: () => [...FAKE_NOTES, ...FAKE_ARTIFACTS],
      getAbstractFileByPath: (p: string) =>
        [...FAKE_NOTES, ...FAKE_ARTIFACTS].find((f) => f.path === p) ?? null,
      adapter: {
        readBinary: async () =>
          Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]).buffer,
      },
      cachedRead: async (f: { path: string }) =>
        `# ${f.path.split("/").pop()}

Conteúdo de mentira da nota, o bastante pra virar contexto.`,
    },
  },
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
  // ?nokey=1 simula a PRIMEIRA vez: nenhum provider configurado. É o cenário
  // em que o envio desiste antes de criar a mensagem do usuário.
  providerCredential: (id: string) =>
    params.get("nokey")
      ? ""
      : ({ openai: "sk-test", anthropic: "sk-ant", gemini: "gm-test" })[id] ?? "",
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

/** Rodada em curso foi interrompida pelo botão de parar. */
let abortado = false;

/** Tira o turno em andamento da tela sem matá-lo (ver session.destacarTurno). */
const destacarOuNada = () => {
  const st = useChatStore.getState();
  if (!st.isLoading || st.background) return;
  const dono = st.turnChatId ?? st.currentChatId;
  if (!dono) return;
  st.detachTurn({
    chatId: dono,
    title: st.currentChatTitle,
    mode: st.sessionMode ?? mode,
    provider: st.sessionProvider ?? provider,
    model: st.sessionModel ?? model,
    effort,
    messages: st.messages,
    tokensIn: st.tokensIn,
    tokensOut: st.tokensOut,
  });
};

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
  // RODADA DE MENTIRA, contrato DE VERDADE. `send: async () => {}` escondia
  // duas coisas que só aparecem no fluxo: o campo limpar (ou não) conforme o
  // envio engata, e tudo que acontece ENQUANTO a resposta chega (o "pensando",
  // a fila, o botão de parar). O contrato copiado do motor:
  //   - sem key na 1ª mensagem → bolha de erro, NENHUMA mensagem do usuário,
  //     devolve false (a rodada nem começou)
  //   - caso contrário → mensagem do usuário, narração, resposta em pedaços,
  //     devolve true
  send: async (text: string) => {
    const st = useChatStore.getState();
    if (!plugin.providerCredential(provider)) {
      st.addMessage({
        type: "ai-response",
        content: "AXXA: no API key configured for this provider.",
        isError: true,
        errorCode: "no-key",
      });
      return false;
    }
    // Espelha o motor: os anexos pendentes são CONSUMIDOS pelo envio.
    if (st.attachments.length > 0) st.setAttachments([]);
    st.addMessage({ type: "user", content: text });
    if (!st.currentChatId) {
      st.setCurrentChatId("preview-" + Date.now());
      st.setCurrentChatTitle(text.slice(0, 40));
      st.lockSession(provider, model, mode);
    }
    // Carimba o dono do turno, como o motor faz: é por ele que a lista sabe
    // qual conversa está respondendo.
    st.setTurnChatId(useChatStore.getState().currentChatId);
    st.setLoading(true);
    emit();
    // ?turn=ms controla a duração da rodada (padrão 1.4s).
    const total = Number(params.get("turn") ?? 1400);
    abortado = false;
    const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const narracao = st.addMessage({
      type: "ai-comment",
      content: "",
      activity: {
        phase: "pending",
        iconPending: "eye",
        pendingText: "Reading PROJECTS/FRAMEWORKS.md",
      },
    });
    await dorme(total * 0.35);
    if (!abortado) {
      useChatStore
        .getState()
        .updateActivity(narracao, { phase: "done", doneText: "Read PROJECTS/FRAMEWORKS.md" });
      const pedacos = ("Resposta de mentira, em pedaços, pra dar pra ver o " +
        "texto chegando enquanto a tela continua respondendo ao toque.").split(" ");
      const id = useChatStore.getState().addMessage({ type: "ai-response", content: "" });
      useChatStore.getState().setStreamingMessageId(id);
      for (const p of pedacos) {
        if (abortado) break;
        useChatStore.getState().appendToMessage(id, p + " ");
        await dorme((total * 0.65) / pedacos.length);
      }
      useChatStore.getState().setStreamingMessageId(null);
    }
    useChatStore.getState().setLoading(false);
    // O turno acabou: se ele respondeu fora da tela, o de verdade grava o
    // arquivo aqui. No preview basta soltar — o que importa é ver o estado.
    useChatStore.getState().clearBackground();
    useChatStore.getState().setTurnChatId(null);
    emit();
    // Mesmo contrato do motor: quem entrou na fila durante a rodada sai agora.
    const fila = useChatStore.getState().queued;
    if (fila.length > 0) {
      const [proxima, ...resto] = fila;
      useChatStore.setState({ queued: resto });
      await session.send(proxima);
    }
    return true;
  },
  stop: () => {
    abortado = true;
    useChatStore.getState().setLoading(false);
    useChatStore.getState().setStreamingMessageId(null);
    useChatStore.getState().clearQueued();
    emit();
  },
  // Igual ao motor (session.ts): o `mode` opcional FIXA o modo da conversa
  // nova. A versão que ignorava o argumento fazia o "New Agent chat" do menu
  // abrir uma conversa de Chat no preview — e o preview dizia que estava tudo
  // bem.
  // Desvio do turno, igual ao da sessão de verdade (session.ts): sair do chat
  // no meio da resposta NÃO mata o turno — ele passa a escrever fora da tela.
  // Sem isto aqui, o preview mostrava a resposta pulando pra conversa errada e
  // dizia que estava tudo bem.
  newChat: (m?: string) => {
    destacarOuNada();
    useChatStore.getState().newChat();
    if (m) {
      mode = m;
      // O motor grava o modo escolhido como padrão (session.ts). É o que faz
      // o menu marcar o módulo certo quando não há conversa travada.
      plugin.settings.defaultMode = m;
    }
    emit();
  },
  newChatInProject: async () => {},
  // Abrir uma conversa da lista: põe mensagens de mentira na tela e TRAVA a
  // sessão no modo/modelo daquela conversa, que é o que o motor faz ao ler o
  // arquivo. Antes era um no-op, então tocar numa conversa do menu não fazia
  // nada e não dava pra ver se o menu tinha aberto a certa.
  load: async (c: { id: string; title: string; mode: string; provider: string; model: string }) => {
    // Mesmo guarda do motor (session.load): pedir a conversa que já está
    // aberta é no-op. Sem ele, o preview recarregava e desfazia o reanexo do
    // turno — e mostrava como se sair e voltar perdesse a resposta.
    if (useChatStore.getState().currentChatId === c.id) return;
    const bg = useChatStore.getState().background;
    if (bg?.chatId === c.id) {
      // Voltando pra conversa que responde em segundo plano: o que vale é o
      // que o turno já escreveu, não o disco.
      const run = useChatStore.getState().attachTurn();
      if (run) {
        const s2 = useChatStore.getState();
        s2.setMessages(run.messages);
        s2.setCurrentChatId(run.chatId);
        s2.setCurrentChatTitle(run.title);
        s2.lockSession(run.provider, run.model, run.mode);
        emit();
      }
      return;
    }
    destacarOuNada();
    const st = useChatStore.getState();
    st.newChat();
    st.setMessages([
      { id: `${c.id}-u`, type: "user", content: c.title, timestamp: Date.now() - 60000 },
      {
        id: `${c.id}-a`,
        type: "ai-response",
        content: `Conversa de mentira do preview, carregada de **${c.mode}**. O que importa aqui é que o menu abriu ESTA e não outra.`,
        timestamp: Date.now() - 50000,
      },
    ]);
    st.setCurrentChatId(c.id);
    st.setCurrentChatTitle(c.title);
    st.lockSession(c.provider, c.model, c.mode);
    mode = c.mode;
    provider = c.provider;
    model = c.model;
    emit();
  },
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

/** Notas do vault falso — nomes parecidos de propósito, que é onde o ranking
 *  do buscador mostra serviço. */
const FAKE_NOTES = [
  { path: "PROJECTS/FRAMEWORKS.md", basename: "FRAMEWORKS", extension: "md", stat: { mtime: 5 } },
  { path: "PROJECTS/CREATIVE SYSTEMS.md", basename: "CREATIVE SYSTEMS", extension: "md", stat: { mtime: 8 } },
  { path: "DAILY/2026-09-14.md", basename: "2026-09-14", extension: "md", stat: { mtime: 99 } },
  { path: "TASKS/Inbox.md", basename: "Inbox", extension: "md", stat: { mtime: 40 } },
  { path: "Learning/Spaced repetition.md", basename: "Spaced repetition", extension: "md", stat: { mtime: 30 } },
  { path: "Notas/2024/framing-de-produto/rascunho.md", basename: "rascunho", extension: "md", stat: { mtime: 10 } },
  { path: "NUTRITION 1.0/Plano semanal.md", basename: "Plano semanal", extension: "md", stat: { mtime: 20 } },
];

/** O que o plugin "gerou" — a lista de artefatos do "+". */
const FAKE_ARTIFACTS = [
  { path: "axxa-ai/generation/images/1731-gato-de-oculos.png", basename: "1731-gato-de-oculos", extension: "png", stat: { mtime: 900 } },
  { path: "axxa-ai/generation/images/1731-gato-de-oculos.md", basename: "1731-gato-de-oculos", extension: "md", stat: { mtime: 901 } },
  { path: "axxa-ai/generation/audio/1730-resumo-falado.mp3", basename: "1730-resumo-falado", extension: "mp3", stat: { mtime: 800 } },
  { path: "axxa-ai/generation/video/1729-clipe.mp4", basename: "1729-clipe", extension: "mp4", stat: { mtime: 700 } },
];

/** Conteúdo de exemplo do modal de aprovação (?s=confirm). */
const MD_DEMO = "# CREATIVE SYSTEMS\n\n## Purpose\nA broad, **practical** view of how creative systems work day to day, with enough text to prove that long lines wrap instead of running off the screen.\n\n## Core Principles\n- Treat the work as a *system*, not a mood\n- Capture first, judge later\n- Review on a schedule, not on a feeling\n\nSee [[PROJECTS/FRAMEWORKS]] for the longer version.\n\n```ts\nexport function review(deck: Card[], hoje = Date.now()) {\n  return deck.filter((c) => c.due <= hoje).sort((a, b) => a.due - b.due);\n}\n```\n";
const TS_DEMO = "import { readFile } from 'node:fs/promises';\n\n/** L\u00ea o deck e devolve o que vence hoje. */\nexport async function due(path: string): Promise<Card[]> {\n  const raw = await readFile(path, 'utf8');\n  const deck = JSON.parse(raw) as Card[];\n  return deck.filter((c) => c.due <= Date.now());\n}\n";

const host = document.getElementById("app");

if (scenario === "confirm") {
  // O modal DE VERDADE — a mesma classe que o agente abre no aparelho. Antes
  // aqui havia um espelho de HTML escrito à mão: ele nunca ia mostrar um bug
  // do modal, só os bugs do espelho.
  void (async () => {
    const { ConfirmationModal } = await import("./src/agent/ConfirmationModal");
    const { getTranslations } = await import("./src/i18n");
    const strings = getTranslations("en-us").agent;
    // ?file=md|ts|txt — o preview precisa mostrar os TRÊS caminhos: nota
    // formatada, código colorido e texto cru.
    const tipo = params.get("file") ?? "md";
    const caso =
      tipo === "ts"
        ? {
            path: "axxa-ai/review.ts",
            content: TS_DEMO,
          }
        : tipo === "txt"
          ? { path: "Inbox/dump.txt", content: "linha 1\nlinha 2\nlinha 3" }
          : { path: "PROJECTS/CREATIVE SYSTEMS.md", content: MD_DEMO };
    // ?big=1 estoura o teto do preview: é o único jeito de VER a linha do
    // truncamento (e de provar que ela fica fora do bloco).
    const content = params.get("big")
      ? caso.content.repeat(6)
      : caso.content;
    const modal = new ConfirmationModal({} as never, {
      toolCall: {
        id: "call_1",
        name: "vault_create",
        arguments: { path: caso.path, content },
      },
      definition: {
        name: "vault_create",
        description:
          "Creates a new vault file with the given content. Fails if it already exists.",
        parameters: { type: "object", properties: {}, required: [] },
      } as never,
      strings,
    });
    void modal.openAndWait();
  })();
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
