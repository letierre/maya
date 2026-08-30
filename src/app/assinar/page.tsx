import { Paywall } from "@/components/Paywall";

export const dynamic = "force-dynamic";

export default function AssinarPage() {
  return (
    <main style={{
      minHeight: "100dvh", background: "oklch(0.12 0.012 270)", color: "#e0d6ff",
      fontFamily: "var(--font-sans)",
    }}>
      <div style={{
        minHeight: "100dvh", boxSizing: "border-box", maxWidth: 460, margin: "0 auto",
        padding: "48px 26px 48px",
        display: "flex", flexDirection: "column", justifyContent: "center",
      }}>
        <Paywall />
      </div>
    </main>
  );
}
