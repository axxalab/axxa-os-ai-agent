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
import { PlusModal } from "../components/composer/PlusModal";
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
import { openVaultNotePicker } from "../components/composer/PlusModal";
import {
  getEffectiveTier,
  canAccess,
  isLicensePro,
  type AppView,
} from "../entitlements";
import { AppContext } from "../components/_shared/AppContext";
import {
  ChatActionsContext,
  type ChatActions,
} from "../components/chat/ChatActionsContext";
import { TranslationsContext, getTranslations } from "../i18n";
import { useChatStore } from "../store/chat";
import { getProvider } from "../providers";
import { ProviderError, type ProviderMessage, type MessageAttachment } from "../providers/base";
import { getModelCapabilities, isGenerationModel } from "../providers/modelCapabilities";
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
  resolveEffortConfig,
  type EffortLevel,
} from "../components/_shared/effort";
import { getContextWindow } from "../components/_shared/contextWindows";
import { useWakeLock } from "../components/_shared/useWakeLock";
import {
  saveChat,
  loadChat,
  renameChat,
  deleteChat,
  generateTitle,
  type ChatData,
  type ChatSummary,
} from "../components/_shared/chatPersistence";
import { Notice, TFile } from "obsidian";
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

  // (v0.1.127) Fullscreen REMOVIDO — o plugin não mexe mais no layout/chrome
  // do Obsidian. Fullscreen v3 virá depois via snippet do dev.

  // Lê traduções na hora — atualiza no próximo render (após forceRender acima)
  const t = getTranslations(plugin.settings.language);

  const isLoading = useChatStore((s) => s.isLoading);
  const tokensIn = useChatStore((s) => s.tokensIn);
  const tokensOut = useChatStore((s) => s.tokensOut);
  const lastPromptTokens = useChatStore((s) => s.lastPromptTokens);
  const tokensPerSec = useChatStore((s) => s.tokensPerSec);
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
  useWakeLock(isLoading);

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

  // "Tudo certo!" auto-dispensa em 1.7s — timer com cleanup (evita update em
  // componente desmontado / timers acumulados). v0.1.195
  useEffect(() => {
    if (!showAllSet) return;
    const id = window.setTimeout(() => setShowAllSet(false), 1700);
    return () => window.clearTimeout(id);
  }, [showAllSet]);

  const finishOnboarding = async (openSettings: boolean) => {
    plugin.settings.onboardingDone = true;
    await plugin.saveSettings();
    if (openSettings) {
      handleOpenSettings();
    } else {
      // "Tudo certo!" (ref: ChatGPT iOS 20) — confirmação breve antes do chat.
      setShowAllSet(true);
    }
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

  // Prompt starters da StarterScreen v2 → injeta texto no Composer + foca.
  // Cada starter bumpa o nonce pra reescrever o doc do editor. v0.1.131
  const [composerInject, setComposerInject] = useState<
    { text: string; nonce: number } | undefined
  >(undefined);

  // Gaveta lateral (avatar do header) com as conversas. v0.1.145
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const handlePromptStarter = (text: string) => {
    setComposerInject((prev) => ({ text, nonce: (prev?.nonce ?? 0) + 1 }));
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
  useEffect(() => {
    if (messages.length === 0) return;
    if (!currentChatId) return;
    const timer = window.setTimeout(() => {
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
    }, 500);
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
    //  - notas viram bloco de contexto markdown no system prompt
    //  - pdf/audio passam como meta (ignorados no wire por enquanto)
    const caps = getModelCapabilities(activeProviderId, activeModel);
    const attachments =
      pendingAttachments.length > 0
        ? pendingAttachments
            .map((p) => p.attachment)
            .filter((a) => (a.type === "image" ? caps.vision : true))
        : undefined;

    // User msg salva sem attachments no store (pra simplicidade do auto-save .md).
    // O propagation pro provider acontece via parâmetro adicional pra streamReply/runAgentTurn.
    addMessage({ type: "user", content: text });
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

  // Regenerar: remove o ai-response (e qualquer msg posterior) e re-roda
  // streamReply usando a user-msg que precedia. Ignora se já tá streamando.
  // Regenerar com BRANCHING: a resposta atual vira uma variante e a nova é
  // gerada NA MESMA bolha — o user navega entre versões com ‹ N/M ›.
  const handleRegenerate = async (aiMessageId: string) => {
    if (useChatStore.getState().isLoading) return;
    const current = useChatStore.getState().messages;
    const aiIdx = current.findIndex(
      (m) => m.id === aiMessageId && m.type === "ai-response"
    );
    if (aiIdx < 0) return;

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
    const history: ProviderMessage[] = [
      {
        role: "system",
        content: buildChatSystemPrompt({
          persona: useChatStore.getState().sessionPersona,
          base: t.systemPrompt.base,
          styleInstruction: resolveStyleInstruction(),
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
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.error("[axxa] regenerar falhou:", err);
        const { message } = describeProviderError(err, t, activeProvider.name);
        new Notice(`${t.ai.errorPrefix} ${message}`);
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
    const history: ProviderMessage[] = [
      {
        role: "system",
        content: buildChatSystemPrompt({
          persona: useChatStore.getState().sessionPersona,
          base: t.systemPrompt.base,
          styleInstruction: resolveStyleInstruction(),
        }),
      },
      ...storeMessagesToProvider(hist),
      {
        role: "user",
        content:
          "Continue EXATAMENTE de onde você parou, sem repetir nem reintroduzir o que já escreveu.",
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
      if (!(err instanceof DOMException && err.name === "AbortError")) {
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
    const caps = getModelCapabilities(activeProviderId, activeModel);
    if (isGenerationModel(caps)) await runGenerationTurn(userText, caps);
    else if (activeMode === "agent") await runAgentTurn(userText);
    else await streamReply(userText);
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
    saveResponseAsNote: (content: string) => void handleSaveResponseAsNote(content),
  };

  const handleStop = () => abortRef.current?.abort();

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

  const handleNewChat = () => {
    abortRef.current?.abort();
    useChatStore.getState().newChat();
    setCleanChat(true);
    setView("chat");
  };

  // Nova conversa JÁ num modo específico (botões New chat / New Q&A / New Agent
  // da gaveta). Mesma lógica do handleNewChat + fixa o modo da sessão. v0.1.219
  const handleNewChatWithMode = (newMode: string) => {
    abortRef.current?.abort();
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
        role: m.type === "user" ? "Você" : "IA",
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
    const title = currentChatTitle || "Conversa";
    const body = msgs
      .map(
        (m) =>
          `## ${m.type === "user" ? "Você" : "Assistente"}\n\n${(m as { content: string }).content}`
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

  // Arena: confirma provider + modelo JUNTOS (a arena navega entre providers).
  // v0.1.224
  const handleArenaConfirm = async (p: string, m: string) => {
    setProviderSel(p);
    plugin.settings.defaultProvider = p;
    await setModelForProvider(p, m); // já faz saveSettings
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
      description: "Nova conversa",
      execute: () => handleNewChat(),
    },
    {
      id: "clear",
      label: "clear",
      description: "Limpar conversa atual",
      execute: () => useChatStore.getState().newChat(),
    },
    {
      id: "regen",
      label: "regen",
      description: "Regenerar última resposta",
      execute: () => {
        const msgs = useChatStore.getState().messages;
        const lastAI = [...msgs].reverse().find((m) => m.type === "ai-response");
        if (lastAI) chatActions.regenerate(lastAI.id);
      },
    },
    {
      id: "stop",
      label: "stop",
      description: "Parar geração em andamento",
      execute: () => handleStop(),
    },
    {
      id: "conversations",
      label: "conversations",
      description: "Ver todas as conversas salvas",
      execute: () => handleOpenConversations(),
    },
    {
      id: "settings",
      label: "settings",
      description: "Abrir Configurações",
      execute: () => handleOpenSettings(),
    },
    {
      id: "mode-chat",
      label: "mode chat",
      description: "Trocar pro modo Chat (antes da primeira msg)",
      execute: () => !isLocked && handleStarterMode("chat"),
    },
    {
      id: "mode-vault",
      label: "mode vault-qa",
      description: "Trocar pro modo Vault Q&A (antes da primeira msg)",
      execute: () => !isLocked && handleStarterMode("vault-qa"),
    },
    {
      id: "mode-agent",
      label: "mode agent",
      description: "Trocar pro modo Agent (antes da primeira msg)",
      execute: () => !isLocked && handleStarterMode("agent"),
    },
    // Skills do usuário (.md na pasta de skills) → /comando que injeta o
    // template no composer (+ troca pro modo do skill, se definido). v0.1.139
    ...plugin.skills.map((s) => ({
      id: s.id,
      label: s.name,
      description: "Skill · " + (s.description || s.name),
      execute: () => {
        if (s.mode && !isLocked) handleStarterMode(s.mode);
        handlePromptStarter(s.body);
      },
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
        ) : view === "media" ? (
          canAccess("media", tier) ? (
            <MediaScreen
              app={plugin.app}
              axxaPaths={[
                plugin.settings.generationPath,
                plugin.settings.recordingsPath,
              ]}
              onClose={() => setView("chat")}
            />
          ) : (
            <LockedScreen view="media" onClose={() => setView("chat")} onSeePlans={() => setView("plans")} />
          )
        ) : view === "statistics" ? (
          canAccess("statistics", tier) ? (
            <StatisticsScreen
              summaries={allChats}
              onOpenUsage={handleOpenSettings}
              onClose={() => setView("chat")}
            />
          ) : (
            <LockedScreen view="statistics" onClose={() => setView("chat")} onSeePlans={() => setView("plans")} />
          )
        ) : view === "projects" ? (
          (() => {
            const selected = projects.find((p) => p.id === selectedProjectId);
            if (selected) {
              const projChats = allChats.filter((c) =>
                selected.chatIds.includes(c.id)
              );
              return (
                <ProjectDetailScreen
                  project={selected}
                  chats={projChats}
                  onBack={() => setSelectedProjectId(null)}
                  onEdit={() => setProjectEditor({ project: selected })}
                  onNewChat={() => handleNewChatInProject(selected)}
                  onOpenChat={(id) => handleLoadChatFromList(id)}
                  onAddSource={() => handleAddProjectSource(selected.id)}
                  onRemoveSource={(path) =>
                    handleRemoveProjectSource(selected.id, path)
                  }
                  onOpenSource={(path) => {
                    const file = plugin.app.vault.getAbstractFileByPath(path);
                    if (file instanceof TFile) {
                      void plugin.app.workspace.getLeaf(true).openFile(file);
                    }
                  }}
                />
              );
            }
            return (
              <ProjectsListScreen
                projects={projects}
                onOpen={(id) => setSelectedProjectId(id)}
                onCreate={() => setProjectEditor({})}
                onClose={() => setView("chat")}
              />
            );
          })()
        ) : view === "profile" ? (
          <ProfileScreen
            tier={tier}
            email=""
            connectedProviders={["openai", "anthropic", "gemini", "openrouter", "nim", "ollama"].filter(
              (id) => id === "ollama" || apiKeyFor(id).trim().length > 0
            )}
            totalChats={allChats.length}
            onClose={() => setView("chat")}
            onOpenPlans={() => setView("plans")}
            onOpenSettings={handleOpenSettings}
          />
        ) : view === "plans" ? (
          <PlansScreen
            tier={tier}
            license={plugin.settings.licenseKey}
            onSetLicense={handleSetLicense}
            onClose={() => setView("chat")}
          />
        ) : view === "chat" &&
          isEmpty &&
          !plugin.settings.onboardingDone &&
          !hasAnyKey ? (
          <OnboardingScreen
            onOpenSettings={() => finishOnboarding(true)}
            onDismiss={() => finishOnboarding(false)}
          />
        ) : isEmpty ? (
          <NewChatScreen
            mode={activeMode}
            plugin={plugin}
            provider={providerSel}
            model={starterModel}
            activeModels={plugin.settings.activeModels}
            onProviderChange={handleStarterProvider}
            onModelChange={handleStarterModel}
            onArenaConfirm={handleArenaConfirm}
            onOpenSettings={handleOpenSettings}
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
                new Notice(
                  `Pra trocar pra ${m}, comece uma Nova conversa (botão "+" no topo).`
                );
                return;
              }
              handleStarterModel(m);
              setDismissedBannerKey(null);
            }}
            onDismiss={() => setDismissedBannerKey(bannerKey)}
          />
        )}
        {view === "chat" && (
          <Composer
            onSend={handleSend}
            onStop={handleStop}
            onPlusClick={handlePlusClick}
            onDraftChange={(text) => (composerDraftRef.current = text)}
            injectText={composerInject}
            streaming={isLoading}
            providerName={activeProvider.name}
            modelName={activeModel}
            effort={effort}
            tokensIn={tokensIn}
            tokensOut={tokensOut}
            tokensPerSec={tokensPerSec}
            contextUsed={lastPromptTokens}
            locked={isLocked}
            mode={activeMode}
            placeholder={placeholderForMode(activeMode, t.composer)}
            onSaveAudio={handleSaveAudio}
            onAddAudio={(path, durationMs, alias) =>
              setPendingAttachments((prev) => [
                ...prev,
                {
                  id: makeAttachmentId(),
                  attachment: { type: "audio", path, durationMs },
                  name: alias,
                },
              ])
            }
            commands={axxaCommands}
            visibleChips={plugin.settings.composerChips}
            visionEnabled={getModelCapabilities(activeProviderId, activeModel).vision}
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
                setPendingAttachments((prev) => [...prev, entry]);
              }}
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
              onUse={(skill) => {
                setSkillsOpen(false);
                setView("chat");
                if (skill.mode && skill.mode !== mode) {
                  void handleStarterMode(skill.mode);
                }
                handlePromptStarter(skill.body);
              }}
              onOpenNote={(path) => {
                const file = plugin.app.vault.getAbstractFileByPath(path);
                if (file instanceof TFile) {
                  void plugin.app.workspace.getLeaf(true).openFile(file);
                }
              }}
            />
          )}
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
