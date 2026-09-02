"use client";

import { useEffect, useState } from "react";
import { Download, Share, X, Smartphone, SquareArrowUp } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CARD: React.CSSProperties = {
  background: "oklch(0.16 0.012 270 / 0.7)",
  borderRadius: 20,
  border: "1px solid rgba(167,139,250,0.25)",
  padding: "20px 18px",
  marginBottom: 12,
};

const LABEL: React.CSSProperties = {
  margin: "0 0 10px", fontSize: 11, fontWeight: 700,
  letterSpacing: ".12em", textTransform: "uppercase", color: "#A78BFA",
};

const DESC: React.CSSProperties = {
  margin: "0 0 14px", fontSize: 12, color: "#9e96b5", lineHeight: 1.5,
};

const BTN: React.CSSProperties = {
  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  padding: "12px 14px", borderRadius: 12, border: 0, cursor: "pointer",
  background: "#7C5CFF", color: "#fff", fontFamily: "inherit",
  fontSize: 13, fontWeight: 700,
};

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function Step({ n, title, desc, icon }: { n: number; title: string; desc: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        background: "rgba(124,92,255,0.15)", color: "#A78BFA",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 800,
      }}>
        {n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "#e0d6ff", display: "flex", alignItems: "center", gap: 6 }}>
          {icon}{title}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: "#9e96b5", lineHeight: 1.5 }}>{desc}</p>
      </div>
    </div>
  );
}

function IosGuide({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 95,
        borderRadius: "24px 24px 0 0", background: "#151520",
        padding: "20px 20px calc(env(safe-area-inset-bottom) + 28px)",
        border: "1px solid rgba(167,139,250,0.15)",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
        maxHeight: "90dvh", overflowY: "auto",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 9999, background: "rgba(167,139,250,0.2)", margin: "0 auto 16px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e0d6ff" }}>Instalar a Maya</h3>
          <button type="button" onClick={onClose} style={{ border: 0, background: "#0B0B10", borderRadius: 10, padding: 8, cursor: "pointer" }}>
            <X size={18} style={{ color: "#9e96b5" }} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, background: "#1a1530", border: "1px solid rgba(167,139,250,0.15)", marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(124,92,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Smartphone size={22} style={{ color: "#7C5CFF" }} />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#e0d6ff", lineHeight: 1.5 }}>
            O iPhone não permite instalar por botão. É rápido — siga 3 passos:
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Step n={1} icon={<SquareArrowUp size={15} style={{ color: "#A78BFA" }} />} title="Toque em Compartilhar" desc="O quadrado com a seta pra cima, na barra do Safari." />
          <Step n={2} title="Escolha “Adicionar à Tela de Início”" desc="Role o menu para baixo até encontrar essa opção." />
          <Step n={3} title="Toque em Adicionar" desc="Pronto! A Maya aparece como um app na sua tela de início." />
        </div>
      </div>
    </>
  );
}

export function InstallAppCard() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return; }
    setIos(isIOS());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setDeferred(null);
    } catch {
      /* usuário fechou o prompt */
    }
  };

  if (installed) return null;

  // iOS: sem API de instalação programática → mostra o guia.
  if (ios) {
    return (
      <>
        <div style={CARD}>
          <p style={LABEL}>Instalar app</p>
          <p style={DESC}>Tenha a Maya na tela de início do seu iPhone, como um app.</p>
          <button type="button" onClick={() => setShowGuide(true)} style={BTN}>
            <Share size={16} /> Como instalar
          </button>
        </div>
        {showGuide && <IosGuide onClose={() => setShowGuide(false)} />}
      </>
    );
  }

  // Android / Chrome desktop: instalação em um clique.
  if (deferred) {
    return (
      <div style={CARD}>
        <p style={LABEL}>Instalar app</p>
        <p style={DESC}>Adicione a Maya à tela de início em um toque.</p>
        <button type="button" onClick={handleInstall} style={BTN}>
          <Download size={16} /> Instalar app
        </button>
      </div>
    );
  }

  return null;
}
