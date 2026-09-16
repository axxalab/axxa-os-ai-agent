import { describe, it, expect } from "vitest";
import { settingsReadLooksBroken as leituraSuspeita } from "../src/core/settingsGuard";

/**
 * A trava que impede uma LEITURA falha de virar uma perda permanente.
 *
 * O caminho do estrago é curto e silencioso: `loadData()` devolve null tanto
 * pra "primeira instalação" quanto pra "o arquivo está lá e não deu pra ler"
 * (JSON quebrado, escrita interrompida). O plugin assume os padrões, a pessoa
 * mexe em qualquer coisa, `saveSettings` roda — e grava o padrão de fábrica
 * por cima de chaves, modelos, providers e projetos. As conversas sobrevivem
 * (são .md no vault); as configurações não têm de onde voltar.
 *
 * A decisão mora em src/core/settingsGuard.ts porque a classe do plugin
 * precisa do app do Obsidian inteiro pra instanciar — e o que importa aqui é
 * a decisão, que é pura.
 */

describe("quando as settings NÃO podem ser gravadas", () => {
  it("leitura boa: grava normalmente", () => {
    expect(
      leituraSuspeita({ chavesLidas: 42, arquivoExiste: true, tamanhoBruto: 900 })
    ).toBe(false);
  });

  it("primeira instalação: não há arquivo, os padrões SÃO a resposta certa", () => {
    expect(
      leituraSuspeita({ chavesLidas: 0, arquivoExiste: false, tamanhoBruto: 0 })
    ).toBe(false);
  });

  it("arquivo existe com conteúdo e não foi lido: TRAVA", () => {
    // É este o caso que apagava tudo em silêncio.
    expect(
      leituraSuspeita({ chavesLidas: 0, arquivoExiste: true, tamanhoBruto: 900 })
    ).toBe(true);
  });

  it("arquivo vazio ou com um `{}` não trava — não há nada a perder", () => {
    expect(
      leituraSuspeita({ chavesLidas: 0, arquivoExiste: true, tamanhoBruto: 0 })
    ).toBe(false);
    expect(
      leituraSuspeita({ chavesLidas: 0, arquivoExiste: true, tamanhoBruto: 2 })
    ).toBe(false);
  });

  it("um JSON quebrado de qualquer tamanho trava", () => {
    // `{"openaiApiKey":` — escrita interrompida no meio. `loadData` devolve
    // null, o arquivo está lá, e tem conteúdo de sobra.
    expect(
      leituraSuspeita({ chavesLidas: 0, arquivoExiste: true, tamanhoBruto: 17 })
    ).toBe(true);
  });
});
