"use client";
import { getLocale } from "@/lib/language";
import { useTranslation } from "@/lib/useTranslation";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Shield, Users, Activity, TrendingUp, Target, DollarSign } from "lucide-react";

interface Report { id: string; post_id: string; reason: string | null; created_at: string; community_posts: { id: string; content: string; display_name: string; created_at: string } | null; }

interface Overview {
  users: number;
  signupsByDay: { date: string; count: number }[];
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
  activeByDay: { date: string; count: number }[];
  funnel: { signup: number; onboarding: number; firstCheckin: number; trial: number; paid: number };
  retention: { d1: number; d7: number; d30: number };
  planMix: { monthly: number; annual: number };
  trialCount: number;
  activeCount: number;
  canceledCount: number;
  pastDueCount: number;
  utmSources: { source: string; count: number }[];
  posts: number;
  comments: number;
  checkins: number;
  diary: number;
  mapboxLoads: number;
}

interface Revenue {
  activeCount: number;
  mrrByCurrency: Record<string, number>;
  activeByCurrency: Record<string, number>;
  arpuByCurrency: Record<string, number>;
  canceledTotal: number;
  canceled30d: number;
  churnRate: number;
  ltv: number | null;
  fetchedAt: string;
}

type Tab = "overview" | "funnel" | "revenue" | "reports";

const pct = (v: number) => `${Math.round(v * 100)}%`;
const fmtMoney = (currency: string, amount: number) => {
  const opts = { minimumFractionDigits: 2 };
  if (currency === "brl") return `R$ ${amount.toLocaleString("pt-BR", opts)}`;
  if (currency === "usd") return `US$ ${amount.toLocaleString("en-US", opts)}`;
  return `${currency.toUpperCase()} ${amount.toLocaleString("pt-BR", opts)}`;
};

export default function AdminPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Overview | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin").then(r => {
      if (r.status === 403) { setError(t("ad_acesso_negado")); setLoading(false); return; }
      return r.json();
    }).then(d => {
      if (d) setData(d);
      setLoading(false);
    }).catch(() => { setError(t("ad_erro_carregar")); setLoading(false); });
  }, []);

  const loadReports = async () => {
    setTab("reports");
    const res = await fetch("/api/admin?type=reports");
    if (res.ok) setReports(await res.json());
  };

  const loadRevenue = async () => {
    setTab("revenue");
    const res = await fetch("/api/admin/revenue");
    if (res.ok) setRevenue(await res.json());
  };

  const deletePost = async (postId: string) => {
    const res = await fetch(`/api/admin/posts/${postId}`, { method: "DELETE" });
    if (res.ok) {
      setReports(prev => prev.filter(r => r.post_id !== postId));
      toast.success(t("ad_post_excluido"));
    } else {
      toast.error(t("ad_erro_carregar"));
    }
  };

  if (error) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0B0B10", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 20 }}>
        <Shield size={48} style={{ color: "#FF4D4D" }} />
        <p style={{ color: "#e0d6ff", fontSize: 16, fontWeight: 600 }}>{error}</p>
        <button type="button" onClick={() => router.push("/perfil")}
          style={{ padding: "10px 20px", borderRadius: 12, background: "#7C5CFF", border: 0, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          {t("ad_voltar")}
        </button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0B0B10", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9e96b5", fontSize: 13 }}>{t("carregando")}</p>
      </div>
    );
  }

  const conversion = data.activeCount / Math.max(data.trialCount + data.activeCount + data.canceledCount + data.pastDueCount, 1);
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "📊 Visão geral" },
    { key: "funnel", label: "🌀 Funil" },
    { key: "revenue", label: "💸 Receita" },
    { key: "reports", label: "🚩 Denúncias" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "#0B0B10", paddingBottom: 100 }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* Header */}
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
        <div style={{ padding: "12px 20px 8px", display: "flex", gap: 8, overflowX: "auto" }}>
          {tabs.map(tb => (
            <button key={tb.key} type="button"
              onClick={() => { if (tb.key === "reports") loadReports(); else if (tb.key === "revenue") loadRevenue(); else setTab(tb.key); }}
              style={{ padding: "8px 14px", borderRadius: 9999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                background: tab === tb.key ? "#7C5CFF" : "#1a1530", color: tab === tb.key ? "#fff" : "#9e96b5" }}>
              {tb.label}
            </button>
          ))}
        </div>

        {/* ── VISÃO GERAL ── */}
        {tab === "overview" && (
          <div style={{ padding: "8px 20px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Kpi icon={<Users size={16} />} label="Usuários" value={data.users} color="#A78BFA" />
              <Kpi icon={<Activity size={16} />} label="DAU (hoje)" value={data.dau} color="#22D18B" />
              <Kpi icon={<Activity size={16} />} label="MAU (30d)" value={data.mau} color="#22D18B" />
              <Kpi icon={<TrendingUp size={16} />} label="Stickiness (DAU/MAU)" value={pct(data.stickiness)} color="#5EEAD4" />
              <Kpi icon={<Target size={16} />} label="Trial → pago" value={pct(conversion)} color="#7C5CFF" />
              <Kpi icon={<DollarSign size={16} />} label="Assinantes ativos" value={data.activeCount} color="#FF9F43" />
            </div>

            <ChartCard title="Cadastros (30d)" data={data.signupsByDay} color="#A78BFA" />
            <ChartCard title="Ativos por dia — DAU (30d)" data={data.activeByDay} color="#22D18B" />

            {data.utmSources.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <SectionTitle>Aquisição por origem (UTM)</SectionTitle>
                {data.utmSources.map(u => (
                  <div key={u.source} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: "1px solid rgba(167,139,250,0.06)" }}>
                    <span style={{ flex: 1, fontSize: 12, color: "#e0d6ff" }}>{u.source || "(direto)"}</span>
                    <span style={{ fontSize: 12, color: "#9e96b5", fontWeight: 700 }}>{u.count}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
              <MiniStat label="Posts" value={data.posts} />
              <MiniStat label="Comentários" value={data.comments} />
              <MiniStat label="Check-ins" value={data.checkins} />
              <MiniStat label="Diários" value={data.diary} />
              <MiniStat label="Mapbox (mês)" value={data.mapboxLoads} />
            </div>
          </div>
        )}

        {/* ── FUNIL ── */}
        {tab === "funnel" && (
          <div style={{ padding: "8px 20px 0" }}>
            <SectionTitle>Funil de ativação</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
              <FunnelBar label="Cadastros" value={data.funnel.signup} total={data.funnel.signup} color="#A78BFA" />
              <FunnelBar label="Onboarding concluído" value={data.funnel.onboarding} total={data.funnel.signup} color="#7C5CFF" />
              <FunnelBar label="1º check-in" value={data.funnel.firstCheckin} total={data.funnel.signup} color="#5EEAD4" />
              <FunnelBar label="Iniciou trial" value={data.funnel.trial} total={data.funnel.signup} color="#22D18B" />
              <FunnelBar label="Pagou (ativo)" value={data.funnel.paid} total={data.funnel.signup} color="#FF9F43" />
            </div>

            <SectionTitle>Retenção (a partir do 1º check-in)</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <RetentionCard label="D1" value={data.retention.d1} />
              <RetentionCard label="D7" value={data.retention.d7} />
              <RetentionCard label="D30" value={data.retention.d30} />
            </div>
            <p style={{ fontSize: 11, color: "#6a657a", lineHeight: 1.5, marginTop: 10 }}>
              D1 = % que voltou no dia seguinte ao 1º check-in. D7/D30 = % que fez outro check-in dentro de 7/30 dias.
            </p>
          </div>
        )}

        {/* ── RECEITA ── */}
        {tab === "revenue" && (
          <div style={{ padding: "8px 20px 0" }}>
            <SectionTitle>Receita (Stripe ao vivo)</SectionTitle>
            {revenue ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {Object.entries(revenue.mrrByCurrency).map(([cur, v]) => (
                    <MiniStat key={cur} label={`MRR (${cur.toUpperCase()})`} value={fmtMoney(cur, v)} />
                  ))}
                  {Object.entries(revenue.arpuByCurrency).map(([cur, v]) => (
                    <MiniStat key={`arpu-${cur}`} label={`ARPU (${cur.toUpperCase()})`} value={fmtMoney(cur, v)} />
                  ))}
                  {Object.keys(revenue.mrrByCurrency).length === 0 && <MiniStat label="MRR" value={fmtMoney("brl", 0)} />}
                  <MiniStat label="Assinantes ativos" value={revenue.activeCount} />
                  <MiniStat label="Cancelados (30d)" value={revenue.canceled30d} />
                  <MiniStat label="Cancelados (total)" value={revenue.canceledTotal} />
                  <MiniStat label="Churn (30d)" value={pct(revenue.churnRate)} />
                  <MiniStat label="LTV (R$)" value={revenue.ltv != null ? `R$ ${revenue.ltv.toLocaleString("pt-BR")}` : "—"} />
                </div>
                <p style={{ fontSize: 10, color: "#6a657a", marginTop: 8 }}>
                  Atualizado às {new Date(revenue.fetchedAt).toLocaleTimeString(getLocale())} · ARPU = MRR ÷ ativos
                </p>
              </>
            ) : (
              <p style={{ fontSize: 12, color: "#9e96b5", padding: 16 }}>{t("carregando")}…</p>
            )}

            <SectionTitle>Assinaturas (banco local)</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              <MiniStat label="Ativos" value={data.activeCount} />
              <MiniStat label="Em trial" value={data.trialCount} />
              <MiniStat label="Cancelados" value={data.canceledCount} />
              <MiniStat label="Inadimplentes" value={data.pastDueCount} />
            </div>

            <SectionTitle>Mix de plano (ativos)</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <MiniStat label="Mensal" value={data.planMix.monthly} />
              <MiniStat label="Anual" value={data.planMix.annual} />
            </div>
          </div>
        )}

        {/* ── DENÚNCIAS ── */}
        {tab === "reports" && (
          <div style={{ padding: "8px 20px 0" }}>
            {reports.length === 0 ? (
              <p style={{ textAlign: "center", color: "#9e96b5", padding: 40 }}>{t("ad_nenhuma_denuncia")}</p>
            ) : reports.map(r => (
              <div key={r.id} style={{ background: "#1a1530", borderRadius: 14, padding: 14, marginBottom: 8, border: "1px solid rgba(167,139,250,0.1)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#FF4D4D", fontWeight: 600 }}>{t("ad_denunciado")}</span>
                  <span style={{ fontSize: 10, color: "#5a5470" }}>{new Date(r.created_at).toLocaleDateString(getLocale())}</span>
                </div>
                <p style={{ margin: "0 0 6px", fontSize: 13, color: "#e0d6ff", lineHeight: 1.4 }}>
                  {r.community_posts?.content?.slice(0, 200) || t("ad_post_excluido")}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "#9e96b5" }}>{t("ad_por")} {r.community_posts?.display_name || "?"}</span>
                  <div style={{ flex: 1 }} />
                  <button type="button" onClick={() => r.community_posts && deletePost(r.community_posts.id)}
                    style={{ padding: "6px 12px", borderRadius: 8, border: 0, background: "rgba(255,77,77,0.15)", color: "#FF4D4D", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                    <Trash2 size={12} /> {t("ad_excluir")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componentes visuais ──────────────────────────────────────────────

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
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

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ background: "#1a1530", borderRadius: 12, padding: 12, border: "1px solid rgba(167,139,250,0.08)" }}>
      <div style={{ fontSize: 11, color: "#9e96b5", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#e0d6ff" }}>{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ margin: "4px 0 10px", fontSize: 13, fontWeight: 700, color: "#e0d6ff" }}>{children}</h3>;
}

function FunnelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const ratio = total > 0 ? value / total : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: "#e0d6ff" }}>{label}</span>
        <span style={{ fontSize: 11, color: "#9e96b5" }}>{value} · {pct(ratio)}</span>
      </div>
      <div style={{ height: 10, borderRadius: 6, background: "#151220", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(ratio * 100, 1)}%`, background: color, borderRadius: 6 }} />
      </div>
    </div>
  );
}

function RetentionCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "#1a1530", borderRadius: 14, padding: 14, border: "1px solid rgba(167,139,250,0.1)", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#9e96b5", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#5EEAD4" }}>{pct(value)}</div>
    </div>
  );
}

function ChartCard({ title, data, color }: { title: string; data: { date: string; count: number }[]; color: string }) {
  const W = 320, H = 90, PAD = 8;
  const values = data.map(d => d.count);
  const max = Math.max(...values, 1);
  const n = data.length;
  const x = (i: number) => PAD + (i / Math.max(n - 1, 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const pts = data.map((d, i) => `${x(i)},${y(d.count)}`).join(" ");
  const area = `M ${x(0)},${H - PAD} L ${pts.split(" ").map(p => p.replace(",", " ")).join(" L ")} L ${x(n - 1)},${H - PAD} Z`;

  return (
    <div style={{ background: "#1a1530", borderRadius: 14, padding: 14, border: "1px solid rgba(167,139,250,0.1)", marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#e0d6ff", marginBottom: 8 }}>{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${title.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#grad-${title.replace(/\W/g, "")})`} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 9, color: "#6a657a" }}>{data[0]?.date?.slice(5)}</span>
        <span style={{ fontSize: 9, color: "#6a657a" }}>{data[n - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}
