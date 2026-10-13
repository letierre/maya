import Link from "next/link";
import { MayaAvatar } from "@/components/MayaAvatar";

export const dynamic = "force-dynamic";

const P = "#7C5CFF";
const PB = "1px solid oklch(0.5 0.12 270 / .15)";

// Página de sucesso pós-pagamento (fluxo do quiz → Stripe). O usuário ainda não
// está logado aqui — a conta é criada de forma assíncrona pelo webhook, e os
// dados de acesso chegam por email. Só orienta o próximo passo.
export default function CheckoutSuccessPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
        background: "oklch(0.12 0.012 270)",
        fontFamily: "var(--font-sans)",
        color: "#e0d6ff",
      }}
    >
      <div
        style={{
          background: "oklch(0.16 0.012 270 / .85)",
          backdropFilter: "blur(12px)",
          borderRadius: 24,
          border: PB,
          padding: "36px 28px",
          width: "100%",
          maxWidth: 440,
          textAlign: "center",
        }}
      >
        <div style={{ marginBottom: 18, display: "flex", justifyContent: "center" }}>
          <MayaAvatar state="idle" size={64} />
        </div>

        <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.025em" }}>
          Pagamento confirmado 🎉
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
          Sua assinatura está ativa. Enviamos seus dados de acesso para o seu email.
        </p>

        <div
          style={{
            background: "oklch(0.5 0.12 270 / .08)",
            border: PB,
            borderRadius: 14,
            padding: "16px",
            marginBottom: 24,
            fontSize: 13,
            color: "var(--muted-foreground)",
            lineHeight: 1.6,
            textAlign: "left",
          }}
        >
          <strong style={{ color: "#e0d6ff" }}>Próximos passos:</strong>
          <ol style={{ margin: "8px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            <li>Abra seu email (olhe também no spam).</li>
            <li>Use o email e a senha enviados para entrar.</li>
            <li>Complete o onboarding para a Maya te conhecer.</li>
          </ol>
        </div>

        <Link
          href="/login"
          style={{
            display: "block",
            textAlign: "center",
            background: P,
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            padding: "14px",
            borderRadius: 13,
            textDecoration: "none",
          }}
        >
          Entrar na Maya
        </Link>
      </div>
    </div>
  );
}
