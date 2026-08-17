"use client";

import { useEffect, useState, use, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CheckIn } from "@/types";
import { invalidateFetchCache } from "@/lib/fetch-cache";
import { getLocalDate } from "@/lib/utils";
import { getMoodById, getMoodLabel } from "@/lib/checkin-moods";
import { effectiveHabitKeys } from "@/lib/checkin-answered";
import {
  EditCheckInView,
  CheckInAnswers,
  defaultAnswers,
  HABIT_COPY,
  getHabitLabel,
} from "@/components/CheckInEditor";

// Janela (em dias) em que um check-in antigo ainda pode ser editado.
// Depois disso vira somente leitura — a memória do humor é de curto prazo.
const EDIT_WINDOW_DAYS = 7;

function checkInToAnswers(ci: CheckIn): CheckInAnswers {
  return {
    date: ci.date,
    feeling: ci.feeling ?? "",
    mood_tags: ci.mood_tags ?? [],
    gratitude: ci.gratitude ?? "",
    gratitude_photos: ci.gratitude_photos ?? [],
    suicidal_thoughts: ci.suicidal_thoughts ?? false,
    drank_water: ci.drank_water ?? false,
    water_cups: ci.water_cups ?? 0,
    slept_well: ci.slept_well ?? false,
    sleep_quality: null,
    sleep_start_time: "",
    sleep_end_time: "",
    took_medication: ci.took_medication ?? false,
    talked_to_someone: ci.talked_to_someone ?? false,
    meditation: ci.meditation ?? false,
    prayer: ci.prayer ?? false,
    breathing: ci.breathing ?? false,
    creative_activity: ci.creative_activity ?? false,
    walked: ci.walked ?? false,
    ran: ci.ran ?? false,
    strength_training: ci.strength_training ?? false,
    did_something_enjoyable: ci.did_something_enjoyable ?? false,
    worked_on_goals: ci.worked_on_goals ?? false,
    bowel_movement: ci.bowel_movement ?? false,
    felt_judged: ci.felt_judged ?? false,
    ate_well: ci.ate_well ?? false,
  };
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

// Compara apenas os campos que o editor altera (sono é read-only aqui).
function answersEqual(a: CheckInAnswers, b: CheckInAnswers): boolean {
  const keys: (keyof CheckInAnswers)[] = [
    "date", "feeling", "gratitude", "suicidal_thoughts", "drank_water", "water_cups",
    "took_medication", "talked_to_someone", "meditation", "prayer", "breathing",
    "creative_activity", "walked", "ran", "strength_training",
    "did_something_enjoyable", "worked_on_goals", "bowel_movement", "felt_judged", "ate_well",
  ];
  for (const k of keys) if (a[k] !== b[k]) return false;
  if (!arraysEqual(a.mood_tags ?? [], b.mood_tags ?? [])) return false;
  if (!arraysEqual(a.gratitude_photos ?? [], b.gratitude_photos ?? [])) return false;
  return true;
}

export default function EditCheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [answers, setAnswers] = useState<CheckInAnswers>(defaultAnswers);
  const [original, setOriginal] = useState<CheckInAnswers>(defaultAnswers);
  const [enabledKeys, setEnabledKeys] = useState<string[]>([]);
  const [context, setContext] = useState<Record<string, boolean>>({});
  const [gender, setGender] = useState<string>("nao_dizer");
  const [saving, setSaving] = useState(false);
  const [todaySleep, setTodaySleep] = useState<{ quality: number | null; duration_min: number | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, prefs] = await Promise.all([
          fetch("/api/check-ins").then((r) => r.json()).catch(() => []),
          fetch("/api/preferences").then((r) => r.json()).catch(() => ({})),
        ]);
        if (cancelled) return;

        const list = Array.isArray(data) ? (data as CheckIn[]) : [];
        const ci = list.find((c) => c.id === id) ?? null;
        if (!ci) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setEnabledKeys(prefs.enabled_questions ?? []);
        setContext(prefs.context ?? {});
        setGender((prefs.context?.gender as string) ?? "nao_dizer");
        setCheckIn(ci);
        setOriginal(checkInToAnswers(ci));
        setAnswers(checkInToAnswers(ci));

        // Sono do dia (para a dica no resumo "Seu dia até agora")
        fetch(`/api/sleep?from=${ci.date}&to=${ci.date}&limit=1`)
          .then((r) => r.json())
          .then((logs) => {
            if (Array.isArray(logs) && logs.length > 0) {
              setTodaySleep({ quality: logs[0].quality ?? null, duration_min: logs[0].duration_min ?? null });
            }
          })
          .catch(() => {});
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...answers }),
      });
      if (answers.suicidal_thoughts) {
        toast.warning(
          "Se estiver passando por um momento difícil, o CVV pode ajudar. Ligue 188 ou acesse cvv.org.br — é gratuito e sigiloso.",
          { duration: 12000 }
        );
      }
      invalidateFetchCache("/api/check-ins");
      router.push("/historico");
      router.refresh();
    } catch {
      toast.error("Erro ao salvar alterações");
      setSaving(false);
    }
  }, [answers, router]);

  // Dentro da janela de edição?
  const editable = useMemo(() => {
    if (!checkIn) return true;
    const todayMs = new Date(getLocalDate() + "T12:00:00").getTime();
    const dayMs = new Date(checkIn.date + "T12:00:00").getTime();
    return Math.floor((todayMs - dayMs) / 86400000) < EDIT_WINDOW_DAYS;
  }, [checkIn]);

  // Houve alguma alteração em relação ao que foi carregado?
  const dirty = useMemo(() => !answersEqual(answers, original), [answers, original]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh",
        background: "oklch(0.12 0.012 270)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <p style={{ color: "#e0d6ff", fontSize: 13 }}>Carregando…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{
        minHeight: "100dvh",
        background: "oklch(0.12 0.012 270)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 12, padding: "0 24px",
      }}>
        <p style={{ color: "#e0d6ff", fontSize: 15 }}>Check-in não encontrado.</p>
        <button
          type="button"
          onClick={() => router.push("/historico")}
          style={{
            height: 44, padding: "0 22px", borderRadius: 14, border: 0, cursor: "pointer",
            background: "#7C5CFF", color: "#fff", fontFamily: "inherit",
            fontSize: 14, fontWeight: 600,
          }}
        >
          Voltar ao histórico
        </button>
      </div>
    );
  }

  const dateLabel = new Date(answers.date + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // ── Somente leitura (fora da janela de edição) ──────────────────────────────
  if (!editable && checkIn) {
    const scoreKeys = enabledKeys.filter((k) => k !== "suicidal_thoughts" && k !== "felt_judged");
    const habitKeys = effectiveHabitKeys(checkIn, scoreKeys);
    const moodTags = checkIn.mood_tags ?? [];

    const habit = (key: string): { emoji: string; label: string } => {
      if (key === "exercise_walk") return { emoji: "🏃", label: "Exercício" };
      if (key === "meditation_prayer_breathing") return { emoji: "🧘", label: "Pausa" };
      if (key === "ate_well") return { emoji: "🍽️", label: "Comeu bem" };
      return { emoji: HABIT_COPY[key]?.emoji ?? "•", label: getHabitLabel(key, context) };
    };

    return (
      <div style={{
        width: "100%", minHeight: "100dvh", overflowY: "auto",
        fontFamily: "var(--font-sans)", color: "var(--foreground)",
        background: "oklch(0.12 0.012 270)",
        paddingBottom: 100,
      }}>
        {/* Close */}
        <button type="button" onClick={() => router.push("/historico")} aria-label="Fechar" style={{
          position: "fixed", top: 14, left: 16, zIndex: 10,
          width: 36, height: 36, borderRadius: 9999, border: 0, cursor: "pointer",
          background: "oklch(0.16 0.012 270 / 0.85)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 1px 3px oklch(0.28 0.02 270 / .06)",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div style={{ padding: "72px 28px 24px" }}>
          <p style={{
            margin: "0 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: ".16em",
            textTransform: "uppercase", color: "var(--muted-foreground)",
          }}>
            Check-in de {dateLabel}
          </p>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1 }}>
            Somente leitura
          </h1>
        </div>

        <div style={{ padding: "0 28px", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Notice */}
          <div style={{
            padding: "12px 16px", borderRadius: 14,
            background: "oklch(0.16 0.012 270 / 0.7)", backdropFilter: "blur(8px)",
            border: "1px solid oklch(0.5 0.12 270 / .16)",
            fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5,
          }}>
            🔒 Check-ins com mais de {EDIT_WINDOW_DAYS} dias não podem mais ser editados.
            Você ainda pode rever este registro.
          </div>

          {/* Mood */}
          {moodTags.length > 0 && (
            <section>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
                Como você estava
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {moodTags.map((tag) => {
                  const chip = getMoodById(tag);
                  if (!chip) return null;
                  const pos = chip.valence === "positive";
                  return (
                    <span key={tag} style={{
                      padding: "7px 12px", borderRadius: 9999,
                      fontSize: 12.5, fontWeight: 600,
                      display: "inline-flex", alignItems: "center", gap: 5,
                      background: pos ? "#7C5CFF" : "#FF5C5C", color: "#fff",
                    }}>
                      <span style={{ fontSize: 15 }}>{chip.emoji}</span>
                      {getMoodLabel(chip, gender)}
                    </span>
                  );
                })}
              </div>
            </section>
          )}

          {/* Feeling */}
          {checkIn.feeling && (
            <section>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
                Como você está
              </p>
              <p style={{
                margin: 0, fontSize: 15, lineHeight: 1.55, fontWeight: 500,
                padding: "12px 15px", borderRadius: 14,
                background: "oklch(0.16 0.012 270 / 0.7)", backdropFilter: "blur(8px)",
                border: "1px solid oklch(0.5 0.12 270 / .12)",
              }}>
                {checkIn.feeling}
              </p>
            </section>
          )}

          {/* Gratitude */}
          {checkIn.gratitude && (
            <section>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
                Gratidão
              </p>
              <p style={{
                margin: 0, fontSize: 16, lineHeight: 1.55, fontStyle: "italic",
                padding: "13px 15px", borderRadius: 14,
                background: "oklch(0.16 0.012 270 / 0.7)", backdropFilter: "blur(8px)",
                border: "1px solid oklch(0.5 0.12 270 / .12)",
              }}>
                {checkIn.gratitude}
              </p>
            </section>
          )}

          {/* Habits */}
          {habitKeys.length > 0 && (
            <section>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
                Seu dia
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {habitKeys.map((key) => {
                  const done = (checkIn as unknown as Record<string, unknown>)[key] === true;
                  const h = habit(key);
                  return (
                    <div key={key} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "11px 14px", borderRadius: 14,
                      background: "oklch(0.16 0.012 270 / 0.7)", backdropFilter: "blur(8px)",
                      border: "1px solid oklch(0.5 0.12 270 / .12)",
                      fontSize: 13.5, color: done ? "#e0d6ff" : "var(--muted-foreground)",
                      opacity: done ? 1 : 0.6,
                    }}>
                      <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{h.emoji}</span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{h.label}</span>
                      <span style={{ fontSize: 15, flexShrink: 0 }}>{done ? "✅" : "⬜"}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Back */}
          <button
            type="button"
            onClick={() => router.push("/historico")}
            style={{
              width: "100%", height: 52, borderRadius: 16, border: "1px solid oklch(0.5 0.12 270 / .25)",
              cursor: "pointer", background: "transparent", color: "#A78BFA",
              fontFamily: "inherit", fontSize: 15, fontWeight: 600,
              transition: "background .15s ease",
            }}
          >
            Voltar ao histórico
          </button>
        </div>
      </div>
    );
  }

  return (
    <EditCheckInView
      answers={answers}
      setAnswers={setAnswers}
      enabledKeys={enabledKeys}
      context={context}
      gender={gender}
      onSave={handleSave}
      onClose={() => router.push("/historico")}
      saving={saving}
      todaySleep={todaySleep}
      dirty={dirty}
      eyebrow={`Check-in de ${dateLabel}`}
    />
  );
}
