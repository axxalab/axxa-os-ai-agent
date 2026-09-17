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
// Tudo aqui sai do que o app JÁ GRAVA por conversa. Nenhum número depende de
// você configurar coisa nenhuma: uma barra de progresso precisaria de um
// limite, e o limite teria que ser inventado — cobrança por token não tem
// teto. Barra assim mede a régua, não o uso.
//
// Cada pedaço responde uma pergunta que os outros não respondem:
//   • o TOTAL responde "quanto?";
//   • o CALENDÁRIO responde "como tem sido?" — se é todo dia um pouco, se
//     sumiu uma semana, se o mês inteiro coube em duas madrugadas;
//   • os MÓDULOS põem número no que o calendário só insinua: sequência, dias
//     ativos e o trabalho que o agente fez no vault;
//   • o MODELO responde "com o quê?".

import type { CSSProperties } from "react";
import type AxxaPlugin from "../main";
import type { ChatSummary } from "../core/chatPersistence";
import { formatUsdRounded } from "../usage/pricing";
import { formatCompact } from "../usage/format";
import { aggregateFromSummaries } from "../usage/aggregate";
import { Icon } from "./Icon";
import { providerIcon } from "./ChatList";
import { resumoDeUso } from "./homeStats";
import { heatmap, type Celula } from "./heatmap";
import {
  diasAtivos,
  sequenciaDeDias,
  trabalhoDoPeriodo,
} from "./homeModules";

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

  // Tudo no cartão conta o MESMO período do desenho: números e calendário
  // discordando logo um acima do outro é a maneira mais rápida de o cartão
  // perder a credibilidade.
  const desde = mapa.celulas.find((c) => c.dia)?.dia ?? "";
  const doPeriodo = chats.filter((c) => (c.date ?? "").slice(0, 10) >= desde);
  const agg = aggregateFromSummaries(doPeriodo, 0);
  const favorito = resumoDeUso(chats, 30).modeloFavorito;

  const sequencia = sequenciaDeDias(mapa.celulas);
  const ativos = diasAtivos(mapa.celulas);
  const trabalho = trabalhoDoPeriodo(chats, desde);

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

      {/* TRÊS, sempre: uma fileira só. Cinco módulos viravam três fileiras e
          o cartão passava de 300px — a lista sumia atrás dele.
          "Dia mais forte" ficou de fora de propósito: é o quadradinho mais
          escuro do calendário logo acima, e módulo que repete o desenho ocupa
          espaço sem dizer nada novo. */}
      <div className="axxa-mods">
        {/* A sequência primeiro: é a única que muda de valor por você abrir o
            app hoje, e a única que se PERDE. */}
        <Modulo
          rotulo="Streak"
          valor={sequencia > 0 ? String(sequencia) : "—"}
          unidade={sequencia === 1 ? "day" : "days"}
        />
        {/* "Active days" quebrava em duas linhas num quadro de 92px e
            esticava a fileira inteira: o rótulo é uma palavra só, e quem diz
            que são dias é o vizinho da esquerda. */}
        <Modulo
          rotulo="Active"
          valor={String(ativos.ativos)}
          unidade={`of ${ativos.total}`}
        />
        {/* Ações é o número mais AXXA de todos: é o equivalente daqui às
            linhas de código do painel do Claude Code. Token mede consumo;
            ação mede TRABALHO feito no vault. Sem nenhuma — quem nunca usou o
            Agent —, o lugar vai pras mensagens em vez de exibir um zero. */}
        {trabalho.acoes > 0 ? (
          <Modulo
            rotulo="Actions"
            valor={formatCompact(trabalho.acoes)}
            unidade="in vault"
          />
        ) : (
          <Modulo
            rotulo="Messages"
            valor={formatCompact(trabalho.mensagens)}
            unidade="sent"
          />
        )}
      </div>

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
      style={{ "--axxa-heat-cols": semanas } as CSSProperties}
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

/**
 * Um módulo: rótulo miúdo em cima, o número embaixo, e a unidade ao lado dele.
 *
 * O número é o que se lê de relance; a unidade existe pra ele não virar um
 * inteiro solto sem significado ("38" do quê?).
 */
function Modulo({
  rotulo,
  valor,
  unidade,
}: {
  rotulo: string;
  valor: string;
  unidade: string;
}) {
  return (
    <div className="axxa-mod">
      <span className="axxa-mod-title">{rotulo}</span>
      <span className="axxa-mod-row">
        <span className="axxa-mod-value">{valor}</span>
        <span className="axxa-mod-unit">{unidade}</span>
      </span>
    </div>
  );
}
