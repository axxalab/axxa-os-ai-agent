// src/components/composer/CameraModal.tsx
// Câmera in-app (getUserMedia) — captura UMA foto e devolve dataUrl jpeg.
// UI fiel ao padrão iOS de câmera (refs: ChatGPT iOS 61, Claude iOS 23):
//   topo  → X (fechar) + flash/torch (se suportado)
//   palco → <video> ao vivo (espelha selfie); vira <img> após capturar
//   rodapé→ galeria · shutter grande · flip front/back
// Após o shutter, mostra preview com "Refazer" / "Usar foto".
//
// Robustez: se getUserMedia falhar (sem permissão / WebView sem câmera),
// cai num <input type=file capture=environment> que dispara a câmera NATIVA
// do sistema (sempre funciona no mobile, vira file dialog no desktop).

import { Notice } from "obsidian";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../_shared/Icon";
import { useFocusTrap } from "../_shared/useFocusTrap";
import { useT } from "../../i18n";

interface CameraModalProps {
  /** Recebe o dataUrl jpeg + mime quando o user confirma a foto. */
  onCapture: (dataUrl: string, mimeType: string) => void;
  onClose: () => void;
}

type Facing = "environment" | "user";

export function CameraModal({ onCapture, onClose }: CameraModalProps) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setReady(false);
    setTorchOn(false);
  };

  // (re)inicia o stream sempre que `facing` muda. Não reinicia após captura.
  useEffect(() => {
    if (captured) return;
    let cancelled = false;

    const start = async () => {
      stopStream();
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t.camera.unsupported);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        setError(null);
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          // v0.1.228: não engole erro de autoplay — ao menos loga (alguns
          // navegadores bloqueiam play() sem gesto). O preview ainda funciona.
          await v.play().catch((err) =>
            console.warn("[axxa] camera autoplay bloqueado:", err),
          );
        }
        const track = stream.getVideoTracks()[0];
        const caps =
          (track as unknown as { getCapabilities?: () => Record<string, unknown> })
            .getCapabilities?.() ?? {};
        setTorchSupported("torch" in caps);
        setReady(true);
      } catch (err) {
        console.error("[axxa] camera falhou:", err);
        setError(t.camera.denied);
      }
    };

    start();
    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, captured]);

  // Cleanup garantido no unmount (solta a câmera).
  useEffect(() => () => stopStream(), []);

  // Focus-trap + Escape + devolve foco ao fechar (a11y, padrão WAI-ARIA dialog).
  const overlayRef = useRef<HTMLDivElement>(null);
  useFocusTrap(overlayRef, { onEscape: onClose });

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: next }],
      } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      /* dispositivo sem torch controlável */
    }
  };

  const shoot = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      // Desespelha a selfie no arquivo final (preview já vinha espelhado).
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    setCaptured(canvas.toDataURL("image/jpeg", 0.92));
    stopStream();
    navigator.vibrate?.(30);
  };

  const usePhoto = () => {
    if (!captured) return;
    onCapture(captured, "image/jpeg");
    onClose();
  };

  // Fallback: câmera nativa do sistema via <input capture>.
  const openNativeCamera = () => nativeInputRef.current?.click();
  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onCapture(String(reader.result ?? ""), file.type || "image/jpeg");
      onClose();
    };
    // v0.1.228: falha de leitura não pode ser silenciosa — avisa e mantém o
    // modal utilizável (o user pode tentar de novo).
    reader.onerror = () => {
      new Notice(t.composer.attachImageFailed);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      ref={overlayRef}
      className="axxa-camera-overlay"
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label={t.camera.title}
    >
      <div className="axxa-camera-stage">
        {captured ? (
          <img
            src={captured}
            alt={t.camera.previewAlt}
            className="axxa-camera-shot"
          />
        ) : (
          <video
            ref={videoRef}
            className="axxa-camera-video"
            playsInline
            muted
            autoPlay
            style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
          />
        )}

        {error && !captured && (
          <div className="axxa-camera-error">
            <Icon name="camera-off" />
            <p className="axxa-camera-error-text">{error}</p>
            <button
              type="button"
              className="axxa-camera-use"
              onClick={openNativeCamera}
            >
              {t.camera.useSystem}
            </button>
          </div>
        )}
      </div>

      {/* Top bar — X + flash */}
      <div className="axxa-camera-top">
        <button
          type="button"
          className="axxa-camera-ctl"
          onClick={onClose}
          aria-label={t.camera.close}
          title={t.camera.close}
        >
          <Icon name="x" />
        </button>
        {!captured && torchSupported && (
          <button
            type="button"
            className={
              "axxa-camera-ctl" + (torchOn ? " axxa-camera-ctl-on" : "")
            }
            onClick={toggleTorch}
            aria-label={t.camera.flash}
            title={t.camera.flash}
          >
            <Icon name={torchOn ? "zap" : "zap-off"} />
          </button>
        )}
      </div>

      {/* Bottom bar — captura OU confirmação */}
      <div className="axxa-camera-bottom">
        {captured ? (
          <>
            <button
              type="button"
              className="axxa-camera-text-btn"
              onClick={() => setCaptured(null)}
            >
              {t.camera.retake}
            </button>
            <button
              type="button"
              className="axxa-camera-use"
              onClick={usePhoto}
            >
              {t.camera.use}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="axxa-camera-side"
              onClick={openNativeCamera}
              aria-label={t.camera.useSystem}
              title={t.camera.useSystem}
            >
              <Icon name="image" />
            </button>
            <button
              type="button"
              className="axxa-camera-shutter"
              onClick={shoot}
              disabled={!ready}
              aria-label={t.camera.shutter}
              title={t.camera.shutter}
            />
            <button
              type="button"
              className="axxa-camera-side"
              onClick={() =>
                setFacing((f) => (f === "user" ? "environment" : "user"))
              }
              aria-label={t.camera.flip}
              title={t.camera.flip}
            >
              <Icon name="refresh-cw" />
            </button>
          </>
        )}
      </div>

      <input
        ref={nativeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleNativeChange}
      />
    </div>
  );
}
