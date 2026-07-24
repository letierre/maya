"use client";

import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";

interface AvatarCropModalProps {
  image: string;
  onCrop: (croppedBlob: Blob) => void;
  onClose: () => void;
}

export function AvatarCropModal({ image, onCrop, onClose }: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCroppedImage = async () => {
    if (!croppedAreaPixels) return;
    const canvas = document.createElement("canvas");
    const img = new Image();
    img.src = image;
    await new Promise<void>((resolve) => { img.onload = () => resolve(); });

    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;
    const ctx = canvas.getContext("2d")!;

    ctx.drawImage(
      img,
      croppedAreaPixels.x * scaleX,
      croppedAreaPixels.y * scaleY,
      croppedAreaPixels.width * scaleX,
      croppedAreaPixels.height * scaleY,
      0, 0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );

    canvas.toBlob((blob) => {
      if (blob) onCrop(blob);
    }, "image/jpeg", 0.9);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "#0F0F14",
      display: "flex", flexDirection: "column",
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px",
        paddingTop: "env(safe-area-inset-top, 16px)",
        borderBottom: "1px solid rgba(167,139,250,0.15)",
      }}>
        <button type="button" onClick={onClose}
          style={{
            background: "none", border: 0, cursor: "pointer",
            fontSize: 14, color: "#9e96b5", fontFamily: "inherit", fontWeight: 500,
          }}>
          Cancelar
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#e0d6ff" }}>
          Ajustar foto
        </span>
        <button type="button" onClick={createCroppedImage}
          style={{
            background: "none", border: 0, cursor: "pointer",
            fontSize: 14, color: "#A78BFA", fontFamily: "inherit", fontWeight: 700,
          }}>
          OK
        </button>
      </div>

      {/* Crop area */}
      <div style={{ flex: 1, position: "relative" }}>
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
        />
      </div>

      {/* Zoom slider */}
      <div style={{
        padding: "20px 24px",
        paddingBottom: "calc(env(safe-area-inset-bottom, 16px) + 20px)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ fontSize: 16 }}>🔍</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: "#7C5CFF" }}
        />
        <span style={{ fontSize: 20 }}>🔍</span>
      </div>
    </div>
  );
}
