// src/components/chat/ModelPicker.tsx
// Seletor de modelo REDESENHADO (v0.1.222) — substitui o dropdown do
// ModelInfoCard (UX ruim). Inspirado no filtro dos recentes da gaveta:
//   • Card do modelo selecionado (logo + nome + categoria + tier + pills)
//   • TABS por categoria (SegmentedRow labeled, igual à gaveta) — só as
//     categorias que o provider TEM (+ aba "favoritos" se houver). Cada tab
//     mostra os modelos daquela categoria.
//   • Seta de EXPAND → modal com TODOS os modelos por categoria, onde dá pra
//     selecionar E favoritar (ícone de salvar estilo Insta).

import { useEffect, useMemo, useState } from "react";
import { Icon } from "../_shared/Icon";
import { SegmentedRow } from "../_shared/SegmentedRow";
import { hapticTick } from "../_shared/haptics";
import { useT } from "../../i18n";
import type AxxaPlugin from "../../main";
import { ModelVendorLogo, categoryIcon, cardPills, Pills } from "./StarterScreen";
import {
  getModelFullInfo,
  localizedDescription,
  groupModelsByCategory,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from "../../providers/modelDescriptions";
import { ModelArena } from "./ModelArena";

const FAV = "__fav__";

/** Uma linha de modelo: selecionar (esquerda) + favoritar (direita). */
function ModelRow({
  provider,
  m,
  active,
  fav,
  desc,
  onPick,
  onToggleFav,
  t,
}: {
  provider: string;
  m: string;
  active: boolean;
  fav: boolean;
  desc?: string;
  onPick: (m: string) => void;
  onToggleFav: (m: string) => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className={"axxa-mpick-opt" + (active ? " is-active" : "")}>
      <button
        type="button"
        role="option"
        aria-selected={active}
        className="axxa-mpick-opt-main"
        onClick={() => onPick(m)}
      >
        <span className="axxa-mpick-opt-logo">
          <ModelVendorLogo provider={provider} model={m} />
        </span>
        <span className="axxa-mpick-opt-text">
          <span className="axxa-mpick-opt-name">{m}</span>
          {desc && <span className="axxa-mpick-opt-desc">{desc}</span>}
        </span>
        {active && (
          <span className="axxa-mpick-opt-check">
            <Icon name="check" />
          </span>
        )}
      </button>
      <button
        type="button"
        className={"axxa-mpick-fav" + (fav ? " is-fav" : "")}
        aria-label={fav ? t.modelPicker.unfav : t.modelPicker.fav}
        title={fav ? t.modelPicker.unfav : t.modelPicker.fav}
        onClick={() => onToggleFav(m)}
      >
        <Icon name={fav ? "bookmark-check" : "bookmark"} />
      </button>
    </div>
  );
}


export function ModelPicker({
  provider,
  model,
  modelOptions,
  onModelChange,
  onArenaConfirm,
  plugin,
}: {
  provider: string;
  model: string;
  modelOptions: string[];
  onModelChange: (model: string) => void;
  /** Arena confirma provider + modelo (navega entre providers). */
  onArenaConfirm: (provider: string, model: string) => void;
  plugin: AxxaPlugin;
}) {
  const t = useT();
  const lang = plugin.settings.language;
  const [modalOpen, setModalOpen] = useState(false);
  const [, bump] = useState(0); // re-render ao favoritar

  // Garante o modelo atual na lista, mesmo se não estiver no activeModels.
  const opts = modelOptions.includes(model) ? modelOptions : [model, ...modelOptions];
  const optsKey = opts.join(",");

  const groups = useMemo(
    () => groupModelsByCategory(provider, opts) as Map<string, string[]>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [provider, optsKey]
  );
  const cats: string[] = CATEGORY_ORDER.filter((c) => groups.has(c));

  const favModels = opts.filter((m) => plugin.isFavoriteModel(provider, m));
  const hasFav = favModels.length > 0;

  const info = getModelFullInfo(provider, model);
  const curCat = info.card.category;
  const [tab, setTab] = useState<string>(curCat);
  // Reseta a aba pra categoria do modelo atual ao trocar de PROVIDER.
  useEffect(() => {
    setTab(curCat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // Aba efetiva — blinda contra aba inexistente (provider mudou / fav sumiu).
  const activeTab =
    tab === FAV
      ? hasFav
        ? FAV
        : cats.includes(curCat)
          ? curCat
          : cats[0]
      : cats.includes(tab)
        ? tab
        : cats.includes(curCat)
          ? curCat
          : cats[0];

  const tabItems = [
    ...(hasFav
      ? [{ id: FAV, icon: "bookmark", label: t.modelPicker.favorites }]
      : []),
    ...cats.map((c) => ({
      id: c,
      icon: categoryIcon(c),
      label: CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS],
    })),
  ];
  const tabModels = activeTab === FAV ? favModels : groups.get(activeTab) ?? [];

  const tier = info.enriched?.tier ?? info.pricing.tier ?? "unknown";
  const tierText = tier === "free" ? "FREE" : tier === "paid" ? "PAID" : "?";
  const desc = localizedDescription(info, model, lang);

  const pick = (m: string) => {
    hapticTick();
    onModelChange(m);
  };
  const toggleFav = (m: string) => {
    hapticTick();
    void plugin.toggleFavoriteModel(provider, m).then(() => bump((n) => n + 1));
  };

  return (
    <div className="axxa-mpick">
      {/* Modelo selecionado + expand */}
      <div className="axxa-mpick-card">
        <span className="axxa-model-card-avatar">
          <ModelVendorLogo provider={provider} model={model} />
        </span>
        <span className="axxa-model-card-id">
          <span className="axxa-model-card-name">{model}</span>
          <span className="axxa-model-card-cat">
            <Icon name={categoryIcon(curCat)} />
            {CATEGORY_LABELS[curCat]}
          </span>
        </span>
        <span className={"axxa-model-tier axxa-model-tier-" + tier}>
          {tierText}
        </span>
        <button
          type="button"
          className="axxa-mpick-expand"
          aria-label={t.modelPicker.expand}
          title={t.modelPicker.expand}
          onClick={() => {
            hapticTick();
            setModalOpen(true);
          }}
        >
          <Icon name="maximize-2" />
        </button>
      </div>
      {desc && <p className="axxa-mc-desc">{desc}</p>}
      <Pills ids={cardPills(info)} />

      {/* Tabs por categoria (igual aos recentes da gaveta) */}
      <div className="axxa-mpick-tabs">
        <SegmentedRow
          items={tabItems}
          activeId={activeTab}
          showActiveLabel
          onSelect={(id) => {
            hapticTick();
            setTab(id);
          }}
        />
      </div>

      {/* Modelos da aba selecionada */}
      <div className="axxa-mpick-list" role="listbox">
        {tabModels.length === 0 ? (
          <p className="axxa-mpick-empty">{t.modelPicker.empty}</p>
        ) : (
          tabModels.map((m) => (
            <ModelRow
              key={m}
              provider={provider}
              m={m}
              active={m === model}
              fav={plugin.isFavoriteModel(provider, m)}
              onPick={pick}
              onToggleFav={toggleFav}
              t={t}
            />
          ))
        )}
      </div>

      {modalOpen && (
        <ModelArena
          provider={provider}
          model={model}
          plugin={plugin}
          onConfirm={(p, m) => {
            onArenaConfirm(p, m);
            setModalOpen(false);
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
