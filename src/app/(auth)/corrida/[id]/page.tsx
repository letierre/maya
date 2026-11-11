"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, Share2 } from "lucide-react";
import { getLocale } from "@/lib/language";
import { useTranslation } from "@/lib/useTranslation";
import { photoUrl } from "@/lib/photo-storage";
import { emitCareDataChanged } from "@/lib/care-events";
import type { Session } from "@/lib/running/types";
import { formatPace, formatDuration } from "@/lib/running/format";
import { computeSplits, sessionPRs } from "@/lib/running/geo";
import { StatBox, PaceChart } from "@/components/running/RunningUI";
import ShareEditor from "@/components/running/ShareEditor";

export default function CorridaDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [session, setSession] = useState<Session | null>(null);
  const [stats, setStats] = useState<{ best_distance_m: number; best_pace: number; longest_duration: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const s = await fetch(`/api/running?id=${id}`).then(r => r.json());
        if (alive) setSession(s || null);
      } catch { /* noop */ }
      try {
        const st = await fetch("/api/running/stats").then(r => r.json());
        if (alive && st && typeof st.total_runs === "number") setStats(st);
      } catch { /* noop */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  const deleteSession = async () => {
    if (!session) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/running?id=${session.id}`, { method: "DELETE" });
      if (res.ok) {
        emitCareDataChanged();
        toast.success(t("co_corrida_excluida"));
        router.push("/corrida");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("co_erro_excluir"));
      }
    } catch { toast.error(t("co_erro_excluir")); }
    setDeleting(false);
  };

  const splits = session ? computeSplits(session.route_coordinates || []) : [];
  const prs = session && stats ? sessionPRs(session, stats) : [];

  return (
    <div style={{ height: "100dvh", background: "#0B0B10", overflowY: "auto" }}>
      {/* Header fixo */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, padding: "calc(env(safe-area-inset-top) + 12px) 16px 12px", display: "flex", alignItems: "center", gap: 10, background: "rgba(11,11,16,0.92)", backdropFilter: "blur(8px)" }}>
        <button type="button" onClick={() => router.push("/corrida")} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(26,21,48,0.85)", border: "1px solid rgba(167,139,250,0.25)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA" }}>
          <ChevronLeft size={18} />
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e0d6ff" }}>
          {session?.activity_type === "walk" ? t("co_caminhada") : t("co_titulo")}
        </h1>
      </div>

      <div style={{ padding: "4px 16px 48px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#9e96b5", padding: 40 }}>…</p>
        ) : !session ? (
          <p style={{ textAlign: "center", color: "#9e96b5", padding: 40 }}>{t("co_nenhuma_corrida")}</p>
        ) : (
          <>
            {session.map_snapshot && (
              <div style={{ marginBottom: 16, borderRadius: 20, overflow: "hidden" }}>
                <img src={photoUrl(session.map_snapshot) || ""} alt={t("co_trajeto_alt")} style={{ width: "100%", display: "block", maxHeight: 240, objectFit: "cover" }} />
              </div>
            )}

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#e0d6ff" }}>{session.activity_type === "walk" ? t("co_caminhada") : t("co_titulo")}</h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9e96b5" }}>
                  {new Date(session.start_time).toLocaleDateString(getLocale(), { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>

            {prs.length > 0 && (
              <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 12, background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🏆</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#FACC15" }}>
                  {prs.map(p => t(p === "dist" ? "co_record_dist" : p === "pace" ? "co_record_pace" : "co_record_dur")).join(" · ")}
                </span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <StatBox label={t("co_distancia")} value={`${(session.distance_meters / 1000).toFixed(2)} km`} />
              <StatBox label={t("co_tempo")} value={formatDuration(session.duration_seconds)} />
              <StatBox label={t("co_ritmo_medio")} value={formatPace(session.avg_pace || 0)} />
              <StatBox label={t("co_velocidade_max")} value={session.max_speed ? `${session.max_speed.toFixed(1)} km/h` : "--"} />
              <StatBox label={t("co_elevacao")} value={session.elevation_gain_m ? `+${Math.round(session.elevation_gain_m)} m` : "--"} />
              <StatBox label={t("co_cadencia")} value={session.avg_cadence ? String(session.avg_cadence) : "--"} />
              <div style={{ gridColumn: "1 / -1" }}>
                <StatBox label={t("co_calorias")} value={session.calories_estimate ? `≈ ${session.calories_estimate} kcal` : "--"} />
              </div>
            </div>

            {splits.length >= 2 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#9e96b5", fontWeight: 600, marginBottom: 10 }}>{t("co_ritmo_por_km")}</div>
                <PaceChart splits={splits} />
              </div>
            )}

            <button type="button" onClick={() => setShareOpen(true)}
              style={{ width: "100%", padding: "14px", borderRadius: 14, border: 0, background: "#7C5CFF", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
              <Share2 size={16} />
              {t("co_compartilhar")}
            </button>

            {!confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)} disabled={deleting}
                style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1px solid rgba(255,77,77,0.4)", background: "rgba(255,77,77,0.1)", color: "#FF4D4D", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {t("co_excluir_corrida")}
              </button>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: "#e0d6ff", marginBottom: 10, textAlign: "center" }}>
                  {t("co_excluir_confirm")}
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#A78BFA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {t("cancelar")}
                  </button>
                  <button type="button" onClick={deleteSession} disabled={deleting}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, border: 0, background: "#FF4D4D", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: deleting ? 0.5 : 1 }}>
                    {deleting ? t("co_excluindo") : t("co_excluir")}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {session && <ShareEditor session={session} open={shareOpen} onClose={() => setShareOpen(false)} />}
    </div>
  );
}
