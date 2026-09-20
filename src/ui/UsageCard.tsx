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
// Tudo aqui é o MÊS VIGENTE e sai do que o app já grava por conversa. Nenhum
// número depende de você configurar coisa nenhuma: uma barra de progresso
// precisaria de um limite, e o limite teria que ser inventado — cobrança por
// token não tem teto. Barra assim mede a régua, não o uso.
//
// Cada pedaço responde uma pergunta que os outros não respondem:
//   • o TOTAL responde "quanto?";
//   • o CALENDÁRIO responde "como tem sido?" — se é todo dia um pouco, se
//     sumiu uma semana, se o mês inteiro coube em duas madrugadas;
//   • os MODELOS respondem "com o quê?", e em que proporção;
//   • os MÓDULOS põem número no que o calendário só insinua: sequência, dias
//     ativos e o trabalho que o agente fez no vault.

import type { CSSProperties } from "react";
import type AxxaPlugin from "../main";
import type { ChatSummary } from "../core/chatPersistence";
import { formatUsdRounded } from "../usage/pricing";
import { formatCompact } from "../usage/format";
import { aggregateFromSummaries } from "../usage/aggregate";
import { Icon } from "./Icon";
import { providerIcon } from "./ChatList";
import { heatmapDoMes, inicioDoMes, type Celula } from "./heatmap";
import {
  diasAtivos,
  modelosMaisUsados,
  sequenciaDeDias,
  trabalhoDoPeriodo,
  type ModeloUsado,
} from "./homeModules";

/** Quantos modelos cabem na lista sem ela virar um relatório. */
const MODELOS = 3;

export function UsageCard({
  plugin,
  chats,
  onOpen,
}: {
  plugin: AxxaPlugin;
  chats: readonly ChatSummary[];
  /** Abre a página de uso — o cartão inteiro é a porta dela. */
  onOpen: () => void;
}) {
  const mapa = heatmapDoMes(chats);
  // UM corte pra tudo: número que discorda do desenho logo acima dele é a
  // maneira mais rápida de o cartão perder a credibilidade.
  const desde = inicioDoMes();
  const doMes = chats.filter((c) => (c.date ?? "").slice(0, 10) >= desde);
  const agg = aggregateFromSummaries(doMes, 0);

  const modelos = modelosMaisUsados(chats, desde, MODELOS);
  // A sequência é a única que olha ALÉM do mês: hábito não recomeça no dia 1
  // só porque o desenho recomeça.
  const sequencia = sequenciaDeDias(chats);
  const ativos = diasAtivos(mapa.celulas);
  const trabalho = trabalhoDoPeriodo(chats, desde);

  // Sai de cena quando não há o que contar. Zero repetido ensina a não olhar
  // pro lugar — e um calendário todo apagado é só um retângulo cinza.
  if (agg.total.chats === 0) return null;

  return (
    // O cartão INTEIRO abre a página: ele já é um resumo, e todo resumo
    // convida a mesma pergunta ("e daí?"). Um botãozinho "ver mais" num canto
    // seria um alvo pequeno pra uma intenção grande.
    <section
      className="axxa-usage is-clickable"
      role="button"
      tabIndex={0}
      aria-label={`Usage in ${mapa.rotulo} — open details`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
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
        {/* O mês dá nome ao que está sendo contado. Sem ele o cartão parece
            falar do começo dos tempos. */}
        <span className="axxa-usage-month">{mapa.rotulo}</span>
      </div>

      {/* Calendário e modelos LADO A LADO: o mês é um quadrado estreito, e a
          largura que sobrava dele não servia pra mais nada. */}
      <div className="axxa-usage-mid">
        <Calendario celulas={mapa.celulas} pico={mapa.pico} />
        {modelos.length > 0 && (
          <div className="axxa-models">
            {modelos.map((m) => (
              <LinhaDeModelo key={m.model} m={m} />
            ))}
          </div>
        )}
      </div>

      <div className="axxa-mods">
        {/* A sequência primeiro: é a única que muda de valor por você abrir o
            app hoje, e a única que se PERDE. */}
        <Modulo
          rotulo="Streak"
          valor={sequencia > 0 ? String(sequencia) : "—"}
          unidade={sequencia === 1 ? "day" : "days"}
        />
        {/* "Active days" quebrava em duas linhas num quadro estreito e
            esticava a fileira: o rótulo é uma palavra só, e quem diz que são
            dias é o vizinho da esquerda. */}
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

/** O calendário do mês: colunas são dias da semana, linhas são semanas. */
function Calendario({ celulas, pico }: { celulas: Celula[]; pico: number }) {
  return (
    <div
      className="axxa-heat"
      role="img"
      aria-label={`Daily usage this month, busiest day ${formatCompact(pico)} tokens`}
    >
      {celulas.map((c, i) => (
        <span
          key={i}
          className={
            c.dia
              ? `axxa-heat-cell is-${c.nivel}`
              : c.futuro
                ? "axxa-heat-cell is-future"
                : "axxa-heat-cell is-void"
          }
          // O título é o que dá o número exato de um dia sem gastar linha:
          // no desktop sai no hover, no celular é inofensivo.
          title={c.dia ? `${c.dia} · ${formatCompact(c.tokens)} tokens` : undefined}
        />
      ))}
    </div>
  );
}

/**
 * Uma linha de modelo: o anel com a fatia, o logo do provider e o nome.
 *
 * O anel é um `conic-gradient` com um furo de máscara, não um SVG: é uma
 * declaração de CSS no lugar de uma árvore de elementos, e o furo precisa ser
 * máscara pra valer sobre QUALQUER fundo — um círculo interno pintado teria
 * que adivinhar a cor do cartão, que é translúcida.
 */
function LinhaDeModelo({ m }: { m: ModeloUsado }) {
  return (
    <div className="axxa-model-row" title={`${formatCompact(m.tokens)} tokens`}>
      <span
        className="axxa-donut"
        style={{ "--axxa-pct": m.pct } as CSSProperties}
        aria-hidden="true"
      />
      <Icon name={providerIcon(m.provider)} size={14} />
      <span className="axxa-model-name">{m.model}</span>
      <span className="axxa-model-pct">{m.pct}%</span>
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
