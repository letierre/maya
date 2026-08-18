"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Heart, Plus } from "lucide-react";
import { compressImage, uploadToCloud, photoUrl } from "@/lib/photo-storage";

// ── Design tokens (mesma base de leitura/corrida) ──────────────
const BG_GRADIENT: React.CSSProperties = {
  background: `
    radial-gradient(ellipse 100% 55% at 80% 0%, oklch(.58 .18 270 / .15) 0%, transparent 55%),
    radial-gradient(ellipse 70% 40% at 0% 100%, oklch(.58 .18 270 / .1) 0%, transparent 50%),
    linear-gradient(180deg, oklch(.12 .012 270) 0%, oklch(.15 .015 270) 100%)
  `,
  fontFamily: "var(--font-sans)",
  color: "#e0d6ff",
  minHeight: "100dvh",
};

const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.15)";
const PURPLE_HEX = "#7C5CFF";
const FOREGROUND = "#e0d6ff";
const CARD_BG = "oklch(.17 .015 270 / .6)";

const MAX = 5;

interface Porque {
  id: string;
  text: string;
  photoPath: string | null;
}

export default function PorquesPage() {
  const [porques, setPorques] = useState<Porque[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingPorques, setSavingPorques] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.porques)) setPorques(data.porques);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Autosave (debounce) — mesmo comportamento do perfil
  useEffect(() => {
    if (!savingPorques) return;
    const timer = setTimeout(async () => {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ porques }),
      });
      setSavingPorques(false);
      toast.success("Porquê salvo!");
    }, 600);
    return () => clearTimeout(timer);
  }, [porques, savingPorques]);

  const updatePorque = (index: number, text: string) => {
    setPorques((prev) => prev.map((p, i) => (i === index ? { ...p, text } : p)));
    setSavingPorques(true);
  };

  const addPorque = () => {
    if (porques.length >= MAX) return;
    setPorques((prev) => [...prev, { id: crypto.randomUUID(), text: "", photoPath: null }]);
  };

  const removePorque = (index: number) => {
    setPorques((prev) => prev.filter((_, i) => i !== index));
    setSavingPorques(true);
  };

  const handlePhoto = async (index: number, file: File) => {
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const path = await uploadToCloud(compressed, "porques");
      setPorques((prev) => prev.map((p, i) => (i === index ? { ...p, photoPath: path } : p)));
      setSavingPorques(true);
    } catch {
      toast.error("Erro ao enviar foto");
    }
    setUploading(false);
  };

  return (
    <div style={{ ...BG_GRADIENT, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: "22px 20px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Heart size={24} color="#f472b6" fill="#f472b6" fillOpacity={0.25} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: FOREGROUND }}>
            Meus Porquês
          </h1>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.6, color: MUTED, maxWidth: 400 }}>
          Seus porquês são as razões que te movem — o que você quer proteger, quem quer se tornar.
          Volte aqui nos dias em que a motivação fraquejar.
        </p>
      </div>

      {/* Lista */}
      <div style={{ padding: "8px 20px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{ height: 96, borderRadius: 16, background: CARD_BG, border: `1px solid ${BORDER}` }} />
          ))
        ) : porques.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px" }}>
            <span style={{ fontSize: 48 }}>💗</span>
            <p style={{ color: FOREGROUND, fontSize: 15, fontWeight: 600, margin: "12px 0 4px" }}>
              Você ainda não escreveu seus porquês
            </p>
            <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.5, maxWidth: 300, margin: "0 auto 16px" }}>
              Comece pelo que mais importa pra você — uma pessoa, um sonho, uma promessa.
            </p>
          </div>
        ) : (
          porques.map((pq, i) => (
            <PorqueCard
              key={pq.id}
              pq={pq}
              index={i}
              uploading={uploading}
              onUpdate={updatePorque}
              onRemove={removePorque}
              onPhotoPick={handlePhoto}
            />
          ))
        )}

        {porques.length < MAX && (
          <button
            type="button"
            onClick={addPorque}
            style={{
              width: "100%", padding: "14px", borderRadius: 14, cursor: "pointer",
              background: "transparent", border: `1px dashed ${PURPLE_HEX}50`,
              color: "#A78BFA", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <Plus style={{ width: 15, height: 15 }} /> Adicionar porquê
          </button>
        )}
      </div>
    </div>
  );
}

// ── Card de um porquê ──────────────────────────────────────────

function PorqueCard({
  pq, index, uploading, onUpdate, onRemove, onPhotoPick,
}: {
  pq: Porque;
  index: number;
  uploading: boolean;
  onUpdate: (index: number, text: string) => void;
  onRemove: (index: number) => void;
  onPhotoPick: (index: number, file: File) => void;
}) {
  const photoSrc = pq.photoPath ? photoUrl(pq.photoPath) : null;
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{
      background: CARD_BG, borderRadius: 16,
      border: `1px solid ${BORDER}`,
      padding: 14, display: "flex", gap: 14, alignItems: "flex-start",
    }}>
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          width: 64, height: 64, borderRadius: 14, flexShrink: 0,
          background: "rgba(244,114,182,0.1)",
          border: "1px solid rgba(244,114,182,0.25)",
          overflow: "hidden", cursor: uploading ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {photoSrc ? (
          <img src={photoSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 24 }}>📷</span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.[0]) onPhotoPick(index, e.target.files[0]);
            e.target.value = "";
          }}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <textarea
          value={pq.text}
          onChange={(e) => onUpdate(index, e.target.value)}
          placeholder="Seu porquê..."
          rows={2}
          style={{
            width: "100%", boxSizing: "border-box", minHeight: 52, resize: "none",
            borderRadius: 12, border: `1px solid ${BORDER}`,
            background: "oklch(.20 .015 270 / .5)",
            padding: "10px 12px", fontFamily: "inherit",
            fontSize: 14, fontWeight: 500, color: FOREGROUND, outline: "none",
            lineHeight: 1.5,
          }}
        />
        <button
          type="button"
          onClick={() => onRemove(index)}
          style={{
            border: 0, background: "none", cursor: "pointer",
            fontSize: 12, color: "#FF5C5C", padding: "4px 0 0", fontWeight: 600,
          }}
        >
          Remover
        </button>
      </div>
    </div>
  );
}
