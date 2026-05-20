export default function LandingPage() {
  const features = [
    { emoji: "🌙", title: "Sono",          desc: "Horários, qualidade e ciclos — entenda seu descanso" },
    { emoji: "🍽️", title: "Nutrição",      desc: "Análise de refeições com IA e acompanhamento calórico" },
    { emoji: "🎯", title: "Metas",         desc: "Metas com etapas, guardião e plano SE-ENTÃO" },
    { emoji: "📅", title: "Planejamento",  desc: "Semana organizada por dia e área de vida" },
    { emoji: "✍️", title: "Check-in",      desc: "Hábitos, sentimento e gratidão em minutos" },
    { emoji: "✨", title: "Maya",          desc: "IA que conhece seu diário, metas e histórico" },
  ];

  return (
    <main style={{
      minHeight: "100dvh",
      background: `radial-gradient(ellipse 90% 55% at 50% -5%, oklch(.93 .05 80 / .55) 0%, transparent 65%),
                   linear-gradient(180deg, oklch(.985 .004 160) 0%, oklch(.94 .022 160) 100%)`,
      fontFamily: "var(--font-sans)",
      color: "var(--foreground)",
      overflowX: "hidden",
    }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "60px 26px 88px" }}>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 22 }}>🌱</div>

          <h1 style={{
            margin: "0 0 14px",
            fontSize: 32, fontWeight: 800,
            letterSpacing: "-0.03em", lineHeight: 1.12,
          }}>
            Seu companheiro de<br />saúde e evolução
          </h1>

          <p style={{
            margin: 0, fontSize: 15.5,
            color: "var(--muted-foreground)",
            lineHeight: 1.65, fontWeight: 430,
          }}>
            Do sono à nutrição, das metas ao planejamento semanal —
            acompanhe tudo com a <strong style={{ fontWeight: 650, color: "oklch(.45 .12 160)" }}>Maya</strong>,
            sua IA pessoal que entende seu contexto completo.
          </p>
        </div>

        {/* ── Feature grid ──────────────────────────────────────── */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 10, marginBottom: 28,
        }}>
          {features.map(({ emoji, title, desc }) => (
            <div key={title} style={{
              background: "oklch(1 0 0 / .58)",
              backdropFilter: "blur(12px)",
              borderRadius: 18,
              padding: "18px 15px",
              border: "1px solid oklch(.5 .12 160 / .1)",
              boxShadow: "0 1px 3px oklch(.2 .04 160 / .05)",
            }}>
              <div style={{ fontSize: 27, lineHeight: 1, marginBottom: 9 }}>{emoji}</div>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700 }}>{title}</p>
              <p style={{
                margin: 0, fontSize: 11.5,
                color: "var(--muted-foreground)",
                lineHeight: 1.45,
              }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* ── Trust strip ───────────────────────────────────────── */}
        <div style={{
          display: "flex", justifyContent: "center",
          gap: 20, marginBottom: 28,
          fontSize: 12, color: "var(--muted-foreground)",
          fontWeight: 600, letterSpacing: ".02em",
        }}>
          <span>🔒 Privacidade total</span>
          <span>·</span>
          <span>🆓 100% gratuito</span>
          <span>·</span>
          <span>📱 PWA</span>
        </div>

        {/* ── CTAs ──────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a
            href="/cadastro"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: 54, borderRadius: 16,
              background: "oklch(.5 .12 160)", color: "#fff",
              fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.01em",
              textDecoration: "none",
              boxShadow: "0 4px 18px -4px oklch(.5 .12 160 / .5)",
              transition: "opacity .15s ease",
            }}
          >
            Começar agora — é grátis
          </a>
          <a
            href="/login"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: 48, borderRadius: 14,
              background: "oklch(1 0 0 / .52)",
              backdropFilter: "blur(8px)",
              border: "1px solid oklch(.5 .12 160 / .18)",
              fontSize: 14, fontWeight: 500,
              color: "var(--foreground)",
              textDecoration: "none",
            }}
          >
            Já tenho conta
          </a>
        </div>

      </div>
    </main>
  );
}
