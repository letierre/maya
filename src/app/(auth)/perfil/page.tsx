"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, BellOff, Shield } from "lucide-react";
import { useTranslation } from "@/lib/useTranslation";
import { LANG_OPTIONS } from "@/lib/i18n";
import { requestPushSubscription, hasPushPermission } from "@/lib/push-utils";
import { LogoutButton } from "@/components/LogoutButton";
import { AvatarCropModal } from "@/components/AvatarCropModal";
import { APP_VERSION } from "@/lib/version";

// ── Constants ─────────────────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { id: "masculino",  label: "Masculino"        },
  { id: "feminino",   label: "Feminino"         },
  { id: "nao_dizer",  label: "Prefiro não dizer"},
] as const;

// ── Styles ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "oklch(0.16 0.012 270 / 0.7)",
  borderRadius: 20,
  border: "1px solid rgba(167,139,250,0.25)",
  padding: "20px 18px",
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box" as const,
  height: 44, borderRadius: 12,
  border: "1px solid rgba(167,139,250,0.25)",
  background: "oklch(.20 .015 270 / .5)",
  padding: "0 14px", fontFamily: "inherit",
  fontSize: 14, fontWeight: 500,
  color: "#e0d6ff", outline: "none",
};

const label11 = (text: string) => (
  <p style={{
    margin: "0 0 10px", fontSize: 11, fontWeight: 700,
    letterSpacing: ".12em", textTransform: "uppercase" as const,
    color: "#A78BFA",
  }}>
    {text}
  </p>
);

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PerfilPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [gender, setGender] = useState("nao_dizer");
  const [language, setLanguage] = useState("pt");
  const [uploading, setUploading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [memberSince, setMemberSince] = useState("");
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [pushState, setPushState] = useState<"unknown" | "granted" | "denied" | "loading" | "unsupported">("unknown");
  const [isAdmin, setIsAdmin] = useState(false);

  // ── Push notifications ────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("unsupported");
      return;
    }
    if (hasPushPermission()) {
      setPushState("granted");
    } else if ("Notification" in window && Notification.permission === "denied") {
      setPushState("denied");
    }
  }, []);

  const handleEnablePush = async () => {
    setPushState("loading");
    const { sub, error } = await requestPushSubscription();
    if (!sub) {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "denied") {
        setPushState("denied");
      } else {
        setPushState("unknown");
        toast.error(error ?? "Erro ao ativar notificações");
      }
      return;
    }
    try {
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
    } catch { /* retry next visit */ }
    setPushState("granted");
    toast.success("Notificações ativadas!");
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const userEdited = useRef(false);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.name) setName(data.name);
        if (data.email) setEmail(data.email);
        // Store raw path for upload, compute display URL separately
        if (data.avatar_url) setAvatarUrl(data.avatar_url);
        if (data.gender) setGender(data.gender);
        if (data.language) setLanguage(data.language);
        if (data.created_at) {
          const d = new Date(data.created_at);
          if (!isNaN(d.getTime())) {
            setMemberSince(d.toLocaleDateString("pt-BR", {
              day: "numeric", month: "long", year: "numeric",
            }));
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Check admin
  useEffect(() => { fetch("/api/admin").then(r => { if (r.ok) setIsAdmin(true); }).catch(() => {}); }, []);

  useEffect(() => {
    if (!userEdited.current) return;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, gender, language }),
        });
        if (res.ok) toast.success("Alterações salvas");
      } catch { /* silent */ }
    }, 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [name, gender, language]);

  const handleFilePick = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCropImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (blob: Blob) => {
    setCropImage(null);
    setUploading(true);
    try {
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.avatar_url);
        toast.success("Foto atualizada!");
      } else {
        toast.error("Erro ao enviar foto");
      }
    } catch { toast.error("Erro ao enviar foto"); }
    setUploading(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { toast.error("Senhas não conferem"); return; }
    setChangingPassword(true);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    if (res.ok) {
      toast.success("Senha alterada!");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } else {
      toast.error("Erro ao alterar senha.");
    }
    setChangingPassword(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "oklch(0.12 0.012 270)" }}>
        <p style={{ color: "#A78BFA", fontSize: 13 }}>Carregando…</p>
      </div>
    );
  }

  const initials = name ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "EU";
  // API now returns signed URL — use directly
  const avatarSrc = avatarUrl || null;

  return (
    <div style={{
      minHeight: "100dvh",
      background: "oklch(0.12 0.012 270)",
      fontFamily: "var(--font-sans)",
      color: "#e0d6ff",
      paddingBottom: 100,
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>

        {/* Header */}
        <div style={{ padding: "32px 0 24px" }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.025em", color: "#e0d6ff" }}>
            Perfil
          </h1>
        </div>

        {/* Avatar + Name + Email */}
        <div style={card}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
            <div style={{ position: "relative", marginBottom: 10 }}>
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                style={{
                  width: 88, height: 88, borderRadius: "50%",
                  background: avatarSrc ? `url(${avatarSrc}) center/cover no-repeat` : "rgba(124,92,255,0.15)",
                  overflow: "hidden", cursor: uploading ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: `3px solid ${uploading ? "#A78BFA" : "#7C5CFF"}`,
                  boxShadow: uploading
                    ? "0 0 0 4px rgba(124,92,255,0.25), 0 0 20px rgba(124,92,255,0.3)"
                    : "0 0 0 4px rgba(124,92,255,0.12)",
                  position: "relative",
                  opacity: uploading ? 0.7 : 1,
                  transition: "all 0.3s ease",
                }}
              >
                {!uploading && !avatarSrc && (
                  <span style={{ fontSize: 28, fontWeight: 700, color: "#A78BFA" }}>
                    {initials}
                  </span>
                )}
                {uploading && (
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      border: "2.5px solid rgba(167,139,250,0.2)",
                      borderTopColor: "#A78BFA",
                      animation: "spin 0.8s linear infinite",
                    }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file" accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => { if (e.target.files?.[0]) handleFilePick(e.target.files[0]); e.target.value = ""; }}
              />
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#e0d6ff" }}>{name || "—"}</p>
            <p style={{ margin: 0, fontSize: 13, color: "#9e96b5" }}>{email || "—"}</p>
            {memberSince && (
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9e96b5" }}>
                Membro desde {memberSince}
              </p>
            )}
          </div>

          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            {label11("Nome")}
            <input value={name} onChange={(e) => { userEdited.current = true; setName(e.target.value); }} placeholder="Seu nome" style={inputStyle} />
          </div>

          {/* Gender */}
          <div style={{ marginBottom: 14 }}>
            {label11(t("pergunta_genero"))}
            <div style={{ display: "flex", gap: 8 }}>
              {GENDER_OPTIONS.map((opt) => (
                <button key={opt.id} type="button" onClick={() => { userEdited.current = true; setGender(opt.id); }}
                  style={{
                    flex: 1, minHeight: 40, borderRadius: 11, border: 0,
                    padding: "4px 6px",
                    cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                    transition: "all .15s ease",
                    background: gender === opt.id ? "#7C5CFF" : "#1e1840",
                    color: gender === opt.id ? "#fff" : "#7C5CFF",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    textAlign: "center", lineHeight: 1.2,
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div style={{ marginBottom: 8 }}>
            {label11("Idioma")}
            <div style={{ display: "flex", gap: 8 }}>
              {LANG_OPTIONS.map((opt) => (
                <button key={opt.id} type="button" onClick={() => { userEdited.current = true; setLanguage(opt.id); }}
                  style={{
                    flex: 1, height: 40, borderRadius: 11, border: 0,
                    cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    transition: "all .15s ease",
                    background: language === opt.id ? "#7C5CFF" : "#1e1840",
                    color: language === opt.id ? "#fff" : "#7C5CFF",
                  }}>
                  {opt.flag} {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notificações Push */}
        <div style={card}>
          {label11("Notificações")}
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "#9e96b5", lineHeight: 1.5 }}>
            Receba lembretes de sono, check-in, refeições e compromissos da sua agenda.
          </p>

          {pushState === "granted" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "rgba(124,92,255,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
              <BellRing size={18} style={{ color: "#7C5CFF", flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#e0d6ff" }}>Notificações ativas</span>
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch("/api/push/test", { method: "POST" });
                  if (!res.ok) {
                    const { error } = await res.json();
                    toast.error(error ?? "Erro ao enviar teste");
                  } else {
                    toast.success("Push de teste enviado!");
                  }
                }}
                style={{
                  padding: "6px 12px", borderRadius: 9999, border: 0, cursor: "pointer",
                  background: "#7C5CFF", color: "#fff", fontFamily: "inherit",
                  fontSize: 11, fontWeight: 600,
                }}
              >
                Testar
              </button>
            </div>
          )}

          {pushState === "unknown" && (
            <button type="button" onClick={handleEnablePush}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 14px", borderRadius: 12, border: 0, cursor: "pointer",
                background: "#7C5CFF", color: "#fff", fontFamily: "inherit",
                fontSize: 13, fontWeight: 700,
              }}>
              <BellRing size={16} /> Ativar notificações
            </button>
          )}

          {pushState === "loading" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "rgba(124,92,255,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
              <BellRing size={18} style={{ color: "#A78BFA", flexShrink: 0 }} className="animate-pulse" />
              <span style={{ fontSize: 13, color: "#A78BFA", fontWeight: 500 }}>Aguardando permissão...</span>
            </div>
          )}

          {pushState === "denied" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "rgba(255,92,92,0.06)", border: "1px solid rgba(255,92,92,0.2)" }}>
              <BellOff size={18} style={{ color: "#FF5C5C", flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12, color: "#FF5C5C", fontWeight: 500, lineHeight: 1.4 }}>
                Notificações bloqueadas. Vá nas configurações do navegador para liberar.
              </span>
            </div>
          )}

          {pushState === "unsupported" && null}
        </div>

        {/* Configurações */}
        <div style={card}>
          <button type="button" onClick={() => router.push("/configurações")}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "transparent", border: 0, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
            <span style={{ fontSize: 20 }}>⚙️</span>
            <div style={{ flex: 1, textAlign: "left" }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#e0d6ff" }}>Configurações</span>
              <span style={{ display: "block", fontSize: 11, color: "#9e96b5", marginTop: 1 }}>Perguntas do check-in</span>
            </div>
            <span style={{ color: "#9e96b5", fontSize: 18 }}>›</span>
          </button>
        </div>

        {/* Password */}
        <div style={card}>
          {label11("Alterar senha")}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type={showPassword ? "text" : "password"} value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Senha atual" style={inputStyle} />
            <input type={showPassword ? "text" : "password"} value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nova senha" style={inputStyle} />
            <input type={showPassword ? "text" : "password"} value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar nova senha" style={inputStyle} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#9e96b5", cursor: "pointer" }}>
              <input type="checkbox" checked={showPassword} onChange={() => setShowPassword(!showPassword)} />
              Mostrar senha
            </label>
            <button type="button" onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword}
              style={{
                width: "100%", height: 44, borderRadius: 12, border: 0,
                cursor: (changingPassword || !currentPassword || !newPassword) ? "not-allowed" : "pointer",
                fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                background: (changingPassword || !currentPassword || !newPassword) ? "#1e1840" : "#7C5CFF",
                color: (changingPassword || !currentPassword || !newPassword) ? "#9e96b5" : "#fff",
              }}>
              {changingPassword ? "Alterando…" : "Alterar senha"}
            </button>
          </div>
        </div>

        {/* Admin */}
        {isAdmin && (
          <div style={{ marginTop: 16 }}>
            <button type="button" onClick={() => router.push("/admin")}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(255,77,77,0.3)", background: "rgba(255,77,77,0.08)", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit" }}>
              <Shield size={18} style={{ color: "#FF4D4D" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#FF4D4D" }}>Painel Admin</span>
            </button>
          </div>
        )}

        {/* Logout */}
        <div style={{ marginTop: 8, marginBottom: 20 }}>
          <LogoutButton />
        </div>

        {/* Versão do app */}
        <p style={{ margin: "0 0 24px", textAlign: "center", fontSize: 11, color: "#6a657a" }}>
          Maya · v{APP_VERSION}
        </p>

      </div>

      {/* Crop modal */}
      {cropImage && (
        <AvatarCropModal
          image={cropImage}
          onCrop={handleCropComplete}
          onClose={() => setCropImage(null)}
        />
      )}
    </div>
  );
}
