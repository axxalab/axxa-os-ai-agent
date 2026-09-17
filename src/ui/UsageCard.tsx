// src/ui/UsageCard.tsx
// O cartão de uso no topo da home: quanto você gastou na semana, em quantas
// conversas, e com qual modelo.
//
// Ele existe pela mesma razão do resto do painel — responder antes de
// perguntar. Gasto com modelo é a única coisa do app que corre sozinha
// enquanto você usa, e até aqui só dava pra saber dela indo atrás de um
// relatório. Quem vê o número toda vez que abre não toma susto no fim do mês.
//
// As contas são do motor do relatório de uso (ver ui/homeStats.ts, que só
// escolhe o que cabe aqui).

import type { ChatSummary } from "../core/chatPersistence";
import { formatUsd } from "../usage/pricing";
import { formatCompact } from "../usage/format";
import { Icon } from "./Icon";
import { providerIcon } from "./ChatList";
import { resumoDeUso, rotuloDaJanela, JANELA_PADRAO } from "./homeStats";

export function UsageCard({ chats }: { chats: readonly ChatSummary[] }) {
  const r = resumoDeUso(chats, JANELA_PADRAO);

  // Sai de cena quando não há o que contar: semana sem conversa, ou conversas
  // que não registraram token nenhum (arquivos de versões antigas). Zero
  // repetido ensina a não olhar pro lugar — e um cartão que só sabe dizer
  // "0" ocupa o topo da tela sem pagar aluguel.
  if (r.chats === 0 || (!r.temCusto && r.tokens === 0)) return null;

  return (
    <section className="axxa-usage" aria-label="Usage this week">
      {/* Duas linhas, não três: cada linha aqui é meia conversa a menos na
          lista logo abaixo, e a lista é o motivo de a tela existir. */}
      <div className="axxa-usage-head">
        {/* A manchete é o dinheiro quando há dinheiro. Com tudo local ou
            grátis o custo é zero, e um "$0.00" garrafal não é notícia — aí
            quem manda é o volume. */}
        <span className="axxa-usage-big">
          {r.temCusto ? (
            <>
              {formatUsd(r.custo)}
              {r.custoIncompleto && (
                <span
                  className="axxa-usage-approx"
                  title="Some models have no public price — this is a floor"
                >
                  +
                </span>
              )}
            </>
          ) : (
            <>
              {formatCompact(r.tokens)}
              <span className="axxa-usage-unit">tokens</span>
            </>
          )}
        </span>

        {/* A forma da semana, não a medida dela: barras sem eixo, sem número,
            só pra ver se hoje foi mais ou menos que anteontem. */}
        <span className="axxa-usage-spark" aria-hidden="true">
          {r.barras.map((v, i) => (
            <span
              key={i}
              className="axxa-usage-bar"
              // 8% de piso pra o dia vazio continuar sendo um dia na régua —
              // barra de altura zero some e a semana perde o tamanho.
              style={{ height: `${Math.max(8, Math.round(v * 100))}%` }}
            />
          ))}
        </span>
      </div>

      <div className="axxa-usage-line">
        <span className="axxa-usage-meta">
          {rotuloDaJanela(r.dias)} · {r.chats === 1 ? "1 chat" : `${r.chats} chats`}
          {r.temCusto ? ` · ${formatCompact(r.tokens)} tokens` : ""}
        </span>
        {r.modeloFavorito && (
          <span className="axxa-usage-model">
            <Icon name={providerIcon(r.modeloFavorito.provider)} size={16} />
            <span>{r.modeloFavorito.model}</span>
          </span>
        )}
      </div>
    </section>
  );
}
