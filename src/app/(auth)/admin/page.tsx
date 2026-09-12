"use client";
import { getLocale } from "@/lib/language";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Shield, Users, FileText, Heart, MessageCircle, CalendarCheck, BookOpen, MapPin } from "lucide-react";

interface Report { id: string; post_id: string; reason: string | null; created_at: string; community_posts: { id: string; content: string; display_name: string; created_at: string } | null; }
interface Stats { users: number; active7d: number; posts: number; comments: number; checkins: number; diary: number; mapboxLoads: number; }

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [tab, setTab] = useState<"stats" | "reports">("stats");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin").then(r => {
      if (r.status === 403) { setError("Acesso negado. Apenas administradores."); setLoading(false); return; }
      return r.json();
    }).then(d => {
      if (d) setStats(d);
      setLoading(false);
    }).catch(() => { setError("Erro ao carregar"); setLoading(false); });
  }, []);

  const loadReports = async () => {
    setTab("reports");
    const res = await fetch("/api/admin?type=reports");
    if (res.ok) setReports(await res.json());
  };

  const deletePost = async (postId: string) => {
    await fetch(`/api/community/posts/${postId}`, { method: "DELETE" });
    setReports(prev => prev.filter(r => r.post_id !== postId));
    toast.success("Post excluído");
  };

  if (error) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0B0B10", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 20 }}>
        <Shield size={48} style={{ color: "#FF4D4D" }} />
        <p style={{ color: "#e0d6ff", fontSize: 16, fontWeight: 600 }}>{error}</p>
        <button type="button" onClick={() => router.push("/perfil")}
          style={{ padding: "10px 20px", borderRadius: 12, background: "#7C5CFF", border: 0, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0B0B10", paddingBottom: 100 }}>
      <div style={{ padding: "22px 20px 4px", display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={() => router.push("/perfil")}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "#1a1530", border: "1px solid rgba(167,139,250,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA" }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#e0d6ff", display: "flex", alignItems: "center", gap: 8 }}>
            <Shield size={20} style={{ color: "#FF4D4D" }} /> Admin
          </h1>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "12px 20px", display: "flex", gap: 8 }}>
        {(["stats", "reports"] as const).map(t => (
          <button key={t} type="button" onClick={() => t === "reports" ? loadReports() : setTab("stats")}
            style={{ padding: "8px 16px", borderRadius: 9999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              background: tab === t ? "#7C5CFF" : "#1a1530", color: tab === t ? "#fff" : "#9e96b5" }}>
            {t === "stats" ? "📊 Stats" : "🚩 Denúncias"}
          </button>
        ))}
      </div>

      {/* Stats */}
      {tab === "stats" && stats && (
        <div style={{ padding: "0 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <StatCard icon={<Users size={16} />} label="Usuários" value={stats.users} color="#A78BFA" />
          <StatCard icon={<Users size={16} />} label="Ativos 7d" value={stats.active7d} color="#22D18B" />
          <StatCard icon={<Heart size={16} />} label="Posts" value={stats.posts} color="#FF4D4D" />
          <StatCard icon={<MessageCircle size={16} />} label="Comentários" value={stats.comments} color="#FF9F43" />
          <StatCard icon={<CalendarCheck size={16} />} label="Check-ins" value={stats.checkins} color="#7C5CFF" />
          <StatCard icon={<BookOpen size={16} />} label="Diários" value={stats.diary} color="#5EEAD4" />
          <StatCard icon={<MapPin size={16} />} label="Mapbox (mês)" value={stats.mapboxLoads} color="#FF9F43" />
        </div>
      )}

      {/* Reports */}
      {tab === "reports" && (
        <div style={{ padding: "0 20px" }}>
          {reports.length === 0 ? (
            <p style={{ textAlign: "center", color: "#9e96b5", padding: 40 }}>Nenhuma denúncia</p>
          ) : reports.map(r => (
            <div key={r.id} style={{ background: "#1a1530", borderRadius: 14, padding: 14, marginBottom: 8, border: "1px solid rgba(167,139,250,0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#FF4D4D", fontWeight: 600 }}>🚩 Denunciado</span>
                <span style={{ fontSize: 10, color: "#5a5470" }}>{new Date(r.created_at).toLocaleDateString(getLocale())}</span>
              </div>
              <p style={{ margin: "0 0 6px", fontSize: 13, color: "#e0d6ff", lineHeight: 1.4 }}>
                {r.community_posts?.content?.slice(0, 200) || "Post excluído"}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, color: "#9e96b5" }}>por {r.community_posts?.display_name || "?"}</span>
                <div style={{ flex: 1 }} />
                <button type="button" onClick={() => r.community_posts && deletePost(r.community_posts.id)}
                  style={{ padding: "6px 12px", borderRadius: 8, border: 0, background: "rgba(255,77,77,0.15)", color: "#FF4D4D", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                  <Trash2 size={12} /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#1a1530", borderRadius: 14, padding: 14, border: "1px solid rgba(167,139,250,0.1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 11, color: "#9e96b5", fontWeight: 500 }}>{label}</span>
      </div>
      <span style={{ fontSize: 22, fontWeight: 800, color: "#e0d6ff" }}>{value}</span>
    </div>
  );
}
