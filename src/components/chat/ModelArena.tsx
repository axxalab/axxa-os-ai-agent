// src/components/chat/ModelArena.tsx
// Seletor de modelo "Mortal Kombat" (v0.1.223) — o modal que abre do card.
//   • STAGE com a ARENA de cada provider de fundo (gradiente temático).
//   • FIGHTER em destaque: retrato gigante do vendor + nome + ficha de STATUS
//     (Coding/Thinking/Tooling/Research/Speed/Vision) em barras de game.
//   • Ranking "HOT" por poder (benchmark) — chama de #rank + chama de fogo no
//     top 3. ◄ ► navegam pelo roster; favoritar (bookmark).
//   • ROSTER em grid de quadradinhos (um por modelo); o cursor marca o ativo.
//   • SCAN → busca o catálogo do provider e revela os modelos NOVOS (badge NEW).
//   • CHOOSE confirma a seleção.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Notice } from "obsidian";
import { Icon } from "../_shared/Icon";
import { hapticTick } from "../_shared/haptics";
import { useT } from "../../i18n";
import type AxxaPlugin from "../../main";
import { ModelVendorLogo, categoryIcon } from "./StarterScreen";
import {
  getModelFullInfo,
  localizedDescription,
  CATEGORY_LABELS,
} from "../../providers/modelDescriptions";
import { getModelStats, STAT_KEYS, STAT_META } from "../../providers/modelStats";
import { formatTokens } from "../_shared/contextWindows";
import { formatUsd } from "../../usage/pricing";

/** Nome de flavor da arena por provider (estilo "stage" de luta). */
const ARENA_NAME: Record<string, string> = {
  openai: "THE LAB",
  anthropic: "THE FOUNDRY",
  gemini: "THE NEBULA",
  openrouter: "THE CROSSROADS",
  nim: "THE GRID",
  ollama: "THE BASEMENT",
};

function StatBar({
  k,
  value,
}: {
  k: (typeof STAT_KEYS)[number];
  value: number;
}) {
  const meta = STAT_META[k];
  const lvl = value >= 85 ? "s" : value >= 70 ? "a" : value >= 50 ? "b" : "c";
  return (
    <div className="axxa-arena-stat" data-lvl={lvl}>
      <span className="axxa-arena-stat-k">
        <Icon name={meta.icon} />
        {meta.label}
      </span>
      <span className="axxa-arena-stat-track">
        <span className="axxa-arena-stat-fill" style={{ width: value + "%" }} />
      </span>
      <span className="axxa-arena-stat-v">{value}</span>
    </div>
  );
}

export function ModelArena({
  provider,
  model,
  modelOptions,
  onPick,
  onClose,
  plugin,
}: {
  provider: string;
  model: string;
  modelOptions: string[];
  onPick: (model: string) => void;
  onClose: () => void;
  plugin: AxxaPlugin;
}) {
  const t = useT();
  const lang = plugin.settings.language;
  const [cursor, setCursor] = useState(model);
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [, bump] = useState(0);

  // Roster = activeModels + descobertos (sem dup), RANQUEADO por poder (hot).
  const roster = useMemo(() => {
    const all = [...modelOptions];
    for (const m of discovered) if (!all.includes(m)) all.push(m);
    if (!all.includes(model)) all.unshift(model);
    return all
      .map((m) => ({
        m,
        power: getModelStats(provider, m, getModelFullInfo(provider, m)).power,
      }))
      .sort((a, b) => b.power - a.power)
      .map((x) => x.m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, modelOptions.join(","), discovered.join(","), model]);

  // Garante cursor válido.
  const cur = roster.includes(cursor) ? cursor : roster[0] ?? model;
  const curIdx = Math.max(0, roster.indexOf(cur));
  const rank = curIdx + 1;
  const isHot = rank <= 3 && roster.length > 3;

  const info = getModelFullInfo(provider, cur);
  const stats = getModelStats(provider, cur, info);
  const desc = localizedDescription(info, cur, lang);
  const tier = info.enriched?.tier ?? info.pricing.tier ?? "unknown";
  const ctx = info.enriched?.contextWindow ?? info.card.contextWindow;
  const inP = info.enriched?.inputPerMillion ?? info.pricing.inputPerMillion;
  const outP = info.enriched?.outputPerMillion ?? info.pricing.outputPerMillion;
  const fav = plugin.isFavoriteModel(provider, cur);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowLeft") move(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, cur]);

  const move = (dir: number) => {
    if (roster.length === 0) return;
    hapticTick();
    const next = (curIdx + dir + roster.length) % roster.length;
    setCursor(roster[next]);
  };

  const doScan = async () => {
    if (scanning) return;
    setScanning(true);
    hapticTick();
    try {
      const all = await plugin.scanModels(provider);
      const news = all.filter(
        (m) => !modelOptions.includes(m) && !discovered.includes(m)
      );
      if (news.length === 0) {
        new Notice(t.arena.scanNone);
      } else {
        setDiscovered((d) => [...d, ...news]);
        new Notice(t.arena.scanFound(news.length));
      }
    } catch {
      new Notice(t.arena.scanErr);
    } finally {
      setScanning(false);
    }
  };

  const choose = () => {
    hapticTick();
    onPick(cur);
    onClose();
  };
  const toggleFav = () => {
    hapticTick();
    void plugin.toggleFavoriteModel(provider, cur).then(() => bump((n) => n + 1));
  };

  return createPortal(
    <div
      className="axxa-arena-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="axxa-arena"
        data-provider={provider}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="axxa-arena-scan" aria-hidden="true" />

        {/* Topo: arena + SCAN + fechar */}
        <div className="axxa-arena-head">
          <span className="axxa-arena-stage-name">
            {ARENA_NAME[provider] ?? provider.toUpperCase()}
          </span>
          <span className="axxa-arena-head-right">
            <button
              type="button"
              className={"axxa-arena-scan-btn" + (scanning ? " is-scanning" : "")}
              onClick={doScan}
              disabled={scanning}
            >
              <Icon name={scanning ? "loader-2" : "radar"} />
              <span>{scanning ? t.arena.scanning : t.arena.scan}</span>
            </button>
            <button
              type="button"
              className="axxa-arena-close"
              onClick={onClose}
              aria-label={t.arena.close}
            >
              <Icon name="x" />
            </button>
          </span>
        </div>

        {/* Lutador em destaque */}
        <div className="axxa-arena-main">
          <button
            type="button"
            className="axxa-arena-nav axxa-arena-nav-prev"
            onClick={() => move(-1)}
            aria-label={t.arena.prev}
          >
            <Icon name="chevron-left" />
          </button>

          <div className="axxa-arena-fighter">
            <div className="axxa-arena-portrait">
              {isHot && (
                <span className="axxa-arena-hot">
                  <Icon name="flame" />
                </span>
              )}
              <span className="axxa-arena-rank">#{rank}</span>
              <span className="axxa-arena-logo">
                <ModelVendorLogo provider={provider} model={cur} />
              </span>
              <button
                type="button"
                className={"axxa-arena-fav" + (fav ? " is-fav" : "")}
                onClick={toggleFav}
                aria-label={fav ? t.modelPicker.unfav : t.modelPicker.fav}
                title={fav ? t.modelPicker.unfav : t.modelPicker.fav}
              >
                <Icon name={fav ? "bookmark-check" : "bookmark"} />
              </button>
            </div>

            <h3 className="axxa-arena-name">{cur}</h3>
            <div className="axxa-arena-meta">
              <span className="axxa-arena-cat">
                <Icon name={categoryIcon(info.card.category)} />
                {CATEGORY_LABELS[info.card.category]}
              </span>
              <span className={"axxa-model-tier axxa-model-tier-" + tier}>
                {tier === "free" ? "FREE" : tier === "paid" ? "PAID" : "?"}
              </span>
              <span className="axxa-arena-power">
                <Icon name="gauge" />
                {t.arena.power} {stats.power}
              </span>
            </div>

            {/* Ficha de status */}
            <div className="axxa-arena-stats">
              {STAT_KEYS.map((k) => (
                <StatBar key={k} k={k} value={stats[k]} />
              ))}
            </div>

            {/* Specs essenciais */}
            <div className="axxa-arena-specs">
              {ctx != null && (
                <span className="axxa-arena-spec">
                  <Icon name="layers" />
                  {formatTokens(ctx)} ctx
                </span>
              )}
              {inP != null && (
                <span className="axxa-arena-spec">
                  <Icon name="arrow-down-to-line" />
                  {formatUsd(inP)}/1M
                </span>
              )}
              {outP != null && (
                <span className="axxa-arena-spec">
                  <Icon name="arrow-up-from-line" />
                  {formatUsd(outP)}/1M
                </span>
              )}
            </div>

            {desc && <p className="axxa-arena-desc">{desc}</p>}
          </div>

          <button
            type="button"
            className="axxa-arena-nav axxa-arena-nav-next"
            onClick={() => move(1)}
            aria-label={t.arena.next}
          >
            <Icon name="chevron-right" />
          </button>
        </div>

        {/* Roster — grid de quadradinhos */}
        <div className="axxa-arena-roster">
          {roster.map((m, i) => {
            const isNew = discovered.includes(m);
            const active = m === cur;
            return (
              <button
                key={m}
                type="button"
                className={
                  "axxa-arena-cell" +
                  (active ? " is-active" : "") +
                  (isNew ? " is-new" : "")
                }
                title={m}
                aria-label={m}
                onClick={() => {
                  hapticTick();
                  setCursor(m);
                }}
              >
                <ModelVendorLogo provider={provider} model={m} />
                {i < 3 && roster.length > 3 && (
                  <span className="axxa-arena-cell-rank">{i + 1}</span>
                )}
                {isNew && <span className="axxa-arena-cell-new">NEW</span>}
              </button>
            );
          })}
        </div>

        {/* Confirmar */}
        <div className="axxa-arena-actions">
          <button type="button" className="axxa-arena-choose" onClick={choose}>
            <Icon name="swords" />
            {t.arena.choose}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
