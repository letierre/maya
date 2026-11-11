"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getLocale } from "@/lib/language";
import { useTranslation } from "@/lib/useTranslation";
import type { Session } from "@/lib/running/types";
import {
  SHARE_GROUP_W, SHARE_GROUP_H,
  loadImage, limitImage, renderSharePreview, exportSharePng,
  type ShareLayer, type ShareBlock,
} from "@/lib/running/share-canvas";

// Editor de compartilhamento: escolha da foto de fundo + posicionamento do
// bloco de dados (arrastar/redimensionar/girar/aproximar) + download do PNG.
export default function ShareEditor({ session, open, onClose }: { session: Session; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<"picker" | "editor">("picker");
  const [sharing, setSharing] = useState(false);
  const [shareScale, setShareScale] = useState(1);
  const [shareRotation, setShareRotation] = useState(0);
  const [shareRouteShift, setShareRouteShift] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const shareBlockRef = useRef<ShareBlock>({ x: 90, y: 350, scale: 1, rotation: 0, routeShiftY: 0 });
  const shareLayerRef = useRef<ShareLayer | null>(null);
  const sharePreviewRef = useRef<HTMLCanvasElement>(null);
  const shareDragRef = useRef<{ startLx: number; startLy: number; bx: number; by: number } | null>(null);

  // Ao abrir, volta para a escolha de foto e limpa o estado.
  useEffect(() => {
    if (open) {
      setStage("picker");
      setSharing(false);
      setShareScale(1); setShareRotation(0); setShareRouteShift(0);
      shareBlockRef.current = { x: 90, y: 350, scale: 1, rotation: 0, routeShiftY: 0 };
      shareLayerRef.current = null;
    }
  }, [open]);

  const renderPreview = () => {
    const canvas = sharePreviewRef.current;
    const layer = shareLayerRef.current;
    if (!canvas || !layer) return;
    renderSharePreview(canvas, session, layer, shareBlockRef.current, t, getLocale());
  };

  // Desenha o preview quando o editor monta (a camada já foi carregada antes).
  useEffect(() => {
    if (open && stage === "editor") renderPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stage]);

  const openEditor = async (bgUrl: string | null) => {
    setSharing(true);
    try {
      let bg: (HTMLImageElement | HTMLCanvasElement) | null = null;
      if (bgUrl) {
        try { bg = limitImage(await loadImage(bgUrl), 1080 * 2); } catch { bg = null; }
      }
      let avatar: HTMLImageElement | null = null;
      try { avatar = await loadImage("/maya-avatar.webp"); } catch { avatar = null; }
      shareLayerRef.current = { bg, avatar };
      shareBlockRef.current = { x: 90, y: 350, scale: 1, rotation: 0, routeShiftY: 0 };
      setShareScale(1); setShareRotation(0); setShareRouteShift(0);
      setStage("editor");
    } catch { toast.error(t("co_erro_salvar")); }
    setSharing(false);
  };

  const downloadShare = async () => {
    const layer = shareLayerRef.current;
    if (!layer) return;
    setSharing(true);
    try {
      const blob = await exportSharePng(session, layer, shareBlockRef.current, t, getLocale());
      if (!blob) { toast.error(t("co_erro_salvar")); return; }
      const file = new File([blob], "corrida.png", { type: "image/png" });
      let shared = false;
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: t("co_minha_corrida") }); shared = true; } catch { /* cai no download */ }
      }
      if (!shared) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "corrida.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        toast.success(t("co_imagem_baixada"));
      }
    } catch (err) {
      console.error("downloadShare error:", err);
      toast.error(t("co_erro_salvar"));
    }
    setSharing(false);
  };

  // Drag no preview: move o bloco de dados (coordenadas lógicas 1080×1920).
  const onPreviewPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const lx = ((e.clientX - rect.left) / rect.width) * 1080;
    const ly = ((e.clientY - rect.top) / rect.height) * 1920;
    const b = shareBlockRef.current;
    shareDragRef.current = { startLx: lx, startLy: ly, bx: b.x, by: b.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPreviewPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = shareDragRef.current;
    if (!d) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const lx = ((e.clientX - rect.left) / rect.width) * 1080;
    const ly = ((e.clientY - rect.top) / rect.height) * 1920;
    shareBlockRef.current = { ...shareBlockRef.current, x: d.bx + (lx - d.startLx), y: d.by + (ly - d.startLy) };
    renderPreview();
  };
  const onPreviewPointerUp = () => { shareDragRef.current = null; };

  // Slider de escala: redimensiona o bloco ancorado no centro.
  const onShareScale = (v: number) => {
    setShareScale(v);
    const b = shareBlockRef.current;
    const s = Math.min(2.5, Math.max(0.4, v));
    const cx = b.x + (SHARE_GROUP_W * b.scale) / 2;
    const cy = b.y + (SHARE_GROUP_H * b.scale) / 2;
    shareBlockRef.current = { ...shareBlockRef.current, scale: s, x: cx - (SHARE_GROUP_W * s) / 2, y: cy - (SHARE_GROUP_H * s) / 2 };
    renderPreview();
  };

  // Slider de rotação: gira o percurso em torno do centro (o card fica reto).
  const onShareRotation = (v: number) => {
    setShareRotation(v);
    shareBlockRef.current = { ...shareBlockRef.current, rotation: v };
    renderPreview();
  };

  // Slider de aproximação: aproxima/afasta o percurso do card (deslocamento vertical).
  const onShareRouteShift = (v: number) => {
    setShareRouteShift(v);
    shareBlockRef.current = { ...shareBlockRef.current, routeShiftY: v };
    renderPreview();
  };

  const onPhotoPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => openEditor(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  if (!open) return null;

  return (
    <>
      {stage === "picker" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
          <div style={{ background: "#1a1530", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 20, width: "100%", maxWidth: 340, padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#e0d6ff", textAlign: "center" }}>{t("co_share_foto_titulo")}</p>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9e96b5", textAlign: "center", lineHeight: 1.5 }}>{t("co_share_foto_hint")}</p>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              style={{ width: "100%", padding: "12px", borderRadius: 12, border: 0, background: "#7C5CFF", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
              📷 {t("co_share_foto_btn")}
            </button>
            <button type="button" onClick={() => openEditor(null)}
              style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#A78BFA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {t("co_share_sem_foto")}
            </button>
          </div>
        </div>
      )}

      {stage === "editor" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "#0B0B10", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "calc(env(safe-area-inset-top) + 12px) 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button type="button" onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(26,21,48,0.85)", border: "1px solid rgba(167,139,250,0.25)", color: "#A78BFA", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#e0d6ff" }}>{t("co_compartilhar")}</span>
            <span style={{ width: 36 }} />
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 12px" }}>
            <div style={{ height: "100%", maxWidth: "100%", aspectRatio: "9 / 16", position: "relative", borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
              <canvas
                ref={sharePreviewRef}
                onPointerDown={onPreviewPointerDown}
                onPointerMove={onPreviewPointerMove}
                onPointerUp={onPreviewPointerUp}
                onPointerCancel={onPreviewPointerUp}
                style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "grab" }}
              />
            </div>
          </div>
          <div style={{ padding: "calc(env(safe-area-inset-bottom) + 16px) 20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#9e96b5", textAlign: "center" }}>{t("co_share_editar")}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, color: "#9e96b5", fontWeight: 700 }}>−</span>
              <input type="range" min={0.4} max={2.5} step={0.05} value={shareScale} onChange={(e) => onShareScale(Number(e.target.value))} style={{ flex: 1, accentColor: "#7C5CFF" }} />
              <span style={{ fontSize: 12, color: "#9e96b5", fontWeight: 700 }}>+</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>⟲</span>
              <input type="range" min={-180} max={180} step={5} value={shareRotation} onChange={(e) => onShareRotation(Number(e.target.value))} style={{ flex: 1, accentColor: "#7C5CFF" }} />
              <span style={{ fontSize: 12, color: "#9e96b5", width: 38, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{shareRotation}°</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>↕</span>
              <input type="range" min={-300} max={300} step={5} value={shareRouteShift} onChange={(e) => onShareRouteShift(Number(e.target.value))} style={{ flex: 1, accentColor: "#7C5CFF" }} />
              <span style={{ fontSize: 12, color: "#9e96b5", width: 38, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{shareRouteShift > 0 ? `+${shareRouteShift}` : shareRouteShift}</span>
            </div>
            <button type="button" onClick={downloadShare} disabled={sharing}
              style={{ width: "100%", padding: "14px", borderRadius: 14, border: 0, background: "#7C5CFF", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: sharing ? 0.5 : 1 }}>
              {sharing ? t("co_preparando") : t("co_baixar")}
            </button>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={onPhotoPicked} style={{ display: "none" }} />
    </>
  );
}
