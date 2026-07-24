export default function LandingPage() {
  const features = [
    { emoji: "💜", title: "Maya te conhece", desc: "Ela cruza seu sono, humor e metas em tempo real" },
    { emoji: "📊", title: "Análise pessoal", desc: "Correlações que só uma IA próxima consegue ver" },
    { emoji: "🌙", title: "Sono",          desc: "Registre e entenda seus padrões de descanso" },
    { emoji: "🎯", title: "Metas",         desc: "Defina, acompanhe e conquiste com suporte" },
    { emoji: "📅", title: "Planejamento",  desc: "Semana organizada com foco no que importa" },
    { emoji: "✍️", title: "Check-in",      desc: "2 minutos por dia para se manter no rumo" },
  ];

  return (
    <main style={{
      minHeight: "100dvh",
      background: "linear-gradient(180deg, oklch(0.12 0.012 270) 0%, oklch(0.16 0.015 270) 100%)",
      fontFamily: "var(--font-sans)",
      color: "#e0d6ff",
      overflowX: "hidden",
    }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "60px 26px 88px" }}>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          {/* Maya photo */}
          <div style={{
            width: 100, height: 100, borderRadius: "50%",
            overflow: "hidden",
            margin: "0 auto 22px",
            boxShadow: "0 0 32px oklch(0.55 0.2 270 / 0.5), 0 0 64px oklch(0.55 0.2 270 / 0.25)",
            border: "2px solid rgba(167,139,250,0.4)",
          }}>
            <img src="/maya-avatar.png" alt="Maya" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>

          <h1 style={{
            margin: "0 0 14px",
            fontSize: 34, fontWeight: 800,
            letterSpacing: "-0.03em", lineHeight: 1.12,
            background: "linear-gradient(135deg, #A78BFA, #5EEAD4)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            Maya
          </h1>

          <p style={{
            margin: "0 0 6px",
            fontSize: 15.5,
            color: "#e0d6ff",
            lineHeight: 1.65, fontWeight: 500,
          }}>
            Sua IA pessoal que conecta sono, humor, hábitos,<br />
            metas e dinheiro para mostrar<br />
            o que você sozinho não enxerga.
          </p>
        </div>

        {/* ── Feature grid ──────────────────────────────────────── */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 10, marginBottom: 28,
        }}>
          {features.map(({ emoji, title, desc }) => (
            <div key={title} style={{
              background: "oklch(0.18 0.015 270 / .7)",
              backdropFilter: "blur(12px)",
              borderRadius: 18,
              padding: "18px 15px",
              border: "1px solid oklch(0.58 0.18 270 / .15)",
              boxShadow: "0 1px 3px oklch(.2 .04 270 / .05)",
            }}>
              <div style={{ fontSize: 27, lineHeight: 1, marginBottom: 9 }}>{emoji}</div>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#e0d6ff" }}>{title}</p>
              <p style={{
                margin: 0, fontSize: 11.5,
                color: "oklch(0.6 0.03 270)",
                lineHeight: 1.45,
              }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* ── Trust strip ───────────────────────────────────────── */}
        <div style={{
          display: "flex", justifyContent: "center",
          gap: 20, marginBottom: 28,
          fontSize: 12, color: "oklch(0.6 0.03 270)",
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
              background: "linear-gradient(135deg, #7C5CFF, #A78BFA)",
              color: "#fff",
              fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.01em",
              textDecoration: "none",
              boxShadow: "0 4px 18px -4px oklch(.55 .2 270 / .5)",
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
              background: "oklch(0.18 0.015 270 / .52)",
              backdropFilter: "blur(8px)",
              border: "1px solid oklch(.58 .18 270 / .2)",
              fontSize: 14, fontWeight: 500,
              color: "#e0d6ff",
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
