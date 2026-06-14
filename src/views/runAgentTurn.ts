// src/views/runAgentTurn.ts
// Agent loop (streaming + tool calls) extraído do AxxaApp (Frente 2 — base 1.0).
// Função de módulo: o wrapper no AxxaApp monta a ctx em CALL-TIME (closure), então
// pendingAttachments e as funções de geração resolvem na hora da chamada — sem
// problema de ordem de render. Corpo movido VERBATIM (zero mudança de lógica).

import { Notice } from "obsidian";
import { useChatStore } from "../store/chat";
import { getProvider } from "../providers";
import {
  providerNeedsKey,
  describeProviderError,
  agentActivitySpec,
  summarizeToolResult,
} from "./axxaApp.helpers";
import {
  resolveEffortConfig,
  effortToMaxTokensSmart,
} from "../components/_shared/effort";
import { getContextWindow } from "../components/_shared/contextWindows";
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
import { ImageGenModal, type ImageModelOption } from "../generation/ImageGenModal";
import { getTranslations } from "../i18n";
import type { ProviderMessage } from "../providers/base";
import type { PermissionLevel } from "../agent/types";
import type { PendingAttachmentEntry } from "./chatTypes";
import type AxxaPlugin from "../main";
import { type MutableRefObject } from "react";

interface AgentCtx {
  plugin: AxxaPlugin;
  t: ReturnType<typeof getTranslations>;
  abortRef: MutableRefObject<AbortController | null>;
  agentApproveAllRef: MutableRefObject<boolean>;
  activeProviderId: string;
  activeProvider: ReturnType<typeof getProvider>;
  activeModel: string;
  activeMode: string;
  apiKeyFor: (providerId: string) => string;
  effort: string;
  resolveStyleInstruction: () => string;
  pendingAttachments: PendingAttachmentEntry[];
  setPendingAttachments: (v: PendingAttachmentEntry[]) => void;
  buildImageModelOptions: () => ImageModelOption[];
  runImageGeneration: (
    prompt: string,
    providerId: string,
    model: string,
    inputImage?: { data: string; mimeType: string }
  ) => Promise<{ ok: boolean; paths: string[]; error?: string }>;
}

export async function runAgentTurnImpl(
  ctx: AgentCtx,
  userText: string,
  userAttachments?: import("../providers/base").MessageAttachment[]
) {
  const {
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
  } = ctx;
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
    // v0.1.228: contador de nudges que NÃO é zerado junto com o buffer — depois
    // de MAX_LOOP_NUDGES tentativas de reconsideração seguidas, aborta de vez
    // (antes o comentário prometia "aborta em 3 nudges" mas o while nunca cortava).
    let loopNudges = 0;
    const MAX_LOOP_NUDGES = 3;
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
              // v0.1.228: tinha imagem anexada mas o data URL não decodificou —
              // avisa em vez de cair silenciosamente pra text2image (a opção
              // IMG2IMG nem aparece no modal porque hasInputImage fica false).
              else new Notice(t.imageGen.inputImageDecodeFailed);
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
              // v0.1.228: imagem anexada CONSUMIDA com sucesso → limpa o
              // pending pra não vazar pra próxima call (consistente com
              // handleCreateImage, que também só limpa quando useInputImage).
              if (gen.ok && choice.useInputImage && inputImage) {
                setPendingAttachments([]);
              }
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
          // Paralelo POR GRUPO de path (v0.1.228): calls que tocam o MESMO
          // arquivo (path/from/to normalizado) rodam serializadas entre si pra
          // evitar race read-modify-write; calls de paths distintos / read-only
          // (sem path → chave única) seguem paralelas. Mantém a ordem original.
          const indexed = preparedCalls.map((prep, idx) => ({ prep, idx }));
          const groups = new Map<string, typeof indexed>();
          for (const item of indexed) {
            const a = item.prep.call.arguments as Record<string, unknown>;
            const writeKey = [a.path, a.from, a.to]
              .filter((v) => typeof v === "string" && v)
              .map((v) => String(v).replace(/^\/+|\/+$/g, ""))
              .join("→");
            // Sem path de escrita → chave única por call (não serializa nada).
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
          loopNudges++;
          // v0.1.228: depois de MAX_LOOP_NUDGES reconsiderações seguidas, aborta
          // de vez — o contador NÃO é zerado com o buffer, então insistência
          // persistente quebra o while em vez de girar pra sempre.
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
          // (mas NÃO o loopNudges — ele acumula pra forçar o abort acima).
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
}
