// src/components/_shared/vaultSearch.ts
// Vault Q&A — busca keyword-based + ranking nas notas do vault.
// Usado pelo modo "vault-qa" pra injetar contexto relevante no system prompt.
//
// MVP: keyword match com pesos:
//   - Match no TÍTULO: 5 pontos por keyword única encontrada
//   - Match no CONTEÚDO: 1 ponto por ocorrência (`\b<kw>\b`)
// Top N notas ranqueadas, excerpt centrado na primeira ocorrência.
//
// Futuro: embeddings (LanceDB ou OpenAI embeddings) — Módulo 6.

import type { App } from "obsidian";

export interface VaultMatch {
  path: string;
  title: string;
  excerpt: string;
  score: number;
}

const STOPWORDS_PT_EN = new Set([
  // PT-BR
  "o", "a", "os", "as", "de", "do", "da", "dos", "das", "um", "uma", "uns", "umas",
  "para", "pra", "por", "que", "qual", "quais", "como", "porque", "porquê",
  "e", "ou", "mas", "se", "é", "são", "está", "estão", "ser", "estar", "ter", "haver",
  "eu", "você", "vc", "ele", "ela", "nós", "vocês", "eles", "elas", "me", "te", "se",
  "no", "na", "nos", "nas", "ao", "aos", "à", "às", "com", "sem", "sobre", "sob",
  "este", "esta", "isso", "aquele", "aquela", "aquilo",
  // EN
  "the", "an", "is", "are", "was", "were", "be", "been", "have", "has", "had",
  "to", "of", "in", "on", "at", "by", "for", "with", "from", "as", "and", "or",
  "but", "if", "this", "that", "these", "those", "it", "its", "they", "them",
]);

/** minúsculas + sem acentos (NFD) — keywords e conteúdo DEVEM usar a mesma
 *  dobra, senão "joão"→keyword "joao" nunca casa o conteúdo "joão". v0.1.227 */
export function foldText(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Tokeniza query em keywords minúsculas, ≥3 chars, sem stopwords, dedupe. */
export function extractKeywords(query: string): string[] {
  return foldText(query)
    .split(/\s+/)
    .map((w) => w.replace(/[^\w]/g, ""))
    .filter((w) => w.length >= 3 && !STOPWORDS_PT_EN.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i);
}

/** Extrai um excerpt centrado na primeira ocorrência de qualquer keyword. */
function extractExcerpt(content: string, keywords: string[], maxLen: number): string {
  // foldText preserva o COMPRIMENTO (toLowerCase + remoção de diacrítico NFD
  // 1-char), então o índice encontrado mapeia 1:1 no content original.
  const lc = foldText(content);
  let bestStart = 0;
  for (const kw of keywords) {
    const idx = lc.indexOf(kw);
    if (idx !== -1) {
      bestStart = Math.max(0, idx - 120);
      break;
    }
  }
  const end = Math.min(content.length, bestStart + maxLen);
  let excerpt = content.slice(bestStart, end).trim();
  if (bestStart > 0) excerpt = "…" + excerpt;
  if (end < content.length) excerpt = excerpt + "…";
  return excerpt;
}

/**
 * Busca top N notas relevantes pra query no vault.
 * Limit padrão = 5. Usa cachedRead pra ser rápido.
 */
export async function searchVault(
  app: App,
  query: string,
  limit: number = 5,
  excerptLen: number = 500
): Promise<VaultMatch[]> {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  const files = app.vault.getMarkdownFiles();
  const matches: VaultMatch[] = [];

  for (const file of files) {
    try {
      const content = await app.vault.cachedRead(file);
      // Mesma dobra (lowercase + sem acento) das keywords — senão o match falha
      // em PT-BR sempre que há acento de um lado só. v0.1.227
      const lcContent = foldText(content);
      const lcTitle = foldText(file.basename);
      let score = 0;

      for (const kw of keywords) {
        // Match no título: 5 pontos
        if (lcTitle.includes(kw)) score += 5;
        // Match no conteúdo: 1 ponto por ocorrência (com word boundary)
        try {
          const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
          const occurrences = (lcContent.match(re) || []).length;
          score += occurrences;
        } catch {
          // regex inválida — usa includes simples como fallback
          if (lcContent.includes(kw)) score += 1;
        }
      }

      if (score > 0) {
        matches.push({
          path: file.path,
          title: file.basename,
          excerpt: extractExcerpt(content, keywords, excerptLen),
          score,
        });
      }
    } catch {
      // arquivo ilegível — skip
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Constrói o bloco de contexto pra injetar no system prompt. */
export function buildVaultContext(matches: VaultMatch[]): string {
  if (matches.length === 0) return "";
  return matches
    .map((m) => `### ${m.title}\n\n${m.excerpt}`)
    .join("\n\n---\n\n");
}
