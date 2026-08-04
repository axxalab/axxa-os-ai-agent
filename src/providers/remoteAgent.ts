// src/providers/remoteAgent.ts
// Provider "Remote Agent" — thin client de um Claude Code headless que roda no
// runtime do usuário (VPS/PC) autenticado na PRÓPRIA assinatura Max. O transporte
// é o próprio vault via LiveSync (AD-1): escrevemos um request em `_agent/inbox/`,
// o runtime executa e escreve `_agent/outbox/`, o LiveSync devolve e nós streamamos.
//
// Encaixa no MESMO contrato `Provider` (streamChat) dos providers HTTP, mas precisa
// do vault — que a interface não injeta. Resolvido por um injetor de módulo
// (configureRemoteAgent), chamado no main.ts onload. `apiKey` é ignorado (a auth
// vive no runtime). Spec: docs/AGENT_PROTOCOL.md

import type { App, EventRef, TAbstractFile } from "obsidian";
import {
  Provider,
  ProviderError,
  ProviderRequest,
  ProviderResponse,
  ProviderMessage,
  TokenHandler,
  UsageHandler,
  ReasoningHandler,
} from "./base";
import {
  newUlid,
  inboxPath,
  cancelPath,
  outboxDir,
  outboxResponsePath,
  runtimeStatePath,
  serializeInboxRequest,
  parseOutboxResponse,
  parseRuntimeState,
  isRuntimeOnline,
  isTerminal,
  bodyDelta,
  type RuntimeState,
} from "./remoteAgentProtocol";

/** Dependências injetadas pelo plugin (o provider não tem acesso ao App sozinho). */
export interface RemoteAgentDeps {
  getApp: () => App;
  /** Raiz do protocolo no vault (settings.remoteAgentPath, default "_agent"). */
  getRoot: () => string;
  /** "mobile" | "desktop" — telemetria/UX no request. */
  getDevice: () => string;
}

let deps: RemoteAgentDeps | null = null;

/** Injeta o acesso ao vault. Chamado uma vez no main.ts onload. */
export function configureRemoteAgent(d: RemoteAgentDeps): void {
  deps = d;
}

function requireDeps(): RemoteAgentDeps {
  if (!deps) {
    throw new ProviderError(
      "Remote Agent não inicializado (configureRemoteAgent não chamado).",
      "unknown"
    );
  }
  return deps;
}

/** Cria uma pasta e todos os pais que faltarem (adapter.mkdir é 1 nível). */
async function ensureDir(app: App, dir: string): Promise<void> {
  const parts = dir.split("/").filter(Boolean);
  let cur = "";
  for (const p of parts) {
    cur = cur ? `${cur}/${p}` : p;
    if (!(await app.vault.adapter.exists(cur))) {
      try {
        await app.vault.adapter.mkdir(cur);
      } catch {
        // Corrida (LiveSync/outro processo criou) — segue.
      }
    }
  }
}

/**
 * Monta o prompt pro runtime a partir das mensagens. O Claude Code tem system/skill
 * próprios no runtime, então system messages viram contexto no topo e o resto vira
 * um transcript legível. Caso comum (1 turno de user) vai direto.
 */
function buildPrompt(messages: ProviderMessage[]): string {
  const sys = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n")
    .trim();
  const convo = messages.filter((m) => m.role !== "system");
  if (convo.length === 1 && convo[0].role === "user") {
    return sys ? `${sys}\n\n${convo[0].content}` : convo[0].content;
  }
  const transcript = convo
    .map((m) => {
      const who =
        m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : m.role;
      return `${who}: ${m.content}`;
    })
    .join("\n\n");
  return sys ? `${sys}\n\n${transcript}` : transcript;
}

/** Erro de abort no formato que o useChatEngine reconhece (mostra "interrompido"). */
function abortError(): DOMException {
  return new DOMException("Remote Agent abortado", "AbortError");
}

const remoteAgentProvider: Provider = {
  id: "remote-agent",
  name: "Remote Agent",
  supportsTools: true, // o runtime (Claude Code) faz tool-calling no vault dele

  async streamChat(
    request: ProviderRequest,
    _apiKey: string,
    onToken: TokenHandler,
    onUsage?: UsageHandler,
    signal?: AbortSignal,
    _onReasoning?: ReasoningHandler
  ): Promise<ProviderResponse> {
    const d = requireDeps();
    const app = d.getApp();
    const root = (d.getRoot() || "_agent").replace(/\/+$/, "");
    const id = newUlid();
    const respPath = outboxResponsePath(root, id);

    // 1) Escreve o request no inbox (a pasta outbox quem cria é o runtime).
    await ensureDir(app, `${root}/inbox`);
    await app.vault.adapter.write(
      inboxPath(root, id),
      serializeInboxRequest({
        id,
        ts: new Date().toISOString(),
        mode: "agent",
        model: request.model || "claude-code",
        device: d.getDevice(),
        prompt: buildPrompt(request.messages),
      })
    );

    // 2) Observa o outbox (eventos do vault + polling de fallback pro mobile).
    return await new Promise<ProviderResponse>((resolve, reject) => {
      let emitted = "";
      let finished = false;
      let cleanup = () => {};

      const finish = (r: ProviderResponse) => {
        if (finished) return;
        finished = true;
        cleanup();
        resolve(r);
      };
      const fail = (err: Error) => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(err);
      };

      const poll = async () => {
        if (finished) return;
        try {
          if (!(await app.vault.adapter.exists(respPath))) return;
          const md = await app.vault.adapter.read(respPath);
          const parsed = parseOutboxResponse(md);
          const { delta } = bodyDelta(emitted, parsed.body);
          if (delta) {
            emitted = parsed.body;
            onToken(delta);
          }
          if (isTerminal(parsed.status)) {
            if (parsed.status === "cancelled") return fail(abortError());
            if (parsed.status === "failed") {
              return fail(
                new ProviderError(parsed.error || "O runtime falhou.", "unknown")
              );
            }
            if (parsed.usage && onUsage) onUsage(parsed.usage);
            finish({ content: emitted, usage: parsed.usage });
          }
        } catch {
          // Leitura transitória (arquivo a meio de escrita/sync) — próximo tick pega.
        }
      };

      const onFsChange = (file: TAbstractFile) => {
        if (file?.path === respPath) void poll();
      };
      const mref: EventRef = app.vault.on("modify", onFsChange);
      const cref: EventRef = app.vault.on("create", onFsChange);
      const timer = window.setInterval(() => void poll(), 1200);

      const onAbort = () => {
        // Fail-safe: sinaliza cancelamento pro runtime e encerra local.
        void app.vault.adapter
          .write(cancelPath(root, id), "")
          .catch(() => {});
        fail(abortError());
      };

      cleanup = () => {
        app.vault.offref(mref);
        app.vault.offref(cref);
        window.clearInterval(timer);
        signal?.removeEventListener("abort", onAbort);
      };

      if (signal) {
        if (signal.aborted) return onAbort();
        signal.addEventListener("abort", onAbort);
      }

      // Primeira leitura (a resposta pode já ter chegado antes do listener).
      void poll();
    });
  },

  async chat(
    request: ProviderRequest,
    apiKey: string
  ): Promise<ProviderResponse> {
    // Wrapper: acumula o streamChat (o retorno já traz o content completo).
    return this.streamChat(request, apiKey, () => {});
  },
};

/**
 * Lê o heartbeat do runtime (state/runtime.md). Usado pela UI de Settings pra
 * mostrar online/offline. Retorna null se o arquivo não existe / não configurado.
 */
export async function remoteAgentRuntimeState(): Promise<RuntimeState | null> {
  if (!deps) return null;
  const app = deps.getApp();
  const root = (deps.getRoot() || "_agent").replace(/\/+$/, "");
  const path = runtimeStatePath(root);
  try {
    if (!(await app.vault.adapter.exists(path))) return null;
    return parseRuntimeState(await app.vault.adapter.read(path));
  } catch {
    return null;
  }
}

/** Conveniência: runtime está online agora? (flag + heartbeat fresco). */
export async function remoteAgentOnline(): Promise<boolean> {
  return isRuntimeOnline(await remoteAgentRuntimeState());
}

export { remoteAgentProvider };
