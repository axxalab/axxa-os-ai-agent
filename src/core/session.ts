// src/core/session.ts
// ChatSession — o controller da conversa. É a "API CRUD" que a casca (UI)
// consome; não sabe de React nem de DOM. Qualquer redesign da interface fala
// com o app por aqui (+ o store zustand pra ler mensagens).
//
//   estado da conversa .......... store zustand (src/store/chat.ts)
//   seleção pré-lock ............ aqui (provider / modelo / modo / effort)
//   persistência ................ .md no vault (chatPersistence) + cache de
//                                 summaries do plugin (main.ts)
//   stream / agente ............. chatEngine.ts / agentTurn.ts
//
// Regras herdadas do app antigo (validadas em uso):
//   - a 1ª mensagem cria id/título e TRAVA provider+modelo+modo da sessão
//     (consistência de contexto); "New chat" destrava;
//   - auto-save debounced a cada mudança nas mensagens; abrir um chat NÃO
//     regrava o arquivo (pula um ciclo); fechar a view flusha o save pendente;
//   - erros (isError) não persistem; fontes de projeto entram como notas de
//     contexto no 1º envio de um chat criado "dentro" do projeto.

import { Notice, TFile } from "obsidian";
import type AxxaPlugin from "../main";
import {
  useChatStore,
  type AIResponseMessage,
  type ChatMessage,
  type UserMessage,
} from "../store/chat";
import { getProvider } from "../providers";
import { getTranslations } from "../i18n";
import {
  saveChat,
  loadChat,
  deleteChat,
  renameChat,
  generateTitle,
  type ChatData,
} from "./chatPersistence";
import { makeId, providerNeedsKey } from "./helpers";
import { streamReply, type EngineCtx } from "./chatEngine";
import { runAgentTurn } from "./agentTurn";
import type { NoteAttachment } from "../providers/base";
import type { Project } from "../projects";

export type ChatMode = "chat" | "vault-qa" | "agent";
export const CHAT_MODES: ChatMode[] = ["chat", "vault-qa", "agent"];
export function isChatMode(v: string | undefined | null): v is ChatMode {
  return !!v && (CHAT_MODES as string[]).includes(v);
}

export interface SessionConfig {
  provider: string;
  model: string;
  mode: ChatMode;
  effort: string;
  /** true após a 1ª mensagem: provider/modelo/modo não mudam mais neste chat. */
  locked: boolean;
}

/** O mínimo que `load()` precisa pra achar o .md (um ChatSummary serve). */
export interface ChatRef {
  id: string;
  mode: string;
}

export class ChatSession {
  private readonly t = getTranslations("en-us");
  private readonly abortRef = { current: null as AbortController | null };
  private readonly approveAllRef = { current: false };
  /** Projeto que vai receber o chat criado no próximo 1º envio. */
  private pendingProjectId: string | null = null;
  /** Fontes do projeto — viram notas de contexto no próximo envio. */
  private pendingNotes: NoteAttachment[] = [];
  private saveTimer: number | null = null;
  private pendingSave: (() => void) | null = null;
  private skipNextSave = false;
  private readonly listeners = new Set<() => void>();
  private readonly unsubStore: () => void;
  private provider: string;
  private model: string;
  private mode: ChatMode;
  private effort: string;

  constructor(private readonly plugin: AxxaPlugin) {
    const s = plugin.settings;
    this.provider = s.defaultProvider || "openai";
    this.model = this.modelFor(this.provider);
    this.mode = isChatMode(s.defaultMode) ? s.defaultMode : "chat";
    this.effort = s.defaultEffort || "med";
    // Auto-save: qualquer mudança no array de mensagens agenda um save.
    this.unsubStore = useChatStore.subscribe((state, prev) => {
      if (state.messages !== prev.messages) this.scheduleSave();
    });
    // Cache de summaries aquecido — o upsert incremental depende dele.
    void plugin.loadChatSummaries();
  }

  /** Chamar ao fechar a view: flusha o save pendente e cancela o stream. */
  dispose(): void {
    this.unsubStore();
    this.flushSave();
    this.abortRef.current?.abort();
    this.listeners.clear();
  }

  /** Inscreve um callback pra mudanças de seleção/sessão. Retorna unsubscribe. */
  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  private emit(): void {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error("[axxa] session listener falhou:", err);
      }
    });
  }

  // ── Seleção (provider / modelo / modo / effort) ─────────────────────────

  /** Config efetiva: a travada na sessão (se houver) ou a seleção atual. */
  get config(): SessionConfig {
    const st = useChatStore.getState();
    const locked = st.sessionProvider !== null;
    const provider = st.sessionProvider ?? this.provider;
    return {
      provider,
      model: st.sessionModel ?? this.model,
      mode: isChatMode(st.sessionMode) ? st.sessionMode : this.mode,
      effort: this.effort,
      locked,
    };
  }

  /** Modelo salvo pro provider (campos legados por provider nas settings). */
  modelFor(provider: string): string {
    const s = this.plugin.settings;
    const fromField = (() => {
      switch (provider) {
        case "anthropic":
          return s.anthropicModel;
        case "gemini":
          return s.geminiModel;
        case "openrouter":
          return s.openrouterModel;
        case "nim":
          return s.nimModel;
        case "ollama":
          return s.ollamaModel;
        default:
          return s.defaultModel;
      }
    })();
    return fromField || s.activeModels?.[provider]?.[0] || "";
  }

  /** Opções do seletor de modelo (modelos ativos + o atual, se faltar). */
  modelOptions(provider: string): string[] {
    const list = this.plugin.settings.activeModels?.[provider] ?? [];
    const cfg = this.config;
    const cur = cfg.provider === provider ? cfg.model : this.modelFor(provider);
    return cur && !list.includes(cur) ? [cur, ...list] : list;
  }

  /** Credencial do provider (Ollama: o endpoint faz o papel da key). */
  apiKeyFor(provider: string): string {
    return this.plugin.providerCredential(provider);
  }

  setProvider(provider: string): void {
    if (this.config.locked) return;
    this.provider = provider;
    this.model = this.modelFor(provider);
    this.plugin.settings.defaultProvider = provider;
    void this.plugin.saveSettings();
    this.emit();
  }

  setModel(model: string): void {
    if (this.config.locked || !model) return;
    this.model = model;
    const s = this.plugin.settings;
    switch (this.provider) {
      case "anthropic":
        s.anthropicModel = model;
        break;
      case "gemini":
        s.geminiModel = model;
        break;
      case "openrouter":
        s.openrouterModel = model;
        break;
      case "nim":
        s.nimModel = model;
        break;
      case "ollama":
        s.ollamaModel = model;
        break;
      default:
        s.defaultModel = model;
    }
    void this.plugin.saveSettings();
    this.emit();
  }

  setMode(mode: ChatMode): void {
    if (this.config.locked) return;
    this.mode = mode;
    this.plugin.settings.defaultMode = mode;
    void this.plugin.saveSettings();
    this.emit();
  }

  setEffort(effort: string): void {
    this.effort = effort;
    this.plugin.settings.defaultEffort = effort;
    void this.plugin.saveSettings();
    this.emit();
  }

  // ── Conversa ────────────────────────────────────────────────────────────

  /** Envia uma mensagem no modo ativo (chat / vault-qa / agent). */
  async send(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    const st = useChatStore.getState();
    if (st.isLoading) return;
    const cfg = this.config;
    const provider = getProvider(cfg.provider);

    // Pre-flight de key ANTES de criar o chat — senão o 1º envio sem key
    // persistia um chat-fantasma (só a pergunta).
    if (
      st.messages.length === 0 &&
      providerNeedsKey(cfg.provider) &&
      !this.apiKeyFor(cfg.provider).trim()
    ) {
      st.addMessage({
        type: "ai-response",
        content: `${this.t.ai.errorPrefix} ${this.t.ai.err.noKey(provider.name)}`,
        isError: true,
        errorCode: "no-key",
      });
      return;
    }

    // 1ª mensagem: id + título + lock da sessão (+ associação ao projeto).
    if (st.messages.length === 0) {
      const id = makeId();
      st.setCurrentChatId(id);
      st.setCurrentChatTitle(generateTitle(trimmed));
      st.lockSession(cfg.provider, cfg.model, cfg.mode);
      if (this.pendingProjectId) {
        const pid = this.pendingProjectId;
        this.pendingProjectId = null;
        await this.updateProjects((prev) =>
          prev.map((p) =>
            p.id === pid && !p.chatIds.includes(id)
              ? { ...p, chatIds: [id, ...p.chatIds] }
              : p
          )
        );
      }
    }

    const attachments =
      this.pendingNotes.length > 0 ? [...this.pendingNotes] : undefined;
    this.pendingNotes = [];

    st.addMessage({ type: "user", content: trimmed });
    this.emit();

    const ctx: EngineCtx = {
      plugin: this.plugin,
      t: this.t,
      abortRef: this.abortRef,
      activeProviderId: cfg.provider,
      activeProvider: provider,
      activeModel: cfg.model,
      activeMode: cfg.mode,
      apiKeyFor: (p) => this.apiKeyFor(p),
      effort: this.effort,
      resolveStyleInstruction: () => "",
    };
    try {
      if (cfg.mode === "agent") {
        await runAgentTurn(
          { ...ctx, agentApproveAllRef: this.approveAllRef },
          trimmed,
          attachments
        );
      } else {
        await streamReply(ctx, trimmed, attachments);
      }
    } finally {
      this.emit();
    }
  }

  /** Interrompe o stream / o turno do agente em andamento. */
  stop(): void {
    this.abortRef.current?.abort();
  }

  /** Nova conversa (destrava a sessão). `mode` opcional já fixa o modo. */
  newChat(mode?: ChatMode): void {
    this.abortRef.current?.abort();
    this.flushSave();
    this.pendingProjectId = null;
    this.pendingNotes = [];
    useChatStore.getState().newChat();
    if (mode) {
      this.mode = mode;
      this.plugin.settings.defaultMode = mode;
      void this.plugin.saveSettings();
    }
    this.emit();
  }

  /** Nova conversa DENTRO de um projeto: fontes viram contexto no 1º envio. */
  async newChatInProject(project: Project): Promise<void> {
    this.newChat();
    this.pendingProjectId = project.id;
    const notes: NoteAttachment[] = [];
    const missing: string[] = [];
    for (const src of project.sources) {
      const file = this.plugin.app.vault.getAbstractFileByPath(src);
      if (!(file instanceof TFile)) {
        missing.push(src.split("/").pop() ?? src);
        continue;
      }
      try {
        const content = await this.plugin.app.vault.cachedRead(file);
        notes.push({ type: "note", path: src, content });
      } catch {
        missing.push(src.split("/").pop() ?? src);
      }
    }
    this.pendingNotes = notes;
    if (missing.length > 0) {
      new Notice(`Project sources not found: ${missing.join(", ")}`);
    }
    this.emit();
  }

  /** Abre uma conversa salva (.md) — reidrata o store e trava a sessão. */
  async load(ref: ChatRef): Promise<void> {
    const store = useChatStore.getState();
    if (store.currentChatId === ref.id) return;
    this.abortRef.current?.abort();
    this.flushSave();
    store.setLoadingChat(true);
    try {
      const chat = await loadChat(
        this.plugin.app,
        this.plugin.settings.chatsPath,
        ref.mode,
        ref.id
      );
      const restored: ChatMessage[] = chat.messages.map((m) => ({
        id: makeId(),
        type: m.type,
        content: m.content,
        timestamp: m.timestamp,
        ...(m.type === "ai-response" && m.reaction
          ? { reaction: m.reaction }
          : {}),
        ...(m.type === "ai-response" && m.agentSteps
          ? { agentSteps: m.agentSteps }
          : {}),
      })) as ChatMessage[];

      const st = useChatStore.getState();
      // Abrir um chat NÃO é atividade: pula o próximo ciclo do auto-save.
      this.skipNextSave = true;
      this.pendingProjectId = null;
      this.pendingNotes = [];
      st.setMessages(restored);
      st.setCurrentChatId(chat.id);
      st.setCurrentChatTitle(chat.title);
      st.lockSession(chat.provider, chat.model, chat.mode);
      st.resetUsage();
      st.addUsage(chat.tokensIn, chat.tokensOut);
      st.setSessionPersona(chat.persona ?? "");
      st.setCurrentChatStarred(chat.starred === true);
      if (chat.effort) this.effort = chat.effort;
    } catch (err) {
      console.error("[axxa] loadChat falhou:", err);
      new Notice(
        `${this.t.ai.errorPrefix} ${err instanceof Error ? err.message : this.t.ai.unknownError}`
      );
    } finally {
      useChatStore.getState().setLoadingChat(false);
      this.emit();
    }
  }

  /** Apaga uma conversa (vai pra lixeira do sistema, recuperável). */
  async delete(ref: ChatRef): Promise<void> {
    try {
      await deleteChat(
        this.plugin.app,
        this.plugin.settings.chatsPath,
        ref.mode,
        ref.id
      );
      this.plugin.removeChatSummary(ref.id);
      // Tira a referência dos projetos (sem chatId órfão).
      await this.updateProjects((prev) =>
        prev.map((p) =>
          p.chatIds.includes(ref.id)
            ? { ...p, chatIds: p.chatIds.filter((id) => id !== ref.id) }
            : p
        )
      );
      if (useChatStore.getState().currentChatId === ref.id) this.newChat();
      new Notice(this.t.chat.deletedToTrash);
    } catch (err) {
      console.error("[axxa] deleteChat falhou:", err);
      new Notice(
        `${this.t.ai.errorPrefix} ${err instanceof Error ? err.message : ""}`
      );
    }
  }

  /** Renomeia o título (frontmatter + H1) sem mudar id/arquivo. */
  async rename(ref: ChatRef, newTitle: string): Promise<void> {
    const clean = newTitle.trim();
    if (!clean) return;
    try {
      await renameChat(
        this.plugin.app,
        this.plugin.settings.chatsPath,
        ref.mode,
        ref.id,
        clean
      );
      if (useChatStore.getState().currentChatId === ref.id) {
        useChatStore.getState().setCurrentChatTitle(clean);
      }
      const cur = this.plugin.chatSummaries?.find((c) => c.id === ref.id);
      if (cur) this.plugin.upsertChatSummary({ ...cur, title: clean });
      new Notice(this.t.conversations.renameSuccess(clean));
    } catch (err) {
      const msg = err instanceof Error ? err.message : this.t.ai.unknownError;
      new Notice(this.t.conversations.renameFailed(msg));
    }
  }

  // ── Projetos (persistidos em settings.projects) ─────────────────────────

  async updateProjects(
    update: (prev: Project[]) => Project[]
  ): Promise<void> {
    this.plugin.settings.projects = update(this.plugin.settings.projects ?? []);
    await this.plugin.saveSettings();
  }

  // ── Auto-save ───────────────────────────────────────────────────────────

  private scheduleSave(): void {
    const st = useChatStore.getState();
    if (st.messages.length === 0 || !st.currentChatId) return;
    if (this.skipNextSave) {
      this.skipNextSave = false;
      return;
    }
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.pendingSave = () => void this.saveNow();
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.pendingSave = null;
      void this.saveNow();
    }, 500);
  }

  /** Grava AGORA um save agendado (fechar a view, trocar de chat). */
  flushSave(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const pending = this.pendingSave;
    this.pendingSave = null;
    pending?.();
  }

  private async saveNow(): Promise<void> {
    const st = useChatStore.getState();
    if (!st.currentChatId) return;
    const userOrAi = st.messages.filter(
      (m): m is UserMessage | AIResponseMessage =>
        m.type === "user" || (m.type === "ai-response" && !m.isError)
    );
    if (userOrAi.length === 0) return;
    const cfg = this.config;
    const chat: ChatData = {
      id: st.currentChatId,
      title: st.currentChatTitle || generateTitle(userOrAi[0].content),
      date: new Date().toISOString(),
      mode: cfg.mode,
      provider: cfg.provider,
      model: cfg.model,
      effort: cfg.effort,
      tokensIn: st.tokensIn,
      tokensOut: st.tokensOut,
      persona: st.sessionPersona || undefined,
      starred: st.currentChatStarred || undefined,
      messages: userOrAi.map((m) => ({
        type: m.type,
        content: m.content,
        timestamp: m.timestamp,
        ...(m.type === "ai-response" && m.reaction
          ? { reaction: m.reaction }
          : {}),
        ...(m.type === "ai-response" && m.agentSteps?.length
          ? { agentSteps: m.agentSteps }
          : {}),
      })),
    };
    try {
      const path = await saveChat(
        this.plugin.app,
        this.plugin.settings.chatsPath,
        chat
      );
      this.plugin.upsertChatSummary({
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
        starred: chat.starred === true,
      });
    } catch (err) {
      console.error("[axxa] saveChat falhou:", err);
    }
  }
}
