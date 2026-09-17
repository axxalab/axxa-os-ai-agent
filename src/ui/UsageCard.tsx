// src/ui/UsageCard.tsx
// O cartão de uso no topo da home, no formato do `/usage` do Claude Code: uma
// linha por período, com quanto dele já foi e quando ele zera.
//
// Ele existe pela mesma razão do resto do painel — responder antes de
// perguntar. Gasto com modelo é a única coisa do app que corre sozinha
// enquanto você usa, e até aqui só dava pra saber dela indo atrás de um
// relatório. Quem vê o número toda vez que abre não toma susto no fim do mês.
//
// A régua é sua: cobrança por token não tem teto, então a barra mede contra o
// ORÇAMENTO que você define nas settings. Sem orçamento não há barra — teria
// que inventar um limite pra fingir que a barra significa algo —, e aí o
// cartão mostra o gasto do mês em números, com o caminho pra criar a régua.

import type AxxaPlugin from "../main";
import type { ChatSummary } from "../core/chatPersistence";
import { formatUsd, formatUsdRounded } from "../usage/pricing";
import { formatCompact } from "../usage/format";
import { Icon } from "./Icon";
import { providerIcon } from "./ChatList";
import { openPluginSettings } from "./modals";
import { resumoDeUso } from "./homeStats";
import {
  barra,
  gastoNoPeriodo,
  mesAtual,
  rotuloReset,
  semanaAtual,
  type GastoDoPeriodo,
  type Periodo,
} from "./usageBars";

export function UsageCard({
  plugin,
  chats,
}: {
  plugin: AxxaPlugin;
  chats: readonly ChatSummary[];
}) {
  const semana = semanaAtual();
  const mes = mesAtual();
  const gastoSemana = gastoNoPeriodo(chats, semana);
  const gastoMes = gastoNoPeriodo(chats, mes);
  const orcSemana = plugin.settings.budgetWeekly;
  const orcMes = plugin.settings.budgetMonthly;
  const temRegua = orcSemana > 0 || orcMes > 0;

  // Sai de cena quando não há o que contar: mês sem conversa nenhuma. Zero
  // repetido ensina a não olhar pro lugar.
  if (gastoMes.chats === 0 && gastoSemana.chats === 0) return null;

  return (
    <section className="axxa-usage" aria-label="Usage">
      {temRegua ? (
        <>
          {orcSemana > 0 && (
            <Linha
              titulo="This week"
              periodo={semana}
              tipo="semana"
              gasto={gastoSemana}
              orcamento={orcSemana}
            />
          )}
          {orcMes > 0 && (
            <Linha
              titulo="This month"
              periodo={mes}
              tipo="mes"
              gasto={gastoMes}
              orcamento={orcMes}
            />
          )}
        </>
      ) : (
        <SemRegua plugin={plugin} chats={chats} gasto={gastoMes} />
      )}

      <Rodape chats={chats} gasto={gastoMes} temRegua={temRegua} />
    </section>
  );
}

/** Uma linha de período: nome + quando zera, a barra, e o quanto saiu. */
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
      {/* Duas linhas por período, não três: cada linha aqui é meia conversa a
          menos na lista logo abaixo, e a lista é o motivo da tela existir. */}
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

/** Sem orçamento: o gasto do mês em números, e a porta pra criar a régua. */
function SemRegua({
  plugin,
  chats,
  gasto,
}: {
  plugin: AxxaPlugin;
  chats: readonly ChatSummary[];
  gasto: GastoDoPeriodo;
}) {
  const semana = resumoDeUso(chats, 7);
  return (
    <div className="axxa-bar-row">
      <div className="axxa-bar-head">
        <span className="axxa-bar-name">This month</span>
        {/* A forma da semana, no lugar onde a porcentagem estaria: barras sem
            eixo e sem número, só pra ver se hoje foi mais que anteontem. */}
        <span className="axxa-usage-spark" aria-hidden="true">
          {semana.barras.map((v, i) => (
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
      <div className="axxa-usage-big">
        {gasto.custo > 0 ? (
          <>
            {formatUsd(gasto.custo)}
            {gasto.incompleto && (
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
            {formatCompact(gasto.tokens)}
            <span className="axxa-usage-unit">tokens</span>
          </>
        )}
        <button
          type="button"
          className="axxa-usage-set"
          onClick={() => openPluginSettings(plugin)}
        >
          Set a budget
        </button>
      </div>
    </div>
  );
}

/** A linha de baixo: o que foi usado, e com quê. */
function Rodape({
  chats,
  gasto,
  temRegua,
}: {
  chats: readonly ChatSummary[];
  gasto: GastoDoPeriodo;
  temRegua: boolean;
}) {
  // O modelo favorito olha a semana, não o mês: é "o que você está usando",
  // não "o que você usou".
  const favorito = resumoDeUso(chats, 7).modeloFavorito;
  return (
    <div className="axxa-usage-line">
      <span className="axxa-usage-meta">
        {gasto.chats === 1 ? "1 chat" : `${gasto.chats} chats`} ·{" "}
        {formatCompact(gasto.tokens)} tokens
        {temRegua ? " this month" : ""}
      </span>
      {favorito && (
        <span className="axxa-usage-model">
          <Icon name={providerIcon(favorito.provider)} size={16} />
          <span>{favorito.model}</span>
        </span>
      )}
    </div>
  );
}
