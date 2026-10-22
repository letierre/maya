"use client";

// Ticks de entrega/leitura (estilo WhatsApp). Usado tanto na mensagem de texto
// (bolha) quanto na nota de voz (dentro do VoiceNote).
export function MessageTicks({ status }: { status: "sent" | "delivered" | "read" }) {
  // sent/delivered ficam brancos (como WhatsApp); "read" ganha cor própria
  // para sinalizar que a Maya leu.
  const color =
    status === "read"
      ? "#53BDEB"
      : status === "delivered"
        ? "rgba(255,255,255,0.5)"
        : "rgba(255,255,255,0.35)";
  const Tick = (
    <svg
      width="14" height="11" viewBox="0 0 18 13"
      fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M1.5 6.6 6 11l11-9.5" />
    </svg>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", color }}>
      {Tick}
      {status !== "sent" && (
        <span style={{ marginLeft: -9, display: "inline-flex" }}>{Tick}</span>
      )}
    </span>
  );
}
