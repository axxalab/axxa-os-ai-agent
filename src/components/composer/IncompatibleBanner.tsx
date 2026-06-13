// src/components/composer/IncompatibleBanner.tsx
// Banner sutil acima do composer mostrando que o combo modo+model
// não vai funcionar — e oferece 1 click pra trocar pro modelo sugerido.
//
// Estilo: linha horizontal slim, ícone tonal + mensagem + chip "Trocar".
// Click no chip dispara onSwapModel(suggestion). Click no X dismiss.

import { Icon } from "../_shared/Icon";
import { useT } from "../../i18n";
import {
  bannerStyleFor,
  type CompatibilityResult,
} from "../../providers/compatibility";

interface IncompatibleBannerProps {
  result: CompatibilityResult;
  /** Callback pra trocar pro modelo sugerido (top 1). */
  onSwapModel?: (model: string) => void;
  /** Callback pra fechar o banner sem ação. */
  onDismiss?: () => void;
}

export function IncompatibleBanner({
  result,
  onSwapModel,
  onDismiss,
}: IncompatibleBannerProps) {
  // v0.1.228: labels via i18n (antes eram PT-BR hardcoded) — respeita o idioma nativo do Obsidian.
  const t = useT();
  if (result.ok || !result.message) return null;
  const { icon, color } = bannerStyleFor(result.reason);
  const primary = result.suggestions?.[0];

  return (
    <div
      className={`axxa-incompat-banner axxa-incompat-${result.reason ?? "info"}`}
      role="status"
      aria-live="polite"
    >
      <span className="axxa-incompat-icon" style={{ color }}>
        <Icon name={icon} />
      </span>
      <span className="axxa-incompat-text">{result.message}</span>
      {primary && onSwapModel && (
        <button
          type="button"
          className="axxa-incompat-action"
          onClick={() => onSwapModel(primary)}
          title={t.composer.compatSwapTo(primary)}
        >
          <Icon name="arrow-right" />
          <span className="axxa-incompat-action-label">{shortenModel(primary)}</span>
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          className="axxa-incompat-close"
          onClick={onDismiss}
          aria-label={t.composer.compatDismiss}
          title={t.composer.compatDismiss}
        >
          <Icon name="x" />
        </button>
      )}
    </div>
  );
}

/** Encurta nome longo de modelo (mantém a parte distintiva) */
function shortenModel(name: string): string {
  if (name.length <= 28) return name;
  // Mantém prefixo + sufixo, corta no meio
  return name.slice(0, 12) + "…" + name.slice(-12);
}
