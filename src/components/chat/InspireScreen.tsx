// src/components/chat/InspireScreen.tsx
// Galeria "Inspire-se" (ref: Claude iOS 57 "Get inspired") — overlay full com
// abas de categoria + cards de ideias. Tocar num card injeta o prompt no
// composer e fecha. Conteúdo curado vem do i18n (t.inspire.cards).

import { useMemo, useState } from "react";
import { Icon } from "../_shared/Icon";
import { useT } from "../../i18n";

interface InspireScreenProps {
  /** Recebe o prompt curado do card escolhido (vai pro composer). */
  onPick: (prompt: string) => void;
  onClose: () => void;
}

type Cat = "all" | "create" | "learn" | "play";

export function InspireScreen({ onPick, onClose }: InspireScreenProps) {
  const t = useT();
  const [cat, setCat] = useState<Cat>("all");

  const cats: { id: Cat; label: string }[] = [
    { id: "all", label: t.inspire.catAll },
    { id: "create", label: t.inspire.catCreate },
    { id: "learn", label: t.inspire.catLearn },
    { id: "play", label: t.inspire.catPlay },
  ];

  const cards = useMemo(
    () =>
      cat === "all"
        ? t.inspire.cards
        : t.inspire.cards.filter((c) => c.cat === cat),
    [cat, t.inspire.cards]
  );

  return (
    <div className="axxa-inspire" role="dialog" aria-label={t.inspire.title}>
      <div className="axxa-inspire-head">
        <button
          type="button"
          className="axxa-inspire-back"
          onClick={onClose}
          aria-label={t.inspire.close}
          title={t.inspire.close}
        >
          <Icon name="arrow-left" />
        </button>
        <div className="axxa-inspire-titles">
          <h2 className="axxa-inspire-title">{t.inspire.title}</h2>
          <p className="axxa-inspire-subtitle">{t.inspire.subtitle}</p>
        </div>
      </div>

      <div className="axxa-inspire-tabs" role="tablist">
        {cats.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={cat === c.id}
            className={
              "axxa-inspire-tab" + (cat === c.id ? " axxa-inspire-tab-active" : "")
            }
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="axxa-inspire-grid">
        {cards.map((c, i) => (
          <button
            key={i}
            type="button"
            className="axxa-inspire-card"
            onClick={() => onPick(c.prompt)}
          >
            <span className="axxa-inspire-card-icon">
              <Icon name={c.icon} />
            </span>
            <span className="axxa-inspire-card-title">{c.title}</span>
            <span className="axxa-inspire-card-desc">{c.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
