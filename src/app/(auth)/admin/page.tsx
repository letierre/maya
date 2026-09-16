"use client";
import { getLocale } from "@/lib/language";
import { useTranslation } from "@/lib/useTranslation";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Shield, Users, Activity, TrendingUp, Target, DollarSign, ClipboardList } from "lucide-react";

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
  aiCost: { usd: number; usd7d: number; calls: number; tokens: number; byFeature: { feature: string; calls: number; usd: number }[]; estimated: boolean };
  posts: number;
  comments: number;
  checkins: number;
  diary: number;
  mapboxLoads: number;
  safetyFlags: { id: string; date: string; user_id: string; email: string }[];
  errors24h: number;
  recentErrors: { path: string; message: string; created_at: string }[];
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
  feesByCurrency: Record<string, number>;
  grossByCurrency: Record<string, number>;
  charges30d: number;
  fetchedAt: string;
}

interface ModuleUsage {
  key: string;
  label: string;
  total: number;
  last24h: number;
  last7d: number;
  activeUsers: number;
  byGender: Record<string, number>;
}

interface Insights {
  languages: Record<string, number>;
  genders: Record<string, number>;
  modules: ModuleUsage[];
  pageviews: { module: string; total: number; last24h: number; last7d: number }[];
}

interface SegRow { key: string; users: number; d7: number | null; d30: number | null; }

interface Patterns {
  hours: number[];
  streaks: { label: string; count: number }[];
  retentionByLang: SegRow[];
  retentionByGender: SegRow[];
  utmConversion: { source: string; trial: number; paid: number; rate: number | null }[];
  cooccurrence: { a: string; b: string; labelA: string; labelB: string; shared: number; jaccard: number }[];
}

interface OnboardingMetrics {
  total: number;
  byDay: { date: string; count: number }[];
  goal: Record<string, number>;
  pains: Record<string, number>;
  tinderAgreed: Record<string, number>;
  areas: Record<string, number>;
  language: Record<string, number>;
  gender: Record<string, number>;
  context: Record<string, { sim: number; nao: number }>;
  inProgress: number;
  dropoffByStep: Record<string, number>;
}

type Tab = "overview" | "users" | "modules" | "patterns" | "funnel" | "revenue" | "reports" | "onboarding";

const pct = (v: number) => `${Math.round(v * 100)}%`;
const LANG_LABELS: [string, string][] = [["pt", "Português"], ["es", "Espanhol"], ["en", "Inglês"], ["other", "Não definido"]];
const GENDER_LABELS: [string, string][] = [["masculino", "Masculino ⚡"], ["feminino", "Feminino 🌸"], ["nao_dizer", "Prefere não dizer 🌱"], ["other", "Não informado"]];
const langLabel = (k: string) => LANG_LABELS.find(([v]) => v === k)?.[1] ?? k;
const genderLabel = (k: string) => GENDER_LABELS.find(([v]) => v === k)?.[1] ?? k;
const fmtMoney = (currency: string, amount: number) => {
  const opts = { minimumFractionDigits: 2 };
  if (currency === "brl") return `R$ ${amount.toLocaleString("pt-BR", opts)}`;
  if (currency === "usd") return `US$ ${amount.toLocaleString("en-US", opts)}`;
  return `${currency.toUpperCase()} ${amount.toLocaleString("pt-BR", opts)}`;
};

// ── Rótulos das respostas do onboarding (pt, admin) ──────────────────
const GOAL_LABELS: [string, string][] = [
  ["sono", "😴 Dormir melhor"], ["leveza", "😌 Me sentir mais leve"], ["alimentacao", "🥗 Comer melhor"],
  ["meta", "🎯 Alcançar uma meta"], ["dinheiro", "💰 Organizar meu dinheiro"],
  ["movimento", "🏃 Me movimentar mais"], ["equilibrio", "🌱 Equilíbrio no geral"],
];
const PAIN_LABELS: [string, string][] = [
  ["nao_sei", "🤷 Não sei o que funciona pra mim"], ["espalhado", "🧩 Minha vida está espalhada"],
  ["sem_tempo", "⏰ Sem tempo / esqueço de me cuidar"], ["desisto", "🔁 Começo e desisto na 1ª semana"],
  ["sem_rumo", "🧭 Me sinto sem rumo"], ["sem_progresso", "📉 Não vejo meu progresso"],
  ["sozinho", "🕳️ Me sinto sozinho(a) nessa"],
];
const AREA_LABELS: [string, string][] = [
  ["sono", "😴 Sono"], ["humor", "😊 Humor"], ["habitos", "✅ Hábitos"], ["metas", "🎯 Metas"],
  ["dinheiro", "💰 Dinheiro"], ["alimentacao", "🥗 Alimentação"], ["movimento", "🏃 Movimento"], ["leitura", "📖 Leitura"],
];
const TINDER_LABELS: [string, string][] = [
  ["ob_tinder_1", "1. Começo a me cuidar e largo na 1ª semana"],
  ["ob_tinder_2", "2. Não sei se o que faço funciona"],
  ["ob_tinder_3", "3. Tanta coisa que não acompanho nada"],
  ["ob_tinder_4", "4. Queria alguém que prestasse atenção em mim"],
];
const CTX_LABELS: [string, string][] = [
  ["has_medication", "💊 Toma medicação"],
  ["has_faith", "🙏 Tem fé/espiritualidade"],
  ["has_creative_hobby", "🎨 Hobby criativo"],
  ["track_suicidal_thoughts", "🧠 Acompanhar pensamentos difíceis"],
];
const STEP_LABELS: [string, string][] = [
  ["welcome", "Boas-vindas"], ["goal", "Objetivo"], ["pain", "Dores"], ["social", "Prova social"],
  ["tinder", "Identificação (frases)"], ["solution", "Solução"], ["comparison", "Comparativo"],
  ["preferences", "Áreas de interesse"], ["about", "Sobre você"], ["processing", "Processando"],
  ["demo", "Demo (check-in)"], ["value", "Entrega de valor"], ["notifications", "Notificações"],
  ["install", "Instalar app"],
];

// Filtra e ordena (desc) os contadores pelos rótulos conhecidos.
function sortedBars(counts: Record<string, number>, labels: [string, string][]): { key: string; label: string; value: number }[] {
  return labels
    .map(([key, label]) => ({ key, label, value: counts?.[key] ?? 0 }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value);
}

export default function AdminPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Overview | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [revenueError, setRevenueError] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsError, setInsightsError] = useState(false);
  const [patterns, setPatterns] = useState<Patterns | null>(null);
  const [patternsError, setPatternsError] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingMetrics | null>(null);
  const [onboardingError, setOnboardingError] = useState(false);
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
    setRevenueError(false);
    const res = await fetch("/api/admin/revenue");
    if (res.ok) setRevenue(await res.json());
    else setRevenueError(true);
  };

  const loadInsights = async () => {
    if (insights) return; // já carregado
    setInsightsError(false);
    const res = await fetch("/api/admin/insights");
    if (res.ok) setInsights(await res.json());
    else setInsightsError(true);
  };

  const loadPatterns = async () => {
    if (patterns) return; // já carregado
    setPatternsError(false);
    const res = await fetch("/api/admin/patterns");
    if (res.ok) setPatterns(await res.json());
    else setPatternsError(true);
  };

  const loadOnboarding = async () => {
    if (onboarding) return; // já carregado
    setOnboardingError(false);
    const res = await fetch("/api/admin/onboarding");
    if (res.ok) setOnboarding(await res.json());
    else setOnboardingError(true);
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
  const langTotal = insights ? Object.values(insights.languages).reduce((a, b) => a + b, 0) : 0;
  const genderTotal = insights ? Object.values(insights.genders).reduce((a, b) => a + b, 0) : 0;
  const maxModuleTotal = insights ? Math.max(...insights.modules.map(m => m.total), 1) : 1;
  const sortedModules = insights ? [...insights.modules].sort((a, b) => b.total - a.total) : [];
  const streakTotal = patterns ? patterns.streaks.reduce((a, b) => a + b.count, 0) : 0;
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "📊 Visão geral" },
    { key: "users", label: "👥 Usuários" },
    { key: "modules", label: "🧩 Módulos" },
    { key: "patterns", label: "🔍 Padrões" },
    { key: "funnel", label: "🌀 Funil" },
    { key: "onboarding", label: "📋 Onboarding" },
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
              onClick={() => { if (tb.key === "reports") loadReports(); else if (tb.key === "revenue") loadRevenue(); else if (tb.key === "users" || tb.key === "modules") { setTab(tb.key); loadInsights(); } else if (tb.key === "patterns") { setTab("patterns"); loadPatterns(); } else if (tb.key === "onboarding") { setTab("onboarding"); loadOnboarding(); } else setTab(tb.key); }}
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

            <div style={{ background: "#1a1530", borderRadius: 14, padding: 14, border: "1px solid rgba(167,139,250,0.1)", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#9e96b5", fontWeight: 600 }}>Custo de IA (30d{data.aiCost.estimated ? ", estimado" : ""})</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#FF9F43" }}>US$ {data.aiCost.usd.toFixed(2)}</span>
            </div>
            <p style={{ fontSize: 10, color: "#6a657a", marginTop: 4, marginBottom: 4 }}>
              {data.aiCost.estimated
                ? "estimado — ainda sem dados reais de tokens"
                : `US$ ${data.aiCost.usd7d.toFixed(2)} nos últimos 7d · ${data.aiCost.calls} chamadas · ${(data.aiCost.tokens / 1000).toFixed(0)}k tokens`}
            </p>
            {!data.aiCost.estimated && data.aiCost.byFeature.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                {data.aiCost.byFeature.slice(0, 6).map(f => (
                  <div key={f.feature} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderTop: "1px solid rgba(167,139,250,0.06)", fontSize: 11 }}>
                    <span style={{ color: "#e0d6ff" }}>{f.feature}</span>
                    <span style={{ color: "#9e96b5" }}>{f.calls} chamadas · US$ {f.usd.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {data.safetyFlags.length > 0 && (
              <div style={{ background: "rgba(255,77,77,0.12)", borderRadius: 14, padding: 14, border: "1px solid rgba(255,77,77,0.35)", marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#FF4D4D", marginBottom: 6 }}>⚠️ Sinais de risco (7d)</div>
                {data.safetyFlags.map(f => (
                  <div key={f.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderTop: "1px solid rgba(255,77,77,0.15)", fontSize: 12 }}>
                    <span style={{ color: "#e0d6ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.email}</span>
                    <span style={{ color: "#9e96b5", whiteSpace: "nowrap" }}>{f.date}</span>
                  </div>
                ))}
              </div>
            )}

            {data.errors24h > 0 && (
              <div style={{ background: "#1a1530", borderRadius: 14, padding: 14, border: "1px solid rgba(255,159,67,0.25)", marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#FF9F43", marginBottom: 6 }}>Erros (24h): {data.errors24h}</div>
                {data.recentErrors.slice(0, 5).map((e, i) => (
                  <div key={i} style={{ padding: "5px 0", borderTop: "1px solid rgba(167,139,250,0.06)", fontSize: 11 }}>
                    <span style={{ color: "#e0d6ff" }}>{e.path}</span>
                    <span style={{ color: "#6a657a" }}> — {e.message.slice(0, 90)}</span>
                  </div>
                ))}
              </div>
            )}

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

        {/* ── USUÁRIOS ── */}
        {tab === "users" && (
          <div style={{ padding: "8px 20px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Kpi icon={<Activity size={16} />} label="Ativos hoje (DAU)" value={data.dau} color="#22D18B" />
              <Kpi icon={<Activity size={16} />} label="Ativos 7d (WAU)" value={data.wau} color="#5EEAD4" />
            </div>

            {!insights ? (
              <p style={{ fontSize: 12, color: insightsError ? "#FF4D4D" : "#9e96b5", padding: 16 }}>
                {insightsError ? t("ad_erro_carregar") : `${t("carregando")}…`}
              </p>
            ) : (
              <>
                <SectionTitle>Idioma</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                  {LANG_LABELS.map(([k, label]) => (
                    <FunnelBar key={k} label={label} value={insights.languages[k] ?? 0} total={langTotal} color="#7C5CFF" />
                  ))}
                </div>

                <SectionTitle>Gênero</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {GENDER_LABELS.map(([k, label]) => (
                    <FunnelBar key={k} label={label} value={insights.genders[k] ?? 0} total={genderTotal} color="#FF9F43" />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── MÓDULOS ── */}
        {tab === "modules" && (
          <div style={{ padding: "8px 20px 0" }}>
            {!insights ? (
              <p style={{ fontSize: 12, color: insightsError ? "#FF4D4D" : "#9e96b5", padding: 16 }}>
                {insightsError ? t("ad_erro_carregar") : `${t("carregando")}…`}
              </p>
            ) : (
              <>
                <SectionTitle>Módulos mais usados (registros)</SectionTitle>
                {sortedModules.map((m, i) => (
                  <ModuleBar key={m.key} rank={i + 1} label={m.label} usage={m} max={maxModuleTotal} baseUsers={data.users} />
                ))}
                <p style={{ fontSize: 11, color: "#6a657a", lineHeight: 1.5, marginTop: 2 }}>
                  👤 = usuários únicos que usaram o módulo; % entre parênteses = taxa de adoção sobre a base total.
                </p>

                <SectionTitle>Uso por gênero (usuários ativos por módulo)</SectionTitle>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", fontSize: 10, color: "#6a657a", fontWeight: 700 }}>
                  <span style={{ flex: 1 }}>Módulo</span>
                  <span style={{ minWidth: 40, textAlign: "right" }}>⚡ M</span>
                  <span style={{ minWidth: 40, textAlign: "right" }}>🌸 F</span>
                  <span style={{ minWidth: 40, textAlign: "right" }}>🌱 ND</span>
                </div>
                {sortedModules.map(m => (
                  <GenderRow key={m.key} label={m.label} byGender={m.byGender} />
                ))}
                <p style={{ fontSize: 11, color: "#6a657a", lineHeight: 1.5, marginTop: 10 }}>
                  Usuários únicos por módulo, segmentados por gênero. Inclui quem ainda não concluiu o onboarding como "não informado".
                </p>

                <SectionTitle>Aberturas (pageviews)</SectionTitle>
                {insights.pageviews.length === 0 ? (
                  <p style={{ fontSize: 11, color: "#6a657a", lineHeight: 1.5 }}>
                    Sem dados ainda — o rastreamento de abertura começa a popular após a migration 056 ser aplicada e os usuários navegarem.
                  </p>
                ) : insights.pageviews.map(p => (
                  <div key={p.module} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: "1px solid rgba(167,139,250,0.06)" }}>
                    <span style={{ flex: 1, fontSize: 12, color: "#e0d6ff" }}>{p.module}</span>
                    <span style={{ fontSize: 10, color: "#6a657a" }}>24h: {p.last24h}</span>
                    <span style={{ fontSize: 10, color: "#6a657a" }}>7d: {p.last7d}</span>
                    <span style={{ fontSize: 11, color: "#5EEAD4", fontWeight: 700, minWidth: 32, textAlign: "right" }}>{p.total}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── PADRÕES ── */}
        {tab === "patterns" && (
          <div style={{ padding: "8px 20px 0" }}>
            {!patterns ? (
              <p style={{ fontSize: 12, color: patternsError ? "#FF4D4D" : "#9e96b5", padding: 16 }}>
                {patternsError ? t("ad_erro_carregar") : `${t("carregando")}…`}
              </p>
            ) : (
              <>
                <SectionTitle>Horário de uso (check-ins por hora)</SectionTitle>
                <div style={{ background: "#1a1530", borderRadius: 14, padding: 14, border: "1px solid rgba(167,139,250,0.1)", marginBottom: 4 }}>
                  <HourChart hours={patterns.hours} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#6a657a", marginTop: 4 }}>
                    <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
                  </div>
                </div>
                <p style={{ fontSize: 10, color: "#6a657a", marginBottom: 16 }}>Horário local (São Paulo).</p>

                <SectionTitle>Sequência (streak) atual</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                  {patterns.streaks.map(s => (
                    <FunnelBar key={s.label} label={`${s.label} dia(s)`} value={s.count} total={streakTotal} color="#FF9F43" />
                  ))}
                </div>

                <SectionTitle>Retenção por idioma</SectionTitle>
                {patterns.retentionByLang.map(r => (
                  <SegRow key={r.key} label={langLabel(r.key)} users={r.users} d7={r.d7} d30={r.d30} />
                ))}

                <SectionTitle>Retenção por gênero</SectionTitle>
                {patterns.retentionByGender.map(r => (
                  <SegRow key={r.key} label={genderLabel(r.key)} users={r.users} d7={r.d7} d30={r.d30} />
                ))}

                <SectionTitle>Conversão por origem (trial → pago)</SectionTitle>
                {patterns.utmConversion.length === 0 ? (
                  <p style={{ fontSize: 11, color: "#6a657a" }}>Sem dados de UTM ainda.</p>
                ) : patterns.utmConversion.map(u => (
                  <div key={u.source} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: "1px solid rgba(167,139,250,0.06)" }}>
                    <span style={{ flex: 1, fontSize: 12, color: "#e0d6ff" }}>{u.source}</span>
                    <span style={{ fontSize: 10, color: "#6a657a" }}>{u.paid + u.trial} sub</span>
                    <span style={{ fontSize: 11, color: "#FF9F43", fontWeight: 700, minWidth: 44, textAlign: "right" }}>{u.rate == null ? "—" : pct(u.rate)}</span>
                  </div>
                ))}

                <SectionTitle>Correlação entre módulos</SectionTitle>
                {patterns.cooccurrence.length === 0 ? (
                  <p style={{ fontSize: 11, color: "#6a657a" }}>Sem sobreposição suficiente entre módulos.</p>
                ) : patterns.cooccurrence.map(c => (
                  <div key={c.a + c.b} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: "1px solid rgba(167,139,250,0.06)" }}>
                    <span style={{ flex: 1, fontSize: 12, color: "#e0d6ff" }}>{c.labelA} ↔ {c.labelB}</span>
                    <span style={{ fontSize: 10, color: "#6a657a" }}>{c.shared} em comum</span>
                    <span style={{ fontSize: 11, color: "#5EEAD4", fontWeight: 700, minWidth: 40, textAlign: "right" }}>{pct(c.jaccard)}</span>
                  </div>
                ))}
              </>
            )}
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

        {/* ── ONBOARDING ── */}
        {tab === "onboarding" && (
          <div style={{ padding: "8px 20px 0" }}>
            {!onboarding ? (
              <p style={{ fontSize: 12, color: onboardingError ? "#FF4D4D" : "#9e96b5", padding: 16 }}>
                {onboardingError ? t("ad_erro_carregar") : `${t("carregando")}…`}
              </p>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Kpi icon={<ClipboardList size={16} />} label="Respostas" value={onboarding.total} color="#A78BFA" />
                  <Kpi icon={<Target size={16} />} label="Conclusão (da base)" value={data.users > 0 ? pct(onboarding.total / data.users) : "—"} color="#22D18B" />
                </div>

                <ChartCard title="Respostas por dia (30d)" data={onboarding.byDay} color="#A78BFA" />

                <SectionTitle>Funil de conclusão</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                  <FunnelBar label="Cadastros" value={data.users} total={data.users} color="#A78BFA" />
                  <FunnelBar label="Começaram o onboarding" value={onboarding.total + onboarding.inProgress} total={data.users} color="#7C5CFF" />
                  <FunnelBar label="Concluíram" value={onboarding.total} total={data.users} color="#22D18B" />
                </div>

                <SectionTitle>Onde param (não concluíram)</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                  {onboarding.inProgress === 0 ? (
                    <p style={{ fontSize: 11, color: "#6a657a", lineHeight: 1.5 }}>Ninguém parado no meio agora.</p>
                  ) : sortedBars(onboarding.dropoffByStep, STEP_LABELS).map((g) => (
                    <FunnelBar key={g.key} label={g.label} value={g.value} total={onboarding.inProgress} color="#FF4D4D" />
                  ))}
                </div>

                {onboarding.total === 0 && (
                  <p style={{ fontSize: 12, color: "#9e96b5", padding: "16px 0", lineHeight: 1.5 }}>
                    Sem respostas ainda — os dados aparecem conforme os usuários concluem o onboarding.
                  </p>
                )}

                <SectionTitle>Objetivo principal</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                  {sortedBars(onboarding.goal, GOAL_LABELS).map((g) => (
                    <FunnelBar key={g.key} label={g.label} value={g.value} total={onboarding.total} color="#A78BFA" />
                  ))}
                </div>

                <SectionTitle>Dores (múltipla escolha)</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                  {sortedBars(onboarding.pains, PAIN_LABELS).map((g) => (
                    <FunnelBar key={g.key} label={g.label} value={g.value} total={onboarding.total} color="#FF9F43" />
                  ))}
                </div>

                <SectionTitle>Frases com que se identificou</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                  {sortedBars(onboarding.tinderAgreed, TINDER_LABELS).map((g) => (
                    <FunnelBar key={g.key} label={g.label} value={g.value} total={onboarding.total} color="#5EEAD4" />
                  ))}
                </div>

                <SectionTitle>Áreas de interesse (múltipla)</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                  {sortedBars(onboarding.areas, AREA_LABELS).map((g) => (
                    <FunnelBar key={g.key} label={g.label} value={g.value} total={onboarding.total} color="#7C5CFF" />
                  ))}
                </div>

                <SectionTitle>Contexto (perguntas sensíveis)</SectionTitle>
                <div style={{ marginBottom: 20 }}>
                  {CTX_LABELS.map(([key, label]) => {
                    const c = onboarding.context[key] ?? { sim: 0, nao: 0 };
                    const tot = c.sim + c.nao;
                    return (
                      <div key={key} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 12, color: "#e0d6ff" }}>{label}</span>
                          <span style={{ fontSize: 11, color: "#9e96b5" }}>{c.sim} sim · {c.nao} não</span>
                        </div>
                        <div style={{ display: "flex", height: 10, borderRadius: 6, background: "#151220", overflow: "hidden" }}>
                          <div style={{ width: `${tot > 0 ? (c.sim / tot) * 100 : 0}%`, background: "#22D18B", transition: "width .3s ease" }} />
                          <div style={{ flex: 1, background: "rgba(255,92,92,0.35)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <SectionTitle>Idioma</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                  {sortedBars(onboarding.language, LANG_LABELS).map((g) => (
                    <FunnelBar key={g.key} label={g.label} value={g.value} total={onboarding.total} color="#7C5CFF" />
                  ))}
                </div>

                <SectionTitle>Gênero</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {sortedBars(onboarding.gender, GENDER_LABELS).map((g) => (
                    <FunnelBar key={g.key} label={g.label} value={g.value} total={onboarding.total} color="#FF9F43" />
                  ))}
                </div>
              </>
            )}
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
              <p style={{ fontSize: 12, color: revenueError ? "#FF4D4D" : "#9e96b5", padding: 16 }}>
                {revenueError ? t("ad_erro_carregar") : `${t("carregando")}…`}
              </p>
            )}

            {revenue && (
              <>
                <SectionTitle>Taxas Stripe (30d)</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {Object.entries(revenue.feesByCurrency).map(([cur, v]) => (
                    <MiniStat key={`fee-${cur}`} label={`Fees (${cur.toUpperCase()})`} value={fmtMoney(cur, v)} />
                  ))}
                  {Object.keys(revenue.feesByCurrency).length === 0 && <MiniStat label="Fees" value={fmtMoney("brl", 0)} />}
                  <MiniStat label="Cobranças (30d)" value={revenue.charges30d} />
                  {Object.entries(revenue.grossByCurrency).map(([cur, v]) => (
                    <MiniStat key={`gross-${cur}`} label={`Volume (${cur.toUpperCase()})`} value={fmtMoney(cur, v)} />
                  ))}
                </div>
              </>
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

function ModuleBar({ rank, label, usage, max, baseUsers }: { rank: number; label: string; usage: ModuleUsage; max: number; baseUsers: number }) {
  const ratio = max > 0 ? usage.total / max : 0;
  const adoption = baseUsers > 0 ? usage.activeUsers / baseUsers : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: "#e0d6ff", fontWeight: 600 }}>{rank}. {label}</span>
        <span style={{ fontSize: 11, color: "#9e96b5", fontWeight: 700 }}>{usage.total}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "#151220", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(ratio * 100, 1)}%`, background: "#7C5CFF", borderRadius: 4 }} />
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 3, fontSize: 10, color: "#6a657a" }}>
        <span>24h: {usage.last24h}</span>
        <span>7d: {usage.last7d}</span>
        <span>👤 {usage.activeUsers} ({pct(adoption)})</span>
      </div>
    </div>
  );
}

function GenderRow({ label, byGender }: { label: string; byGender: Record<string, number> }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 0", borderTop: "1px solid rgba(167,139,250,0.06)" }}>
      <span style={{ flex: 1, fontSize: 12, color: "#e0d6ff" }}>{label}</span>
      <span style={{ minWidth: 40, textAlign: "right", fontSize: 11, color: "#9e96b5" }}>{byGender.masculino ?? 0}</span>
      <span style={{ minWidth: 40, textAlign: "right", fontSize: 11, color: "#9e96b5" }}>{byGender.feminino ?? 0}</span>
      <span style={{ minWidth: 40, textAlign: "right", fontSize: 11, color: "#9e96b5" }}>{byGender.nao_dizer ?? 0}</span>
    </div>
  );
}

function HourChart({ hours }: { hours: number[] }) {
  const W = 320, H = 80;
  const max = Math.max(...hours, 1);
  const bw = W / 24;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} preserveAspectRatio="none">
      {hours.map((v, i) => {
        const h = v === 0 ? 1 : Math.max((v / max) * (H - 10), 1);
        return <rect key={i} x={i * bw} y={H - h} width={bw - 1.5} height={h} fill="#22D18B" rx={1} />;
      })}
    </svg>
  );
}

function SegRow({ label, users, d7, d30 }: { label: string; users: number; d7: number | null; d30: number | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: "1px solid rgba(167,139,250,0.06)" }}>
      <span style={{ flex: 1, fontSize: 12, color: "#e0d6ff" }}>{label}</span>
      <span style={{ fontSize: 10, color: "#6a657a", minWidth: 42, textAlign: "right" }}>{users} 👤</span>
      <span style={{ fontSize: 11, color: "#5EEAD4", minWidth: 42, textAlign: "right" }}>D7 {d7 == null ? "—" : pct(d7)}</span>
      <span style={{ fontSize: 11, color: "#A78BFA", minWidth: 52, textAlign: "right" }}>D30 {d30 == null ? "—" : pct(d30)}</span>
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
