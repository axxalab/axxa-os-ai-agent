// src/ui/RagLine.tsx
// A linha do índice LOCAL, logo abaixo do cartão de uso.
//
// Ela existe porque o índice é a parte do app mais fácil de não perceber: ele
// se constrói sozinho, mora escondido numa pasta oculta, e a diferença entre
// "achou pelo sentido" e "achou pela palavra" só aparece na qualidade de uma
// resposta — tarde demais pra quem está lendo. A linha conta três coisas que
// só ele sabe: se existe, de quanto do vault ele é feito, e que nada disso
// sai do aparelho.
//
// E ela é AÇÃO, não aviso. Duas, na verdade, e elas são diferentes:
//
//   • o texto abre as settings, onde se escolhe COMO indexar (modelo de
//     embedding, precisão, shards) — decisões que se tomam uma vez;
//   • o ↻ reindexa AGORA, que é o que se quer nove em cada dez vezes: você
//     escreveu notas novas e quer que elas entrem. Pôr isso atrás de duas
//     telas de settings seria esconder o gesto mais frequente atrás do mais
//     raro.
//
// Reindexar é INCREMENTAL (ver main.runVaultIndex): só o que mudou é
// re-embedado, senão "atualizar" custaria a conta de um índice inteiro.

import { useEffect, useState } from "react";
import type AxxaPlugin from "../main";
import { formatCompact } from "../usage/format";
import { Icon } from "./Icon";
import { openPluginSettings } from "./modals";

export function RagLine({ plugin }: { plugin: AxxaPlugin }) {
  // O índice muda por fora desta tela (a indexação roda no plugin), e o
  // plugin avisa pelos mesmos listeners das settings.
  const [, redesenhar] = useState(0);
  useEffect(
    () => plugin.onSettingsChange(() => redesenhar((n) => n + 1)),
    [plugin]
  );

  const idx = plugin.vectorIndex;
  const trechos = idx?.size ?? 0;
  const notas = idx?.fileCount ?? 0;
  const pronto = trechos > 0;
  const rodando = plugin.indexing !== null;

  return (
    <div className={pronto ? "axxa-rag-line is-on" : "axxa-rag-line"}>
      <button
        type="button"
        className="axxa-rag-open"
        aria-label="Index settings"
        onClick={() => openPluginSettings(plugin)}
      >
        {/* O mesmo ícone nos dois estados: o que muda é a COR (ver o `is-on`
            no CSS). Trocar o desenho junto faria parecer outra coisa, e é a
            mesma coisa em dois estados. */}
        <Icon name="database" size={14} />
        <span className="axxa-rag-text">
          {pronto ? (
            <>
              <strong>Local index</strong> · {formatCompact(notas)}{" "}
              {notas === 1 ? "note" : "notes"} · {formatCompact(trechos)}{" "}
              {trechos === 1 ? "chunk" : "chunks"} · searched on this device
            </>
          ) : (
            <>
              {/* Sem índice o app NÃO fica sem busca — ele cai na busca por
                  palavra. Dizer "desligado" seria mentira; o que muda é achar
                  por sentido ou só por palavra igual. */}
              <strong>Local index</strong> · not built yet — notes are found by
              keyword until you build it
            </>
          )}
        </span>
      </button>

      {/* Rodando, o mesmo botão CANCELA: é o gesto que a pessoa procura
          quando percebe que começou na hora errada. */}
      <button
        type="button"
        className={rodando ? "axxa-rag-refresh is-running" : "axxa-rag-refresh"}
        aria-label={rodando ? "Cancel indexing" : "Update index"}
        title={rodando ? "Cancel indexing" : "Update index with new notes"}
        onClick={() => void plugin.runVaultIndex()}
      >
        <Icon name={rodando ? "square" : "refresh-cw"} size={14} />
      </button>
    </div>
  );
}
