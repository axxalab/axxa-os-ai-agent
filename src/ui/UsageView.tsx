// src/ui/UsageView.tsx
// A página de USO: o cartão da home aberto, com o recorte na sua mão.
//
// O cartão responde "quanto, como e com quê" de relance e cabe em três linhas.
// Esta tela existe pras perguntas que não cabem ali e que sempre chegam
// depois: "quanto foi só o Opus?", "e no Agent?", "e na semana passada?".
//
// Ela não recalcula nada por conta própria — filtra as conversas e entrega a
// mesma agregação de sempre (usage/aggregate), a mesma do relatório. Dois
// caminhos pra mesma conta acabariam discordando, e é justamente aqui, onde
// se confere dinheiro, que discordar custa a confiança da tela inteira.
//
// O recorte é aplicado ANTES de somar: com ele aplicado no fim, o total diria
// uma coisa e a tabela outra.

import { useMemo, useState } from "react";
import { Notice } from "obsidian";
import type AxxaPlugin from "../main";
import { useChatSummaries } from "./ChatList";
import { Icon } from "./Icon";
import { aggregateFromSummaries, sortBucketEntries } from "../usage/aggregate";
import { formatUsd, formatUsdRounded } from "../usage/pricing";
import { formatCompact } from "../usage/format";
import { saveUsageMarkdown } from "../usage/export";
import {
  FILTRO_VAZIO,
  alternar,
  aplicar,
  opcoes,
  temFiltro,
  type UsageFilter,
} from "../usage/filters";
import { moduleLabel } from "./modules";
import { providerIcon } from "./ChatList";
import { PROVIDERS } from "../core/providersMeta";

/** Janelas do filtro de período. 0 = tudo. */
const PERIODOS: Array<{ dias: number; label: string }> = [
  { dias: 0, label: "All time" },
  { dias: 7, label: "7 days" },
  { dias: 30, label: "30 days" },
  { dias: 90, label: "90 days" },
];

export function UsageView({
  plugin,
  onBack,
}: {
  plugin: AxxaPlugin;
  onBack: () => void;
}) {
  const chats = useChatSummaries(plugin);
  const [f, setF] = useState<UsageFilter>(FILTRO_VAZIO);
  const [salvando, setSalvando] = useState(false);

  // As opções saem das conversas INTEIRAS, não do recorte: se elas
  // encolhessem junto, marcar um provider apagaria os outros da lista e não
  // haveria como desmarcar.
  const porProvider = useMemo(() => opcoes(chats, "provider"), [chats]);
  const porModelo = useMemo(() => opcoes(chats, "model"), [chats]);
  const porModo = useMemo(() => opcoes(chats, "mode"), [chats]);

  const recorte = useMemo(() => aplicar(chats, f), [chats, f]);
  const agg = useMemo(() => aggregateFromSummaries(recorte, 0), [recorte]);

  const salvarRelatorio = async () => {
    setSalvando(true);
    try {
      // O relatório é do RECORTE, não do vault inteiro: foi o recorte que a
      // pessoa montou, e é dele que ela quer o documento.
      const r = await saveUsageMarkdown(
        plugin.app,
        agg,
        f.days,
        plugin.settings.chatsPath
      );
      new Notice(`Report saved: ${r.path}`);
    } catch (err) {
      console.error("[axxa] salvar report falhou:", err);
      new Notice(
        `Could not save the report: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="axxa-chat">
      <header className="axxa-topbar is-bare">
        <button
          type="button"
          className="axxa-icon-btn"
          aria-label="Back"
          onClick={onBack}
        >
          <Icon name="arrow-left" />
        </button>
        <span className="axxa-brand axxa-topbar-brand">Usage</span>
      </header>

      <div className="axxa-messages axxa-home">
        {/* Os totais do recorte, em cima: é a resposta da pergunta que a
            pessoa acabou de fazer com os filtros. */}
        <section className="axxa-usage">
          <div className="axxa-usage-line">
            <span className="axxa-usage-meta">
              <span className="axxa-usage-big">
                {agg.total.cost > 0
                  ? formatUsdRounded(agg.total.cost)
                  : formatCompact(agg.total.tokensIn + agg.total.tokensOut)}
              </span>
              <span className="axxa-usage-unit">
                {agg.total.cost > 0 ? "spent" : "tokens"}
              </span>
              {agg.total.hasUnknownCost && (
                <span
                  className="axxa-usage-approx"
                  title="Some models have no public price — this is a floor"
                >
                  +
                </span>
              )}
            </span>
            <span className="axxa-usage-month">
              {agg.total.chats === 1 ? "1 chat" : `${agg.total.chats} chats`}
            </span>
          </div>
          <div className="axxa-mods">
            <Modulo
              rotulo="In"
              valor={formatCompact(agg.total.tokensIn)}
              unidade="tokens"
            />
            <Modulo
              rotulo="Out"
              valor={formatCompact(agg.total.tokensOut)}
              unidade="tokens"
            />
            <Modulo
              rotulo="Avg"
              valor={
                agg.total.chats > 0
                  ? formatUsdRounded(agg.total.cost / agg.total.chats)
                  : "—"
              }
              unidade="per chat"
            />
          </div>
        </section>

        <Grupo titulo="Period">
          <div className="axxa-chips">
            {PERIODOS.map((p) => (
              <Chip
                key={p.dias}
                label={p.label}
                on={f.days === p.dias}
                // Período é UM: duas janelas ao mesmo tempo não querem dizer
                // nada. Por isso ele substitui em vez de alternar.
                onClick={() => setF({ ...f, days: p.dias })}
              />
            ))}
          </div>
        </Grupo>

        <Grupo titulo="Provider">
          <div className="axxa-chips">
            {porProvider.map((o) => (
              <Chip
                key={o.id}
                label={PROVIDERS.find((p) => p.id === o.id)?.name ?? o.id}
                logo={providerIcon(o.id)}
                count={o.count}
                on={f.providers.includes(o.id)}
                onClick={() =>
                  setF({ ...f, providers: alternar(f.providers, o.id) })
                }
              />
            ))}
          </div>
        </Grupo>

        <Grupo titulo="Model">
          <div className="axxa-chips">
            {porModelo.map((o) => (
              <Chip
                key={o.id}
                label={o.id}
                count={o.count}
                on={f.models.includes(o.id)}
                onClick={() => setF({ ...f, models: alternar(f.models, o.id) })}
              />
            ))}
          </div>
        </Grupo>

        <Grupo titulo="Mode">
          <div className="axxa-chips">
            {porModo.map((o) => (
              <Chip
                key={o.id}
                label={moduleLabel(o.id)}
                count={o.count}
                on={f.modes.includes(o.id)}
                onClick={() => setF({ ...f, modes: alternar(f.modes, o.id) })}
              />
            ))}
          </div>
        </Grupo>

        {temFiltro(f) && (
          <button
            type="button"
            className="axxa-home-filter is-accent"
            onClick={() => setF(FILTRO_VAZIO)}
          >
            <Icon name="x" size={16} />
            <span>Clear filters</span>
          </button>
        )}

        {/* O detalhe: quanto por modelo, dentro do recorte. É a tabela que
            responde "o caro é qual?" sem precisar abrir conversa nenhuma. */}
        <Grupo titulo="By model">
          {sortBucketEntries(agg.byModel).length === 0 ? (
            <p className="axxa-usage-vazio">Nothing in this slice.</p>
          ) : (
            <div className="axxa-linhas">
              {sortBucketEntries(agg.byModel).map(([modelo, b]) => (
                <div key={modelo} className="axxa-linha">
                  <span className="axxa-linha-nome">{modelo}</span>
                  <span className="axxa-linha-sub">
                    {b.chats === 1 ? "1 chat" : `${b.chats} chats`} ·{" "}
                    {formatCompact(b.tokensIn + b.tokensOut)} tokens
                  </span>
                  <span className="axxa-linha-valor">
                    {b.cost > 0 ? formatUsd(b.cost) : "—"}
                    {b.hasUnknownCost && (
                      <span className="axxa-usage-approx">+</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Grupo>

        <Grupo titulo="Most expensive chats">
          {agg.chats.length === 0 ? (
            <p className="axxa-usage-vazio">Nothing in this slice.</p>
          ) : (
            <div className="axxa-linhas">
              {agg.chats.slice(0, 10).map((c) => (
                <div key={c.id} className="axxa-linha">
                  <span className="axxa-linha-nome">
                    {c.title || "Untitled"}
                  </span>
                  <span className="axxa-linha-sub">
                    {c.day} · {c.model}
                  </span>
                  <span className="axxa-linha-valor">
                    {c.cost == null ? "—" : formatUsd(c.cost)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Grupo>

        {/* O relatório é a saída desta tela: o que está aqui vira um .md no
            vault, com o mesmo recorte. */}
        <button
          type="button"
          className="axxa-fab is-wide"
          disabled={salvando}
          onClick={() => void salvarRelatorio()}
        >
          <Icon name={salvando ? "loader" : "file-down"} size={20} />
          <span>{salvando ? "Saving…" : "Save report (.md)"}</span>
        </button>
      </div>
    </div>
  );
}

function Grupo({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="axxa-home-block">
      <span className="axxa-section-label">{titulo}</span>
      {children}
    </section>
  );
}

/** Uma opção de filtro: nome, quantas conversas tem, e se está ligada. */
function Chip({
  label,
  logo,
  count,
  on,
  onClick,
}: {
  label: string;
  logo?: string;
  count?: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={on ? "axxa-filter-chip is-on" : "axxa-filter-chip"}
      aria-pressed={on}
      onClick={onClick}
    >
      {logo && <Icon name={logo} size={14} />}
      <span className="axxa-filter-nome">{label}</span>
      {count !== undefined && (
        <span className="axxa-filter-count">{count}</span>
      )}
    </button>
  );
}

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
