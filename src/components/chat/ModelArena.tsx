// src/components/chat/ModelArena.tsx
// Seletor "Mortal Kombat" de modelo (v0.1.223, turbinado v0.1.224).
//   • < PROVIDER > no topo: navega entre providers (a arena re-tematiza).
//   • FIGHTER com DUPLA ID: provider (host) no canto sup-esq + dono/vendor do
//     modelo no inf-dir; o brasão da FAMÍLIA (cor própria) no centro.
//   • Ficha de STATUS (6 barras) + ranking "HOT" por poder (benchmark).
//   • Troca de modelo = animação SAI/ENTRA (direção-aware).
//   • ROSTER em 3 tiers: Hall of Fame (favoritos) · Creators (ativos) ·
//     Soldiers (descobertos no SCAN). Células tingidas pela cor da família.
//   • SCAN busca o catálogo do provider e revela os NOVOS. CHOOSE confirma.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Notice } from "obsidian";
import { Icon } from "../_shared/Icon";
import { hapticTick } from "../_shared/haptics";
import { useT } from "../../i18n";
import type AxxaPlugin from "../../main";
import {
  ModelVendorLogo,
  categoryIcon,
  PROVIDERS,
  providerConfigured,
} from "./StarterScreen";
import {
  getModelFullInfo,
  localizedDescription,
  CATEGORY_LABELS,
} from "../../providers/modelDescriptions";
import { getModelStats, STAT_KEYS, STAT_META } from "../../providers/modelStats";
import { getModelFamily } from "../../providers/modelFamily";
import { formatTokens } from "../_shared/contextWindows";
import { formatUsd } from "../../usage/pricing";

const ARENA_NAME: Record<string, string> = {
  openai: "THE LAB",
  anthropic: "THE FOUNDRY",
  gemini: "THE NEBULA",
  openrouter: "THE CROSSROADS",
  nim: "THE GRID",
  ollama: "THE BASEMENT",
};

function providerLogoId(id: string): string {
  return PROVIDERS.find((p) => p.id === id)?.icon ?? "logo-openai";
}
function providerName(id: string): string {
  return PROVIDERS.find((p) => p.id === id)?.name ?? id;
}

function StatBar({ k, value }: { k: (typeof STAT_KEYS)[number]; value: number }) {
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

/** Uma célula do roster (quadradinho), tingida pela família. */
function RosterCell({
  prov,
  m,
  active,
  isNew,
  rank,
  onPick,
}: {
  prov: string;
  m: string;
  active: boolean;
  isNew: boolean;
  rank?: number;
  onPick: (m: string) => void;
}) {
  const fam = getModelFamily(m);
  return (
    <button
      type="button"
      className={"axxa-arena-cell" + (active ? " is-active" : "")}
      title={m}
      aria-label={m}
      style={{ ["--axxa-fam" as string]: fam.color }}
      onClick={() => {
        hapticTick();
        onPick(m);
      }}
    >
      <ModelVendorLogo provider={prov} model={m} />
      <span className="axxa-arena-cell-fam">
        <Icon name={fam.icon} />
      </span>
      {rank != null && <span className="axxa-arena-cell-rank">{rank}</span>}
      {isNew && <span className="axxa-arena-cell-new">NEW</span>}
    </button>
  );
}

export function ModelArena({
  provider,
  model,
  onConfirm,
  onClose,
  plugin,
}: {
  provider: string;
  model: string;
  onConfirm: (provider: string, model: string) => void;
  onClose: () => void;
  plugin: AxxaPlugin;
}) {
  const t = useT();
  const lang = plugin.settings.language;
  const [, bump] = useState(0);
  const [prov, setProv] = useState(provider);
  const [cursor, setCursor] = useState(model);
  const [navDir, setNavDir] = useState(0); // -1 / 0 / 1 (anim direção)
  const [discovered, setDiscovered] = useState<Record<string, string[]>>({});
  const [scanning, setScanning] = useState(false);

  // v0.1.228: ref vivo do provider atual — pro SCAN não notificar fora de contexto
  // (usuário pode ter trocado de provider enquanto o scan resolvia).
  const provRef = useRef(prov);
  provRef.current = prov;

  // v0.1.228: poder por (prov,model) memoizado por render — sortPower só lê do
  // Map, sem recomputar getModelFullInfo+getModelStats a cada comparação do sort.
  const powerCache = useRef(new Map<string, number>());
  const powerOf = (p: string, m: string) => {
    const cache = powerCache.current;
    const key = p + "::" + m;
    let v = cache.get(key);
    if (v == null) {
      v = getModelStats(p, m, getModelFullInfo(p, m)).power;
      cache.set(key, v);
    }
    return v;
  };
  const sortPower = (p: string, list: string[]) =>
    [...new Set(list)].sort((a, b) => powerOf(p, b) - powerOf(p, a));

  // Providers configurados (+ garante o atual) — pra navegação < >.
  const provList = useMemo(() => {
    const cfg = PROVIDERS.filter((p) => providerConfigured(plugin, p.id)).map(
      (p) => p.id
    );
    return cfg.includes(provider) ? cfg : [provider, ...cfg];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // ── Roster do provider atual, em 3 tiers.
  const active = plugin.settings.activeModels[prov] ?? [];
  const disc = discovered[prov] ?? [];
  const favKeys = plugin.settings.favoriteModels ?? [];

  // v0.1.228: roster inteiro (sets, filtros, sort por power) memoizado —
  // não recomputa a cada render, só quando prov/active/disc/favoritos mudam.
  const { hall, creators, soldiers, flat, powerSorted } = useMemo(() => {
    const favModels = favKeys
      .filter((k) => k.startsWith(prov + "::"))
      .map((k) => k.slice(prov.length + 2));
    const favSet = new Set(favModels);
    const activeSet = new Set(active);

    const hall = sortPower(prov, favModels);
    const creators = sortPower(
      prov,
      active.filter((m) => !favSet.has(m))
    );
    const soldiers = sortPower(
      prov,
      disc.filter((m) => !favSet.has(m) && !activeSet.has(m))
    );
    const flat = [...new Set([...hall, ...creators, ...soldiers])];
    if (flat.length === 0) flat.push(cursor);
    const powerSorted = sortPower(prov, flat);
    return { hall, creators, soldiers, flat, powerSorted };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prov, active, disc, favKeys, cursor]);

  const cur = flat.includes(cursor) ? cursor : flat[0];
  const rank = powerSorted.indexOf(cur) + 1;
  const isHot = rank <= 3 && flat.length > 3;

  const info = getModelFullInfo(prov, cur);
  const fam = getModelFamily(cur);
  const stats = getModelStats(prov, cur, info);
  const desc = localizedDescription(info, cur, lang);
  const tier = info.enriched?.tier ?? info.pricing.tier ?? "unknown";
  const ctx = info.enriched?.contextWindow ?? info.card.contextWindow;
  const inP = info.enriched?.inputPerMillion ?? info.pricing.inputPerMillion;
  const outP = info.enriched?.outputPerMillion ?? info.pricing.outputPerMillion;
  const fav = plugin.isFavoriteModel(prov, cur);

  // v0.1.228: ref vivo do handler de tecla — listener registrado UMA vez ([] deps),
  // sem re-registrar a cada render (handler sempre lê o estado atual via ref).
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  onKeyRef.current = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowRight") moveModel(1);
    else if (e.key === "ArrowLeft") moveModel(-1);
    else if (e.key === "ArrowUp") moveProvider(-1);
    else if (e.key === "ArrowDown") moveProvider(1);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onKeyRef.current(e);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const moveModel = (dir: number) => {
    if (flat.length < 2) return;
    hapticTick();
    setNavDir(dir);
    const i = flat.indexOf(cur);
    setCursor(flat[(i + dir + flat.length) % flat.length]);
  };
  const moveProvider = (dir: number) => {
    if (provList.length < 2) return;
    hapticTick();
    setNavDir(dir);
    const i = provList.indexOf(prov);
    const np = provList[(i + dir + provList.length) % provList.length];
    setProv(np);
    // v0.1.228: cursor do destino considera favoritos+ativos+descobertos
    // (mesma composição do roster), não só activeModels.
    const npFav = (plugin.settings.favoriteModels ?? [])
      .filter((k) => k.startsWith(np + "::"))
      .map((k) => k.slice(np.length + 2));
    const npActive = plugin.settings.activeModels[np] ?? [];
    const pool = sortPower(np, [...npFav, ...npActive, ...(discovered[np] ?? [])]);
    setCursor(pool[0] ?? cur);
  };

  const doScan = async () => {
    if (scanning) return;
    setScanning(true);
    hapticTick();
    const scanProv = prov; // v0.1.228: alvo capturado no início do scan
    try {
      const all = await plugin.scanModels(scanProv);
      const known = new Set([
        ...(plugin.settings.activeModels[scanProv] ?? []),
        ...(discovered[scanProv] ?? []),
      ]);
      const news = all.filter((m) => !known.has(m));
      // resultado sempre gravado no provider escaneado (correto), mas só
      // notifica/abre se o usuário ainda está nele.
      if (news.length > 0) {
        setDiscovered((d) => ({
          ...d,
          [scanProv]: [...(d[scanProv] ?? []), ...news],
        }));
      }
      if (provRef.current === scanProv) {
        new Notice(news.length === 0 ? t.arena.scanNone : t.arena.scanFound(news.length));
      }
    } catch (e) {
      console.error("[arena] scan failed", e); // v0.1.228: não engole o erro
      if (provRef.current === scanProv) new Notice(t.arena.scanErr);
    } finally {
      setScanning(false);
    }
  };

  const choose = () => {
    hapticTick();
    onConfirm(prov, cur);
    onClose();
  };
  const toggleFav = () => {
    hapticTick();
    void plugin.toggleFavoriteModel(prov, cur).then(() => bump((n) => n + 1));
  };

  const tiers: { key: string; label: string; icon: string; models: string[] }[] =
    [
      { key: "hall", label: t.arena.hall, icon: "trophy", models: hall },
      { key: "creators", label: t.arena.creators, icon: "star", models: creators },
      { key: "soldiers", label: t.arena.soldiers, icon: "shield", models: soldiers },
    ];

  return createPortal(
    <div
      className="axxa-arena-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="axxa-arena-name"
      onClick={onClose}
    >
      <div
        className="axxa-arena"
        data-provider={prov}
        style={{ ["--axxa-fam" as string]: fam.color }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="axxa-arena-scan" aria-hidden="true" />

        {/* Topo: < PROVIDER > + SCAN + fechar */}
        <div className="axxa-arena-head">
          <span className="axxa-arena-provnav">
            <button
              type="button"
              className="axxa-arena-provnav-btn"
              onClick={() => moveProvider(-1)}
              aria-label={t.arena.prevProvider}
              disabled={provList.length < 2}
            >
              <Icon name="chevron-left" />
            </button>
            <span className="axxa-arena-stage-name">
              {ARENA_NAME[prov] ?? prov.toUpperCase()}
            </span>
            <button
              type="button"
              className="axxa-arena-provnav-btn"
              onClick={() => moveProvider(1)}
              aria-label={t.arena.nextProvider}
              disabled={provList.length < 2}
            >
              <Icon name="chevron-right" />
            </button>
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

        {/* Lutador (re-monta na troca → animação sai/entra) */}
        <div className="axxa-arena-main">
          <button
            type="button"
            className="axxa-arena-nav axxa-arena-nav-prev"
            onClick={() => moveModel(-1)}
            aria-label={t.arena.prev}
          >
            <Icon name="chevron-left" />
          </button>

          <div
            key={prov + "|" + cur}
            className="axxa-arena-fighter"
            data-dir={navDir}
          >
            <div className="axxa-arena-portrait">
              {/* sup-esq = PROVIDER (host) */}
              <span className="axxa-arena-id-prov" title={providerName(prov)}>
                <Icon name={providerLogoId(prov)} />
              </span>
              {/* sup-dir = HOT (top 3) */}
              {isHot && (
                <span className="axxa-arena-hot">
                  <Icon name="flame" />
                </span>
              )}
              {/* inf-esq = rank de poder */}
              <span className="axxa-arena-rank">#{rank}</span>
              {/* Centro = brasão da FAMÍLIA (visual ID) */}
              <span className="axxa-arena-fam-emblem">
                <Icon name={fam.icon} />
              </span>
              {/* inf-dir = DONO/vendor do modelo */}
              <span className="axxa-arena-id-vendor" title={cur}>
                <ModelVendorLogo provider={prov} model={cur} />
              </span>
            </div>

            <h3 id="axxa-arena-name" className="axxa-arena-name">{cur}</h3>
            <div className="axxa-arena-meta">
              <span className="axxa-arena-fam-tag">
                <Icon name={fam.icon} />
                {fam.label}
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

            <div className="axxa-arena-stats">
              {STAT_KEYS.map((k) => (
                <StatBar key={k} k={k} value={stats[k]} />
              ))}
            </div>

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
            onClick={() => moveModel(1)}
            aria-label={t.arena.next}
          >
            <Icon name="chevron-right" />
          </button>
        </div>

        {/* Roster em 3 tiers */}
        <div className="axxa-arena-roster">
          {tiers
            .filter((tr) => tr.models.length > 0)
            .map((tr) => (
              <div key={tr.key} className="axxa-arena-tier" data-tier={tr.key}>
                <div className="axxa-arena-tier-label">
                  <Icon name={tr.icon} />
                  {tr.label}
                  <span className="axxa-arena-tier-n">{tr.models.length}</span>
                </div>
                <div className="axxa-arena-grid">
                  {tr.models.map((m) => {
                    const pr = powerSorted.indexOf(m) + 1;
                    return (
                      <RosterCell
                        key={m}
                        prov={prov}
                        m={m}
                        active={m === cur}
                        isNew={disc.includes(m)}
                        rank={pr <= 3 && flat.length > 3 ? pr : undefined}
                        onPick={(mm) => {
                          setNavDir(0);
                          setCursor(mm);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
        </div>

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
