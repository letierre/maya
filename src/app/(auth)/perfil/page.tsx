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

const P   = "oklch(.5 .12 160)";
const PL  = "oklch(.5 .12 160 / .12)";
const PB  = "1px solid oklch(.5 .12 160 / .15)";

const GENDER_OPTIONS = [
  { id: "masculino",  label: "Masculino"        },
  { id: "feminino",   label: "Feminino"         },
  { id: "nao_dizer",  label: "Prefiro não dizer"},
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

const label11 = (text: string) => (
  <p style={{
    margin: "0 0 10px", fontSize: 11, fontWeight: 700,
    letterSpacing: ".12em", textTransform: "uppercase" as const,
    color: "var(--muted-foreground)",
  }}>
    {text}
  </p>
);

const card: React.CSSProperties = {
  background: "oklch(1 0 0 / .55)",
  backdropFilter: "blur(12px)",
  borderRadius: 20,
  border: PB,
  padding: "20px 18px",
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box" as const,
  height: 44, borderRadius: 12, border: PB,
  background: "oklch(.97 .005 160)",
  padding: "0 14px", fontFamily: "inherit",
  fontSize: 14, fontWeight: 500,
  color: "var(--foreground)", outline: "none",
};

// ── PorqueEditor ──────────────────────────────────────────────────────────────

function PorqueEditor({
  porque, onUpdate, onRemove, onPhoto,
}: {
  porque: Porque;
  onUpdate: (d: Partial<Omit<Porque, "id">>) => void;
  onRemove: () => void;
  onPhoto: (f: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const photoSrc = porque.photoPath ? photoUrl(porque.photoPath) : null;

  return (
    <div style={{
      display: "flex", gap: 12,
      padding: "12px 14px", borderRadius: 14,
      background: "oklch(.5 .12 160 / .06)",
      border: "1px solid oklch(.5 .12 160 / .1)",
    }}>
      {/* Photo thumb */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        style={{
          width: 52, height: 52, borderRadius: 12,
          flexShrink: 0, border: PB, overflow: "hidden",
          background: "oklch(.92 .01 160)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}
      >
        {photoSrc
          ? <img src={photoSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 18 }}>📷</span>
        }
        <input
          ref={fileRef} type="file" accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files?.[0]) onPhoto(e.target.files[0]); e.target.value = ""; }}
        />
      </button>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <textarea
          value={porque.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          placeholder="Ex: Minha filha, minha saúde, meus sonhos…"
          rows={2}
          style={{
            width: "100%", boxSizing: "border-box" as const,
            resize: "none", border: "none", outline: "none",
            background: "transparent", fontFamily: "inherit",
            fontSize: 13.5, lineHeight: 1.55,
            color: "var(--foreground)",
          }}
        />
        <button
          type="button"
          onClick={onRemove}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: 11,
            color: "var(--muted-foreground)", padding: 0,
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
  const { t, setLang } = useTranslation();

  const [loading, setLoading]   = useState(true);
  const [saved, setSaved]       = useState(false);
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [gender, setGender]     = useState("nao_dizer");
  const [language, setLanguage] = useState("pt");
  const [uploading, setUploading] = useState(false);
  const [porques, setPorques]   = useState<Porque[]>([]);
  const [savingPorques, setSavingPorques] = useState(false);

  const [currentPassword,  setCurrentPassword]  = useState("");
  const [newPassword,      setNewPassword]      = useState("");
  const [confirmPassword,  setConfirmPassword]  = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword,     setShowPassword]     = useState(false);

  const isFirstRender = useRef(true);
  const autoSaveRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fileInputRef  = useRef<HTMLInputElement>(null);

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setName(data.name || "");
        setEmail(data.email || "");
        setAvatarUrl(data.avatar_url || "");
        setGender(data.gender || "nao_dizer");
        setLanguage(data.language || "pt");
        setPorques(data.porques || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Auto-save name / gender / language ──────────────────────────────────────

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
        if (res.ok) {
          setSaved(true);
          setLang(language as "pt" | "es" | "en");
          try {
            const prev = JSON.parse(localStorage.getItem("user_profile") || "{}");
            localStorage.setItem("user_profile", JSON.stringify({ ...prev, name }));
          } catch { /* noop */ }
        }
      } catch { /* silent */ }
    }, 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [name, gender, language]);

  // ── Avatar upload ────────────────────────────────────────────────────────────

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Foto deve ter no máximo 2MB"); return; }
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const finalUrl = data.avatar_url + "?t=" + Date.now();
      setAvatarUrl(finalUrl);
      try {
        const prev = JSON.parse(localStorage.getItem("user_profile") || "{}");
        localStorage.setItem("user_profile", JSON.stringify({ ...prev, avatar_url: finalUrl }));
      } catch { /* noop */ }
      toast.success("Foto atualizada!");
    } catch { toast.error("Erro ao enviar foto"); }
    setUploading(false);
  };

  // ── Password ─────────────────────────────────────────────────────────────────

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos"); return;
    }
    if (newPassword !== confirmPassword) { toast.error("As senhas não coincidem"); return; }
    if (newPassword.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Erro ao alterar senha"); }
      else {
        toast.success("Senha alterada!");
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        setShowPassword(false);
      }
    } catch { toast.error("Erro ao alterar senha"); }
    setChangingPassword(false);
  };

  // ── Porquês ──────────────────────────────────────────────────────────────────

  const savePorques = async (updated: Porque[]) => {
    setPorques(updated);
    setSavingPorques(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ porques: updated }),
      });
    } catch { /* silent */ }
    setSavingPorques(false);
  };

  const addPorque    = () => savePorques([...porques, { id: Math.random().toString(36).slice(2), text: "", photoPath: null }]);
  const updatePorque = (id: string, data: Partial<Omit<Porque, "id">>) => savePorques(porques.map((p) => p.id === id ? { ...p, ...data } : p));
  const removePorque = (id: string) => savePorques(porques.filter((p) => p.id !== id));
  const handlePorquePhoto = async (id: string, file: File) => {
    try {
      const compressed = await compressImage(file);
      const path = await uploadToCloud(compressed, "meals");
      updatePorque(id, { photoPath: path });
    } catch { toast.error("Erro ao processar imagem"); }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "oklch(.98 .005 160)",
      }}>
        <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Carregando…</p>
      </div>
    );
  }

  const initials = name ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "EU";

  return (
    <div style={{
      minHeight: "100dvh",
      background: `radial-gradient(ellipse 80% 50% at 50% 0%, oklch(.95 .04 80 / .4) 0%, transparent 60%),
                   linear-gradient(180deg, oklch(.985 .004 160) 0%, oklch(.94 .022 160) 100%)`,
      fontFamily: "var(--font-sans)",
      color: "var(--foreground)",
      paddingBottom: 100,
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "56px 0 24px",
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.025em" }}>
              Meu Perfil
            </h1>
            {saved && (
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: P, fontWeight: 600 }}>
                Salvo ✓
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push("/configurações")}
            style={{
              height: 36, padding: "0 14px", borderRadius: 10,
              border: PB, background: "oklch(1 0 0 / .55)",
              backdropFilter: "blur(8px)", cursor: "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: 600,
              color: "var(--foreground)", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            ⚙️ {t("config_title")}
          </button>
        </div>

        {/* ── Avatar + Nome + Email ────────────────────────────────── */}
        <div style={card}>
          {/* Avatar */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
            <div style={{ position: "relative", marginBottom: 10 }}>
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                style={{
                  width: 88, height: 88, borderRadius: "50%",
                  background: avatarUrl ? "transparent" : P,
                  overflow: "hidden", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: `3px solid ${P}`,
                  boxShadow: `0 0 0 4px oklch(.5 .12 160 / .12)`,
                }}
              >
                {avatarUrl
                  ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 28, color: "#fff", fontWeight: 700 }}>{initials}</span>
                }
                {uploading && (
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    background: "oklch(.1 .02 160 / .5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 20 }}>⏳</span>
                  </div>
                )}
              </div>
              {/* Camera badge */}
              <div style={{
                position: "absolute", bottom: 0, right: 0,
                width: 26, height: 26, borderRadius: "50%",
                background: P, border: "2px solid oklch(.985 .004 160)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, cursor: "pointer",
              }}
                onClick={() => !uploading && fileInputRef.current?.click()}
              >
                📷
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--muted-foreground)" }}>
              Toque para trocar a foto
            </p>
            <input
              ref={fileInputRef} type="file" accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            {label11("Nome")}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              style={inputStyle}
            />
          </div>

          {/* Email */}
          <div>
            {label11("Email")}
            <input
              type="email"
              value={email}
              disabled
              style={{ ...inputStyle, opacity: 0.5, cursor: "not-allowed" }}
            />
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--muted-foreground)" }}>
              O email não pode ser alterado
            </p>
          </div>
        </div>

        {/* ── Gênero ──────────────────────────────────────────────── */}
        <div style={card}>
          {label11(t("pergunta_genero"))}
          <div style={{ display: "flex", gap: 8 }}>
            {GENDER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setGender(opt.id)}
                style={{
                  flex: 1, height: 42, borderRadius: 12, border: 0,
                  cursor: "pointer", fontFamily: "inherit",
                  fontSize: 12, fontWeight: 600,
                  transition: "all .15s ease",
                  background: gender === opt.id ? P : PL,
                  color: gender === opt.id ? "#fff" : "var(--foreground)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Idioma ──────────────────────────────────────────────── */}
        <div style={card}>
          {label11("Idioma / Language")}
          <div style={{ display: "flex", gap: 8 }}>
            {LANG_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLanguage(opt.id)}
                style={{
                  flex: 1, height: 42, borderRadius: 12, border: 0,
                  cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: 600,
                  transition: "all .15s ease",
                  background: language === opt.id ? P : PL,
                  color: language === opt.id ? "#fff" : "var(--foreground)",
                }}
              >
                {opt.flag} {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Meus Porquês ────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              {label11("❤️ Meus Porquês")}
              <p style={{ margin: "-6px 0 0", fontSize: 12.5, color: "var(--muted-foreground)" }}>
                O que te move? Pessoas, valores, sonhos…
              </p>
            </div>
            {porques.length < 5 && (
              <button
                type="button"
                onClick={addPorque}
                style={{
                  height: 34, padding: "0 12px", borderRadius: 10,
                  border: PB, background: PL,
                  cursor: "pointer", fontFamily: "inherit",
                  fontSize: 12, fontWeight: 700, color: P,
                  flexShrink: 0,
                }}
              >
                + Novo
              </button>
            )}
          </div>

          {porques.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "20px 0",
              color: "var(--muted-foreground)", fontSize: 13,
            }}>
              <p style={{ margin: "0 0 4px", fontSize: 22 }}>💭</p>
              <p style={{ margin: 0 }}>Adicione o que te motiva a cuidar de você.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {porques.map((pq) => (
                <PorqueEditor
                  key={pq.id}
                  porque={pq}
                  onUpdate={(data) => updatePorque(pq.id, data)}
                  onRemove={() => removePorque(pq.id)}
                  onPhoto={(file) => handlePorquePhoto(pq.id, file)}
                />
              ))}
            </div>
          )}

          {savingPorques && (
            <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--muted-foreground)", textAlign: "right" }}>
              Salvando…
            </p>
          )}
        </div>

        {/* ── Trocar senha ────────────────────────────────────────── */}
        <div style={card}>
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "center",
              justifyContent: "space-between", background: "none",
              border: "none", cursor: "pointer", fontFamily: "inherit",
              padding: 0,
            }}
          >
            {label11("🔒 Trocar senha")}
            <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: -10 }}>
              {showPassword ? "▲ Fechar" : "▼ Abrir"}
            </span>
          </button>

          {showPassword && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
              {[
                { label: "Senha atual",          val: currentPassword,  set: setCurrentPassword },
                { label: "Nova senha",            val: newPassword,      set: setNewPassword },
                { label: "Confirmar nova senha",  val: confirmPassword,  set: setConfirmPassword },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>
                    {label}
                  </p>
                  <input
                    type="password"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={changingPassword}
                style={{
                  width: "100%", height: 46, borderRadius: 13, border: 0,
                  background: changingPassword ? "oklch(.88 .02 160)" : P,
                  color: changingPassword ? "oklch(.6 .04 160)" : "#fff",
                  fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                  cursor: changingPassword ? "not-allowed" : "pointer",
                  transition: "all .2s ease",
                }}
              >
                {changingPassword ? "Alterando…" : "Alterar senha"}
              </button>
            </div>
          )}
        </div>

        {/* ── Sair ────────────────────────────────────────────────── */}
        <div style={{
          ...card,
          display: "flex", justifyContent: "center",
          background: "oklch(1 0 0 / .4)",
        }}>
          <LogoutButton />
        </div>

      </div>
    </div>
  );
}
