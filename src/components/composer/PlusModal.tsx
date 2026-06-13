// src/components/composer/PlusModal.tsx
// Bottom sheet estilo Claude chat (iOS/Android):
//   1. Drag handle
//   2. Row de 3 ícones circulares grandes: Nota / PDF / Imagem
//      — Imagem fica disabled se o modelo ativo não suporta vision
//   3. Effort selector (5 níveis pill)
//   4. Future: settings (max_tokens, system prompt override, etc)

import { useRef, useState } from "react";
import { FuzzySuggestModal, Menu, Notice, Platform, TFile } from "obsidian";
import { useFocusTrap } from "../_shared/useFocusTrap";
import type { App } from "obsidian";
import { Icon } from "../_shared/Icon";
import { CameraModal } from "./CameraModal";
import {
  EFFORT_LEVELS,
  EFFORT_LABELS,
  EFFORT_DESCRIPTIONS,
  type EffortLevel,
} from "../_shared/effort";
import { useT } from "../../i18n";
import { useApp } from "../_shared/AppContext";

export interface AttachPickResult {
  type: "note" | "pdf" | "image";
  /** Pra note: path vault. Pra pdf/image: filename ou similar. */
  name: string;
  /** Pra pdf/image: dataUrl base64. */
  dataUrl?: string;
  /** Pra pdf: mime type. */
  mimeType?: string;
  /** Pra note: conteúdo lido. */
  content?: string;
  /** Pra note: path no vault (referência absoluta). */
  path?: string;
}

interface PlusModalProps {
  currentEffort: string;
  onSelectEffort: (level: EffortLevel) => void;
  onClose: () => void;
  /** True se o modelo ativo aceita imagens. Habilita botão Imagem. */
  visionEnabled?: boolean;
  /** Callback quando user escolheu um anexo (nota, pdf ou imagem). */
  onAttachPicked?: (att: AttachPickResult) => void;
  /** Estado on/off das toggle actions (webSearch / createImage / etc). */
  toggles?: Record<string, boolean>;
  /** Callback quando user mexe num toggle. */
  onToggle?: (key: string, value: boolean) => void;
  /** True se o modelo ativo suporta image gen (habilita Create Image toggle). */
  imageGenEnabled?: boolean;
  /** True se há QUALQUER modelo de imagem conectado (habilita "Criar imagem"). */
  createImageAvailable?: boolean;
  /** Abre o modal de geração de imagem in-chat (fallback). v0.1.166 */
  onCreateImage?: () => void;
  /** Estilo de resposta atual (normal/concise/...). Ref: Claude "Choose style". */
  responseStyle?: string;
  /** Callback quando user troca o estilo de resposta. */
  onSelectStyle?: (id: string) => void;
  /** Abre a galeria de Apps/Skills (ref: ChatGPT "Explore apps"). */
  onExploreSkills?: () => void;
}

export function PlusModal({
  currentEffort,
  onSelectEffort,
  onClose,
  visionEnabled = false,
  onAttachPicked,
  toggles = {},
  onToggle,
  // imageGenEnabled: recebida do pai mas o gate real de "Criar imagem" é
  // createImageAvailable (há modelo de imagem conectado). Não consumida aqui. v0.1.228
  createImageAvailable = false,
  onCreateImage,
  responseStyle = "normal",
  onSelectStyle,
  onExploreSkills,
}: PlusModalProps) {
  const t = useT();
  const app = useApp();

  // Estilo de resposta (ref: Claude iOS 23 "Choose style ›") — menu nativo.
  const STYLE_IDS = ["normal", "concise", "explanatory", "formal", "friendly"];
  const styleLabel = (id: string): string => {
    const map: Record<string, string> = {
      normal: t.responseStyle.normal,
      concise: t.responseStyle.concise,
      explanatory: t.responseStyle.explanatory,
      formal: t.responseStyle.formal,
      friendly: t.responseStyle.friendly,
    };
    return map[id] ?? id;
  };
  const openStyleMenu = (e: React.MouseEvent) => {
    if (!onSelectStyle) return;
    e.preventDefault();
    e.stopPropagation();
    const menu = new Menu();
    STYLE_IDS.forEach((id) =>
      menu.addItem((i) =>
        i
          .setTitle(styleLabel(id))
          .setChecked(id === responseStyle)
          .onClick(() => onSelectStyle(id))
      )
    );
    menu.showAtMouseEvent(e.nativeEvent);
  };
  // Inputs hidden — disparados pelos botões da row
  const [imageInput, setImageInput] = useState<HTMLInputElement | null>(null);
  const [pdfInput, setPdfInput] = useState<HTMLInputElement | null>(null);
  // No mobile, a câmera NATIVA do sistema (<input capture>) é mais confiável que
  // o getUserMedia num WebView — e é a mesma câmera dos prints iOS. v0.1.196
  const [cameraInput, setCameraInput] = useState<HTMLInputElement | null>(null);
  // Câmera in-app (getUserMedia) — overlay full-screen sobre o sheet (desktop).
  const [cameraOpen, setCameraOpen] = useState(false);

  // Focus-trap + Escape + devolve foco ao fechar (a11y, padrão WAI-ARIA dialog).
  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusTrap(sheetRef, { onEscape: onClose });

  // Helper: blob → dataUrl via FileReader
  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("FileReader"));
      reader.readAsDataURL(blob);
    });

  // ===== Anexar nota (vault) =====
  const handlePickNote = async () => {
    // Picker fuzzy nativo (quick-switcher style) — openVaultNotePicker já trata
    // o caso de vault vazio (Notice + null). v0.1.228
    try {
      const path = await openVaultNotePicker(app, t);
      if (!path) return;
      // Resolve o TFile pra usar cachedRead (path vault-relative correto,
      // robusto a subpastas/config). v0.1.228
      const file = app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) {
        new Notice(t.plus.pickNoteFailed("not found"));
        return;
      }
      const content = await app.vault.cachedRead(file);
      onAttachPicked?.({
        type: "note",
        name: file.name,
        path: file.path,
        content,
      });
      onClose();
    } catch (err) {
      console.error("[axxa] pick note falhou:", err);
      new Notice(
        t.plus.pickNoteFailed(err instanceof Error ? err.message : "erro")
      );
    }
  };

  // ===== Anexar PDF =====
  const handlePickPdf = () => {
    pdfInput?.click();
  };

  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      new Notice(t.plus.pickPdfWrongType);
      return;
    }
    try {
      const dataUrl = await blobToDataUrl(file);
      onAttachPicked?.({
        type: "pdf",
        name: file.name,
        dataUrl,
        mimeType: file.type || "application/pdf",
      });
      onClose();
    } catch (err) {
      console.error("[axxa] pick pdf falhou:", err);
      new Notice(t.plus.pickPdfFailed);
    }
  };

  // ===== Anexar imagem =====
  const handlePickImage = () => {
    if (!visionEnabled) {
      new Notice(t.composer.attachImageNoVision);
      return;
    }
    imageInput?.click();
  };

  // ===== Câmera (tira foto → vira anexo de imagem) =====
  const handleOpenCamera = () => {
    if (!visionEnabled) {
      new Notice(t.composer.attachImageNoVision);
      return;
    }
    // Mobile → câmera nativa do sistema (confiável no WebView).
    // Desktop → preview ao vivo via getUserMedia (webcam).
    if (Platform.isMobile) {
      cameraInput?.click();
    } else {
      setCameraOpen(true);
    }
  };

  const handleCameraInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const dataUrl = await blobToDataUrl(file);
      handleCameraCapture(dataUrl, file.type || "image/jpeg");
    } catch (err) {
      console.error("[axxa] foto da câmera falhou:", err);
      new Notice(t.composer.attachImageFailed);
    }
  };

  const handleCameraCapture = (dataUrl: string, mimeType: string) => {
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", " ")
      .slice(0, 16);
    onAttachPicked?.({
      type: "image",
      name: t.camera.fileName(stamp),
      dataUrl,
      mimeType,
    });
    onClose();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    // Conta anexos OK — só fecha se algo entrou; senão avisa. v0.1.228
    let attached = 0;
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const dataUrl = await blobToDataUrl(file);
        onAttachPicked?.({
          type: "image",
          name: file.name,
          dataUrl,
          mimeType: file.type,
        });
        attached++;
      } catch (err) {
        console.error("[axxa] pick image falhou:", err);
        new Notice(t.composer.attachImageFailed);
      }
    }
    if (attached === 0) {
      if (files.length > 0) new Notice(t.composer.attachImageNoneValid);
      return;
    }
    onClose();
  };

  return (
    <div className="axxa-plus-overlay" onClick={onClose}>
      <div
        ref={sheetRef}
        className="axxa-plus-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={t.plus.dialogLabel}
      >
        <div className="axxa-plus-handle" />
        <div className="axxa-plus-title">{t.plus.addToChat}</div>

        {/* Tiles grandes monocromáticos — estrutura "Add to Chat" (Claude iOS 23) */}
        <div className="axxa-plus-tiles">
          <PlusTile
            icon="camera"
            label={t.plus.attachCamera}
            onClick={handleOpenCamera}
            disabled={!visionEnabled}
            disabledTitle={t.composer.attachImageNoVision}
          />
          <PlusTile
            icon="image"
            label={t.plus.attachPhotos}
            onClick={handlePickImage}
            disabled={!visionEnabled}
            disabledTitle={t.composer.attachImageNoVision}
          />
          <PlusTile
            icon="file-up"
            label={t.plus.attachFiles}
            onClick={handlePickPdf}
          />
        </div>

        {/* Hidden inputs disparados pelos botões */}
        <input
          ref={setImageInput}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleImageChange}
        />
        <input
          ref={setPdfInput}
          type="file"
          accept="application/pdf,.pdf"
          style={{ display: "none" }}
          onChange={handlePdfChange}
        />
        {/* Câmera nativa (mobile): dispara a câmera do sistema. */}
        <input
          ref={setCameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={handleCameraInputChange}
        />

        <div className="axxa-plus-divider" />

        {/* Action rows estilo Claude chat — cada feature numa linha
            com ícone à esquerda, label/desc no meio, toggle/chevron à direita */}
        <div className="axxa-plus-rows">
          <PlusActionRow
            icon="file-text"
            tone="green"
            label={t.plus.attachNote}
            desc={t.plus.attachNoteDesc}
            onClick={handlePickNote}
          />
          <PlusToggleRow
            icon="globe"
            tone="blue"
            label={t.plus.webSearchTitle}
            desc={t.plus.webSearchDesc}
            checked={Boolean(toggles.webSearch)}
            onChange={(v) => onToggle?.("webSearch", v)}
          />
          <PlusActionRow
            icon="image-plus"
            tone="pink"
            label={t.imageGen.menuLabel}
            desc={t.imageGen.menuDesc}
            disabled={!createImageAvailable}
            onClick={() => {
              onCreateImage?.();
              onClose();
            }}
          />
          {onExploreSkills && (
            <PlusActionRow
              icon="layout-grid"
              tone="purple"
              label={t.skills.title}
              desc={t.skills.subtitle}
              onClick={() => {
                onExploreSkills();
                onClose();
              }}
            />
          )}
          <PlusToggleRow
            icon="brain"
            tone="orange"
            label={t.plus.extendedThinkingTitle}
            desc={t.plus.extendedThinkingDesc}
            checked={Boolean(toggles.extendedThinking)}
            onChange={(v) => onToggle?.("extendedThinking", v)}
          />
          {onSelectStyle && (
            <div
              className="axxa-plus-row axxa-plus-row-tone-purple"
              role="button"
              tabIndex={0}
              onClick={openStyleMenu}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).click();
                }
              }}
            >
              <span className="axxa-plus-row-icon">
                <Icon name="feather" />
              </span>
              <span className="axxa-plus-row-text">
                <span className="axxa-plus-row-label">
                  {t.responseStyle.menuLabel}
                </span>
                <span className="axxa-plus-row-desc">
                  {t.plus.styleDesc}
                </span>
              </span>
              <span className="axxa-plus-row-value">
                {styleLabel(responseStyle)}
              </span>
              <span className="axxa-plus-row-chevron">
                <Icon name="chevron-right" />
              </span>
            </div>
          )}
        </div>

        <div className="axxa-plus-divider" />

        {/* Effort — single line horizontal (sem grid 2 colunas) */}
        <div className="axxa-plus-effort-section">
          <div className="axxa-plus-effort-head">
            <span className="axxa-plus-effort-label">{t.plus.effortTitle}</span>
            <span className="axxa-plus-effort-sub">{t.plus.effortSub}</span>
          </div>
          <div className="axxa-plus-effort-row">
            {EFFORT_LEVELS.map((level) => {
              const active = level === currentEffort;
              return (
                <button
                  key={level}
                  type="button"
                  className={
                    "axxa-plus-effort-pill" +
                    (active ? " axxa-plus-effort-pill-active" : "")
                  }
                  onClick={() => {
                    onSelectEffort(level);
                    onClose();
                  }}
                  title={EFFORT_DESCRIPTIONS[level]}
                >
                  {EFFORT_LABELS[level]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {cameraOpen && (
        <CameraModal
          onCapture={handleCameraCapture}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Action row no PlusModal — linha horizontal com ícone tonal + texto à esquerda
 * e toggle switch à direita. Estilo iOS Settings list.
 */
function PlusToggleRow({
  icon,
  tone,
  label,
  desc,
  checked,
  onChange,
  disabled = false,
}: {
  icon: string;
  tone: "blue" | "pink" | "orange" | "green" | "purple" | "red";
  label: string;
  desc: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={
        "axxa-plus-row axxa-plus-row-tone-" + tone +
        (disabled ? " axxa-plus-row-disabled" : "")
      }
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <span className="axxa-plus-row-icon">
        <Icon name={icon} />
      </span>
      <span className="axxa-plus-row-text">
        <span className="axxa-plus-row-label">{label}</span>
        <span className="axxa-plus-row-desc">{desc}</span>
      </span>
      <span
        className={
          "axxa-plus-row-switch" +
          (checked ? " axxa-plus-row-switch-on" : "")
        }
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        role="switch"
      >
        <span className="axxa-plus-row-switch-thumb" />
      </span>
    </div>
  );
}

/**
 * Action row no PlusModal — igual ao ToggleRow mas DISPARA uma ação (chevron à
 * direita em vez de switch). Usado por "Criar imagem". v0.1.166
 */
function PlusActionRow({
  icon,
  tone,
  label,
  desc,
  onClick,
  disabled = false,
}: {
  icon: string;
  tone: "blue" | "pink" | "orange" | "green" | "purple" | "red";
  label: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={
        "axxa-plus-row axxa-plus-row-tone-" + tone +
        (disabled ? " axxa-plus-row-disabled" : "")
      }
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onClick()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span className="axxa-plus-row-icon">
        <Icon name={icon} />
      </span>
      <span className="axxa-plus-row-text">
        <span className="axxa-plus-row-label">{label}</span>
        <span className="axxa-plus-row-desc">{desc}</span>
      </span>
      <span className="axxa-plus-row-chevron">
        <Icon name="chevron-right" />
      </span>
    </div>
  );
}

/**
 * Tile grande monocromático do topo — ícone centralizado + label embaixo,
 * fundo neutro arredondado. Estrutura "Add to Chat" (Câmera/Fotos/Arquivo).
 */
function PlusTile({
  icon,
  label,
  onClick,
  disabled = false,
  disabledTitle,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  return (
    <button
      type="button"
      className={
        "axxa-plus-tile" + (disabled ? " axxa-plus-tile-disabled" : "")
      }
      onClick={onClick}
      disabled={disabled}
      title={disabled && disabledTitle ? disabledTitle : label}
    >
      <span className="axxa-plus-tile-icon">
        <Icon name={icon} />
      </span>
      <span className="axxa-plus-tile-label">{label}</span>
    </button>
  );
}

/**
 * Picker fuzzy de notas via FuzzySuggestModal do Obsidian.
 * UX igual ao Quick Switcher — type-ahead na lista, Enter pra escolher.
 */
class VaultNotePickerModal extends FuzzySuggestModal<TFile> {
  private files: TFile[];
  private resolver: (path: string | null) => void;
  private resolved = false;

  constructor(app: App, resolver: (path: string | null) => void) {
    super(app);
    this.files = app.vault.getMarkdownFiles();
    this.resolver = resolver;
    this.setPlaceholder("Buscar nota pra anexar...");
  }

  getItems(): TFile[] {
    return this.files;
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile): void {
    this.resolved = true;
    this.resolver(item.path);
  }

  onClose(): void {
    // Se fechou sem escolher (Escape, clique fora), resolve com null
    if (!this.resolved) this.resolver(null);
    super.onClose();
  }
}

export async function openVaultNotePicker(
  app: App,
  t: ReturnType<typeof useT>
): Promise<string | null> {
  return new Promise((resolve) => {
    const files = app.vault.getMarkdownFiles();
    if (files.length === 0) {
      new Notice(t.plus.pickNoteEmpty);
      resolve(null);
      return;
    }
    const modal = new VaultNotePickerModal(app, resolve);
    modal.open();
  });
}
