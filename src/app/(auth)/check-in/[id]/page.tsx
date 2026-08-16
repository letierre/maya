"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CheckIn } from "@/types";
import { invalidateFetchCache } from "@/lib/fetch-cache";
import { EditCheckInView, CheckInAnswers, defaultAnswers } from "@/components/CheckInEditor";

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

export default function EditCheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [answers, setAnswers] = useState<CheckInAnswers>(defaultAnswers);
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
      eyebrow={`Check-in de ${dateLabel}`}
    />
  );
}
