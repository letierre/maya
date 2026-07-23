"use client";

export type AvatarState = "idle" | "processing" | "speaking" | "mini";

interface MayaAvatarProps {
  state?: AvatarState;
  size?: number;
  className?: string;
}

const MAYA_IMAGE = "/maya-avatar.png";

export function MayaAvatar({ state = "idle", size = 60, className = "" }: MayaAvatarProps) {
  if (state === "mini") {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          position: "relative",
          boxShadow: "0 0 10px rgba(124,92,255,0.4), 0 0 20px rgba(124,92,255,0.2)",
        }}
      >
        <img
          src={MAYA_IMAGE}
          alt="Maya"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        {/* Glow ring */}
        <div
          style={{
            position: "absolute",
            inset: -3,
            borderRadius: "50%",
            border: "1.5px solid rgba(167,139,250,0.35)",
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }

  const isProcessing = state === "processing";
  const isSpeaking = state === "speaking";

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
        boxShadow: isProcessing
          ? "0 0 24px rgba(124,92,255,0.6), 0 0 48px rgba(124,92,255,0.3)"
          : "0 0 16px rgba(124,92,255,0.4), 0 0 32px rgba(124,92,255,0.2)",
        animation:
          state === "idle"
            ? "mayaBreathe 3s ease-in-out infinite"
            : isSpeaking
            ? "mayaBreathe 1.5s ease-in-out infinite"
            : "none",
      }}
    >
      <img
        src={MAYA_IMAGE}
        alt="Maya"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* Outer glow ring */}
      <div
        style={{
          position: "absolute",
          inset: -6,
          borderRadius: "50%",
          border: `1.5px solid rgba(167,139,250,0.3)`,
          pointerEvents: "none",
          animation:
            isProcessing
              ? "mayaBreathe 1s ease-in-out infinite"
              : isSpeaking
              ? "mayaBreathe 0.8s ease-in-out infinite"
              : "mayaBreathe 3s ease-in-out infinite",
        }}
      />

      {/* Processing particles */}
      {isProcessing && <ProcessingParticles size={size} />}

      {/* Speaking waveform */}
      {isSpeaking && <WaveformOverlay size={size} />}
    </div>
  );
}

// ── Processing particles ─────────────────────────────────────────────

function ProcessingParticles({ size }: { size: number }) {
  const particles = Array.from({ length: 8 }, (_, i) => ({
    angle: (i / 8) * 360,
    delay: i * 0.12,
    color: i % 2 === 0 ? "#A78BFA" : "#5EEAD4",
  }));

  return (
    <div
      style={{
        position: "absolute",
        inset: -(size * 0.18),
        animation: "spin 3s linear infinite",
        pointerEvents: "none",
      }}
    >
      {particles.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const x = 50 + Math.cos(rad) * 48;
        const y = 50 + Math.sin(rad) * 48;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: p.color,
              opacity: 0.7,
              transform: "translate(-50%, -50%)",
              animation: `particlePulse 1.5s ease-in-out ${p.delay}s infinite`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes particlePulse {
          0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(0.8); }
          50% { opacity: 0.9; transform: translate(-50%, -50%) scale(1.4); }
        }
      `}</style>
    </div>
  );
}

// ── Waveform overlay ──────────────────────────────────────────────────

function WaveformOverlay({ size }: { size: number }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: -(size * 0.12),
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "flex-end",
        gap: 3,
        height: size * 0.25,
        pointerEvents: "none",
      }}
    >
      {[1, 0.7, 1.4, 0.5, 1.2, 0.8, 1, 0.6].map((scale, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: 12,
            borderRadius: 9999,
            background: i % 2 === 0 ? "#A78BFA" : "#5EEAD4",
            opacity: 0.6,
            animation: `waveBar 0.6s ease-in-out ${i * 0.08}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes waveBar {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1.6); }
        }
      `}</style>
    </div>
  );
}
