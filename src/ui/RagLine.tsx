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
// É uma linha, não um cartão: o índice não é uma decisão que se toma toda
// hora, é um estado que se confere de vez em quando.

import type AxxaPlugin from "../main";
import { formatCompact } from "../usage/format";
import { Icon } from "./Icon";

export function RagLine({ plugin }: { plugin: AxxaPlugin }) {
  const idx = plugin.vectorIndex;
  const trechos = idx?.size ?? 0;
  const notas = idx?.fileCount ?? 0;
  const pronto = trechos > 0;

  return (
    <div className={pronto ? "axxa-rag-line is-on" : "axxa-rag-line"}>
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
            keyword until you index them in Settings
          </>
        )}
      </span>
    </div>
  );
}
