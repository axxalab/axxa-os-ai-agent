// src/ui/UsageCard.tsx
// O cartão de uso no topo da home, no espírito do painel que o app do Claude
// mostra ao abrir uma sessão nova: quanto já rodou, COMO tem rodado, e com o
// quê.
//
// Ele existe pela mesma razão do resto do painel — responder antes de
// perguntar. Gasto e volume são as únicas coisas do app que correm sozinhas
// enquanto você usa; até aqui só dava pra saber delas indo atrás de um
// relatório.
//
// Três informações, e cada uma responde uma pergunta diferente:
//   • o TOTAL responde "quanto?";
//   • o HEATMAP responde "como tem sido?" — se é todo dia um pouco, se sumiu
//     uma semana, se o mês inteiro coube em duas madrugadas. Número nenhum
//     responde isso;
//   • o MODELO responde "com o quê?".
//
// As barras de orçamento aparecem depois, e só pra quem definiu uma régua
// (ver usageBars.ts): sem limite de plano, barra sem régua não mede nada.

import type AxxaPlugin from "../main";
import type { ChatSummary } from "../core/chatPersistence";
import { formatUsd, formatUsdRounded } from "../usage/pricing";
import { formatCompact } from "../usage/format";
import { aggregateFromSummaries } from "../usage/aggregate";
import { Icon } from "./Icon";
import { providerIcon } from "./ChatList";
import { resumoDeUso } from "./homeStats";
import { heatmap, type Celula } from "./heatmap";
import {
  barra,
  gastoNoPeriodo,
  mesAtual,
  rotuloReset,
  semanaAtual,
  type GastoDoPeriodo,
  type Periodo,
} from "./usageBars";

/** Semanas no calendário. Meio ano cabe na largura de um telefone e é fundo
 *  suficiente pra um hábito aparecer. */
const SEMANAS = 26;

export function UsageCard({
  plugin,
  chats,
}: {
  plugin: AxxaPlugin;
  chats: readonly ChatSummary[];
}) {
  const mapa = heatmap(chats, SEMANAS);
  const orcSemana = plugin.settings.budgetWeekly;
  const orcMes = plugin.settings.budgetMonthly;

  // Custo do MESMO período do desenho: total e calendário discordando logo um
  // acima do outro é a maneira mais rápida de o cartão perder a credibilidade.
  const desde = mapa.celulas.find((c) => c.dia)?.dia ?? "";
  const doPeriodo = chats.filter((c) => (c.date ?? "").slice(0, 10) >= desde);
  const agg = aggregateFromSummaries(doPeriodo, 0);
  const favorito = resumoDeUso(chats, 30).modeloFavorito;

  // Sai de cena quando não há o que contar. Zero repetido ensina a não olhar
  // pro lugar — e um calendário todo apagado é só um retângulo cinza.
  if (agg.total.chats === 0) return null;

  return (
    <section className="axxa-usage" aria-label="Usage">
      <div className="axxa-usage-line">
        <span className="axxa-usage-meta">
          <span className="axxa-usage-big">{formatCompact(mapa.total)}</span>
          <span className="axxa-usage-unit">tokens</span>
          <span className="axxa-usage-sep">·</span>
          {agg.total.chats === 1 ? "1 chat" : `${agg.total.chats} chats`}
          {agg.total.cost > 0 && (
            <>
              <span className="axxa-usage-sep">·</span>
              {formatUsdRounded(agg.total.cost)}
              {agg.total.hasUnknownCost && (
                <span
                  className="axxa-usage-approx"
                  title="Some models have no public price — this is a floor"
                >
                  +
                </span>
              )}
            </>
          )}
        </span>
        {favorito && (
          <span className="axxa-usage-model" title="Most used model">
            <Icon name={providerIcon(favorito.provider)} size={16} />
            <span>{favorito.model}</span>
          </span>
        )}
      </div>

      <Calendario celulas={mapa.celulas} semanas={mapa.semanas} pico={mapa.pico} />

      {orcSemana > 0 && (
        <Linha
          titulo="This week"
          periodo={semanaAtual()}
          tipo="semana"
          gasto={gastoNoPeriodo(chats, semanaAtual())}
          orcamento={orcSemana}
        />
      )}
      {orcMes > 0 && (
        <Linha
          titulo="This month"
          periodo={mesAtual()}
          tipo="mes"
          gasto={gastoNoPeriodo(chats, mesAtual())}
          orcamento={orcMes}
        />
      )}
    </section>
  );
}

/** O calendário: colunas são semanas, linhas são dias da semana. */
function Calendario({
  celulas,
  semanas,
  pico,
}: {
  celulas: Celula[];
  semanas: number;
  pico: number;
}) {
  return (
    <div
      className="axxa-heat"
      style={{ "--axxa-heat-cols": semanas } as React.CSSProperties}
      role="img"
      aria-label={`Daily usage over the last ${semanas} weeks, busiest day ${formatCompact(pico)} tokens`}
    >
      {celulas.map((c, i) => (
        <span
          key={i}
          className={c.dia ? `axxa-heat-cell is-${c.nivel}` : "axxa-heat-cell is-void"}
          // O título é o que dá o número exato de um dia sem gastar linha:
          // no desktop sai no hover, no celular é inofensivo.
          title={c.dia ? `${c.dia} · ${formatCompact(c.tokens)} tokens` : undefined}
        />
      ))}
    </div>
  );
}

/** Uma linha de orçamento: nome + quando zera, quanto saiu, e a barra. */
function Linha({
  titulo,
  periodo,
  tipo,
  gasto,
  orcamento,
}: {
  titulo: string;
  periodo: Periodo;
  tipo: "semana" | "mes";
  gasto: GastoDoPeriodo;
  orcamento: number;
}) {
  const b = barra(gasto.custo, orcamento);
  return (
    <div className="axxa-bar-row">
      <div className="axxa-bar-head">
        <span className="axxa-bar-name">
          {titulo}
          <span className="axxa-bar-reset"> · {rotuloReset(periodo.reset, tipo)}</span>
        </span>
        <span className="axxa-bar-num">
          {formatUsdRounded(gasto.custo)}
          {gasto.incompleto && <span className="axxa-usage-approx">+</span>}
          <span className="axxa-bar-of"> / {formatUsdRounded(orcamento)}</span>
          <span className={b.estourou ? "axxa-bar-pct is-over" : "axxa-bar-pct"}>
            {b.porcento}%
          </span>
        </span>
      </div>
      {/* A barra é um `meter` em espírito, mas não em marcação: `<meter>` vem
          com aparência própria do sistema e não se deixa pintar. */}
      <div
        className="axxa-bar-track"
        role="img"
        aria-label={`${titulo}: ${b.porcento}% of ${formatUsd(orcamento)}`}
      >
        <span
          className={b.estourou ? "axxa-bar-fill is-over" : "axxa-bar-fill"}
          style={{ width: `${Math.round(b.fracao * 100)}%` }}
        />
      </div>
    </div>
  );
}
