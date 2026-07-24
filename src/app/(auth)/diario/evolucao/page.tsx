"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useTranslation } from "@/lib/useTranslation";
import { getLocalDate } from "@/lib/utils";
import { ArrowLeft, ChevronDown } from "lucide-react";

const QUESTIONS = [
  { key: "q1", label: "Três coisas boas que aconteceram hoje", rows: 3 },
  { key: "q2", label: "O que você fez para que elas acontecessem?", rows: 2 },
  { key: "q3", label: "Qual qualidade sua você mais usou hoje?", rows: 2 },
  { key: "q4", label: "O que faria diferente hoje?", rows: 2 },
  { key: "q5", label: "Uma gentileza que você fez ou recebeu hoje", rows: 2 },
  { key: "q6", label: "O que você se compromete a fazer amanhã?", rows: 3 },
];

function formatDisplayDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

export default function DiarioEvolucaoPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [entryDate, setEntryDate] = useState(() => getLocalDate());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const updateAnswer = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const answered = QUESTIONS.filter((q) => answers[q.key]?.trim());
    if (answered.length === 0) { toast.error("Responda pelo menos uma pergunta"); return; }
    setSaving(true);
    const content = QUESTIONS
      .filter((q) => answers[q.key]?.trim())
      .map((q) => `${q.label}\n${answers[q.key].trim()}`)
      .join("\n\n");
    const res = await fetch("/api/diary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: entryDate, title: "Diário de Evolução", content, photos: [] }),
    });
    if (!res.ok) { toast.error(t("erro_salvar_entrada")); setSaving(false); return; }
    toast.success(t("entrada_salva"));
    router.push("/diario");
    router.refresh();
  };

  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    if ("showPicker" in el && typeof el.showPicker === "function") {
      el.showPicker();
    } else {
      el.click();
    }
  };

  const answeredCount = QUESTIONS.filter((q) => answers[q.key]?.trim()).length;

  return (
    <div style={{ minHeight: "100dvh", background: "#0F0F14", paddingBottom: 100 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" onClick={() => router.back()}
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "#1a1530", border: "1px solid rgba(167,139,250,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#A78BFA",
              }}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <button type="button" onClick={openDatePicker}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: 0, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#e0d6ff" }}>{formatDisplayDate(entryDate)}</h1>
                <ChevronDown size={14} style={{ color: "#9e96b5" }} />
              </button>
              <input type="date" ref={dateInputRef} value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}
            style={{ height: 38, paddingInline: 18, borderRadius: 12, background: "#7C5CFF", border: 0, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 20 }}>🌱</span>
          <span style={{ fontSize: 13, color: "#9e96b5" }}>{answeredCount}/{QUESTIONS.length} respondidas</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {QUESTIONS.map((q) => (
            <div key={q.key}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#e0d6ff", marginBottom: 8 }}>{q.label}</label>
              <Textarea placeholder="Escreva aqui..." rows={q.rows}
                value={answers[q.key] || ""}
                onChange={(e) => updateAnswer(q.key, e.target.value)}
                style={{
                  resize: "none", borderRadius: 14, background: "#1a1530",
                  border: "1px solid rgba(167,139,250,0.2)", color: "#e0d6ff",
                  fontSize: 14, lineHeight: 1.6,
                }}
              />
            </div>
          ))}
        </div>

        <button type="button" onClick={() => router.back()}
          style={{
            width: "100%", marginTop: 24, padding: "14px 0", borderRadius: 14,
            border: "1px solid rgba(167,139,250,0.2)", background: "transparent",
            cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600,
            color: "#9e96b5",
          }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
