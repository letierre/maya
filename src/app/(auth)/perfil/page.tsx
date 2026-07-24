"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "@/lib/useTranslation";
import { LANG_OPTIONS } from "@/lib/i18n";
import { compressImage, uploadToCloud, photoUrl } from "@/lib/photo-storage";
import { LogoutButton } from "@/components/LogoutButton";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Porque {
  id: string;
  text: string;
  photoPath: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { id: "masculino",  label: "Masculino"        },
  { id: "feminino",   label: "Feminino"         },
  { id: "nao_dizer",  label: "Prefiro não dizer"},
] as const;

const NAV_LINKS = [
  { href: "/planejamento", label: "Planejamento",   emoji: "📅" },
  { href: "/metas",        label: "Metas",           emoji: "🎯" },
  { href: "/diario",       label: "Diário",          emoji: "📖" },
  { href: "/sono",         label: "Sono",            emoji: "😴" },
  { href: "/nutricao",     label: "Nutrição",        emoji: "🥗" },
  { href: "/financas",     label: "Finanças",        emoji: "💰" },
  { href: "/historico",    label: "Histórico",       emoji: "📊" },
  { href: "/configurações", label: "Configurações",  emoji: "⚙️" },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#1a1530",
  borderRadius: 20,
  border: "1px solid rgba(167,139,250,0.25)",
  padding: "20px 18px",
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box" as const,
  height: 44, borderRadius: 12,
  border: "1px solid rgba(167,139,250,0.25)",
  background: "#0F0F14",
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

// ── Porque Editor ──────────────────────────────────────────────────────────────

function PorqueEditor({
  pq, index, onUpdate, onRemove, uploading, onPhotoPick,
}: {
  pq: Porque; index: number;
  onUpdate: (index: number, field: string, value: string | null) => void;
  onRemove: (index: number) => void;
  uploading: boolean;
  onPhotoPick: (index: number, file: File) => void;
}) {
  const photoSrc = pq.photoPath ? photoUrl(pq.photoPath) : null;
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{
      background: "#0F0F14", borderRadius: 14,
      border: "1px solid rgba(167,139,250,0.15)",
      padding: 14, marginBottom: 10,
      display: "flex", gap: 14, alignItems: "flex-start",
    }}>
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          width: 56, height: 56, borderRadius: 14,
          background: "rgba(124,92,255,0.1)",
          border: "1px solid rgba(167,139,250,0.2)",
          overflow: "hidden", cursor: "pointer", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {photoSrc ? (
          <img src={photoSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 20 }}>📷</span>
        )}
        <input
          ref={fileRef}
          type="file" accept="image/*" capture="environment"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.[0]) onPhotoPick(index, e.target.files[0]);
            e.target.value = "";
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <input
          value={pq.text}
          onChange={(e) => onUpdate(index, "text", e.target.value)}
          placeholder="Seu porquê..."
          style={{ ...inputStyle, marginBottom: 8 }}
        />
        <button
          type="button"
          onClick={() => onRemove(index)}
          style={{
            border: 0, background: "none", cursor: "pointer",
            fontSize: 12, color: "#FF5C5C", padding: 0, fontWeight: 600,
          }}
        >
          Remover
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PerfilPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [gender, setGender] = useState("nao_dizer");
  const [language, setLanguage] = useState("pt");
  const [uploading, setUploading] = useState(false);
  const [porques, setPorques] = useState<Porque[]>([]);
  const [savingPorques, setSavingPorques] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [memberSince, setMemberSince] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.name) setName(data.name);
        if (data.email) setEmail(data.email);
        if (data.avatar_url) setAvatarUrl(data.avatar_url);
        if (data.gender) setGender(data.gender);
        if (data.language) setLanguage(data.language);
        if (data.porques?.length > 0) setPorques(data.porques);
        if (data.created_at) {
          setMemberSince(new Date(data.created_at).toLocaleDateString("pt-BR", {
            day: "numeric", month: "long", year: "numeric",
          }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setSaved(false);
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, gender, language }),
        });
        if (res.ok) setSaved(true);
      } catch { /* silent */ }
    }, 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [name, gender, language]);

  const handleAvatarPick = async (file: File) => {
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const path = await uploadToCloud(compressed, "avatars");
      const formData = new FormData();
      formData.append("avatar_path", path);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      if (res.ok) {
        setAvatarUrl(path);
        toast.success("Foto atualizada!");
      }
    } catch { toast.error("Erro ao enviar foto"); }
    setUploading(false);
  };

  const handlePorquePhoto = async (index: number, file: File) => {
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const path = await uploadToCloud(compressed, "porques");
      setPorques((prev) => prev.map((p, i) => i === index ? { ...p, photoPath: path } : p));
      setSavingPorques(true);
    } catch { toast.error("Erro ao enviar foto"); }
    setUploading(false);
  };

  useEffect(() => {
    if (!savingPorques) return;
    const timer = setTimeout(async () => {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ porques }),
      });
      setSavingPorques(false);
      toast.success("Porquê salvo!");
    }, 600);
    return () => clearTimeout(timer);
  }, [porques, savingPorques]);

  const updatePorque = (index: number, field: string, value: string | null) => {
    setPorques((prev) => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
    setSavingPorques(true);
  };

  const addPorque = () => {
    if (porques.length >= 5) return;
    setPorques((prev) => [...prev, { id: crypto.randomUUID(), text: "", photoPath: null }]);
  };

  const removePorque = (index: number) => {
    setPorques((prev) => prev.filter((_, i) => i !== index));
    setSavingPorques(true);
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
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0F0F14" }}>
        <p style={{ color: "#A78BFA", fontSize: 13 }}>Carregando…</p>
      </div>
    );
  }

  const initials = name ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "EU";
  const avatarSrc = avatarUrl ? photoUrl(avatarUrl) : null;

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0F0F14",
      fontFamily: "Inter, system-ui, sans-serif",
      color: "#e0d6ff",
      paddingBottom: 100,
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>

        {/* Header */}
        <div style={{ padding: "32px 0 24px" }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.025em", color: "#e0d6ff" }}>
            Perfil
          </h1>
          {saved && (
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#7C5CFF", fontWeight: 600 }}>Salvo ✓</p>
          )}
        </div>

        {/* Avatar + Name + Email */}
        <div style={card}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
            <div style={{ position: "relative", marginBottom: 10 }}>
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                style={{
                  width: 88, height: 88, borderRadius: "50%",
                  background: "rgba(124,92,255,0.15)",
                  overflow: "hidden", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "3px solid #7C5CFF",
                  boxShadow: "0 0 0 4px rgba(124,92,255,0.12)",
                }}
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : null}
                <span style={{ fontSize: 28, fontWeight: 700, color: "#A78BFA", position: avatarSrc ? "absolute" : "static", zIndex: 1 }}>
                  {initials}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file" accept="image/*" capture="environment"
                style={{ display: "none" }}
                onChange={(e) => { if (e.target.files?.[0]) handleAvatarPick(e.target.files[0]); e.target.value = ""; }}
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
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" style={inputStyle} />
          </div>

          {/* Gender */}
          <div style={{ marginBottom: 14 }}>
            {label11(t("pergunta_genero"))}
            <div style={{ display: "flex", gap: 8 }}>
              {GENDER_OPTIONS.map((opt) => (
                <button key={opt.id} type="button" onClick={() => setGender(opt.id)}
                  style={{
                    flex: 1, height: 40, borderRadius: 11, border: 0,
                    cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    transition: "all .15s ease",
                    background: gender === opt.id ? "#7C5CFF" : "#1e1840",
                    color: gender === opt.id ? "#fff" : "#7C5CFF",
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
                <button key={opt.id} type="button" onClick={() => setLanguage(opt.id)}
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

        {/* Navegar — access to all sections */}
        <div style={card}>
          {label11("Navegar")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                type="button"
                onClick={() => router.push(link.href)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  padding: "12px 4px", borderRadius: 14,
                  border: "1px solid rgba(167,139,250,0.15)",
                  background: "#0F0F14",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 20 }}>{link.emoji}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#9e96b5" }}>{link.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Porquês */}
        <div style={card}>
          {label11("Meus Porquês")}
          {porques.map((pq, i) => (
            <PorqueEditor key={pq.id} pq={pq} index={i}
              onUpdate={updatePorque} onRemove={removePorque}
              uploading={uploading} onPhotoPick={handlePorquePhoto}
            />
          ))}
          {porques.length < 5 && (
            <button type="button" onClick={addPorque}
              style={{
                width: "100%", padding: "12px", borderRadius: 12,
                border: "1px dashed rgba(167,139,250,0.35)", background: "transparent",
                cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                color: "#A78BFA",
              }}>
              + Adicionar porquê
            </button>
          )}
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

        {/* Logout */}
        <div style={{ marginTop: 8, marginBottom: 20 }}>
          <LogoutButton />
        </div>

      </div>
    </div>
  );
}
