// src/core/vaultLookup.ts
// A busca das SUAS NOTAS antes de uma resposta — os trechos que entram como
// contexto, e a linha de atividade que conta isso enquanto acontece.
//
// Morava dentro do turno de chat, atrás de um `if (mode === "vault-qa")`.
// Saiu de lá quando a decisão virou um interruptor por conversa (ver
// vaultContext.ts): o turno de AGENTE passou a precisar exatamente da mesma
// busca, e duas cópias de uma coisa que fala com o índice, com o effort e com
// a linha do tempo divergiriam na primeira mudança de qualquer um dos três.

import type AxxaPlugin from "../main";
import type { getTranslations } from "../i18n";
import { hybridSearch } from "../rag/hybrid";
import { effortToVaultLookup } from "./effort";

type AddMessage = (m: Record<string, unknown>) => string;
type UpdateActivity = (id: string, patch: Record<string, unknown>) => void;

/**
 * Procura no vault e devolve o BLOCO de contexto pronto pro system prompt
 * ("" quando não achou nada ou a busca falhou).
 *
 * Nunca lança: uma busca que quebra não pode derrubar o envio. O que dá errado
 * vira uma linha de atividade falhada e a conversa segue sem o contexto — que
 * é o mesmo que acontecia antes de existir índice nenhum.
 */
export async function buscarContextoDoVault({
  plugin,
  t,
  effort,
  query,
  addMessage,
  updateActivity,
}: {
  plugin: AxxaPlugin;
  t: ReturnType<typeof getTranslations>;
  effort: string;
  query: string;
  addMessage: AddMessage;
  updateActivity: UpdateActivity;
}): Promise<string> {
  // topK e excerptChars escalam com o effort: quem pediu "max" quer que ele
  // leia mais antes de responder.
  const { topK, excerptChars } = effortToVaultLookup(
    effort,
    plugin.settings.effortConfigs
  );

  const searchActivityId = addMessage({
    type: "ai-comment",
    content: "",
    activity: {
      phase: "pending",
      iconPending: "radar",
      iconDone: "check",
      pendingText: t.vault.searching(topK, effort),
      doneText: t.vault.searchDone,
    },
  });

  try {
    // Com índice RAG → híbrida (semântica + keyword); sem índice → keyword
    // puro. Nunca bloqueia o envio.
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

    if (hits.length === 0) {
      updateActivity(searchActivityId, {
        phase: "done",
        iconDone: "circle-slash",
        doneText: t.vault.notFound,
      });
      return "";
    }

    // Cabeçalho com o título CITÁVEL ([[basename]]) + path, pra IA citar a
    // fonte exata e o link abrir a nota no clique.
    const bloco = hits
      .map((h) => {
        const base = h.path.replace(/\.md$/i, "").split("/").pop() ?? h.path;
        return `### [[${base}]]\n_(${h.path})_\n\n${h.text}`;
      })
      .join("\n\n---\n\n");

    const semanticUsed = hits.some((h) => h.via.includes("semantic"));
    const hasIndex = !!plugin.vectorIndex && plugin.vectorIndex.size > 0;
    updateActivity(searchActivityId, {
      phase: "done",
      doneText: semanticUsed
        ? t.vault.foundContextSemantic(hits.length)
        : hasIndex
          ? t.vault.foundContextKeywordFallback(hits.length)
          : t.vault.foundContextKeyword(hits.length),
    });
    return bloco;
  } catch (err) {
    console.error("[axxa] vault search falhou:", err);
    updateActivity(searchActivityId, {
      phase: "failed",
      iconFailed: "x-circle",
      failedText: `${t.ai.errorPrefix} ${
        err instanceof Error ? err.message : t.ai.unknownError
      }`,
    });
    return "";
  }
}
