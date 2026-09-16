import { describe, it, expect } from "vitest";
import {
  AXXA_HIDDEN,
  HIDDEN_MOVES,
  isHiddenPath,
  shouldMigrate,
} from "../src/core/vaultPaths";

/**
 * A regra de quando MEXER nos arquivos de alguém.
 *
 * Mover arquivo de conversa é a operação mais perigosa deste app: é a única
 * coisa que ele guarda que não se refaz. Por isso a decisão é uma função pura,
 * testada, e cada "não" dela vale mais que o "sim".
 */

describe("o que vai pra pasta oculta", () => {
  it("conversas e índice vão; o resto não é mencionado aqui", () => {
    const legados = HIDDEN_MOVES.map((m) => m.legado);
    expect(legados).toContain("axxa-ai/chats");
    expect(legados).toContain("axxa-ai/index");
    // Skills, mídia gerada e relatórios ficam VISÍVEIS de propósito: skill é
    // nota que a pessoa edita, e mídia escondida não dá pra embutir numa nota
    // (o Obsidian não resolve link pra fora do índice).
    expect(legados).not.toContain("axxa-ai/skills");
    expect(legados).not.toContain("axxa-ai/generation");
    expect(legados).not.toContain("axxa-ai/reports");
  });

  it("todo destino é uma pasta que o Obsidian ignora", () => {
    for (const m of HIDDEN_MOVES) {
      expect(m.novo.startsWith(`${AXXA_HIDDEN}/`)).toBe(true);
      expect(isHiddenPath(m.novo)).toBe(true);
      expect(isHiddenPath(m.legado)).toBe(false);
    }
  });
});

describe("isHiddenPath", () => {
  it("qualquer trecho com ponto na frente esconde o caminho inteiro", () => {
    expect(isHiddenPath(".axxa/chats/agent/x.md")).toBe(true);
    expect(isHiddenPath("notas/.rascunho/x.md")).toBe(true);
    expect(isHiddenPath("axxa-ai/chats/x.md")).toBe(false);
    // Ponto NO MEIO do nome não esconde nada — só no começo.
    expect(isHiddenPath("notas/plano.v2/x.md")).toBe(false);
  });
});

describe("shouldMigrate", () => {
  const base = {
    caminhoAtual: "axxa-ai/chats",
    legado: "axxa-ai/chats",
    novo: ".axxa/chats",
    origemExiste: true,
    destinoExiste: false,
  };

  it("caminho padrão antigo, com arquivos lá e destino livre: move", () => {
    expect(shouldMigrate(base)).toBe(true);
  });

  it("caminho ESCOLHIDO pela pessoa não se mexe", () => {
    // Quem apontou as conversas pra outro lugar tomou uma decisão. Migrar por
    // cima dela é desfazer o que ela pediu.
    expect(
      shouldMigrate({ ...base, caminhoAtual: "Arquivo/minhas-conversas" })
    ).toBe(false);
  });

  it("instalação nova (já no caminho novo) não tenta nada", () => {
    expect(shouldMigrate({ ...base, caminhoAtual: ".axxa/chats" })).toBe(false);
  });

  it("origem inexistente: não há o que mover", () => {
    expect(shouldMigrate({ ...base, origemExiste: false })).toBe(false);
  });

  it("destino JÁ existe: não passa por cima", () => {
    // Ou a migração já rodou, ou há coisa lá. Escrever por cima podia
    // sobrescrever conversa — e conversa não se refaz.
    expect(shouldMigrate({ ...base, destinoExiste: true })).toBe(false);
  });

  it("um 'não' basta, mesmo com todo o resto a favor", () => {
    expect(
      shouldMigrate({ ...base, origemExiste: false, destinoExiste: true })
    ).toBe(false);
  });
});
