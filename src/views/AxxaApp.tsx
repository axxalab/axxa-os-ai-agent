// src/views/AxxaApp.tsx
// Layout completo com session lock + starter screen + persistência de chats.
//
// Fluxo:
//   - Chat vazio → StarterScreen com provider/model/effort + Recent Chats
//   - Primeira msg → lockSession() + setCurrentChatId(uuid) + auto-save inicia
//   - Cada update em messages → auto-save debounced (500ms) no .axxa/chats/chat/[id].md
//   - "Nova conversa" no header → newChat() reseta tudo
//   - Click em chat recente → loadChat() reidrata mensagens + locked session

import { useEffect, useRef, useState } from "react";
import type AxxaPlugin from "../main";
import { Header } from "../components/layout/Header";
import { Sidebar } from "../components/layout/Sidebar";
import { PersonaModal } from "../components/chat/PersonaModal";
import { ChatSearchModal } from "../components/chat/ChatSearchModal";
import { RenameChatModal } from "../components/chat/RenameChatModal";
import { VoiceScreen } from "../components/chat/VoiceScreen";
import { SkillsScreen } from "../components/chat/SkillsScreen";
import { Icon } from "../components/_shared/Icon";
import { ChatArea } from "../components/chat/ChatArea";
import { Composer } from "../components/composer/Composer";
import { SuggestionsSheet } from "../components/composer/SuggestionsSheet";
import { PlusModal } from "../components/composer/PlusModal";
import { ModelSheet } from "../components/composer/ModelSheet";
import { NewChatScreen } from "../components/chat/NewChatScreen";
import { ConversationsList } from "../components/chat/ConversationsList";
import {
  MediaScreen,
  StatisticsScreen,
  ProfileScreen,
  LockedScreen,
  OnboardingScreen,
  PlansScreen,
} from "../components/screens/Screens";
import {
  ProjectsListScreen,
  ProjectDetailScreen,
  ProjectEditor,
} from "../components/screens/Projects";
import { makeProjectId, type Project } from "../projects";
import { PROVIDERS, providerConfigured } from "../components/_shared/providersMeta";
import { openVaultNotePicker } from "../components/composer/PlusModal";
import {
  getEffectiveTier,
  canAccess,
  isLicensePro,
  type AppView,
} from "../entitlements";
import { AppContext } from "../components/_shared/AppContext";
import { prettyModelName } from "../providers/modelDescriptions";
import { transcribeAudio } from "../providers/transcribe";
import {
  keptAttachmentLines,
  withKeptAttachmentNotes,
  approxBase64Bytes,
  PDF_MAX_BYTES,
} from "../components/_shared/attachmentNotes";
import {
  ChatActionsContext,
  type ChatActions,
} from "../components/chat/ChatActionsContext";
import { TranslationsContext, getTranslations } from "../i18n";
import { useChatStore } from "../store/chat";
import { getProvider } from "../providers";
import { ProviderError, type ProviderMessage, type MessageAttachment } from "../providers/base";
import {
  getModelCapabilities,
  isGenerationModel,
  supportsThinking,
} from "../providers/modelCapabilities";
import {
  buildChatSystemPrompt,
  storeMessagesToProvider,
} from "../agent/conversation";
import { checkCompatibility } from "../providers/compatibility";
import { IncompatibleBanner } from "../components/composer/IncompatibleBanner";
import {
  ImageGenModal,
  type ImageModelOption,
} from "../generation/ImageGenModal";
import {
  effortToMaxTokensSmart,
  effortToVaultLookup,
  resolveEffortConfig,
  type EffortLevel,
} from "../components/_shared/effort";
import { hybridSearch } from "../rag/hybrid";
import { getContextWindow } from "../components/_shared/contextWindows";
import { useWakeLock } from "../components/_shared/useWakeLock";
import { setCloudTts } from "../components/_shared/speech";
import {
  saveChat,
  loadChat,
  renameChat,
  deleteChat,
  generateTitle,
  type ChatData,
  type ChatSummary,
} from "../components/_shared/chatPersistence";
import { Notice, Platform, TFile } from "obsidian";
import { ensureFolder } from "../components/_shared/chatPersistence";
import type { AxxaCommand } from "../components/composer/completions";
import type { ChatMessage, UserMessage, AIResponseMessage, AIErrorCode } from "../store/chat";
import {
  makeId,
  placeholderForMode,
  describeProviderError,
  providerNeedsKey,
} from "./axxaApp.helpers";
import { useProjectActions } from "./useProjectActions";
import { useGeneration } from "./useGeneration";
import { useChatEngine } from "./useChatEngine";
import { runAgentTurnImpl } from "./runAgentTurn";
import type { PendingAttachmentEntry } from "./chatTypes";

interface AxxaAppProps {
  plugin: AxxaPlugin;
}

export function AxxaApp({ plugin }: AxxaAppProps) {
  // Subscreve a saveSettings — quando user troca idioma (ou qualquer setting
  // reativo) re-renderiza pegando os novos valores do plugin.settings.
  const [, forceRender] = useState(0);
  useEffect(() => {
    const unsub = plugin.onSettingsChange(() => forceRender((n) => n + 1));
    return unsub;
  }, [plugin]);

  // (P1-48) Armadilha do provider errado: novato adiciona a key do Gemini,
  // mas o chip ativo segue OpenAI (sem key) e o 1º envio falha com "add your
  // key in Settings" — que ele ACABOU de fazer. A cada mudança de settings,
  // se o provider ativo está sem credencial e outro está configurado,
  // troca automaticamente pro primeiro configurado (com Notice discreto).
  useEffect(() => {
    const unsub = plugin.onSettingsChange(() => {
      const cur = plugin.settings.defaultProvider;
      if (providerConfigured(plugin, cur)) return;
      const firstOk = PROVIDERS.find((p) => providerConfigured(plugin, p.id));
      if (!firstOk) return;
      plugin.settings.defaultProvider = firstOk.id;
      setProviderSel(firstOk.id);
      new Notice(t.starter.providerAutoSwitched(firstOk.name));
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugin]);

  // Cloud TTS: quando o ★ TTS de Connections → Models aponta pra OpenAI e há
  // key, o read-aloud/Modo Voz passa a falar via nuvem; senão, nativo. v0.1.236
  const ttsRole = plugin.roleModel("tts");
  useEffect(() => {
    if (ttsRole && ttsRole.provider === "openai" && plugin.settings.openaiApiKey) {
      setCloudTts({
        provider: "openai",
        model: ttsRole.model,
        apiKey: plugin.settings.openaiApiKey,
      });
    } else {
      setCloudTts(null);
    }
  }, [ttsRole?.provider, ttsRole?.model, plugin.settings.openaiApiKey]);

  // (v0.1.242) Fullscreen v3: voltou como opt-in pelo menu do header. O toggle
  // só grava settings.mobileFullscreen; quem alterna as classes no chrome do
  // Obsidian é o AxxaView.applyFullscreen(). Default OFF e reversível.

  // Lê traduções na hora — atualiza no próximo render (após forceRender acima)
  const t = getTranslations(plugin.settings.language);

  const isLoading = useChatStore((s) => s.isLoading);
  const tokensIn = useChatStore((s) => s.tokensIn);
  const tokensOut = useChatStore((s) => s.tokensOut);
  const messages = useChatStore((s) => s.messages);
  const sessionProvider = useChatStore((s) => s.sessionProvider);
  const sessionModel = useChatStore((s) => s.sessionModel);
  const sessionMode = useChatStore((s) => s.sessionMode);
  const sessionPersona = useChatStore((s) => s.sessionPersona);
  const currentChatId = useChatStore((s) => s.currentChatId);
  const currentChatTitle = useChatStore((s) => s.currentChatTitle);
  const abortRef = useRef<AbortController | null>(null);
  /** Rascunho atual do composer — pra prefill do modal de imagem. #9 */
  const composerDraftRef = useRef("");
  /** "Aprovar todas" do diff-approval do agente — vale só pra rodada atual. */
  const agentApproveAllRef = useRef(false);

  // Mantém a tela ligada enquanto a IA gera (chat / agent / geração de mídia).
  // Evita que a tela apague por inatividade e congele o stream no mobile.

  // View state: chat (default) ou conversations (tela cheia de todas conversas)
  const [view, setView] = useState<AppView>("chat");
  // Plano efetivo (override de admin > entitlement real). Gateia telas pagas.
  const tier = getEffectiveTier(plugin.settings);
  const handleNavigate = (v: AppView) => setView(v);

  // Onboarding de 1º uso (#4): zero chaves de provider + ainda não dispensado.
  const hasAnyKey =
    [
      plugin.settings.openaiApiKey,
      plugin.settings.anthropicApiKey,
      plugin.settings.geminiApiKey,
      plugin.settings.openrouterApiKey,
      plugin.settings.nimApiKey,
    ].some((k) => (k ?? "").trim().length > 0);
  // Modo Voz / Skills / "tudo certo" overlays. v0.1.194
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [showAllSet, setShowAllSet] = useState(false);
  // (P1-13, a11y) Live region: anuncia início/fim da resposta pra leitores de
  // tela — sem isto o usuário envia e fica no silêncio absoluto.
  const [srAnnouncement, setSrAnnouncement] = useState("");
  const prevLoadingRef = useRef(false);
  useEffect(() => {
    if (isLoading && !prevLoadingRef.current) {
      setSrAnnouncement(t.chat.srResponding);
    } else if (!isLoading && prevLoadingRef.current) {
      setSrAnnouncement(t.chat.srResponseDone);
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, t]);

  // "Tudo certo!" auto-dispensa em 1.7s — timer com cleanup (evita update em
  // componente desmontado / timers acumulados). v0.1.195
  useEffect(() => {
    if (!showAllSet) return;
    const id = window.setTimeout(() => setShowAllSet(false), 1700);
    return () => window.clearTimeout(id);
  }, [showAllSet]);

  const finishOnboarding = async (openSettings: boolean) => {
    if (openSettings) {
      // (P1-40) O CTA "Add my first key" NÃO marca o onboarding como feito:
      // se o usuário cancelar as Settings sem key, o welcome volta — antes
      // um clique + cancelar perdia o welcome pra sempre.
      handleOpenSettings();
      return;
    }
    plugin.settings.onboardingDone = true;
    await plugin.saveSettings();
    // (auditoria jul/2026) "You're all set!" no SKIP era celebração invertida:
    // confirmava um setup que não aconteceu (zero keys). O skip agora dispensa
    // em silêncio; a celebração fica reservada pra quando houver key de fato.
  };
  // License key (#15) — salva e re-renderiza (tier recomputa). Notice do estado.
  const handleSetLicense = async (key: string) => {
    plugin.settings.licenseKey = key;
    await plugin.saveSettings();
    new Notice(isLicensePro(key) ? t.plans.licenseValid : t.plans.licenseInvalid);
  };
  // Busca dentro da conversa atual (toggle no Header → campo acima da ChatArea)
  // Alvo de destaque da busca (msg escolhida no modal). n = nonce p/ re-disparar.
  const [searchTarget, setSearchTarget] = useState<{
    id: string;
    n: number;
  } | null>(null);
  const [allChats, setAllChats] = useState<ChatSummary[]>([]);

  const [providerSel, setProviderSel] = useState(plugin.settings.defaultProvider);
  const [openaiModelSel, setOpenaiModelSel] = useState(plugin.settings.defaultModel);
  const [anthropicModelSel, setAnthropicModelSel] = useState(plugin.settings.anthropicModel);
  const [geminiModelSel, setGeminiModelSel] = useState(plugin.settings.geminiModel);
  const [openrouterModelSel, setOpenrouterModelSel] = useState(plugin.settings.openrouterModel);
  const [nimModelSel, setNimModelSel] = useState(plugin.settings.nimModel);
  const [ollamaModelSel, setOllamaModelSel] = useState(plugin.settings.ollamaModel);
  const [effort, setEffort] = useState(plugin.settings.defaultEffort);
  const [mode, setMode] = useState(
    plugin.settings.defaultMode === "vault-qa" ? "vault-qa" : "chat"
  );
  // Chat vazio aberto via "nova conversa" (gaveta/header) → base LIMPA
  // (NewChatScreen) em vez da StarterScreen. A StarterScreen só aparece no open
  // inicial do plugin. v0.1.219
  const [cleanChat, setCleanChat] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [recentChats, setRecentChats] = useState<ChatSummary[]>([]);
  // Todos os summaries da última varredura (null = carregando) — alimenta os
  // stats do dashboard da StarterScreen sem segunda passada no disco (v0.1.103).
  const [chatSummaries, setChatSummaries] = useState<ChatSummary[] | null>(null);

  // Mapeia provider id → modelo correspondente
  const modelFor = (providerId: string): string => {
    switch (providerId) {
      case "anthropic": return anthropicModelSel;
      case "gemini": return geminiModelSel;
      case "openrouter": return openrouterModelSel;
      case "nim": return nimModelSel;
      case "ollama": return ollamaModelSel;
      default: return openaiModelSel;
    }
  };

  // Mapeia provider id → API key (centralizado pra um lugar só).
  // Pra Ollama, "apiKey" carrega o endpoint (provider trata como URL).
  const apiKeyFor = (providerId: string): string => {
    switch (providerId) {
      case "anthropic": return plugin.settings.anthropicApiKey;
      case "gemini": return plugin.settings.geminiApiKey;
      case "openrouter": return plugin.settings.openrouterApiKey;
      case "nim": return plugin.settings.nimApiKey;
      case "ollama": return plugin.settings.ollamaEndpoint;
      default: return plugin.settings.openaiApiKey;
    }
  };

  const activeProviderId = sessionProvider ?? providerSel;
  const activeProvider = getProvider(activeProviderId);
  const activeModel = sessionModel ?? modelFor(activeProviderId);
  const activeMode = sessionMode ?? mode;
  const isLocked = sessionProvider !== null;

  const starterModel = modelFor(providerSel);

  // Estilo de resposta global (espelha plugin.settings.responseStyle) — state
  // só pra reatividade do PlusModal. v0.1.189
  const [responseStyle, setResponseStyle] = useState(
    plugin.settings.responseStyle
  );

  // Projetos (ref: ChatGPT iOS 182/187/189). State espelha settings. v0.1.191
  const [projects, setProjects] = useState<Project[]>(
    plugin.settings.projects ?? []
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  // null = editor fechado; { project?: Project } = aberto (novo ou editando).
  const [projectEditor, setProjectEditor] = useState<
    null | { project?: Project }
  >(null);
  // Projeto pendente: ao começar "nova conversa neste projeto", a associação
  // chat↔projeto acontece no 1º send (quando o chat id é criado).
  const pendingProjectIdRef = useRef<string | null>(null);
  // (P1-28) Anexos do ÚLTIMO envio — repassados no retryError do mesmo turno.
  const lastSendAttachmentsRef = useRef<MessageAttachment[] | undefined>(undefined);

  // Ações de projeto extraídas → useProjectActions (Frente 2). persistProjects é
  // retornado porque handleSend e a edição de mensagem também o reusam.
  const {
    persistProjects,
    handleSaveProject,
    handleDeleteProject,
    handleAddProjectSource,
    handleRemoveProjectSource,
  } = useProjectActions(plugin, t, {
    projectEditor,
    setProjects,
    setProjectEditor,
    setSelectedProjectId,
  });

  // Modo Voz (ref: ChatGPT iOS 133/140, Grok 63/66). v0.1.192
  const [voiceOpen, setVoiceOpen] = useState(false);
  // (P1-91/93) Wake lock cobre o stream E o Modo Voz inteiro — no loop
  // hands-free a tela apagava entre falas e matava a conversa de voz.
  useWakeLock(isLoading || voiceOpen);
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  // Favoritos do seletor de modelo — chaves "provider::model" (≤5 por provider).
  // Só esses aparecem no bottom sheet; o resto vive no "More models". v0.1.236
  const [favoriteModels, setFavoriteModels] = useState<string[]>(
    plugin.settings.favoriteModels ?? []
  );
  const handleToggleFavorite = (model: string) => {
    const key = `${activeProviderId}::${model}`;
    setFavoriteModels((prev) => {
      let next: string[];
      if (prev.includes(key)) {
        next = prev.filter((k) => k !== key);
      } else {
        const count = prev.filter((k) =>
          k.startsWith(`${activeProviderId}::`)
        ).length;
        if (count >= 5) return prev; // teto de 5 por provider
        next = [...prev, key];
      }
      plugin.settings.favoriteModels = next;
      void plugin.saveSettings();
      return next;
    });
  };
  const [voiceURI, setVoiceURI] = useState(plugin.settings.voiceURI);
  const [voiceRate, setVoiceRate] = useState(plugin.settings.voiceRate);
  const [voiceIntroDone, setVoiceIntroDone] = useState(
    plugin.settings.voiceIntroDone
  );
  const handleChangeVoice = async (uri: string) => {
    setVoiceURI(uri);
    plugin.settings.voiceURI = uri;
    await plugin.saveSettings();
  };
  const handleChangeVoiceRate = async (rate: number) => {
    setVoiceRate(rate);
    plugin.settings.voiceRate = rate;
    await plugin.saveSettings();
  };
  const handleVoiceIntroDone = async () => {
    setVoiceIntroDone(true);
    plugin.settings.voiceIntroDone = true;
    await plugin.saveSettings();
  };

  const handleNewChatInProject = async (project: Project) => {
    abortRef.current?.abort();
    useChatStore.getState().newChat();
    pendingProjectIdRef.current = project.id;
    // Pré-anexa as fontes do projeto como notas de contexto.
    // v0.1.228: valida TFile antes de ler (evita ler pasta/path inválido) e
    // junta as fontes que sumiram num Notice agregado, em vez de engolir cada erro.
    const entries: PendingAttachmentEntry[] = [];
    const missing: string[] = [];
    for (const src of project.sources) {
      const file = plugin.app.vault.getAbstractFileByPath(src);
      if (!(file instanceof TFile)) {
        missing.push(src.split("/").pop() ?? src);
        continue;
      }
      try {
        const content = await plugin.app.vault.cachedRead(file);
        entries.push({
          id: makeAttachmentId(),
          attachment: { type: "note", path: src, content },
          name: src.split("/").pop() ?? src,
        });
      } catch {
        missing.push(src.split("/").pop() ?? src);
      }
    }
    if (missing.length > 0) {
      new Notice(t.projects.sourcesMissing(missing.join(", ")));
    }
    setPendingAttachments(entries);
    setSelectedProjectId(null);
    setView("chat");
  };

  // Estilo de resposta global (ref: Claude "Choose style") → instrução anexada
  // ao system prompt. "normal" não adiciona nada. v0.1.189
  const resolveStyleInstruction = (): string => {
    switch (plugin.settings.responseStyle) {
      case "concise": return t.responseStyle.instrConcise;
      case "explanatory": return t.responseStyle.instrExplanatory;
      case "formal": return t.responseStyle.instrFormal;
      case "friendly": return t.responseStyle.instrFriendly;
      default: return "";
    }
  };

  // ============================================================
  // Carrega lista de chats quando chat tá vazio — UMA varredura só:
  // recentes = slice(0,8); o array completo vai pros stats do dashboard.
  // (listAllChats lê todos os .md de qualquer jeito; o limit só corta depois)
  // ============================================================
  const isEmpty = messages.length === 0;
  // (P1-38) Compartilhado entre o branch de render e o gate do Composer.
  const showOnboarding =
    view === "chat" &&
    isEmpty &&
    !plugin.settings.onboardingDone &&
    !hasAnyKey;

  // Prompt starters da StarterScreen v2 → injeta texto no Composer + foca.
  // Cada starter bumpa o nonce pra reescrever o doc do editor. v0.1.131
  const [composerInject, setComposerInject] = useState<
    { text: string; nonce: number } | undefined
  >(undefined);
  // Editor do composer vazio? Gateia os balões de sugestão (somem ao digitar).
  // Flip-guarded: só re-renderiza quando cruza a fronteira vazio↔texto (não a
  // cada tecla — o rascunho em si continua num ref pra não re-renderizar tudo).
  const [composerEmpty, setComposerEmpty] = useState(true);
  // "See more" dos balões → bottom sheet com a lista completa do modo (ou null).
  const [suggestSheetOpen, setSuggestSheetOpen] = useState(false);

  // Gaveta lateral (avatar do header) com as conversas. v0.1.145
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Nonce GLOBAL monotônico (v0.1.237): o nonce derivado do prev colidia
  // quando um setComposerInject(undefined) entrava no mesmo tick (skill com
  // `mode` via slash: handleStarterMode limpa → handlePromptStarter recomeça
  // do zero → nonce repete → Composer ignora a injeção silenciosamente).
  const injectNonceRef = useRef(0);
  const handlePromptStarter = (text: string) => {
    injectNonceRef.current += 1;
    setComposerInject({ text, nonce: injectNonceRef.current });
  };

  // Carregamento ÚNICO das conversas (v0.1.175): UM disk-walk cacheado no
  // plugin, reusado por TODOS (Starter/Sidebar/Conversas/Statistics). Antes cada
  // tela fazia seu próprio listAllChats → várias passadas = abrir lento. Aqui
  // só sincronizamos os estados locais com o cache (e a cada mudança dele).
  useEffect(() => {
    // v0.1.228: guard `alive` evita setState após desmontar (loadChatSummaries
    // resolve async; sem o guard o .then() podia bater num componente já morto).
    let alive = true;
    const sync = () => {
      if (!alive) return;
      const all = plugin.chatSummaries ?? [];
      setAllChats(all);
      setChatSummaries(all);
      setRecentChats(all.slice(0, 8));
    };
    plugin.loadChatSummaries().then(sync);
    const unsub = plugin.onChatsChange(sync);
    return () => {
      alive = false;
      unsub();
    };
  }, [plugin]);

  // ============================================================
  // Auto-save debounced — escreve .axxa/chats/chat/[id].md
  // ============================================================
  // (auditoria jul/2026) Dois guarda-chuvas:
  //  - justLoadedRef: abrir uma conversa antiga dispara o effect (messages
  //    mudou na reidratação) e REGRAVAVA o arquivo com date=agora — o
  //    histórico reordenava sozinho. Pula UM ciclo após o load.
  //  - pendingSaveRef: o debounce de 500ms era só clearTimeout no cleanup —
  //    fechar a view logo após a última mudança PERDIA o save. No unmount,
  //    flusha o save pendente em vez de descartar.
  const justLoadedRef = useRef(false);
  const pendingSaveRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    if (!currentChatId) return;
    if (justLoadedRef.current) {
      justLoadedRef.current = false;
      return;
    }
    const doSave = () => {
      pendingSaveRef.current = null;
      const userOrAi = messages.filter(
        (m): m is UserMessage | AIResponseMessage =>
          m.type === "user" ||
          // Erros (isError) não são persistidos — são efêmeros por design
          (m.type === "ai-response" && !m.isError)
      );
      if (userOrAi.length === 0) return;
      const chat: ChatData = {
        id: currentChatId,
        title: currentChatTitle || generateTitle(userOrAi[0].content),
        date: new Date().toISOString(),
        mode: activeMode,
        provider: activeProviderId,
        model: activeModel,
        effort,
        tokensIn,
        tokensOut,
        persona: useChatStore.getState().sessionPersona || undefined,
        messages: userOrAi.map((m) => ({
          type: m.type as "user" | "ai-response",
          content: m.content,
          timestamp: m.timestamp,
          // Persiste reaction quando ai-response (like/dislike sobrevive reload)
          ...(m.type === "ai-response" && (m as AIResponseMessage).reaction
            ? { reaction: (m as AIResponseMessage).reaction }
            : {}),
          // Persiste as ações do agent (continuidade de contexto). v0.1.160
          ...(m.type === "ai-response" &&
          (m as AIResponseMessage).agentSteps?.length
            ? { agentSteps: (m as AIResponseMessage).agentSteps }
            : {}),
        })),
      };
      saveChat(plugin.app, plugin.settings.chatsPath, chat)
        .then((path) => {
          // Upsert INCREMENTAL no cache compartilhado — mantém as listas em dia
          // (Starter/Sidebar/Conversas) sem re-ler o disco. v0.1.175
          plugin.upsertChatSummary({
            id: chat.id,
            title: chat.title,
            date: chat.date,
            mode: chat.mode,
            provider: chat.provider,
            model: chat.model,
            effort: chat.effort,
            tokensIn: chat.tokensIn,
            tokensOut: chat.tokensOut,
            messageCount: chat.messages.length,
            filePath: path,
          });
        })
        .catch((err) => console.error("[axxa] saveChat falhou:", err));
    };
    pendingSaveRef.current = doSave;
    const timer = window.setTimeout(doSave, 500);
    return () => window.clearTimeout(timer);
  }, [
    messages,
    currentChatId,
    currentChatTitle,
    activeMode, // v0.1.228: snapshot salvo refletia mode stale (faltava na dep array)
    activeProviderId,
    activeModel,
    effort,
    tokensIn,
    tokensOut,
    sessionPersona,
    plugin.app,
    plugin.settings.chatsPath,
  ]);
  // Flush no unmount: se a view fecha com um save agendado, grava AGORA em
  // vez de descartar (o clearTimeout do cleanup acima só cobre re-agendamento).
  useEffect(
    () => () => {
      pendingSaveRef.current?.();
    },
    []
  );

  // ============================================================
  // Handlers
  // ============================================================

  // Motor de chat (stream) extraído → useChatEngine (Frente 2).
  const { streamReply } = useChatEngine({
    plugin,
    t,
    abortRef,
    activeProviderId,
    activeProvider,
    activeModel,
    activeMode,
    apiKeyFor,
    effort,
    resolveStyleInstruction,
  });

  // ============================================================
  // Agent loop — STREAMING + tool calls (v0.1.40)
  //
  // Flow:
  //   1. Monta history com system prompt + tools disponíveis
  //   2. Chama provider.streamChat() pra cada turno — tokens vêm via onToken
  //      e alimentam um ai-response message (sticky-bottom scroll funciona)
  //   3. Retorno do streamChat tem o estado final (text + tool_calls + usage)
  //   4. Se tem toolCalls: pra cada uma → check permission → executa
  //   5. Loop até resposta sem tools (final answer)
  //
  // Por que streaming agora?
  //   - User vê os tokens chegando (igual chat mode)
  //   - Token/s metric funciona
  //   - Sticky-bottom scroll triggered por updates de message
  //   - Provider sem streaming real (NIM) cai num pseudo-stream que ainda
  //     emite onToken — UX consistente
  // ============================================================
  const runAgentTurn = (
    userText: string,
    userAttachments?: import("../providers/base").MessageAttachment[]
  ) =>
    runAgentTurnImpl(
      {
        plugin,
        t,
        abortRef,
        agentApproveAllRef,
        activeProviderId,
        activeProvider,
        activeModel,
        activeMode,
        apiKeyFor,
        effort,
        resolveStyleInstruction,
        pendingAttachments,
        setPendingAttachments,
        buildImageModelOptions,
        runImageGeneration,
      },
      userText,
      userAttachments
    );

  // Anexos pendentes (multi-tipo) — limpa após envio.
  // Cada attachment ganha id estável pra UI tracking — não persiste no .md.
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachmentEntry[]>([]);
  const makeAttachmentId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Toggles do PlusModal (webSearch, createImage, extendedThinking) — estado
  // local. Cada provider/modelo decide se respeita. Persistência é da sessão.
  const [plusToggles, setPlusToggles] = useState<Record<string, boolean>>({});

  // Dismissed banner state — chave = `${mode}::${provider}::${model}` pra
  // reaparecer se user mudar qualquer um dos 3. Sessão only.
  const [dismissedBannerKey, setDismissedBannerKey] = useState<string | null>(null);

  // Compatibilidade ATUAL do combo modo+provider+modelo+anexos.
  // Recomputado a cada render (cheap — só checa flags). null se não há issue.
  const activeModelsList =
    plugin.settings.activeModels?.[activeProviderId] ?? [];
  const hasImageAttachment = pendingAttachments.some(
    (p) => p.attachment.type === "image"
  );
  const compatibility = checkCompatibility(
    activeMode,
    activeProviderId,
    activeModel,
    activeModelsList,
    hasImageAttachment
  );
  const bannerKey = `${activeMode}::${activeProviderId}::${activeModel}`;
  const showBanner = !compatibility.ok && dismissedBannerKey !== bannerKey;

  const handleSend = async (text: string) => {
    const { addMessage, lockSession, setCurrentChatId, setCurrentChatTitle } =
      useChatStore.getState();

    // (P1-16) Envio attachment-only: o texto vira a lista de anexos — a bolha
    // e o título do chat não ficam vazios, e o modelo recebe um contexto útil.
    if (!text.trim() && pendingAttachments.length > 0) {
      text = pendingAttachments.map((p) => p.name).join(", ");
    }

    // (P1-49) Pre-flight de key ANTES de travar a sessão/criar o chat id:
    // sem isto o 1º envio sem key persistia um chat-fantasma (só a pergunta)
    // nos Recents, e reabri-lo não mostrava erro nenhum.
    if (
      messages.length === 0 &&
      providerNeedsKey(activeProviderId) &&
      !apiKeyFor(activeProviderId).trim()
    ) {
      addMessage({
        type: "ai-response",
        content: `${t.ai.errorPrefix} ${t.ai.err.noKey(activeProvider.name)}`,
        isError: true,
        errorCode: "no-key",
      });
      return;
    }

    // Primeira msg da sessão → cria chat ID, gera título, trava session
    if (messages.length === 0) {
      const newId = makeId();
      setCurrentChatId(newId);
      setCurrentChatTitle(generateTitle(text));
      lockSession(activeProviderId, activeModel, activeMode);
      // Associa o chat recém-criado ao projeto pendente (se houver). v0.1.191
      if (pendingProjectIdRef.current) {
        const pid = pendingProjectIdRef.current;
        pendingProjectIdRef.current = null;
        void persistProjects((prev) =>
          prev.map((p) =>
            p.id === pid && !p.chatIds.includes(newId)
              ? { ...p, chatIds: [newId, ...p.chatIds] }
              : p
          )
        );
      }
    }

    // Prepara attachments pra envio. Filtros aplicados em streamReply/runAgentTurn:
    //  - imagens só vão se o modelo aceita vision
    //  - PDF só vai se o modelo/transporte aceita (caps.pdf) — v0.1.248
    //  - notas viram bloco de contexto markdown no system prompt
    //  - áudio passa como meta (ignorado no wire por enquanto)
    const caps = getModelCapabilities(activeProviderId, activeModel);
    const attachments =
      pendingAttachments.length > 0
        ? pendingAttachments
            .map((p) => p.attachment)
            .filter((a) =>
              a.type === "image"
                ? caps.vision
                : a.type === "pdf"
                ? !!caps.pdf
                : true
            )
        : undefined;
    // (P1-28) Guarda os anexos do turno pro retry: erro transitório numa msg
    // com imagem re-tentava SEM a imagem, silenciosamente.
    lastSendAttachmentsRef.current = attachments;

    // Áudio → TEXTO antes do envio (v0.1.249). O transcript entra no corpo da
    // mensagem, então é literalmente o que o modelo lê — fim do "gravei, mandei
    // e a IA ignorou". Falha de transcrição não derruba o envio: cai no aviso
    // honesto de antes.
    const transcripts = await transcribePendingAudio(pendingAttachments);

    // User msg salva sem attachments no store (pra simplicidade do auto-save .md).
    // O propagation pro provider acontece via parâmetro adicional pra streamReply/runAgentTurn.
    // O rastro em texto sobrevive ao reload: transcript do áudio, recibo do PDF
    // enviado, aviso honesto quando o modelo não aceita. Sem isso o chip sumia
    // no send e o anexo desaparecia da conversa.
    const keptLines = keptAttachmentLines(
      pendingAttachments.map((p) => ({
        type: p.attachment.type,
        path: (p.attachment as { path?: string }).path,
        name: p.name,
        sent: p.attachment.type === "pdf" && !!caps.pdf,
        transcript: transcripts.get(p.id),
      })),
      {
        audio: t.composer.audioKeptNote,
        pdf: t.composer.pdfKeptNote,
        pdfSent: t.composer.pdfSentNote,
        audioTranscript: t.composer.audioTranscriptNote,
      }
    );
    addMessage({
      type: "user",
      content: withKeptAttachmentNotes(text, keptLines),
    });
    setPendingAttachments([]);

    // Se o modelo ativo é de generation (imageGen/audioGen/videoGen), roteia
    // pra runGenerationTurn em vez de chat — gera mídia + salva no vault.
    if (isGenerationModel(caps)) {
      await runGenerationTurn(text, caps);
      return;
    }

    // Dispatch baseado no modo: agent usa loop com tools, demais usa streamReply
    if (activeMode === "agent") {
      await runAgentTurn(text, attachments);
    } else {
      await streamReply(text, attachments);
    }
  };

  // ============================================================
  // Generation turn — chama generateImage/Audio/Video conforme as caps
  // do modelo, salva o resultado em axxa-ai/generation/{type}/ + sidecar .md
  // com frontmatter, e renderiza a mídia inline na conversa.
  // ============================================================
  // Geração de mídia (img/áudio/vídeo) extraída → useGeneration (Frente 2).
  // runGenerationTurn é retornado porque handleSend/regenerate/retry o reusam.
  const {
    runGenerationTurn,
    buildImageModelOptions,
    runImageGeneration,
    handleCreateImage,
    lastImageGenRef,
  } = useGeneration({
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
  });

  // (P1-57) Reconstrói o contexto do vault pro regenerate/continue no modo
  // vault-qa — sem isto a nova variante respondia "de cabeça", sem busca,
  // e a queda de qualidade era silenciosa. Mesmo formato do streamReply.
  const fetchVaultContextForRetry = async (query: string): Promise<string> => {
    if (activeMode !== "vault-qa" || !query) return "";
    try {
      const { topK, excerptChars } = effortToVaultLookup(
        effort,
        plugin.settings.effortConfigs
      );
      const hits = await hybridSearch({
        app: plugin.app,
        index: plugin.vectorIndex,
        creds: {
          openaiApiKey: plugin.settings.openaiApiKey,
          openrouterApiKey: plugin.settings.openrouterApiKey,
          geminiApiKey: plugin.settings.geminiApiKey,
          nimApiKey: plugin.settings.nimApiKey,
        },
        query,
        topK,
        excerptChars,
      });
      if (hits.length === 0) return "";
      return hits
        .map((h) => {
          const base = h.path.replace(/\.md$/i, "").split("/").pop() ?? h.path;
          return `### [[${base}]]\n_(${h.path})_\n\n${h.text}`;
        })
        .join("\n\n---\n\n");
    } catch {
      return "";
    }
  };

  // Regenerar: remove o ai-response (e qualquer msg posterior) e re-roda
  // streamReply usando a user-msg que precedia. Ignora se já tá streamando.
  // Regenerar com BRANCHING: a resposta atual vira uma variante e a nova é
  // gerada NA MESMA bolha — o user navega entre versões com ‹ N/M ›.
  const handleRegenerate = async (aiMessageId: string) => {
    if (useChatStore.getState().isLoading) return;
    // (P1-57, caso quebrado) Modelo de geração não conversa — streamChat
    // nele estoura erro depois de já ter esvaziado a bolha. Regenerar mídia
    // é re-enviar o prompt (o retry da bolha de erro já faz o caminho certo).
    if (isGenerationModel(getModelCapabilities(activeProviderId, activeModel))) {
      new Notice(t.ai.regenNotForGeneration);
      return;
    }
    // (P1-58) Pre-flight de key ANTES do beginVariant — sem key o fluxo
    // esvaziava a bolha e só então falhava.
    if (
      providerNeedsKey(activeProviderId) &&
      !apiKeyFor(activeProviderId).trim()
    ) {
      useChatStore.getState().addMessage({
        type: "ai-response",
        content: `${t.ai.errorPrefix} ${t.ai.err.noKey(activeProvider.name)}`,
        isError: true,
        errorCode: "no-key",
      });
      return;
    }
    const current = useChatStore.getState().messages;
    const aiIdx = current.findIndex(
      (m) => m.id === aiMessageId && m.type === "ai-response"
    );
    if (aiIdx < 0) return;

    // (P1-57) Modo AGENT: regenerar re-roda o TURNO com tools — o streamChat
    // puro produzia um completion sem tools (o agente "perdia as mãos").
    // O run recria as mensagens do turno; variantes não se aplicam ao agent.
    if (activeMode === "agent") {
      let agentUserIdx = -1;
      for (let i = aiIdx; i >= 0; i--) {
        if (current[i].type === "user") {
          agentUserIdx = i;
          break;
        }
      }
      if (agentUserIdx < 0) return;
      const agentUserText = (current[agentUserIdx] as UserMessage).content;
      useChatStore.getState().setMessages(current.slice(0, agentUserIdx + 1));
      await runAgentTurn(agentUserText);
      return;
    }

    // Remove só o que vem DEPOIS da resposta — a bolha fica e vira variante.
    useChatStore.getState().setMessages(current.slice(0, aiIdx + 1));

    const {
      beginVariant,
      syncVariant,
      appendToMessage,
      setLoading,
      setStreamingMessageId,
      setAgentSteps,
      addUsage,
      startStreamTimer,
      tickStreamTokens,
      endStreamTimer,
    } = useChatStore.getState();

    // History = tudo ANTES da resposta sendo regenerada (sem erros).
    const before = current
      .slice(0, aiIdx)
      .filter(
        (m) => m.type === "user" || (m.type === "ai-response" && !m.isError)
      ) as Array<UserMessage | AIResponseMessage>;
    // (P1-57) Vault Q&A: refaz a busca pro contexto entrar na regeneração.
    const lastUserBefore = [...before].reverse().find((m) => m.type === "user");
    const regenVaultBlock = await fetchVaultContextForRetry(
      lastUserBefore?.content ?? ""
    );
    const history: ProviderMessage[] = [
      {
        role: "system",
        content: buildChatSystemPrompt({
          persona: useChatStore.getState().sessionPersona,
          base: t.systemPrompt.base,
          styleInstruction: resolveStyleInstruction(),
          vaultSuffix: t.systemPrompt.vaultQaSuffix,
          vaultBlock: regenVaultBlock,
        }),
      },
      ...storeMessagesToProvider(before),
    ];

    beginVariant(aiMessageId); // arquiva a versão atual + abre variante vazia
    setLoading(true);
    setStreamingMessageId(aiMessageId);
    const effortCfg = resolveEffortConfig(effort, plugin.settings.effortConfigs);
    const maxTokens = effortToMaxTokensSmart(
      effort,
      getContextWindow(activeModel),
      plugin.settings.effortConfigs
    );
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      startStreamTimer();
      await activeProvider.streamChat(
        {
          model: activeModel,
          messages: history,
          maxTokens,
          temperature: effortCfg.temperature,
        },
        apiKeyFor(activeProviderId),
        (token) => {
          appendToMessage(aiMessageId, token);
          tickStreamTokens(token);
        },
        (usage) => addUsage(usage.input, usage.output),
        controller.signal
      );
      endStreamTimer();
      syncVariant(aiMessageId);
    } catch (err) {
      syncVariant(aiMessageId);
      // (P1-58) Variante que ficou VAZIA é descartada — restaura a versão
      // anterior em vez de exibir uma bolha em branco ‹2/2›.
      useChatStore.getState().discardEmptyVariant(aiMessageId);
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.error("[axxa] regenerar falhou:", err);
        const { message, code } = describeProviderError(err, t, activeProvider.name);
        // Erro como BOLHA acionável (retry/settings), não Notice efêmero.
        useChatStore.getState().addMessage({
          type: "ai-response",
          content: `${t.ai.errorPrefix} ${message}`,
          isError: true,
          errorCode: code,
        });
      }
    } finally {
      setLoading(false);
      setStreamingMessageId(null);
      endStreamTimer();
      abortRef.current = null;
    }
  };

  // Continuar: emenda uma resposta cortada no limite de tokens NA MESMA bolha.
  // Manda o history até a resposta + um nudge "continue de onde parou" e
  // appenda os novos tokens à mesma ai-response (não cria bolha nova).
  const continueReply = async (aiMessageId: string) => {
    const snapshot = useChatStore.getState();
    if (snapshot.isLoading) return;
    const msgs = snapshot.messages;
    const idx = msgs.findIndex(
      (m) => m.id === aiMessageId && m.type === "ai-response"
    );
    if (idx < 0) return;

    // v0.1.228: mesmo pre-flight de chave do streamReply — sem API key nem
    // adianta tentar continuar (evita marcar truncated e injetar espaço à toa).
    if (
      providerNeedsKey(activeProviderId) &&
      !apiKeyFor(activeProviderId).trim()
    ) {
      new Notice(`${t.ai.errorPrefix} ${t.ai.err.noKey(activeProvider.name)}`);
      return;
    }

    const {
      appendToMessage,
      setTruncated,
      setLoading,
      setStreamingMessageId,
      setAgentSteps,
      addUsage,
      startStreamTimer,
      tickStreamTokens,
      endStreamTimer,
    } = useChatStore.getState();

    setTruncated(aiMessageId, false);
    setLoading(true);
    setStreamingMessageId(aiMessageId);

    const hist = msgs
      .slice(0, idx + 1)
      .filter(
        (m) => m.type === "user" || (m.type === "ai-response" && !m.isError)
      ) as Array<UserMessage | AIResponseMessage>;
    // (P1-57) Vault Q&A: a continuação leva o mesmo contexto do vault da
    // pergunta original — sem isto continuava "de cabeça".
    const contUserMsg = [...hist].reverse().find((m) => m.type === "user");
    const contVaultBlock = await fetchVaultContextForRetry(
      contUserMsg?.content ?? ""
    );
    const history: ProviderMessage[] = [
      {
        role: "system",
        content: buildChatSystemPrompt({
          persona: useChatStore.getState().sessionPersona,
          base: t.systemPrompt.base,
          styleInstruction: resolveStyleInstruction(),
          vaultSuffix: t.systemPrompt.vaultQaSuffix,
          vaultBlock: contVaultBlock,
        }),
      },
      ...storeMessagesToProvider(hist),
      {
        role: "user",
        content:
          "Continue EXACTLY where you left off — do not repeat or reintroduce anything you already wrote.",
      },
    ];

    const effortCfg = resolveEffortConfig(effort, plugin.settings.effortConfigs);
    const maxTokens = effortToMaxTokensSmart(
      effort,
      getContextWindow(activeModel),
      plugin.settings.effortConfigs
    );
    let lastOutputTokens = 0;
    const controller = new AbortController();
    abortRef.current = controller;

    // v0.1.228: emenda o espaço só QUANDO o primeiro token de continuação chega
    // (antes era cego: se o stream falhava imediatamente, a bolha ficava com um
    // espaço solto sem nenhuma continuação emendada).
    let firstContinuationToken = true;
    try {
      startStreamTimer();
      await activeProvider.streamChat(
        {
          model: activeModel,
          messages: history,
          maxTokens,
          temperature: effortCfg.temperature,
        },
        apiKeyFor(activeProviderId),
        (token) => {
          if (firstContinuationToken) {
            // Espaço antes pra não colar a continuação na última palavra.
            appendToMessage(aiMessageId, " ");
            firstContinuationToken = false;
          }
          appendToMessage(aiMessageId, token);
          tickStreamTokens(token);
        },
        (usage) => {
          lastOutputTokens = usage.output;
          addUsage(usage.input, usage.output);
        },
        controller.signal
      );
      endStreamTimer();
      // Cortou de novo? Mantém o botão pra continuar mais uma vez.
      if (lastOutputTokens > 0 && lastOutputTokens >= maxTokens * 0.95) {
        setTruncated(aiMessageId, true);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // (P1-72) Abortar a CONTINUAÇÃO não pode matar o botão Continuar
        // pra sempre — restaura o truncated e o usuário retoma quando quiser.
        setTruncated(aiMessageId, true);
      } else {
        console.error("[axxa] continue falhou:", err);
        const { message } = describeProviderError(err, t, activeProvider.name);
        new Notice(`${t.ai.errorPrefix} ${message}`);
        // Deixa o botão disponível pra tentar de novo
        setTruncated(aiMessageId, true);
      }
    } finally {
      setLoading(false);
      setStreamingMessageId(null);
      endStreamTimer();
      abortRef.current = null;
    }
  };

  // Deletar: remove msg. Se for user-msg, remove também o ai-response
  // imediatamente a seguir (manter o par alinhado).
  const handleDeleteMessage = (messageId: string) => {
    const current = useChatStore.getState().messages;
    const idx = current.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    const msg = current[idx];
    if (msg.type === "user") {
      const next = current[idx + 1];
      if (next && next.type === "ai-response") {
        useChatStore
          .getState()
          .setMessages([...current.slice(0, idx), ...current.slice(idx + 2)]);
        return;
      }
    }
    useChatStore.getState().removeMessage(messageId);
  };

  // Editar: trunca a conversa a partir da user-msg editada e re-envia o texto
  // novo (gera resposta nova). Mesmo dispatch do handleSend (agent vs chat).
  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (useChatStore.getState().isLoading) return;
    const current = useChatStore.getState().messages;
    const idx = current.findIndex(
      (m) => m.id === messageId && m.type === "user"
    );
    if (idx < 0) return;
    const text = newContent.trim();
    if (!text) return;

    const caps = getModelCapabilities(activeProviderId, activeModel);
    // Reanexa o que estiver pendente no compositor (mesma regra do handleSend:
    // imagem só se o modelo tem visão). Edição raramente tem anexos, mas se
    // houver, segue o mesmo caminho do envio normal. v0.1.227
    const attachments =
      pendingAttachments.length > 0
        ? pendingAttachments
            .map((p) => p.attachment)
            .filter((a) => (a.type === "image" ? caps.vision : true))
        : undefined;

    useChatStore.getState().setMessages(current.slice(0, idx));
    useChatStore.getState().addMessage({ type: "user", content: text });
    setPendingAttachments([]);

    // Mesmo dispatch do handleSend: generation → runGenerationTurn (antes não
    // roteava, então editar a prompt de um modelo de imagem/áudio/vídeo dava
    // erro), agent → runAgentTurn, senão streamReply. v0.1.227
    if (isGenerationModel(caps)) await runGenerationTurn(text, caps);
    else if (activeMode === "agent") await runAgentTurn(text, attachments);
    else await streamReply(text, attachments);
  };

  // "Tentar de novo" da bolha de erro: diferente do regenerate (que ramifica a
  // resposta), aqui DESCARTA a bolha de erro + o "Pensando..." que falhou e
  // re-dispara o MESMO turno (chat / vault-qa / agent / generation) a partir da
  // última user-msg. Resultado limpo, sem variante de erro pendurada. v0.1.147
  const retryError = async (errorMessageId: string) => {
    if (useChatStore.getState().isLoading) return;
    const current = useChatStore.getState().messages;
    const errIdx = current.findIndex(
      (m) => m.id === errorMessageId && m.type === "ai-response"
    );
    if (errIdx < 0) return;
    // Acha a última user-msg antes do erro.
    let userIdx = -1;
    for (let i = errIdx; i >= 0; i--) {
      if (current[i].type === "user") {
        userIdx = i;
        break;
      }
    }
    if (userIdx < 0) return;
    const userText = (current[userIdx] as UserMessage).content;
    // Volta o histórico pro estado logo após a user-msg (remove erro + comments).
    useChatStore.getState().setMessages(current.slice(0, userIdx + 1));
    // (P1-31) Turno de geração via modal (user msg "🖼️ prompt"): o retry
    // re-invoca a MESMA geração — antes caía no modelo de CHAT ativo e o
    // usuário recebia um parágrafo sobre a imagem em vez da imagem.
    if (userText.startsWith("🖼️") && lastImageGenRef.current) {
      const { providerId, model } = lastImageGenRef.current;
      const genPrompt = userText.replace(/^🖼️\s*/, "");
      useChatStore.getState().setLoading(true);
      const genController = new AbortController();
      abortRef.current = genController;
      try {
        await runImageGeneration(
          genPrompt,
          providerId,
          model,
          undefined,
          genController.signal
        );
      } finally {
        useChatStore.getState().setLoading(false);
        if (abortRef.current === genController) abortRef.current = null;
      }
      return;
    }
    const caps = getModelCapabilities(activeProviderId, activeModel);
    // (P1-28) Se o erro pertence ao ÚLTIMO turno enviado, o retry leva os
    // mesmos anexos do envio original (imagem/nota não somem no re-envio).
    const lastUserIdx = current.reduce(
      (acc, m, i) => (m.type === "user" ? i : acc),
      -1
    );
    const retryAttachments =
      userIdx === lastUserIdx ? lastSendAttachmentsRef.current : undefined;
    if (isGenerationModel(caps)) await runGenerationTurn(userText, caps);
    else if (activeMode === "agent") await runAgentTurn(userText, retryAttachments);
    else await streamReply(userText, retryAttachments);
  };

  const chatActions: ChatActions = {
    regenerate: handleRegenerate,
    deleteMessage: handleDeleteMessage,
    continueResponse: continueReply,
    editMessage: handleEditMessage,
    retryError,
    // Arrow defere o lookup pra DEPOIS de handleOpenSettings ser inicializado
    // (ele é declarado mais abaixo — evita o temporal dead zone).
    openSettings: () => handleOpenSettings(),
    startNewChat: () => handleNewChat(),
    saveResponseAsNote: (content: string) => void handleSaveResponseAsNote(content),
  };

  const handleStop = () => abortRef.current?.abort();

  // (P1-66/68) Aplicar uma skill: valida o `mode` do frontmatter, avisa
  // quando a sessão está travada (antes: ignorado em silêncio), troca o modo
  // SEM persistir defaultMode (era efeito colateral surpresa), e PRESERVA o
  // rascunho já digitado — o template entra abaixo dele, não por cima.
  const applySkill = (skill: (typeof plugin.skills)[number]) => {
    const SKILL_MODES = ["chat", "vault-qa", "agent"];
    if (skill.mode && skill.mode !== mode) {
      if (!SKILL_MODES.includes(skill.mode)) {
        new Notice(t.skills.invalidMode(skill.mode));
      } else if (isLocked) {
        new Notice(t.skills.modeLockedNotice(skill.mode));
      } else {
        setComposerInject(undefined);
        setMode(skill.mode);
      }
    }
    const draft = composerDraftRef.current.trim();
    handlePromptStarter(draft ? `${draft}\n\n${skill.body}` : skill.body);
  };

  /**
   * Transcreve os áudios pendentes (VOZ-03). Devolve id do anexo → texto.
   *
   * Silenciosamente vazio quando o setting está off ou não há key OpenAI — e aí
   * a mensagem cai no aviso honesto de sempre, sem inventar conteúdo. Uma falha
   * por arquivo não cancela o envio nem os outros áudios: o usuário vê o Notice
   * e a gravação continua na conversa. v0.1.249
   */
  const transcribePendingAudio = async (
    pending: PendingAttachmentEntry[]
  ): Promise<Map<string, string>> => {
    const out = new Map<string, string>();
    const audios = pending.filter((p) => p.attachment.type === "audio");
    if (audios.length === 0) return out;
    const apiKey = plugin.settings.openaiApiKey?.trim();
    if (!plugin.settings.transcribeAudio || !apiKey) return out;

    new Notice(t.composer.transcribing);
    for (const p of audios) {
      const path = (p.attachment as { path?: string }).path;
      if (!path) continue;
      try {
        const buf = await plugin.app.vault.adapter.readBinary(path);
        const text = await transcribeAudio({
          apiKey,
          model: plugin.settings.transcribeModel || "gpt-4o-mini-transcribe",
          data: new Uint8Array(buf),
          filename: path.split("/").pop() ?? "audio.webm",
        });
        if (text) out.set(p.id, text);
      } catch (err) {
        console.error("[axxa] transcrição falhou:", err);
        new Notice(
          t.composer.transcribeFailed(
            err instanceof Error ? err.message : ""
          )
        );
      }
    }
    return out;
  };

  // Salva o áudio gravado pelo hold-to-record no Vault e devolve o path
  // relativo (pra usar como wikilink no composer). Cria a pasta se não existir.
  const handleSaveAudio = async (
    blob: Blob,
    _durationMs: number
  ): Promise<string | null> => {
    try {
      const folder = plugin.settings.recordingsPath || "axxa-ai/recordings";
      await ensureFolder(plugin.app.vault.adapter, folder);
      // Nome: timestamp ISO-safe + extensão guess do mime
      const ext = blob.type.includes("ogg")
        ? "ogg"
        : blob.type.includes("mp4")
          ? "m4a"
          : "webm";
      const ts = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .slice(0, 19);
      const path = `${folder}/${ts}.${ext}`;
      const buffer = await blob.arrayBuffer();
      await plugin.app.vault.adapter.writeBinary(path, buffer);
      return path;
    } catch (err) {
      console.error("[axxa] save audio falhou:", err);
      return null;
    }
  };

  // Salva uma resposta da IA como NOVA nota markdown no vault e abre ela.
  // Título derivado da 1ª linha/heading do conteúdo; pasta = notesPath setting
  // (fallback "axxa-ai/notes"). É o "joga no meu vault" do footer. v0.1.186
  const handleSaveResponseAsNote = async (content: string) => {
    try {
      const folder = plugin.settings.notesPath || "axxa-ai/notes";
      await ensureFolder(plugin.app.vault.adapter, folder);
      // Título: 1ª linha não-vazia, sem markdown de heading, limitada e
      // higienizada pra um nome de arquivo válido.
      const firstLine =
        content
          .split("\n")
          .map((l) => l.replace(/^#+\s*/, "").trim())
          .find((l) => l.length > 0) ?? "Nota AXXA";
      const safeTitle =
        firstLine.replace(/[\\/:*?"<>|#^[\]]/g, "").slice(0, 60).trim() ||
        "Nota AXXA";
      // Evita colisão: sufixo incremental se já existir.
      let path = `${folder}/${safeTitle}.md`;
      let n = 2;
      while (await plugin.app.vault.adapter.exists(path)) {
        path = `${folder}/${safeTitle} ${n}.md`;
        n += 1;
      }
      // vault.create pode falhar se o índice da pasta ainda não sincronizou
      // (ensureFolder escreve via adapter). Fallback pro adapter.write, igual
      // ao padrão de generation/save.ts. v0.1.195
      try {
        // vault.create já falha se o arquivo existir → protege contra o TOCTOU
        // do loop de exists acima (create-then-fail).
        await plugin.app.vault.create(path, content);
      } catch {
        // v0.1.228: adapter.write clobra cego — re-checa exists imediatamente
        // antes de escrever e, se colidiu na janela, desambigua com sufixo único.
        if (await plugin.app.vault.adapter.exists(path)) {
          path = `${folder}/${safeTitle} ${Date.now().toString(36)}.md`;
        }
        await plugin.app.vault.adapter.write(path, content);
      }
      new Notice(t.chat.savedAsNote(path));
      // Abre a nota recém-criada numa nova aba (lazy — não bloqueia se falhar).
      const file = plugin.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        void plugin.app.workspace.getLeaf(true).openFile(file);
      }
    } catch (err) {
      console.error("[axxa] save response as note falhou:", err);
      new Notice(t.chat.saveAsNoteFailed);
    }
  };

  // Abre a aba de Settings do plugin. `app.setting` é API semi-privada do
  // Obsidian (não tipada publicamente) mas estável e amplamente usada pela
  // comunidade pra esse fim — não há equivalente público. Guard defensivo +
  // fallback pro Notice caso a API mude num futuro update. v0.1.196
  const handleOpenSettings = () => {
    const app = plugin.app as unknown as {
      setting?: { open?: () => void; openTabById?: (id: string) => void };
    };
    try {
      app.setting?.open?.();
      app.setting?.openTabById?.("axxa-os-ai-agent");
    } catch (err) {
      console.error("[axxa] abrir Settings falhou:", err);
      new Notice(t.header.openSettings);
    }
  };

  // Fullscreen mobile: o setting é a fonte da verdade; quem aplica as classes
  // no chrome do Obsidian é o AxxaView (via onSettingsChange). Aqui só
  // persistimos o toggle — o re-render vem do mesmo listener. v0.1.242
  const handleToggleFullscreen = () => {
    plugin.settings.mobileFullscreen = !plugin.settings.mobileFullscreen;
    void plugin
      .saveSettings()
      .catch((err) => console.error("[axxa] salvar fullscreen falhou:", err));
  };

  const handleNewChat = () => {
    abortRef.current?.abort();
    // (P1-09) Chat novo FORA do fluxo de projeto: descarta a associação
    // pendente — senão o 1º send entra num projeto que o usuário abandonou.
    pendingProjectIdRef.current = null;
    useChatStore.getState().newChat();
    setCleanChat(true);
    setView("chat");
  };

  // Nova conversa JÁ num modo específico (botões New chat / New Q&A / New Agent
  // da gaveta). Mesma lógica do handleNewChat + fixa o modo da sessão. v0.1.219
  const handleNewChatWithMode = (newMode: string) => {
    abortRef.current?.abort();
    pendingProjectIdRef.current = null; // (P1-09) idem handleNewChat
    // Limpa um prompt-starter pendente ANTES do remount do Composer (key=mode):
    // sem isso o editor recém-montado re-injeta o texto da sugestão antiga.
    setComposerInject(undefined);
    setMode(newMode);
    useChatStore.getState().newChat();
    setCleanChat(true);
    setView("chat");
  };

  // Deleta uma conversa (vai pra lixeira do sistema, recuperável). #3
  const handleDeleteChat = async (chatId: string, mode: string) => {
    try {
      await deleteChat(plugin.app, plugin.settings.chatsPath, mode, chatId);
      plugin.removeChatSummary(chatId);
      // v0.1.228: limpa a referência do chat dos projetos (evita chatId órfão
      // apontando pra uma conversa que já foi pra lixeira).
      await persistProjects((prev) =>
        prev.map((p) =>
          p.chatIds.includes(chatId)
            ? { ...p, chatIds: p.chatIds.filter((id) => id !== chatId) }
            : p
        )
      );
      // Se era a conversa aberta, limpa a tela.
      if (currentChatId === chatId) {
        abortRef.current?.abort();
        useChatStore.getState().newChat();
        setView("chat");
      }
      new Notice(t.chat.deletedToTrash);
    } catch (err) {
      console.error("[axxa] deleteChat falhou:", err);
      new Notice(
        `${t.ai.errorPrefix} ${err instanceof Error ? err.message : ""}`
      );
    }
  };

  // Abre a tela cheia de conversas — usa o cache compartilhado (sem novo walk).
  const handleOpenConversations = async () => {
    const all = await plugin.loadChatSummaries();
    setAllChats(all);
    setView("conversations");
  };

  // Quando user clica numa conversa da lista cheia, descobre o modo dela
  // pelo summary e carrega o .md correto.
  const handleLoadChatFromList = async (chatId: string) => {
    const summary = allChats.find((c) => c.id === chatId);
    await handleLoadChat(chatId, summary?.mode);
    setView("chat");
  };

  // Rename direto pelo título do header (chat ativo). Reescreve o arquivo
  // com base na sessionMode + currentChatId já conhecidos.
  const handleHeaderRename = async (newTitle: string) => {
    if (!currentChatId) {
      // Sem chat salvo ainda — só atualiza local. Auto-save vai usar isso
      // na próxima escrita.
      useChatStore.getState().setCurrentChatTitle(newTitle);
      return;
    }
    try {
      await renameChat(
        plugin.app,
        plugin.settings.chatsPath,
        activeMode,
        currentChatId,
        newTitle
      );
      useChatStore.getState().setCurrentChatTitle(newTitle);
      // Atualiza o cache compartilhado → re-sincroniza todas as listas. v0.1.175
      const cur = plugin.chatSummaries?.find((c) => c.id === currentChatId);
      if (cur) plugin.upsertChatSummary({ ...cur, title: newTitle });
      new Notice(t.conversations.renameSuccess(newTitle));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.ai.unknownError;
      new Notice(t.conversations.renameFailed(msg));
    }
  };

  // Renomeia uma conversa QUALQUER a partir da lista (modal nativo). v0.1.187
  const handleRenameChatFromList = (
    chatId: string,
    chatMode: string,
    currentTitle: string
  ) => {
    new RenameChatModal(plugin.app, {
      currentTitle,
      title: t.conversations.renameModalTitle,
      inputLabel: t.conversations.renameInputLabel,
      submitLabel: t.conversations.renameSubmit,
      cancelLabel: t.conversations.renameCancel,
      onSubmit: async (newTitle) => {
        try {
          await renameChat(
            plugin.app,
            plugin.settings.chatsPath,
            chatMode,
            chatId,
            newTitle
          );
          if (currentChatId === chatId) {
            useChatStore.getState().setCurrentChatTitle(newTitle);
          }
          const cur = plugin.chatSummaries?.find((c) => c.id === chatId);
          if (cur) plugin.upsertChatSummary({ ...cur, title: newTitle });
          // Re-sincroniza a lista cheia aberta.
          setAllChats(await plugin.loadChatSummaries());
          new Notice(t.conversations.renameSuccess(newTitle));
        } catch (err) {
          const msg = err instanceof Error ? err.message : t.ai.unknownError;
          new Notice(t.conversations.renameFailed(msg));
        }
      },
    }).open();
  };

  const handleOpenSearch = () => {
    const hits = useChatStore
      .getState()
      .messages.filter((m) => m.type === "user" || m.type === "ai-response")
      .map((m) => ({
        id: m.id,
        role: m.type === "user" ? t.chat.roleUser : t.chat.roleAI,
        text: (m as { content: string }).content,
      }));
    if (hits.length === 0) return;
    new ChatSearchModal(
      plugin.app,
      hits,
      t.chat.searchPlaceholder,
      t.chat.searchNoResults,
      (id) => setSearchTarget({ id, n: Date.now() })
    ).open();
  };

  const handleCopyConversation = async () => {
    const msgs = useChatStore
      .getState()
      .messages.filter((m) => m.type === "user" || m.type === "ai-response");
    if (msgs.length === 0) return;
    const title = currentChatTitle || t.header.conversationFallbackTitle;
    const body = msgs
      .map(
        (m) =>
          `## ${m.type === "user" ? t.chat.roleUser : t.chat.roleAssistant}\n\n${(m as { content: string }).content}`
      )
      .join("\n\n");
    const text = `# ${title}\n\n${body}\n`;
    try {
      await navigator.clipboard.writeText(text);
      new Notice(t.header.copyConversationDone);
    } catch (err) {
      console.error("[axxa] copy conversation falhou:", err);
      // v0.1.228: fallback p/ execCommand quando clipboard API falha (permissão
      // negada / contexto inseguro) e, se mesmo assim falhar, avisa o usuário em
      // vez de deixar o clique silencioso.
      let copied = false;
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
      new Notice(
        copied ? t.header.copyConversationDone : t.header.copyConversationFailed
      );
    }
  };

  const handleEditPersona = () => {
    new PersonaModal(
      plugin.app,
      useChatStore.getState().sessionPersona,
      {
        title: t.chat.personaTitle,
        desc: t.chat.personaDesc,
        placeholder: t.chat.personaPlaceholder,
        save: t.chat.personaSave,
        clear: t.chat.personaClear,
        cancel: t.menu.cancel,
      },
      (persona) => {
        useChatStore.getState().setSessionPersona(persona);
        new Notice(persona ? t.chat.personaSet : t.chat.personaCleared);
      }
    ).open();
  };

  const handlePlusClick = () => setPlusOpen(true);
  const handlePlusClose = () => setPlusOpen(false);
  const handleSelectEffort = async (level: EffortLevel) => {
    setEffort(level);
    plugin.settings.defaultEffort = level;
    await plugin.saveSettings();
  };

  const handleSelectStyle = async (id: string) => {
    setResponseStyle(id);
    plugin.settings.responseStyle = id;
    await plugin.saveSettings();
  };

  const handleStarterProvider = async (p: string) => {
    setProviderSel(p);
    plugin.settings.defaultProvider = p;
    await plugin.saveSettings();
  };

  const handleStarterMode = async (newMode: string) => {
    // Limpa o prompt-starter pendente antes do remount do Composer (key=mode) —
    // senão trocar de modo re-injeta a sugestão que já tinha sido apagada.
    setComposerInject(undefined);
    setMode(newMode);
    plugin.settings.defaultMode = newMode;
    await plugin.saveSettings();
  };

  const setModelForProvider = async (provider: string, m: string) => {
    switch (provider) {
      case "anthropic":
        setAnthropicModelSel(m);
        plugin.settings.anthropicModel = m;
        break;
      case "gemini":
        setGeminiModelSel(m);
        plugin.settings.geminiModel = m;
        break;
      case "openrouter":
        setOpenrouterModelSel(m);
        plugin.settings.openrouterModel = m;
        break;
      case "nim":
        setNimModelSel(m);
        plugin.settings.nimModel = m;
        break;
      case "ollama":
        setOllamaModelSel(m);
        plugin.settings.ollamaModel = m;
        break;
      default:
        setOpenaiModelSel(m);
        plugin.settings.defaultModel = m;
    }
    await plugin.saveSettings();
  };

  const handleStarterModel = async (m: string) => {
    await setModelForProvider(providerSel, m);
  };

  // Switcher do header (ref: Claude iOS 16). Troca o modelo. Se a sessão já
  // está locked (continuidade), abrir outro modelo inicia uma NOVA conversa
  // nele — preservando a sessão atual intacta.
  const handleHeaderModelSelect = (m: string) => {
    if (m === activeModel) return;
    const targetProvider = activeProviderId;
    if (isLocked) {
      abortRef.current?.abort();
      useChatStore.getState().newChat();
      setView("chat");
      if (providerSel !== targetProvider) {
        setProviderSel(targetProvider);
        plugin.settings.defaultProvider = targetProvider;
      }
    }
    void setModelForProvider(targetProvider, m);
  };

  // chatMode opcional — quando vem da ConversationsList (que conhece o modo
  // do summary). Quando ausente, default "chat" pra compat com fluxo antigo.
  const handleLoadChat = async (chatId: string, chatMode: string = "chat") => {
    try {
      const chat = await loadChat(
        plugin.app,
        plugin.settings.chatsPath,
        chatMode,
        chatId
      );
      const restored: ChatMessage[] = chat.messages.map((m) => ({
        id: makeId(),
        type: m.type,
        content: m.content,
        timestamp: m.timestamp,
        // Restaura reaction salva quando ai-response
        ...(m.type === "ai-response" && m.reaction
          ? { reaction: m.reaction }
          : {}),
        // Restaura as ações do agent → o agent "lembra" o que fez ao continuar.
        ...(m.type === "ai-response" && m.agentSteps
          ? { agentSteps: m.agentSteps }
          : {}),
      })) as ChatMessage[];

      const {
        setMessages,
        setCurrentChatId,
        setCurrentChatTitle,
        lockSession,
        resetUsage,
        addUsage,
        setSessionPersona,
      } = useChatStore.getState();

      // Abrir um chat NÃO é atividade: pula o próximo ciclo do auto-save —
      // senão a reidratação regrava o arquivo com date=agora e o histórico
      // reordena só de abrir. (auditoria jul/2026)
      justLoadedRef.current = true;
      // (P1-09/P1-55) Carregar um chat também sai do fluxo "novo chat no
      // projeto" — a associação pendente não pode sobreviver à troca.
      pendingProjectIdRef.current = null;
      setMessages(restored);
      setCurrentChatId(chat.id);
      setCurrentChatTitle(chat.title);
      // lockSession agora também guarda o mode original do chat
      lockSession(chat.provider, chat.model, chat.mode);
      resetUsage();
      addUsage(chat.tokensIn, chat.tokensOut);
      setEffort(chat.effort);
      setSessionPersona(chat.persona ?? "");
      // v0.1.228: reidratação gera ids novos (makeId) p/ cada msg → um highlight
      // pendente apontaria pra id inexistente. Reseta o destaque no load.
      setSearchTarget(null);
    } catch (err) {
      console.error("[axxa] loadChat falhou:", err);
      // v0.1.228: o clique não pode parecer no-op — avisa o usuário do erro.
      new Notice(
        `${t.ai.errorPrefix} ${err instanceof Error ? err.message : t.ai.unknownError}`
      );
    }
  };

  // ============================================================
  // Slash commands — disponíveis no Composer via /comando
  // ============================================================
  const axxaCommands: AxxaCommand[] = [
    {
      id: "new",
      label: "new",
      description: "New conversation",
      execute: () => handleNewChat(),
    },
    {
      id: "clear",
      label: "clear",
      description: "Clear the current conversation",
      execute: () => useChatStore.getState().newChat(),
    },
    {
      id: "regen",
      label: "regen",
      description: "Regenerate the last response",
      execute: () => {
        const msgs = useChatStore.getState().messages;
        const lastAI = [...msgs].reverse().find((m) => m.type === "ai-response");
        if (lastAI) chatActions.regenerate(lastAI.id);
      },
    },
    {
      id: "stop",
      label: "stop",
      description: "Stop the current generation",
      execute: () => handleStop(),
    },
    {
      id: "conversations",
      label: "conversations",
      description: "View all saved conversations",
      execute: () => handleOpenConversations(),
    },
    {
      id: "settings",
      label: "settings",
      description: "Open Settings",
      execute: () => handleOpenSettings(),
    },
    {
      id: "mode-chat",
      label: "mode chat",
      description: "Switch to Chat mode (before the first message)",
      execute: () => !isLocked && handleStarterMode("chat"),
    },
    {
      id: "mode-vault",
      label: "mode vault-qa",
      description: "Switch to Vault Q&A mode (before the first message)",
      execute: () => !isLocked && handleStarterMode("vault-qa"),
    },
    {
      id: "mode-agent",
      label: "mode agent",
      description: "Switch to Agent mode (before the first message)",
      execute: () => !isLocked && handleStarterMode("agent"),
    },
    // Skills do usuário (.md na pasta de skills) → /comando que injeta o
    // template no composer (+ troca pro modo do skill, se definido). v0.1.139
    ...plugin.skills.map((s) => ({
      id: s.id,
      label: s.name,
      description: "Skill · " + (s.description || s.name),
      execute: () => applySkill(s),
    })),
  ];

  return (
    <AppContext.Provider value={plugin.app}>
      <TranslationsContext.Provider value={t}>
        <ChatActionsContext.Provider value={chatActions}>
        <div
          className={
            "axxa-root axxa-bg-" +
            (plugin.settings.background || "none") +
            (plugin.settings.codeWrap ? " axxa-code-wrap" : "") +
            (isLoading ? " axxa-bg-active" : "") +
            (view === "chat" && isEmpty && cleanChat
              ? " axxa-newchat-active"
              : "")
          }
          data-axxa-density={plugin.settings.density || "normal"}
          data-axxa-motion={plugin.settings.motion || "wave"}
        >
          <Header
            version={plugin.manifest.version}
            chatTitle={currentChatTitle}
            onOpenSettings={handleOpenSettings}
            onNewChat={handleNewChat}
            onOpenSidebar={() => setSidebarOpen(true)}
            onRenameChat={handleHeaderRename}
            onToggleSearch={handleOpenSearch}
            searchActive={false}
            onCopyConversation={handleCopyConversation}
            canCopy={messages.some(
              (m) => m.type === "user" || m.type === "ai-response"
            )}
            onEditPersona={handleEditPersona}
            personaActive={sessionPersona.trim().length > 0}
            modelName={activeModel}
            modelOptions={activeModelsList}
            onSelectModel={handleHeaderModelSelect}
            modelLocked={isLocked}
            onOpenVoice={() => setVoiceOpen(true)}
            fullscreen={!!plugin.settings.mobileFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            showFullscreen={Platform.isMobile}
          />
        {view === "conversations" ? (
          <ConversationsList
            chats={allChats}
            onLoadChat={handleLoadChatFromList}
            onClose={() => setView("chat")}
            visibleChips={plugin.settings.listChips}
            onRenameChat={handleRenameChatFromList}
            onDeleteChat={handleDeleteChat}
            onNewChat={handleNewChat}
          />
        ) : showOnboarding ? (
          <OnboardingScreen
            onOpenSettings={() => finishOnboarding(true)}
            onDismiss={() => finishOnboarding(false)}
          />
        ) : isEmpty ? (
          <NewChatScreen
            mode={activeMode}
            plugin={plugin}
            provider={providerSel}
            onProviderChange={handleStarterProvider}
            onOpenSettings={handleOpenSettings}
            onPickSuggestion={handlePromptStarter}
            onSeeMoreSuggestions={() => setSuggestSheetOpen(true)}
            showSuggestions={composerEmpty}
          />
        ) : (
          <ChatArea highlightTarget={searchTarget} />
        )}
        {view === "chat" && showBanner && (
          <IncompatibleBanner
            result={compatibility}
            onSwapModel={(m) => {
              // Se session locked (após primeira msg), não dá pra trocar — avisa.
              if (isLocked) {
                new Notice(t.composer.compatLockedNotice(m));
                return;
              }
              handleStarterModel(m);
              setDismissedBannerKey(null);
            }}
            onDismiss={() => setDismissedBannerKey(bannerKey)}
          />
        )}
        {/* (P1-38) Composer some enquanto o onboarding está na tela — enviar
            por baixo dele matava o welcome sem marcá-lo como concluído. */}
        {view === "chat" && !showOnboarding && (
          <Composer
            key={activeMode}
            onSend={handleSend}
            onStop={handleStop}
            onPlusClick={handlePlusClick}
            onOpenVoice={() => setVoiceOpen(true)}
            onOpenModel={() => setModelSheetOpen(true)}
            onDraftChange={(text) => {
              composerDraftRef.current = text;
              const empty = text.trim().length === 0;
              setComposerEmpty((prev) => (prev === empty ? prev : empty));
            }}
            injectText={composerInject}
            streaming={isLoading}
            modelName={activeModel}
            effort={effort}
            mode={activeMode}
            placeholder={placeholderForMode(activeMode, t.composer)}
            onSaveAudio={handleSaveAudio}
            onAddAudio={(path, durationMs, alias) => {
              setPendingAttachments((prev) => [
                ...prev,
                {
                  id: makeAttachmentId(),
                  attachment: { type: "audio", path, durationMs },
                  name: alias,
                },
              ]);
              // O aviso diz a VERDADE do estado atual: com transcrição ligada
              // (e key OpenAI), o áudio vira texto e é enviado; sem isso, fica
              // só o wikilink na conversa. v0.1.249
              new Notice(
                plugin.settings.transcribeAudio &&
                  plugin.settings.openaiApiKey?.trim()
                  ? t.composer.audioAttachedTranscribeNotice
                  : t.composer.audioAttachedNotice
              );
            }}
            commands={axxaCommands}
            visionEnabled={getModelCapabilities(activeProviderId, activeModel).vision}
            pdfEnabled={
              !!getModelCapabilities(activeProviderId, activeModel).pdf
            }
            pendingAttachments={pendingAttachments.map((p) => {
              const a = p.attachment;
              switch (a.type) {
                case "image":
                  return {
                    id: p.id,
                    kind: "image" as const,
                    dataUrl: a.dataUrl,
                    mimeType: a.mimeType ?? "image/png",
                    name: p.name,
                  };
                case "note":
                  return {
                    id: p.id,
                    kind: "note" as const,
                    path: a.path,
                    name: p.name,
                  };
                case "pdf":
                  return {
                    id: p.id,
                    kind: "pdf" as const,
                    name: p.name,
                    dataUrl: a.dataUrl,
                  };
                case "audio":
                  return {
                    id: p.id,
                    kind: "audio" as const,
                    path: a.path,
                    name: p.name,
                    durationMs: a.durationMs,
                  };
              }
            })}
            onAddImage={(img) =>
              setPendingAttachments((prev) => [
                ...prev,
                {
                  id: img.id,
                  attachment: {
                    type: "image",
                    dataUrl: img.dataUrl,
                    mimeType: img.mimeType,
                  },
                  name: img.name,
                },
              ])
            }
            onRemoveAttachment={(id) =>
              setPendingAttachments((prev) => prev.filter((p) => p.id !== id))
            }
            onPickNote={async (path, isFolder) => {
              // Pasta vira "note" sem content (pra LLM saber que existe);
              // arquivo é lido e inlinado como contexto na hora do envio
              try {
                let content = "";
                let resolvedPath = path;
                if (!isFolder) {
                  // Path pode vir sem .md (do autocomplete). Adiciona se faltar.
                  const candidate = path.endsWith(".md") ? path : `${path}.md`;
                  const exists = await plugin.app.vault.adapter.exists(candidate);
                  if (exists) {
                    resolvedPath = candidate;
                    content = await plugin.app.vault.adapter.read(candidate);
                  } else if (await plugin.app.vault.adapter.exists(path)) {
                    content = await plugin.app.vault.adapter.read(path);
                  } else {
                    new Notice(`Nota não encontrada: ${path}`);
                    return;
                  }
                }
                setPendingAttachments((prev) => [
                  ...prev,
                  {
                    id: makeAttachmentId(),
                    attachment: {
                      type: "note",
                      path: resolvedPath,
                      content,
                    },
                    name: resolvedPath.split("/").pop() ?? resolvedPath,
                  },
                ]);
              } catch (err) {
                console.error("[axxa] onPickNote falhou:", err);
                new Notice(
                  `Falha ao anexar nota: ${err instanceof Error ? err.message : "erro"}`
                );
              }
            }}
          />
        )}
          {plusOpen && (
            <PlusModal
              currentEffort={effort}
              onSelectEffort={handleSelectEffort}
              onClose={handlePlusClose}
              visionEnabled={
                getModelCapabilities(activeProviderId, activeModel).vision
              }
              imageGenEnabled={
                Boolean(getModelCapabilities(activeProviderId, activeModel).imageGen)
              }
              createImageAvailable={buildImageModelOptions().some((o) => o.connected)}
              onCreateImage={handleCreateImage}
              responseStyle={responseStyle}
              onSelectStyle={handleSelectStyle}
              onExploreSkills={() => {
                setPlusOpen(false);
                // (P1-67) Abre com a lista FRESCA: notas criadas/editadas na
                // pasta desde o load passam a aparecer sem reload do plugin.
                void plugin.reloadSkills().then(() => forceRender((n) => n + 1));
                setSkillsOpen(true);
              }}
              toggles={plusToggles}
              onToggle={(key, value) =>
                setPlusToggles((prev) => ({ ...prev, [key]: value }))
              }
              onAttachPicked={(picked) => {
                const id = makeAttachmentId();
                const entry: PendingAttachmentEntry = (() => {
                  switch (picked.type) {
                    case "note":
                      return {
                        id,
                        attachment: {
                          type: "note",
                          path: picked.path ?? picked.name,
                          content: picked.content ?? "",
                        },
                        name: picked.name,
                      };
                    case "pdf":
                      return {
                        id,
                        attachment: {
                          type: "pdf",
                          dataUrl: picked.dataUrl,
                          name: picked.name,
                        },
                        name: picked.name,
                      };
                    case "image":
                      return {
                        id,
                        attachment: {
                          type: "image",
                          dataUrl: picked.dataUrl ?? "",
                          mimeType: picked.mimeType,
                        },
                        name: picked.name,
                      };
                  }
                })();
                if (picked.type === "pdf") {
                  // Teto de 30MB: o limite de request é 32MB (Anthropic) / 50MB
                  // (OpenAI) e o base64 já infla ~33% — melhor barrar aqui do
                  // que levar um 413 no meio da conversa. v0.1.248
                  const bytes = approxBase64Bytes(picked.dataUrl);
                  if (bytes > PDF_MAX_BYTES) {
                    new Notice(t.composer.pdfTooLarge(bytes / (1024 * 1024)));
                    return;
                  }
                }
                setPendingAttachments((prev) => [...prev, entry]);
                // O usuário fica sabendo AGORA se o modelo ativo lê o PDF —
                // não depois, por uma resposta que ignorou o arquivo. v0.1.248
                if (picked.type === "pdf") {
                  const label = prettyModelName(activeModel) || activeModel;
                  new Notice(
                    getModelCapabilities(activeProviderId, activeModel).pdf
                      ? t.composer.pdfAttachedNotice(label)
                      : t.composer.pdfUnsupportedNotice(label)
                  );
                }
              }}
            />
          )}
          {modelSheetOpen && (
            <ModelSheet
              provider={activeProviderId}
              models={activeModelsList}
              favorites={favoriteModels}
              onToggleFavorite={handleToggleFavorite}
              currentModel={activeModel}
              onSelectModel={handleHeaderModelSelect}
              currentEffort={effort}
              onSelectEffort={handleSelectEffort}
              thinkingOn={Boolean(plusToggles.extendedThinking)}
              onToggleThinking={(v) =>
                setPlusToggles((prev) => ({ ...prev, extendedThinking: v }))
              }
              onOpenSettings={handleOpenSettings}
              thinkingCapable={supportsThinking(activeModel)}
              locked={isLocked}
              onClose={() => setModelSheetOpen(false)}
            />
          )}
          {suggestSheetOpen && (
            <SuggestionsSheet
              mode={activeMode}
              onPick={handlePromptStarter}
              onClose={() => setSuggestSheetOpen(false)}
            />
          )}
          {projectEditor && (
            <ProjectEditor
              initial={projectEditor.project}
              onSave={handleSaveProject}
              onDelete={
                projectEditor.project ? handleDeleteProject : undefined
              }
              onClose={() => setProjectEditor(null)}
            />
          )}
          {voiceOpen && (() => {
            const aiResponses = messages.filter(
              (m) => m.type === "ai-response"
            );
            const lastAiMsg = aiResponses[aiResponses.length - 1];
            const lastAi = lastAiMsg
              ? {
                  id: lastAiMsg.id,
                  content: (lastAiMsg as { content?: string }).content ?? "",
                  done: !isLoading,
                }
              : null;
            return (
              <VoiceScreen
                onSend={(text) => handleSend(text)}
                onStop={handleStop}
                onClose={() => setVoiceOpen(false)}
                lastAi={lastAi}
                isStreaming={isLoading}
                lang={plugin.settings.language === "en-us" ? "en-US" : "pt-BR"}
                voiceURI={voiceURI}
                voiceRate={voiceRate}
                onChangeVoice={handleChangeVoice}
                onChangeRate={handleChangeVoiceRate}
                introDone={voiceIntroDone}
                onIntroDone={handleVoiceIntroDone}
              />
            );
          })()}
          {skillsOpen && (
            <SkillsScreen
              skills={plugin.skills}
              onClose={() => setSkillsOpen(false)}
              onCreateExamples={() => {
                void (async () => {
                  await plugin.seedExampleSkills();
                  await plugin.reloadSkills();
                  forceRender((n) => n + 1);
                })();
              }}
              onUse={(skill) => {
                setSkillsOpen(false);
                setView("chat");
                applySkill(skill);
              }}
              onOpenNote={(path) => {
                const file = plugin.app.vault.getAbstractFileByPath(path);
                if (file instanceof TFile) {
                  void plugin.app.workspace.getLeaf(true).openFile(file);
                }
              }}
            />
          )}
          <span className="axxa-sr-only" role="status" aria-live="polite">
            {srAnnouncement}
          </span>
          {showAllSet && (
            <div className="axxa-allset" role="status" aria-label={t.allSet.title}>
              <div className="axxa-allset-check">
                <Icon name="check" />
              </div>
              <p className="axxa-allset-title">{t.allSet.title}</p>
              <p className="axxa-allset-sub">{t.allSet.sub}</p>
            </div>
          )}
          {/* Gaveta lateral de conversas (avatar do header). v0.1.145 */}
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            chats={allChats}
            onLoadChat={handleLoadChat}
            onNewChatMode={handleNewChatWithMode}
            onOpenAll={handleOpenConversations}
            onOpenSettings={handleOpenSettings}
            onNavigate={handleNavigate}
            tier={tier}
            onDeleteChat={handleDeleteChat}
            activeView={view}
            version={plugin.manifest.version}
            founder={plugin.settings.founder}
          />
        </div>
        </ChatActionsContext.Provider>
      </TranslationsContext.Provider>
    </AppContext.Provider>
  );
}
