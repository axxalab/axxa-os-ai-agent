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
import { ChatArea } from "../components/chat/ChatArea";
import { Composer } from "../components/composer/Composer";
import { PlusModal } from "../components/composer/PlusModal";
import { StarterScreen } from "../components/chat/StarterScreen";
import { ConversationsList } from "../components/chat/ConversationsList";
import {
  MediaScreen,
  StatisticsScreen,
  ProjectsScreen,
  ProfileScreen,
  LockedScreen,
  OnboardingScreen,
  PlansScreen,
} from "../components/screens/Screens";
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
  buildAgentSystemPrompt,
  storeMessagesToProvider,
} from "../agent/conversation";
import {
  makeCallSignature,
  isLooping,
  trimSignatures,
} from "../agent/loopDetection";
import { checkCompatibility } from "../providers/compatibility";
import { IncompatibleBanner } from "../components/composer/IncompatibleBanner";
import {
  saveGeneration,
  generationSupported,
  generationSupportSummary,
  type GenerationMediaType,
} from "../generation/save";
import {
  ImageGenModal,
  type ImageModelOption,
} from "../generation/ImageGenModal";
import { getPricing } from "../usage/pricing";
import {
  effortToMaxTokensSmart,
  effortToVaultLookup,
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
import { Notice } from "obsidian";
import { ensureFolder } from "../components/_shared/chatPersistence";
import { hybridSearch } from "../rag/hybrid";
import type { AxxaCommand } from "../components/composer/completions";
import { TOOL_DEFINITIONS, getToolDefinition } from "../agent/toolSchemas";
import { TOOL_REGISTRY, isTransientError } from "../agent/tools";
import { decideToolGate } from "../agent/permissions";
import { ConfirmationModal } from "../agent/ConfirmationModal";
import type { PermissionLevel } from "../agent/types";
import type { ChatMessage, UserMessage, AIResponseMessage, AIErrorCode } from "../store/chat";

interface AxxaAppProps {
  plugin: AxxaPlugin;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Spec de activity para cada tool — define ícone Lucide + textos pending/done
 * que aparecem na timeline estilo Claude Code.
 *
 * iconPending: ícone semântico que pulsa enquanto a tool roda
 * iconDone:    troca pra check com pop animation no fim (default global "check-circle-2")
 * pendingText: ação em gerúndio + path resumido
 * doneText:    ação no particípio + path resumido (sem "✓", o ícone faz isso)
 */
function agentActivitySpec(
  toolName: string,
  args: Record<string, unknown>
): {
  iconPending: string;
  iconDone: string;
  pendingText: string;
  doneText: string;
} {
  const path = String(args.path ?? args.from ?? args.folder ?? "");
  // Encurta path long pra cabe na timeline (mantém basename)
  const shortPath = path.length > 48 ? "…" + path.slice(-46) : path;

  switch (toolName) {
    case "vault_search":
      return {
        iconPending: "radar",
        iconDone: "search-check",
        pendingText: `Buscando "${String(args.query ?? "").slice(0, 40)}"`,
        doneText: `Buscou "${String(args.query ?? "").slice(0, 40)}"`,
      };
    case "vault_list":
      return {
        iconPending: "folder-search",
        iconDone: "folder-check",
        pendingText: `Listando ${shortPath || "raiz"}`,
        doneText: `Listou ${shortPath || "raiz"}`,
      };
    case "vault_read":
      return {
        iconPending: "eye",
        iconDone: "file-check-2",
        pendingText: `Lendo ${shortPath}`,
        doneText: `Leu ${shortPath}`,
      };
    case "vault_create":
      return {
        iconPending: "file-plus-2",
        iconDone: "file-check-2",
        pendingText: `Criando ${shortPath}`,
        doneText: `Criou ${shortPath}`,
      };
    case "vault_edit":
      return {
        iconPending: "file-pen-line",
        iconDone: "file-check-2",
        pendingText: `Editando ${shortPath}`,
        doneText: `Editou ${shortPath}`,
      };
    case "vault_move":
      return {
        iconPending: "move",
        iconDone: "check-circle-2",
        pendingText: `Movendo ${shortPath} → ${String(args.to ?? "?")}`,
        doneText: `Moveu ${shortPath} → ${String(args.to ?? "?")}`,
      };
    case "vault_delete":
      return {
        iconPending: "trash-2",
        iconDone: "circle-check-big",
        pendingText: `Deletando ${shortPath}`,
        doneText: `Deletou ${shortPath}`,
      };
    case "vault_create_folder":
      return {
        iconPending: "folder-plus",
        iconDone: "folder-check",
        pendingText: `Criando pasta ${shortPath}`,
        doneText: `Criou pasta ${shortPath}`,
      };
    default:
      return {
        iconPending: "wrench",
        iconDone: "check-circle-2",
        pendingText: `Executando ${toolName}`,
        doneText: `${toolName} concluído`,
      };
  }
}

/**
 * Extrai uma métrica curta do resultado de uma tool — usado como `content`
 * do ai-comment depois que vira "done". Exemplos:
 *   vault_list  → "8 itens"
 *   vault_read  → "1.2k chars"
 *   vault_edit  → "+12 chars" (tirado da string de retorno se possível)
 */
function summarizeToolResult(toolName: string, result: string): string {
  if (!result) return "";
  switch (toolName) {
    case "vault_list": {
      // Padrão: "Conteúdo de X (Y itens):"
      const m = /\((\d+)\s+itens?\)/.exec(result);
      return m ? `${m[1]} item${m[1] === "1" ? "" : "s"}` : "";
    }
    case "vault_read":
      return `${result.length >= 1000 ? (result.length / 1000).toFixed(1) + "k" : result.length} chars`;
    case "vault_create": {
      const m = /\((\d+)\s+chars\)/.exec(result);
      return m ? `${m[1]} chars` : "";
    }
    case "vault_edit": {
      const m = /\(([+-]\d+)\s+chars\)/.exec(result);
      return m ? `${m[1]} chars` : "";
    }
    default:
      return "";
  }
}

// Placeholder do composer varia pelo modo da sessão — feedback visual de
// que o "papel" do AXXA muda (assistente geral vs. focado no vault, etc.)
// Strings vêm do dicionário i18n (PT-BR / EN-US) — `t.composer.placeholderXxx`.
function placeholderForMode(
  mode: string,
  composer: {
    placeholderChat: string;
    placeholderVaultQa: string;
    placeholderAgent: string;
    placeholderCoder: string;
  }
): string {
  switch (mode) {
    case "vault-qa":
      return composer.placeholderVaultQa;
    case "agent":
      return composer.placeholderAgent;
    case "coder":
      return composer.placeholderCoder;
    default:
      return composer.placeholderChat;
  }
}

/**
 * Traduz qualquer erro de stream/chat numa mensagem amigável + localizada e no
 * código correspondente. Centraliza a tradução (os providers lançam texto
 * PT-only cru; aqui ele vira PT ou EN conforme a UI) e dá à bolha de erro a
 * info pra oferecer a ação certa ("Abrir Configurações" só p/ key inválida/
 * ausente). v0.1.147.
 */
function describeProviderError(
  err: unknown,
  t: ReturnType<typeof getTranslations>,
  providerName: string
): { message: string; code: AIErrorCode } {
  if (err instanceof ProviderError) {
    switch (err.code) {
      case "no-key":
        return { message: t.ai.err.noKey(providerName), code: "no-key" };
      case "invalid-key":
        return { message: t.ai.err.invalidKey(providerName), code: "invalid-key" };
      case "rate-limit":
        return { message: t.ai.err.rateLimit, code: "rate-limit" };
      case "network":
        return { message: t.ai.err.network, code: "network" };
      case "billing":
        return { message: t.ai.err.billing, code: "billing" };
      default:
        // "unknown" carrega a msg detalhada do provider (única com info real).
        return { message: err.message || t.ai.unknownError, code: "unknown" };
    }
  }
  if (err instanceof Error) {
    return { message: err.message || t.ai.unknownError, code: "unknown" };
  }
  return { message: t.ai.unknownError, code: "unknown" };
}

/** Providers que exigem API key (Ollama roda local via endpoint, dispensa). */
function providerNeedsKey(providerId: string): boolean {
  return providerId !== "ollama";
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
  const finishOnboarding = async (openSettings: boolean) => {
    plugin.settings.onboardingDone = true;
    await plugin.saveSettings();
    if (openSettings) handleOpenSettings();
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
    const sync = () => {
      const all = plugin.chatSummaries ?? [];
      setAllChats(all);
      setChatSummaries(all);
      setRecentChats(all.slice(0, 8));
    };
    plugin.loadChatSummaries().then(sync);
    const unsub = plugin.onChatsChange(sync);
    return unsub;
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

  // streamReply: parte reusável do fluxo de envio — vault search → comment
  // "Pensando..." → streamChat → trata erro/abort.
  // Lê a história ATUAL do store (não captura via closure) pra funcionar
  // tanto no handleSend quanto no handleRegenerate (que mutou o array antes).
  // userAttachments: imagens anexadas pela UI — propagadas pra última msg user
  // do history quando o modelo suporta vision.
  const streamReply = async (
    userText: string,
    userAttachments?: import("../providers/base").MessageAttachment[]
  ) => {
    const {
      addMessage,
      removeMessage,
      appendToMessage,
      updateActivity,
      setLoading,
      setStreamingMessageId,
      setAgentSteps,
      addUsage,
      startStreamTimer,
      tickStreamTokens,
      endStreamTimer,
    } = useChatStore.getState();

    // Pre-flight cold-start: sem API key não adianta nem mostrar "Pensando..." —
    // emite direto a bolha de erro ACIONÁVEL (com "Abrir Configurações"). v0.1.147
    if (
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

    // Resolve config completo do effort atual (com overrides do usuário).
    // Centraliza todos os params escaláveis em um objeto só.
    const effortCfg = resolveEffortConfig(effort, plugin.settings.effortConfigs);

    // Modo Vault Q&A: busca notas relevantes ANTES da chamada
    // topK e excerptChars escalam com effort (low=3×300 ... max=12×2000)
    // Se índice RAG existe → busca semântica (cosine sim sobre embeddings).
    // Senão → fallback pra busca keyword (busca por título + ocorrências).
    let vaultContextBlock = "";
    if (activeMode === "vault-qa") {
      const { topK } = effortToVaultLookup(effort, plugin.settings.effortConfigs);

      // Activity de busca — pulsa enquanto procura, vira check com resumo
      const searchActivityId = addMessage({
        type: "ai-comment",
        content: "",
        activity: {
          phase: "pending",
          iconPending: "radar",
          iconDone: "check",
          pendingText: `Buscando até ${topK} trechos (híbrido)`,
          doneText: `Busca concluída`,
        },
      });

      try {
        // Busca híbrida: semantic (RAG) + keyword fundidos via RRF, re-rankeados
        // pelo grafo de links. Funciona com ou sem índice (cai pra keyword).
        const hits = await hybridSearch({
          app: plugin.app,
          index: plugin.vectorIndex,
          creds: {
            openaiApiKey: plugin.settings.openaiApiKey,
            openrouterApiKey: plugin.settings.openrouterApiKey,
            geminiApiKey: plugin.settings.geminiApiKey,
            nimApiKey: plugin.settings.nimApiKey,
          },
          query: userText,
          topK,
        });
        if (hits.length > 0) {
          // Cabeçalho com o título CITÁVEL ([[basename]]) + path de referência,
          // pra IA citar a fonte exata e o link abrir a nota no clique. v0.1.137
          vaultContextBlock = hits
            .map((h) => {
              const base = h.path.replace(/\.md$/i, "").split("/").pop() ?? h.path;
              return `### [[${base}]]\n_(${h.path})_\n\n${h.text}`;
            })
            .join("\n\n---\n\n");
          updateActivity(searchActivityId, {
            phase: "done",
            doneText: `${hits.length} trecho${hits.length > 1 ? "s" : ""} encontrado${hits.length > 1 ? "s" : ""}`,
          });
        } else {
          updateActivity(searchActivityId, {
            phase: "done",
            iconDone: "circle-slash",
            doneText: t.vault.notFound,
          });
        }
      } catch (err) {
        console.error("[axxa] vault search falhou:", err);
        updateActivity(searchActivityId, {
          phase: "failed",
          iconFailed: "x-circle",
          failedText: `${t.ai.errorPrefix} ${err instanceof Error ? err.message : t.ai.unknownError}`,
        });
      }
    }

    // Activity de "Pensando..." estilo Claude chat (sparkles pulsando).
    // Vira done quando o primeiro token chega (em vez de ser removido) —
    // mostra visualmente que o LLM começou a responder.
    const commentId = addMessage({
      type: "ai-comment",
      content: "",
      activity: {
        phase: "pending",
        iconPending: "sparkles",
        iconDone: "check",
        pendingText: t.ai.thinking,
        doneText: t.ai.thinking,
      },
    });
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let responseId: string | null = null;

    try {
      // Inlina notes anexadas no system prompt — não vão pro wire visual,
      // mas o LLM "vê" o conteúdo das notas marcadas pra esta turn.
      let noteContextBlock = "";
      if (userAttachments) {
        const noteAtts = userAttachments.filter(
          (a): a is import("../providers/base").NoteAttachment =>
            a.type === "note"
        );
        if (noteAtts.length > 0) {
          noteContextBlock =
            "\n\n[Notas anexadas pelo usuário]\n\n" +
            noteAtts.map((n) => `### ${n.path}\n\n${n.content}`).join("\n\n---\n\n");
        }
      }
      // System prompt + history centralizados em agent/conversation.ts.
      const fullSystem = buildChatSystemPrompt({
        persona: useChatStore.getState().sessionPersona,
        base: t.systemPrompt.base,
        vaultSuffix: t.systemPrompt.vaultQaSuffix,
        vaultBlock: vaultContextBlock,
        noteBlock: noteContextBlock,
      });
      const history: ProviderMessage[] = [
        { role: "system", content: fullSystem },
        ...storeMessagesToProvider(
          useChatStore.getState().messages,
          userAttachments
        ),
      ];

      const apiKey = apiKeyFor(activeProviderId);

      const maxTokens = effortToMaxTokensSmart(
        effort,
        getContextWindow(activeModel),
        plugin.settings.effortConfigs
      );
      let lastOutputTokens = 0;

      startStreamTimer();
      await activeProvider.streamChat(
        {
          model: activeModel,
          messages: history,
          maxTokens,
          temperature: effortCfg.temperature,
        },
        apiKey,
        (token) => {
          if (responseId === null) {
            // Primeiro token: marca "Pensando..." como done (ícone pop pra check)
            // em vez de remover — fica registrado na timeline da conversa.
            updateActivity(commentId, { phase: "done" });
            responseId = addMessage({ type: "ai-response", content: token });
            setStreamingMessageId(responseId);
          } else {
            appendToMessage(responseId, token);
          }
          tickStreamTokens(token);
        },
        (usage) => {
          lastOutputTokens = usage.output;
          addUsage(usage.input, usage.output);
        },
        controller.signal
      );
      endStreamTimer();

      // Heurística de truncamento: se o output bateu ~o teto de tokens, a
      // resposta provavelmente foi cortada → habilita o botão "Continuar".
      if (
        responseId !== null &&
        lastOutputTokens > 0 &&
        lastOutputTokens >= maxTokens * 0.95
      ) {
        useChatStore.getState().setTruncated(responseId, true);
      }

      if (responseId === null) {
        updateActivity(commentId, { phase: "done" });
        addMessage({ type: "ai-response", content: t.ai.emptyResponse });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (responseId === null) {
          updateActivity(commentId, {
            phase: "failed",
            iconFailed: "circle-stop",
            failedText: t.ai.interrupted,
          });
        }
      } else {
        if (responseId === null) {
          updateActivity(commentId, {
            phase: "failed",
            iconFailed: "x-circle",
            failedText: t.ai.failed,
          });
        }
        const { message, code } = describeProviderError(
          err,
          t,
          activeProvider.name
        );
        addMessage({
          type: "ai-response",
          content: `${t.ai.errorPrefix} ${message}`,
          isError: true,
          errorCode: code,
        });
      }
    } finally {
      setLoading(false);
      setStreamingMessageId(null);
      abortRef.current = null;
    }
  };

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
  const runAgentTurn = async (
    userText: string,
    userAttachments?: import("../providers/base").MessageAttachment[]
  ) => {
    const {
      addMessage,
      removeMessage,
      appendToMessage,
      updateActivity,
      setLoading,
      setStreamingMessageId,
      setAgentSteps,
      addUsage,
      startStreamTimer,
      tickStreamTokens,
      endStreamTimer,
    } = useChatStore.getState();

    // Pre-flight cold-start: sem API key, erro acionável direto. v0.1.147
    if (
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

    if (!activeProvider.supportsTools) {
      addMessage({
        type: "ai-response",
        content: `${t.ai.errorPrefix} O provider "${activeProvider.name}" não suporta tool calling. Use OpenAI (que tem function calling) pro Agent Mode.`,
      });
      return;
    }

    setLoading(true);
    // Activity inicial "Pensando" — pulsa enquanto LLM processa, vira check
    // quando o stream começa (primeiro token).
    const commentId = addMessage({
      type: "ai-comment",
      content: "",
      activity: {
        phase: "pending",
        iconPending: "sparkles",
        iconDone: "check",
        pendingText: t.agent.thinking,
        doneText: t.agent.thinking,
      },
    });

    const permissionLevel: PermissionLevel = (plugin.settings.agentPermissionLevel ||
      "ask") as PermissionLevel;
    // Diff-approval (aposta #2): toda ação que ESCREVE passa por preview/diff
    // antes de gravar (default ON). "Aprovar todas" reseta a cada rodada.
    const diffApproval = plugin.settings.agentDiffApproval !== false;
    agentApproveAllRef.current = false;

    // Config do effort atual — agentMaxTurns, retry, loop detection, etc.
    const effortCfg = resolveEffortConfig(effort, plugin.settings.effortConfigs);

    // System prompt + history do agent (persona é PREPENDIDA no agent) —
    // centralizados em agent/conversation.ts.
    const history: ProviderMessage[] = [
      {
        role: "system",
        content: buildAgentSystemPrompt(
          useChatStore.getState().sessionPersona,
          t.agent.systemPrompt
        ),
      },
      // toolMode=true → o agent declara tools, então agentSteps são expandidos
      // pro shape wire (replay PRECISO). Nos demais modos fica false (achata).
      ...storeMessagesToProvider(
        useChatStore.getState().messages,
        userAttachments,
        true
      ),
    ];

    const tools = TOOL_DEFINITIONS.map((td) => ({
      name: td.name,
      description: td.description,
      parameters: td.parameters,
    }));

    const apiKey = apiKeyFor(activeProviderId);

    // MAX_TURNS agora vem do effort config — low=5, med=12, high=25,
    // xhigh=60, max=200. User pode override via Settings → Effort.
    // 0 = uncapped (loop detection é o único limite).
    const MAX_TURNS = effortCfg.agentMaxTurns;
    const isUncapped = MAX_TURNS === 0;
    // Loop detection: guarda assinatura das últimas N tool calls pra detectar
    // o LLM ficar batendo a mesma chamada em loop infinito. Quando detecta,
    // injeta uma msg "tool" forçada pedindo pra mudar de estratégia.
    const loopWindow = effortCfg.loopDetectionWindow;
    const recentCallSignatures: string[] = [];
    // Ações de tool do run inteiro — anexadas à resposta final p/ continuidade.
    const runSteps: import("../agent/types").AIToolStep[] = [];

    let turn = 0;
    let firstTurn = true;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      while (isUncapped || turn < MAX_TURNS) {
        turn++;

        // Cria msg ai-response que vai ser preenchida token-a-token.
        // Cada turno é um message separado pra ficar claro qual tokens
        // pertencem a qual round de tool execution.
        let responseId: string | null = null;
        const onToken = (token: string) => {
          if (responseId === null) {
            // Primeiro token do primeiro turno: marca a activity de "Pensando"
            // como done (ícone vira check com pop animation) e inicia a resposta.
            if (firstTurn) {
              updateActivity(commentId, { phase: "done" });
              firstTurn = false;
            }
            responseId = addMessage({ type: "ai-response", content: token });
            setStreamingMessageId(responseId);
          } else {
            appendToMessage(responseId, token);
          }
          tickStreamTokens(token);
        };

        startStreamTimer();
        const response = await activeProvider.streamChat(
          {
            model: activeModel,
            messages: history,
            maxTokens: effortToMaxTokensSmart(
              effort,
              getContextWindow(activeModel),
              plugin.settings.effortConfigs
            ),
            temperature: effortCfg.temperature,
            tools,
          },
          apiKey,
          onToken,
          (usage) => addUsage(usage.input, usage.output),
          controller.signal
        );
        endStreamTimer();
        setStreamingMessageId(null);

        // Caso 1: stream terminou sem tool_calls = resposta final
        if (!response.toolCalls || response.toolCalls.length === 0) {
          // Se não veio nem um token (raro), insere uma resposta vazia
          if (responseId === null) {
            if (firstTurn) {
              updateActivity(commentId, { phase: "done" });
              firstTurn = false;
            }
            responseId = addMessage({
              type: "ai-response",
              content: response.content || t.ai.emptyResponse,
            });
          }
          // Anexa as ações do run à resposta final → continuidade ao reabrir.
          if (runSteps.length > 0 && responseId) {
            setAgentSteps(responseId, runSteps);
          }
          return;
        }

        // Caso 2: tool_calls — finaliza mensagem do turno (se já criada) e
        // adiciona msg do assistant na history pra próximo loop.
        if (firstTurn) {
          updateActivity(commentId, { phase: "done" });
          firstTurn = false;
        }
        history.push({
          role: "assistant",
          content: response.content ?? "",
          toolCalls: response.toolCalls,
        });

        // Loop detection: assinatura = name + JSON(args). Se a mesma assinatura
        // aparecer `loopWindow` vezes consecutivas, injetamos um nudge na
        // history e cortamos o loop. Evita o LLM "ficar girando" sem entender
        // que tá repetindo a mesma chamada que já falhou.
        let loopDetected = false;
        if (loopWindow > 0) {
          for (const call of response.toolCalls) {
            recentCallSignatures.push(
              makeCallSignature(call.name, call.arguments)
            );
          }
          trimSignatures(recentCallSignatures, loopWindow * 4);
          loopDetected = isLooping(recentCallSignatures, loopWindow);
        }

        // Executa as tool calls — em paralelo se effort permite e há >1 call,
        // senão sequencial. Modais de confirmação são SEMPRE sequenciais
        // (não dá pra abrir 2 ConfirmationModal ao mesmo tempo).
        type CallResult = {
          callId: string;
          content: string;
          activityId: string;
          spec: ReturnType<typeof agentActivitySpec>;
          meta: string;
          ok: boolean;
        };

        // Pre-check de permissão (sequencial) e cria placeholders de activity.
        // Isso garante que o usuário vê os modais um por vez e a ordem do
        // resultado preserva a ordem em que o LLM pediu.
        const preparedCalls: Array<{
          call: typeof response.toolCalls[number];
          def: ReturnType<typeof getToolDefinition>;
          approved: boolean;
          activityId: string;
          spec: ReturnType<typeof agentActivitySpec>;
        }> = [];
        for (const call of response.toolCalls) {
          // generate_image: fluxo PRÓPRIO (modal de confirmação modelo+preço+
          // conectado + render inline), fora do registry de tools de vault. O
          // usuário confirma o modelo; a imagem entra na conversa. v0.1.167
          if (call.name === "generate_image") {
            const genPrompt =
              typeof call.arguments.prompt === "string"
                ? call.arguments.prompt
                : "";
            const imgAtt = pendingAttachments.find(
              (p) => p.attachment.type === "image"
            );
            let inputImage: { data: string; mimeType: string } | undefined;
            if (imgAtt && imgAtt.attachment.type === "image") {
              const mm = /^data:([^;]+);base64,(.+)$/.exec(
                imgAtt.attachment.dataUrl
              );
              if (mm) inputImage = { mimeType: mm[1], data: mm[2] };
            }
            const modal = new ImageGenModal(plugin.app, {
              options: buildImageModelOptions(),
              initialPrompt: genPrompt,
              hasInputImage: !!inputImage,
              strings: t.imageGen,
            });
            const choice = await modal.openAndWait();
            let resultText: string;
            let ok = false;
            if (!choice) {
              resultText =
                "Usuário cancelou a geração da imagem. NÃO tente de novo automaticamente — pergunte o que ele prefere.";
            } else {
              const gen = await runImageGeneration(
                choice.prompt,
                choice.providerId,
                choice.model,
                choice.useInputImage ? inputImage : undefined
              );
              ok = gen.ok;
              resultText = gen.ok
                ? `Imagem gerada (${choice.model}) e já renderizada na conversa: ${gen.paths.join(", ")}. NÃO repita a geração; comente o resultado pro usuário.`
                : `Falha ao gerar imagem: ${gen.error}`;
            }
            history.push({
              role: "tool",
              toolCallId: call.id,
              content: resultText,
            });
            runSteps.push({
              id: call.id,
              name: "generate_image",
              arguments: call.arguments,
              result: resultText.slice(0, 1200),
              ok,
            });
            continue;
          }
          const def = getToolDefinition(call.name);
          if (!def) {
            addMessage({
              type: "ai-comment",
              content: "",
              activity: {
                phase: "failed",
                iconPending: "wrench",
                iconFailed: "alert-triangle",
                pendingText: `Tool desconhecida: ${call.name}`,
                failedText: `Tool desconhecida: ${call.name}`,
              },
            });
            history.push({
              role: "tool",
              toolCallId: call.id,
              content: `Tool "${call.name}" não existe. Use uma das tools disponíveis.`,
            });
            continue;
          }

          // Gate: roda direto ("auto") ou abre o preview de confirmação.
          // Lógica (permissão + diff-approval + irreversível) em permissions.ts.
          const gate = decideToolGate(def, permissionLevel, {
            diffApproval,
            approveAll: agentApproveAllRef.current,
          });
          let approved = gate === "auto";
          if (gate === "confirm") {
            const modal = new ConfirmationModal(plugin.app, {
              toolCall: call,
              definition: def,
            });
            const res = await modal.openAndWait();
            approved = res.approved;
            if (res.approveAll) agentApproveAllRef.current = true;
          }

          if (!approved) {
            addMessage({
              type: "ai-comment",
              content: "",
              activity: {
                phase: "failed",
                iconPending: "shield",
                iconFailed: "ban",
                pendingText: `Negado: ${call.name}`,
                failedText: `Negado: ${call.name}`,
              },
            });
            history.push({
              role: "tool",
              toolCallId: call.id,
              content:
                "User negou esta ação. NÃO tente repetir essa mesma chamada — considere outra abordagem ou pergunte ao user.",
            });
            continue;
          }

          const spec = agentActivitySpec(call.name, call.arguments);
          const activityId = addMessage({
            type: "ai-comment",
            content: "",
            activity: {
              phase: "pending",
              iconPending: spec.iconPending,
              iconDone: spec.iconDone,
              pendingText: spec.pendingText,
              doneText: spec.doneText,
            },
          });
          preparedCalls.push({ call, def, approved, activityId, spec });
        }

        // Executor com retry pra cada call individual.
        const execCall = async (
          prep: (typeof preparedCalls)[number]
        ): Promise<CallResult> => {
          const { call, activityId, spec } = prep;
          const executor = TOOL_REGISTRY[call.name];
          const maxAttempts = 1 + Math.max(0, effortCfg.toolRetryOnError);
          let lastErr: unknown = null;
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              const result = await executor(
                {
                  app: plugin.app,
                  vectorIndex: plugin.vectorIndex,
                  embed: {
                    openaiApiKey: plugin.settings.openaiApiKey,
                    openrouterApiKey: plugin.settings.openrouterApiKey,
                    geminiApiKey: plugin.settings.geminiApiKey,
                    nimApiKey: plugin.settings.nimApiKey,
                  },
                },
                call.arguments
              );
              const meta = summarizeToolResult(call.name, result);
              // Detalhe expansível do chip (estilo Claude Code) — snippet do
              // resultado, truncado pra não estourar a timeline.
              const detail =
                result && result.length > 800
                  ? result.slice(0, 800).trimEnd() + "\n…"
                  : result || undefined;
              updateActivity(activityId, { phase: "done", detail }, meta);
              return {
                callId: call.id,
                content: result,
                activityId,
                spec,
                meta,
                ok: true,
              };
            } catch (err) {
              lastErr = err;
              // Só retenta erros transitórios (network / fs lock). Path errado
              // ou arg inválido não vão dar certo no retry — cai direto.
              const msg = err instanceof Error ? err.message : "";
              if (!isTransientError(msg) || attempt === maxAttempts) break;
            }
          }
          const msg =
            lastErr instanceof Error ? lastErr.message : "Erro desconhecido.";
          updateActivity(
            activityId,
            {
              phase: "failed",
              iconFailed: "x-circle",
              failedText: spec.pendingText.replace(
                /^(Lendo|Editando|Criando|Movendo|Deletando|Listando|Executando)/,
                "Falhou em"
              ),
            },
            msg
          );
          return {
            callId: call.id,
            content: `ERRO: ${msg}. NÃO repita essa mesma chamada — ajuste path/args ou tente outra abordagem.`,
            activityId,
            spec,
            meta: "",
            ok: false,
          };
        };

        let results: CallResult[];
        if (effortCfg.parallelToolCalls && preparedCalls.length > 1) {
          // Paralelo: roda todas ao mesmo tempo, espera todas terminarem.
          // Cada call já tem seu próprio activity, não há disputa de UI.
          results = await Promise.all(preparedCalls.map(execCall));
        } else {
          results = [];
          for (const prep of preparedCalls) {
            results.push(await execCall(prep));
          }
        }
        for (const r of results) {
          history.push({
            role: "tool",
            toolCallId: r.callId,
            content: r.content,
          });
          // Acumula pra persistência (result truncado p/ não inchar o .md).
          const call = response.toolCalls.find((c) => c.id === r.callId);
          if (call) {
            runSteps.push({
              id: r.callId,
              name: call.name,
              arguments: call.arguments,
              result: r.content.slice(0, 1200),
              ok: r.ok,
            });
          }
        }

        // Se detectou loop, injeta nudge pro LLM e segue um turn — se ele
        // insistir, dá outro turn e o próximo check vai cortar denovo.
        // Se o loop for muito persistente (3 nudges seguidos), aborta de vez.
        if (loopDetected) {
          history.push({
            role: "user",
            content:
              "⚠️ Detectei que você repetiu a mesma tool call exata várias vezes. " +
              "Isso indica que sua abordagem atual não está funcionando. " +
              "PARE de repetir, RECONSIDERE a estratégia (talvez você precise " +
              "de informação adicional — tente vault_list/vault_read em outro path) " +
              "OU pergunte ao usuário pra ele esclarecer. Não repita a mesma chamada.",
          });
          addMessage({
            type: "ai-comment",
            content: "",
            activity: {
              phase: "failed",
              iconPending: "rotate-cw",
              iconFailed: "alert-triangle",
              pendingText: "Loop detectado — pedindo reconsideração",
              failedText: "Loop detectado — pedi reconsideração ao agent",
            },
          });
          // Limpa o histórico de assinaturas pra dar chance limpa ao retry
          recentCallSignatures.length = 0;
        }
      }
      const maxId = addMessage({
        type: "ai-response",
        content: t.agent.maxTurnsReached(MAX_TURNS),
      });
      if (runSteps.length > 0) setAgentSteps(maxId, runSteps);
    } catch (err) {
      if (firstTurn) {
        // Em caso de erro antes do primeiro token, marca o "Pensando..." como
        // failed (ícone vira X) em vez de remover — dá feedback claro do que aconteceu.
        if (err instanceof DOMException && err.name === "AbortError") {
          updateActivity(commentId, {
            phase: "failed",
            iconFailed: "circle-stop",
            failedText: t.ai.interrupted,
          });
        } else {
          updateActivity(commentId, {
            phase: "failed",
            iconFailed: "x-circle",
            failedText: t.ai.failed,
          });
        }
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        // Abort silencioso — usuário clicou em parar
      } else {
        const { message, code } = describeProviderError(
          err,
          t,
          activeProvider.name
        );
        addMessage({
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

  // Anexos pendentes (multi-tipo) — limpa após envio.
  // Cada attachment ganha id estável pra UI tracking — não persiste no .md.
  interface PendingAttachmentEntry {
    id: string;
    attachment: MessageAttachment;
    name: string;
  }
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
  const runGenerationTurn = async (
    prompt: string,
    caps: ReturnType<typeof getModelCapabilities>
  ) => {
    const {
      addMessage,
      updateActivity,
      setLoading,
      newChat,
    } = useChatStore.getState();
    void newChat;

    setLoading(true);
    const mediaType: GenerationMediaType = caps.imageGen
      ? "image"
      : caps.audioGen
        ? "audio"
        : "video";

    // Pre-flight HONESTO: o modelo tem a cap, mas o provider implementa de fato?
    // (ex: Veo/Sora flagam videoGen, mas não há generateVideo). Avisa com clareza
    // em vez de deixar estourar "Provider não implementa…". Auditoria v0.1.164.
    if (!generationSupported(activeProviderId, mediaType)) {
      setLoading(false);
      addMessage({
        type: "ai-response",
        content: `${t.ai.errorPrefix} ${t.ai.genUnsupported(mediaType, generationSupportSummary())}`,
        isError: true,
        errorCode: "unknown",
      });
      return;
    }

    const activityId = addMessage({
      type: "ai-comment",
      content: "",
      activity: {
        phase: "pending",
        iconPending: mediaType === "image" ? "image-plus" : mediaType === "audio" ? "volume-2" : "video",
        iconDone: "check",
        pendingText: mediaType === "image"
          ? "Gerando imagem..."
          : mediaType === "audio"
            ? "Gerando áudio..."
            : "Gerando vídeo...",
        doneText: "",
      },
    });

    try {
      const provider = activeProvider;
      const apiKey = apiKeyFor(activeProviderId);
      let items;
      if (mediaType === "image") {
        if (!provider.generateImage) {
          throw new Error(`Provider "${provider.name}" não implementa generateImage.`);
        }
        items = await provider.generateImage(
          { model: activeModel, prompt, size: "1024x1024" },
          apiKey
        );
      } else if (mediaType === "audio") {
        if (!provider.generateAudio) {
          throw new Error(`Provider "${provider.name}" não implementa generateAudio.`);
        }
        items = await provider.generateAudio(
          { model: activeModel, prompt },
          apiKey
        );
      } else {
        if (!provider.generateVideo) {
          throw new Error(`Provider "${provider.name}" não implementa generateVideo.`);
        }
        items = await provider.generateVideo(
          { model: activeModel, prompt },
          apiKey
        );
      }

      // Salva cada item gerado no vault com sidecar de metadata
      const savedPaths: string[] = [];
      for (const item of items) {
        const result = await saveGeneration(
          plugin.app,
          plugin.settings.generationPath,
          item.data,
          {
            id: makeId(),
            type: mediaType,
            provider: activeProviderId,
            model: activeModel,
            prompt,
            created: new Date().toISOString(),
            size: item.data.byteLength,
            mime: item.mime,
            width: item.width,
            height: item.height,
            duration: item.duration,
            seed: item.seed,
            chatId: useChatStore.getState().currentChatId ?? undefined,
          }
        );
        savedPaths.push(result.mediaPath);
      }

      updateActivity(
        activityId,
        {
          phase: "done",
          doneText: `${items.length} ${mediaType === "image" ? "imagem" : mediaType === "audio" ? "áudio" : "vídeo"}${items.length > 1 ? "s" : ""} gerado${items.length > 1 ? "s" : ""}`,
        },
        savedPaths[0]
      );

      // Resposta com wikilinks pra cada mídia salva (renderizado como embed pelo Obsidian)
      const responseContent = savedPaths
        .map((p) => mediaType === "image" ? `![[${p}]]` : `[[${p}]]`)
        .join("\n\n");
      addMessage({ type: "ai-response", content: responseContent });
    } catch (err) {
      const { message, code } = describeProviderError(
        err,
        t,
        activeProvider.name
      );
      updateActivity(
        activityId,
        {
          phase: "failed",
          iconFailed: "x-circle",
          failedText: t.ai.failed,
        },
        message
      );
      addMessage({
        type: "ai-response",
        content: `${t.ai.errorPrefix} ${message}`,
        isError: true,
        errorCode: code,
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // Geração de imagem IN-CHAT (sem trocar de modelo) — v0.1.166
  // O fallback que o user pediu: abre um modal de confirmação (modelo + preço +
  // conectado), gera com o modelo escolhido e injeta a imagem NA CONVERSA ATUAL.
  // Suporta IMG2IMG quando há imagem anexada e o modelo edita (Nano Banana).
  // ============================================================

  /** Enumera os modelos de imagem ATIVOS (que o plugin gera de fato) com preço
   *  por imagem + se o provider está conectado (first-user case). */
  const buildImageModelOptions = (): ImageModelOption[] => {
    const opts: ImageModelOption[] = [];
    const active = plugin.settings.activeModels ?? {};
    for (const providerId of Object.keys(active)) {
      if (!generationSupported(providerId, "image")) continue;
      for (const model of active[providerId] ?? []) {
        if (!getModelCapabilities(providerId, model).imageGen) continue;
        const pricing = getPricing(providerId, model);
        opts.push({
          providerId,
          providerLabel: getProvider(providerId).name,
          model,
          pricePerImage: pricing.imagePerCall ?? undefined,
          connected:
            providerId === "ollama" ? true : apiKeyFor(providerId).trim().length > 0,
          // Edição (IMG2IMG) hoje só no Nano Banana.
          supportsEdit:
            providerId === "gemini" && model.startsWith("gemini-2.5-flash-image"),
        });
      }
    }
    return opts;
  };

  /** Gera UMA imagem com provider/modelo explícitos e injeta na conversa atual.
   *  Retorna o resultado (pra tool do agente reportar). NÃO mexe no loading
   *  global — quem chama gerencia. */
  const runImageGeneration = async (
    prompt: string,
    providerId: string,
    model: string,
    inputImage?: { data: string; mimeType: string }
  ): Promise<{ ok: boolean; paths: string[]; error?: string }> => {
    const { addMessage, updateActivity } = useChatStore.getState();
    const provider = getProvider(providerId);
    const apiKey = apiKeyFor(providerId);
    if (providerNeedsKey(providerId) && !apiKey.trim()) {
      const msg = t.ai.err.noKey(provider.name);
      addMessage({
        type: "ai-response",
        content: `${t.ai.errorPrefix} ${msg}`,
        isError: true,
        errorCode: "no-key",
      });
      return { ok: false, paths: [], error: msg };
    }
    if (!generationSupported(providerId, "image") || !provider.generateImage) {
      const msg = t.ai.genUnsupported("image", generationSupportSummary());
      addMessage({
        type: "ai-response",
        content: `${t.ai.errorPrefix} ${msg}`,
        isError: true,
        errorCode: "unknown",
      });
      return { ok: false, paths: [], error: msg };
    }
    const activityId = addMessage({
      type: "ai-comment",
      content: "",
      activity: {
        phase: "pending",
        iconPending: inputImage ? "wand-2" : "image-plus",
        iconDone: "check",
        pendingText: inputImage ? "Editando imagem..." : "Gerando imagem...",
        doneText: "",
        placeholder: "image",
      },
    });
    try {
      const items = await provider.generateImage(
        {
          model,
          prompt,
          size: "1024x1024",
          ...(inputImage ? { image: inputImage } : {}),
        },
        apiKey
      );
      const savedPaths: string[] = [];
      for (const item of items) {
        const r = await saveGeneration(
          plugin.app,
          plugin.settings.generationPath,
          item.data,
          {
            id: makeId(),
            type: "image",
            provider: providerId,
            model,
            prompt,
            created: new Date().toISOString(),
            size: item.data.byteLength,
            mime: item.mime,
            width: item.width,
            height: item.height,
            seed: item.seed,
            chatId: useChatStore.getState().currentChatId ?? undefined,
          }
        );
        savedPaths.push(r.mediaPath);
      }
      updateActivity(
        activityId,
        {
          phase: "done",
          doneText: `${items.length} imagem${items.length > 1 ? "ns" : ""} gerada${items.length > 1 ? "s" : ""}`,
        },
        savedPaths[0]
      );
      addMessage({
        type: "ai-response",
        content: savedPaths.map((p) => `![[${p}]]`).join("\n\n"),
      });
      return { ok: true, paths: savedPaths };
    } catch (err) {
      const { message, code } = describeProviderError(err, t, provider.name);
      updateActivity(
        activityId,
        { phase: "failed", iconFailed: "x-circle", failedText: t.ai.failed },
        message
      );
      addMessage({
        type: "ai-response",
        content: `${t.ai.errorPrefix} ${message}`,
        isError: true,
        errorCode: code,
      });
      return { ok: false, paths: [], error: message };
    }
  };

  /** Abre o modal de confirmação (fallback do + → Criar imagem). */
  const handleCreateImage = async () => {
    // Imagem anexada vira candidata a IMG2IMG.
    const imgAtt = pendingAttachments.find(
      (p) => p.attachment.type === "image"
    );
    let inputImage: { data: string; mimeType: string } | undefined;
    if (imgAtt && imgAtt.attachment.type === "image") {
      const m = /^data:([^;]+);base64,(.+)$/.exec(imgAtt.attachment.dataUrl);
      if (m) inputImage = { mimeType: m[1], data: m[2] };
    }
    const modal = new ImageGenModal(plugin.app, {
      options: buildImageModelOptions(),
      // Prefill com o que o user já digitou no composer (#9).
      initialPrompt: composerDraftRef.current.trim(),
      hasInputImage: !!inputImage,
      strings: t.imageGen,
    });
    const choice = await modal.openAndWait();
    if (!choice) return;
    const store = useChatStore.getState();
    if (store.messages.length === 0) {
      const newId = makeId();
      store.setCurrentChatId(newId);
      store.setCurrentChatTitle(generateTitle(choice.prompt));
      store.lockSession(activeProviderId, activeModel, activeMode);
    }
    store.addMessage({ type: "user", content: `🖼️ ${choice.prompt}` });
    if (choice.useInputImage && inputImage) {
      setPendingAttachments([]);
    }
    store.setLoading(true);
    try {
      await runImageGeneration(
        choice.prompt,
        choice.providerId,
        choice.model,
        choice.useInputImage ? inputImage : undefined
      );
    } finally {
      store.setLoading(false);
    }
  };

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

    try {
      // Emenda um espaço antes pra não colar a continuação na última palavra
      appendToMessage(aiMessageId, " ");
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
    useChatStore.getState().setMessages(current.slice(0, idx));
    useChatStore.getState().addMessage({ type: "user", content: text });
    if (activeMode === "agent") await runAgentTurn(text);
    else await streamReply(text);
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

  const handleOpenSettings = () => {
    const app = plugin.app as unknown as {
      setting: { open: () => void; openTabById: (id: string) => void };
    };
    app.setting.open();
    app.setting.openTabById("axxa-os-ai-agent");
  };

  const handleNewChat = () => {
    abortRef.current?.abort();
    useChatStore.getState().newChat();
    setView("chat");
  };

  // Deleta uma conversa (vai pra lixeira do sistema, recuperável). #3
  const handleDeleteChat = async (chatId: string, mode: string) => {
    try {
      await deleteChat(plugin.app, plugin.settings.chatsPath, mode, chatId);
      plugin.removeChatSummary(chatId);
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
    try {
      await navigator.clipboard.writeText(`# ${title}\n\n${body}\n`);
      new Notice(t.header.copyConversationDone);
    } catch (err) {
      console.error("[axxa] copy conversation falhou:", err);
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

  const handleStarterModel = async (m: string) => {
    switch (providerSel) {
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
    } catch (err) {
      console.error("[axxa] loadChat falhou:", err);
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
            (isLoading ? " axxa-bg-active" : "")
          }
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
          />
        {view === "conversations" ? (
          <ConversationsList
            chats={allChats}
            onLoadChat={handleLoadChatFromList}
            onClose={() => setView("chat")}
            visibleChips={plugin.settings.listChips}
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
          canAccess("projects", tier) ? (
            <ProjectsScreen onClose={() => setView("chat")} />
          ) : (
            <LockedScreen view="projects" onClose={() => setView("chat")} onSeePlans={() => setView("plans")} />
          )
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
          <StarterScreen
            plugin={plugin}
            provider={providerSel}
            model={starterModel}
            effort={effort}
            mode={mode}
            recentChats={recentChats}
            summaries={chatSummaries}
            activeModels={plugin.settings.activeModels}
            onProviderChange={handleStarterProvider}
            onModelChange={handleStarterModel}
            onEffortChange={handleSelectEffort}
            onModeChange={handleStarterMode}
            onLoadChat={handleLoadChat}
            onOpenConversations={handleOpenConversations}
            onOpenSettings={handleOpenSettings}
            onPromptStarter={handlePromptStarter}
            visibleChips={plugin.settings.listChips}
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
          {/* Gaveta lateral de conversas (avatar do header). v0.1.145 */}
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            chats={allChats}
            onLoadChat={handleLoadChat}
            onNewChat={handleNewChat}
            onOpenAll={handleOpenConversations}
            onOpenSettings={handleOpenSettings}
            onNavigate={handleNavigate}
            tier={tier}
            onDeleteChat={handleDeleteChat}
          />
        </div>
        </ChatActionsContext.Provider>
      </TranslationsContext.Provider>
    </AppContext.Provider>
  );
}
