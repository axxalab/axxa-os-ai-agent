// src/core/agentTurn.ts
// Loop do AGENTE: stream + tool calls + confirmação NATIVA (ConfirmationModal
// com diff) + loop detection + retry de tools. Sem React: recebe um `AgentCtx`
// e opera no store. Chamado pela ChatSession (src/core/session.ts).
//
// Diferença pro app antigo: a tool `generate_image` não é oferecida ao modelo
// nesta base (o fluxo de geração de imagem saiu com a casca antiga); se o
// modelo insistir, recebe um resultado explicando que não está disponível.

import { useChatStore } from "../store/chat";
import {
  providerNeedsKey,
  describeProviderError,
  agentActivitySpec,
  summarizeToolResult,
} from "./helpers";
import { resolveEffortConfig, effortToMaxTokensSmart } from "./effort";
import { getContextWindow } from "./contextWindows";
import {
  buildAgentSystemPrompt,
  storeMessagesToProvider,
} from "../agent/conversation";
import { decideToolGate } from "../agent/permissions";
import { ConfirmationModal } from "../agent/ConfirmationModal";
import { TOOL_REGISTRY, isTransientError } from "../agent/tools";
import { TOOL_DEFINITIONS, getToolDefinition } from "../agent/toolSchemas";
import {
  makeCallSignature,
  isLooping,
  trimSignatures,
} from "../agent/loopDetection";
import type { MessageAttachment, ProviderMessage } from "../providers/base";
import type { AIToolStep, PermissionLevel } from "../agent/types";
import type { EngineCtx } from "./chatEngine";

export interface AgentCtx extends EngineCtx {
  /** "Aprovar todas" da rodada — resetado a cada turno. */
  agentApproveAllRef: { current: boolean };
}

const UNAVAILABLE_TOOLS = new Set(["generate_image"]);

export async function runAgentTurn(
  ctx: AgentCtx,
  userText: string,
  userAttachments?: MessageAttachment[]
): Promise<void> {
  const {
    plugin,
    t,
    abortRef,
    agentApproveAllRef,
    activeProviderId,
    activeProvider,
    activeModel,
    apiKeyFor,
    effort,
  } = ctx;
  const {
    addMessage,
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
  void userText; // já está no store (última mensagem do usuário)

  // Pre-flight: sem API key, erro acionável direto.
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
      content: `${t.ai.errorPrefix} ${t.agent.needsOpenAI}`,
    });
    return;
  }

  setLoading(true);
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

  const permissionLevel: PermissionLevel = (plugin.settings
    .agentPermissionLevel || "ask") as PermissionLevel;
  // Diff-approval: toda ação que ESCREVE passa por preview/diff antes de gravar.
  const diffApproval = plugin.settings.agentDiffApproval !== false;
  agentApproveAllRef.current = false;

  const effortCfg = resolveEffortConfig(effort, plugin.settings.effortConfigs);

  const history: ProviderMessage[] = [
    {
      role: "system",
      content: buildAgentSystemPrompt(
        useChatStore.getState().sessionPersona,
        t.agent.systemPrompt
      ),
    },
    // toolMode=true → agentSteps são expandidos pro shape wire (replay preciso).
    ...storeMessagesToProvider(
      useChatStore.getState().messages,
      userAttachments,
      true
    ),
  ];

  const tools = TOOL_DEFINITIONS.filter(
    (td) => !UNAVAILABLE_TOOLS.has(td.name)
  ).map((td) => ({
    name: td.name,
    description: td.description,
    parameters: td.parameters,
  }));

  const apiKey = apiKeyFor(activeProviderId);

  // MAX_TURNS vem do effort config (0 = sem teto; loop detection é o limite).
  const MAX_TURNS = effortCfg.agentMaxTurns;
  const isUncapped = MAX_TURNS === 0;
  const loopWindow = effortCfg.loopDetectionWindow;
  const recentCallSignatures: string[] = [];
  let loopNudges = 0;
  const MAX_LOOP_NUDGES = 3;
  // Ações de tool do run inteiro — anexadas à resposta final p/ continuidade.
  const runSteps: AIToolStep[] = [];

  let turn = 0;
  let firstTurn = true;
  const controller = new AbortController();
  abortRef.current = controller;

  try {
    while (isUncapped || turn < MAX_TURNS) {
      turn++;
      // Stop entre turnos.
      if (controller.signal.aborted) {
        throw new DOMException("Interrupted", "AbortError");
      }

      let responseId: string | null = null;
      const onToken = (token: string) => {
        if (responseId === null) {
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

      // Caso 1: sem tool_calls = resposta final.
      if (!response.toolCalls || response.toolCalls.length === 0) {
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
        if (runSteps.length > 0 && responseId) {
          setAgentSteps(responseId, runSteps);
        }
        return;
      }

      // Caso 2: tool_calls — registra a msg do assistant na history.
      if (firstTurn) {
        updateActivity(commentId, { phase: "done" });
        firstTurn = false;
      }
      history.push({
        role: "assistant",
        content: response.content ?? "",
        toolCalls: response.toolCalls,
      });

      // Loop detection por assinatura (name + JSON(args)).
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

      type CallResult = {
        callId: string;
        content: string;
        activityId: string;
        spec: ReturnType<typeof agentActivitySpec>;
        meta: string;
        ok: boolean;
      };

      // Pre-check de permissão (sequencial — um modal por vez) e placeholders.
      const preparedCalls: Array<{
        call: (typeof response.toolCalls)[number];
        def: ReturnType<typeof getToolDefinition>;
        approved: boolean;
        activityId: string;
        spec: ReturnType<typeof agentActivitySpec>;
      }> = [];
      for (const call of response.toolCalls) {
        if (UNAVAILABLE_TOOLS.has(call.name)) {
          const resultText = `Tool "${call.name}" is not available in this build. Do NOT retry — tell the user.`;
          addMessage({
            type: "ai-comment",
            content: "",
            activity: {
              phase: "failed",
              iconPending: "wrench",
              iconFailed: "alert-triangle",
              pendingText: t.agent.unknownTool(call.name),
              failedText: t.agent.unknownTool(call.name),
            },
          });
          history.push({ role: "tool", toolCallId: call.id, content: resultText });
          runSteps.push({
            id: call.id,
            name: call.name,
            arguments: call.arguments,
            result: resultText,
            ok: false,
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
              pendingText: t.agent.unknownTool(call.name),
              failedText: t.agent.unknownTool(call.name),
            },
          });
          history.push({
            role: "tool",
            toolCallId: call.id,
            content: `Tool "${call.name}" does not exist. Use one of the available tools.`,
          });
          continue;
        }

        // Gate: roda direto ("auto") ou abre o preview de confirmação.
        const gate = decideToolGate(def, permissionLevel, {
          approveAll: agentApproveAllRef.current,
        });
        let approved = gate === "auto";
        if (gate === "confirm") {
          const modal = new ConfirmationModal(plugin.app, {
            toolCall: call,
            definition: def,
            showDiff: diffApproval,
            strings: t.agent,
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
              pendingText: t.agent.deniedTool(call.name),
              failedText: t.agent.deniedTool(call.name),
            },
          });
          history.push({
            role: "tool",
            toolCallId: call.id,
            content:
              "User denied this action. Do NOT repeat this same call — consider another approach or ask the user.",
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

      // Executor com retry (só erros transitórios) pra cada call.
      const execCall = async (
        prep: (typeof preparedCalls)[number]
      ): Promise<CallResult> => {
        const { call, activityId, spec } = prep;
        if (controller.signal.aborted) {
          updateActivity(activityId, {
            phase: "failed",
            iconFailed: "circle-stop",
            failedText: t.ai.interrupted,
          });
          return {
            callId: call.id,
            content: "Interrupted by the user — this call did NOT run.",
            activityId,
            spec,
            meta: "",
            ok: false,
          };
        }
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
            const msg = err instanceof Error ? err.message : "";
            if (!isTransientError(msg) || attempt === maxAttempts) break;
          }
        }
        const msg =
          lastErr instanceof Error ? lastErr.message : t.ai.unknownError;
        updateActivity(
          activityId,
          {
            phase: "failed",
            iconFailed: "x-circle",
            failedText: spec.pendingText.replace(
              /^(Reading|Editing|Creating|Moving|Deleting|Listing|Searching|Running)/,
              "Failed on"
            ),
          },
          msg
        );
        return {
          callId: call.id,
          content: `ERROR: ${msg}. Do NOT repeat this same call — fix path/args or try another approach.`,
          activityId,
          spec,
          meta: "",
          ok: false,
        };
      };

      let results: CallResult[];
      if (effortCfg.parallelToolCalls && preparedCalls.length > 1) {
        // Paralelo POR GRUPO de path: calls no MESMO arquivo rodam em série
        // (evita race read-modify-write); paths distintos rodam em paralelo.
        const indexed = preparedCalls.map((prep, idx) => ({ prep, idx }));
        const groups = new Map<string, typeof indexed>();
        for (const item of indexed) {
          const a = item.prep.call.arguments as Record<string, unknown>;
          const writeKey = [a.path, a.from, a.to]
            .filter((v) => typeof v === "string" && v)
            .map((v) => String(v).replace(/^\/+|\/+$/g, ""))
            .join("→");
          const key = writeKey || `__solo_${item.idx}`;
          const bucket = groups.get(key);
          if (bucket) bucket.push(item);
          else groups.set(key, [item]);
        }
        results = new Array<CallResult>(preparedCalls.length);
        await Promise.all(
          [...groups.values()].map(async (bucket) => {
            for (const { prep, idx } of bucket) {
              results[idx] = await execCall(prep);
            }
          })
        );
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
      // Stop no meio das tools: encerra pelo caminho de interrupção (anexa steps).
      if (controller.signal.aborted) {
        throw new DOMException("Interrupted", "AbortError");
      }

      if (loopDetected) {
        loopNudges++;
        if (loopNudges >= MAX_LOOP_NUDGES) {
          const loopId = addMessage({
            type: "ai-response",
            content: t.agent.loopAborted,
          });
          if (runSteps.length > 0) setAgentSteps(loopId, runSteps);
          return;
        }
        history.push({
          role: "user",
          content:
            "⚠️ You repeated the exact same tool call several times. " +
            "This means your current approach is not working. " +
            "STOP repeating, RECONSIDER your strategy (maybe you need " +
            "additional information — try vault_list/vault_read on another path) " +
            "OR ask the user to clarify. Do not repeat the same call.",
        });
        addMessage({
          type: "ai-comment",
          content: "",
          activity: {
            phase: "failed",
            iconPending: "rotate-cw",
            iconFailed: "alert-triangle",
            pendingText: t.agent.loopDetectedPending,
            failedText: t.agent.loopDetectedDone,
          },
        });
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
      if (!firstTurn) {
        const stopId = addMessage({
          type: "ai-response",
          content: t.ai.interrupted,
        });
        if (runSteps.length > 0) setAgentSteps(stopId, runSteps);
      }
    } else {
      const { message, code } = describeProviderError(
        err,
        t,
        activeProvider.name
      );
      const errId = addMessage({
        type: "ai-response",
        content: `${t.ai.errorPrefix} ${message}`,
        isError: true,
        errorCode: code,
      });
      if (runSteps.length > 0) setAgentSteps(errId, runSteps);
    }
  } finally {
    setLoading(false);
    setStreamingMessageId(null);
    endStreamTimer();
    abortRef.current = null;
  }
}
