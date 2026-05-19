"use client";

import { useEffect, useState, useCallback } from "react";
import { Moon, Zap, Clock, TrendingUp, BellRing, BellOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  computeSleepStats,
  sleepScore,
  formatDuration,
  sleepCycleTimes,
  DURATION_CHIPS,
} from "@/lib/sleep-utils";
import { requestPushSubscription, hasPushPermission } from "@/lib/push-utils";
import type { SleepLog, SleepStats } from "@/types";
import { getLocalDate } from "@/lib/utils";

interface SleepConfig {
  bedtime: string;
  wake_time: string;
  target_hours: number;
  reminder_time: string;
}

const DEFAULT_CONFIG: SleepConfig = {
  bedtime: "23:00",
  wake_time: "07:00",
  target_hours: 8,
  reminder_time: "22:30",
};

// ── Color helpers (app identity: hue 160 = verde primário) ────────────────────

const P = "oklch(.5 .12 160)";   // primary green
const PL = "oklch(.5 .12 160 / .15)";
const PB = "1px solid oklch(.6 .08 160 / .25)";

const QUALITY_EMOJI = ["", "😩", "😕", "😐", "🙂", "😊"];
const QUALITY_LABEL = ["", "Péssimo", "Ruim", "Ok", "Bom", "Ótimo"];

function qualityColor(q: number | null): string {
  if (!q) return "var(--muted-foreground)";
  if (q <= 2) return "oklch(.5 .15 15)";
  if (q === 3) return "oklch(.55 .12 60)";
  return "oklch(.45 .15 160)";
}

function scoreColor(s: number): string {
  if (s >= 70) return "oklch(.45 .15 160)";
  if (s >= 45) return "oklch(.55 .12 60)";
  return "oklch(.5 .15 15)";
}

function fmt12(ts: string | null): string {
  if (!ts) return "--";
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ── Push helpers ──────────────────────────────────────────────────────────────

type PushState = "unknown" | "granted" | "denied" | "loading" | "unsupported";

type PushResult = "granted" | "denied" | "error";

async function subscribeToPush(): Promise<{ result: PushResult; errorMsg?: string }> {
  const { sub, error } = await requestPushSubscription();
  if (!sub) {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "denied") {
      return { result: "denied" };
    }
    return { result: "error", errorMsg: error ?? undefined };
  }
  try {
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub),
    });
  } catch { /* retry on next visit */ }
  return { result: "granted" };
}

// ── Input style shared ────────────────────────────────────────────────────────

// O wrapper carrega a borda e o radius — o input fica transparente e sem borda.
// Isso evita que o input[type="time"] (com largura mínima nativa no mobile)
// apareça cortado: o wrapper faz o clip mas a borda visual é dele, não do input.
const timeInputWrap: React.CSSProperties = {
  overflow: "hidden",
  minWidth: 0,
  borderRadius: 10,
  border: "1px solid oklch(.7 .04 160 / .3)",
  background: "oklch(.97 .005 160)",
};

const timeInputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  minWidth: 0,
  display: "block",
  padding: "9px 10px",
  border: "none",
  borderRadius: 0,
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 600,
  background: "transparent",
  color: "var(--foreground)",
  outline: "none",
};

// ── Manual log modal ──────────────────────────────────────────────────────────

function ManualLogModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [quality, setQuality] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [interruptions, setInterruptions] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!quality) return;
    setSaving(true);
    await fetch("/api/sleep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: getLocalDate(), quality, duration_min: durationMin, interruptions, source: "checkin" }),
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  const label11 = (text: string) => (
    <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
      {text}
    </p>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "oklch(.1 .02 160 / .45)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", boxSizing: "border-box",
        borderRadius: "24px 24px 0 0",
        background: "oklch(.99 .003 160)",
        padding: "24px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 32px oklch(.2 .04 160 / .1)",
        overflow: "hidden",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 9999, background: "oklch(.85 .02 160)", margin: "0 auto 20px" }} />
        <h2 style={{ margin: "0 0 20px", fontSize: 19, fontWeight: 700 }}>Registrar sono</h2>

        {label11("Como foi?")}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map((q) => (
            <button key={q} type="button" onClick={() => setQuality(q)} style={{
              flex: 1, padding: "10px 2px", borderRadius: 12, border: 0, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              background: quality === q ? PL : "oklch(.95 .005 160)",
              outline: quality === q ? `2px solid ${P}` : "none",
              transition: "all .15s ease",
            }}>
              <span style={{ fontSize: 26 }}>{QUALITY_EMOJI[q]}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: quality === q ? "oklch(.35 .1 160)" : "var(--muted-foreground)" }}>
                {QUALITY_LABEL[q]}
              </span>
            </button>
          ))}
        </div>

        {label11("Acordou durante a noite?")}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[0, 1, 2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => setInterruptions(n)} style={{
              flex: 1, padding: "10px 4px", borderRadius: 12, border: 0, cursor: "pointer",
              background: interruptions === n ? P : "oklch(.95 .005 160)",
              fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              color: interruptions === n ? "#fff" : "oklch(.4 .06 160)",
              transition: "all .15s ease",
            }}>
              {n === 4 ? "4+" : n === 0 ? "Não" : `${n}×`}
            </button>
          ))}
        </div>

        {label11("Quanto dormiu?")}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 24 }}>
          {DURATION_CHIPS.map(({ label, value }) => (
            <button key={value} type="button" onClick={() => setDurationMin(durationMin === value ? null : value)} style={{
              padding: "8px 14px", borderRadius: 9999, cursor: "pointer",
              border: durationMin === value ? "none" : `1px solid oklch(.7 .04 160 / .4)`,
              background: durationMin === value ? P : "oklch(.95 .005 160)",
              fontFamily: "inherit", fontSize: 13, fontWeight: 600,
              color: durationMin === value ? "#fff" : "oklch(.4 .06 160)",
              transition: "all .15s ease",
            }}>{label}</button>
          ))}
        </div>

        <button type="button" onClick={save} disabled={!quality || saving} style={{
          width: "100%", height: 50, borderRadius: 14, border: 0,
          cursor: !quality ? "not-allowed" : "pointer",
          background: quality ? P : "oklch(.88 .02 160)",
          color: quality ? "#fff" : "oklch(.6 .04 160)",
          fontFamily: "inherit", fontSize: 15, fontWeight: 700,
          opacity: saving ? 0.7 : 1, transition: "all .2s ease",
        }}>{saving ? "Salvando…" : "Salvar"}</button>
      </div>
    </div>
  );
}

// ── Sleep edit modal ──────────────────────────────────────────────────────────

function toSPTime(ts: string | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const sp = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return `${String(sp.getUTCHours()).padStart(2, "0")}:${String(sp.getUTCMinutes()).padStart(2, "0")}`;
}

function EditSleepModal({ log, onClose, onSaved }: {
  log: SleepLog;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [startTime, setStartTime] = useState(toSPTime(log.sleep_start));
  const [endTime, setEndTime] = useState(toSPTime(log.sleep_end));
  const [quality, setQuality] = useState<number | null>(log.quality ?? null);
  const [interruptions, setInterruptions] = useState<number>(log.interruptions ?? 0);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const sleepStart = startTime ? `${log.date}T${startTime}:00-03:00` : null;
    let sleepEnd: string | null = null;
    let durationMin: number | null = null;

    if (startTime && endTime) {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      const crossMidnight = endMin <= startMin;
      const endDate = crossMidnight
        ? new Date(new Date(log.date + "T12:00:00").getTime() + 86400000).toISOString().split("T")[0]
        : log.date;
      sleepEnd = `${endDate}T${endTime}:00-03:00`;
      durationMin = crossMidnight ? (24 * 60 - startMin) + endMin : endMin - startMin;
    }

    await fetch("/api/sleep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: log.date,
        source: log.source,
        sleep_start: sleepStart,
        sleep_end: sleepEnd,
        duration_min: durationMin,
        quality: quality ?? log.quality,
        interruptions,
      }),
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  const dayLabel = new Date(log.date + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });

  const label11 = (text: string) => (
    <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
      {text}
    </p>
  );

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "oklch(.1 .02 160 / .45)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "flex-end",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", boxSizing: "border-box",
        borderRadius: "24px 24px 0 0",
        background: "oklch(.99 .003 160)",
        padding: "24px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 32px oklch(.2 .04 160 / .1)",
        overflow: "hidden",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 9999, background: "oklch(.85 .02 160)", margin: "0 auto 16px" }} />
        <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>Editar sono</h2>
        <p style={{ margin: "0 0 20px", fontSize: 12, color: "var(--muted-foreground)", textTransform: "capitalize" }}>{dayLabel}</p>

        {/* Times */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
          <div style={timeInputWrap}>
            {label11("Dormiu às")}
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={timeInputStyle} />
          </div>
          <div style={timeInputWrap}>
            {label11("Acordou às")}
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={timeInputStyle} />
          </div>
        </div>

        {/* Interruptions */}
        {label11("Acordou durante a noite?")}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[0, 1, 2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => setInterruptions(n)} style={{
              flex: 1, padding: "10px 4px", borderRadius: 12, border: 0, cursor: "pointer",
              background: interruptions === n ? P : "oklch(.95 .005 160)",
              fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              color: interruptions === n ? "#fff" : "oklch(.4 .06 160)",
              transition: "all .15s ease",
            }}>
              {n === 4 ? "4+" : n === 0 ? "Não" : `${n}×`}
            </button>
          ))}
        </div>

        {/* Quality */}
        {label11("Qualidade")}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[1, 2, 3, 4, 5].map((q) => (
            <button key={q} type="button" onClick={() => setQuality(q)} style={{
              flex: 1, padding: "10px 2px", borderRadius: 12, border: 0, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              background: quality === q ? PL : "oklch(.95 .005 160)",
              outline: quality === q ? `2px solid ${P}` : "none",
              transition: "all .15s ease",
            }}>
              <span style={{ fontSize: 22 }}>{QUALITY_EMOJI[q]}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: quality === q ? "oklch(.35 .1 160)" : "var(--muted-foreground)" }}>
                {QUALITY_LABEL[q]}
              </span>
            </button>
          ))}
        </div>

        <button type="button" onClick={save} disabled={saving} style={{
          width: "100%", height: 50, borderRadius: 14, border: 0,
          cursor: saving ? "not-allowed" : "pointer",
          background: P, color: "#fff",
          fontFamily: "inherit", fontSize: 15, fontWeight: 700,
          opacity: saving ? 0.7 : 1, transition: "opacity .15s ease",
        }}>{saving ? "Salvando…" : "Salvar alterações"}</button>
      </div>
    </div>
  );
}

// ── History row ───────────────────────────────────────────────────────────────

function SleepHistoryRow({ log, onEdit }: { log: SleepLog; onEdit: (log: SleepLog) => void }) {
  const score = sleepScore(log);
  const dayLabel = new Date(log.date + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "short", day: "numeric", month: "short",
  });

  return (
    <div
      onClick={() => onEdit(log)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 0", borderBottom: "1px solid oklch(.88 .02 160 / .5)",
        cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 22, flexShrink: 0 }}>
        {log.quality ? QUALITY_EMOJI[log.quality] : "😴"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{dayLabel}</p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted-foreground)" }}>
          {log.duration_min ? formatDuration(log.duration_min) : "--"}
          {log.sleep_start && log.sleep_end ? ` · ${fmt12(log.sleep_start)}–${fmt12(log.sleep_end)}` : ""}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ minWidth: 38, textAlign: "right", fontSize: 15, fontWeight: 700, color: scoreColor(score) }}>
          {score}
        </div>
        <span style={{ fontSize: 11, color: "oklch(.65 .04 160)" }}>✏️</span>
      </div>
    </div>
  );
}

// ── Sleep config card ─────────────────────────────────────────────────────────

function SleepConfigCard({ config, onChange, onSave, saving }: {
  config: SleepConfig;
  onChange: (c: SleepConfig) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const TARGET_OPTIONS = [6, 7, 7.5, 8, 8.5, 9];

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-4">
        <p className="text-sm font-semibold">⚙️ Minhas configurações de sono</p>

        {/* Bedtime + Wake — stacked, overflow-hidden prevents time input bleed */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={timeInputWrap}>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
              Horário de dormir
            </p>
            <input
              type="time"
              value={config.bedtime}
              onChange={(e) => onChange({ ...config, bedtime: e.target.value })}
              style={timeInputStyle}
            />
          </div>
          <div style={timeInputWrap}>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
              Horário de acordar
            </p>
            <input
              type="time"
              value={config.wake_time}
              onChange={(e) => onChange({ ...config, wake_time: e.target.value })}
              style={timeInputStyle}
            />
          </div>
        </div>

        {/* Target hours */}
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
            Meta de sono
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TARGET_OPTIONS.map((h) => (
              <button key={h} type="button" onClick={() => onChange({ ...config, target_hours: h })} style={{
                padding: "7px 13px", borderRadius: 9999, cursor: "pointer",
                border: config.target_hours === h ? "none" : "1px solid oklch(.7 .04 160 / .35)",
                background: config.target_hours === h ? P : "oklch(.96 .005 160)",
                fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                color: config.target_hours === h ? "#fff" : "oklch(.4 .06 160)",
                transition: "all .15s ease",
              }}>
                {h % 1 === 0 ? `${h}h` : `${h}h`}
              </button>
            ))}
          </div>
        </div>

        {/* Reminder time */}
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
            Lembrete noturno
          </p>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted-foreground)" }}>
            Notificação push antes de dormir (requer notificações ativas)
          </p>
          <div style={timeInputWrap}>
            <input
              type="time"
              value={config.reminder_time}
              onChange={(e) => onChange({ ...config, reminder_time: e.target.value })}
              style={timeInputStyle}
            />
          </div>
        </div>

        <button type="button" onClick={onSave} disabled={saving} style={{
          width: "100%", height: 44, borderRadius: 12, border: 0,
          cursor: saving ? "not-allowed" : "pointer",
          background: P, color: "#fff",
          fontFamily: "inherit", fontSize: 14, fontWeight: 700,
          opacity: saving ? 0.7 : 1, transition: "opacity .15s ease",
        }}>
          {saving ? "Salvando…" : "Salvar configurações"}
        </button>
      </CardContent>
    </Card>
  );
}

// ── Cycle calculator ──────────────────────────────────────────────────────────

function CycleCalculator({ defaultBedtime = "23:00" }: { defaultBedtime?: string }) {
  const [bedtime, setBedtime] = useState(defaultBedtime);
  const [synced, setSynced] = useState(defaultBedtime);

  if (defaultBedtime !== synced) {
    setSynced(defaultBedtime);
    setBedtime(defaultBedtime);
  }

  const idealWakes = (() => {
    const [h, m] = bedtime.split(":").map(Number);
    const start = new Date();
    start.setHours(h, m, 0, 0);
    return sleepCycleTimes(start, [5, 6]);
  })();

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="size-4" style={{ color: P }} />
          <p className="text-sm font-semibold">Calculadora de ciclos</p>
        </div>
        <p className="text-xs text-muted-foreground">
          O sono acontece em ciclos de 90 min. Acorde no fim de um ciclo e você vai se sentir mais descansado.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ fontSize: 13, color: "var(--muted-foreground)", flexShrink: 0 }}>Dormir às</label>
          <div style={{ ...timeInputWrap, flex: 1 }}>
            <input
              type="time"
              value={bedtime}
              onChange={(e) => setBedtime(e.target.value)}
              style={timeInputStyle}
            />
          </div>
        </div>
        <div>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
            Horários ideais para acordar
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            {idealWakes.map((w, i) => (
              <div key={i} style={{
                flex: 1, padding: "12px", borderRadius: 14, textAlign: "center",
                background: i === 1 ? PL : "oklch(.96 .005 160)",
                border: i === 1 ? PB : "1px solid oklch(.87 .02 160)",
              }}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: i === 1 ? "oklch(.35 .1 160)" : "var(--foreground)" }}>
                  {w.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--muted-foreground)" }}>
                  {i === 0 ? "5 ciclos · 7h30" : "6 ciclos · 9h"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SonoPage() {
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [stats, setStats] = useState<SleepStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLog, setEditingLog] = useState<SleepLog | null>(null);
  const [pushState, setPushState] = useState<PushState>("unknown");
  const [pushError, setPushError] = useState<string | null>(null);
  const [config, setConfig] = useState<SleepConfig>(DEFAULT_CONFIG);
  const [configSaving, setConfigSaving] = useState(false);

  const loadLogs = useCallback(async () => {
    const [sleepData, prefsData] = await Promise.all([
      fetch("/api/sleep?limit=30").then((r) => r.json()).catch(() => []),
      fetch("/api/preferences").then((r) => r.json()).catch(() => ({})),
    ]);

    if (Array.isArray(sleepData)) {
      setLogs(sleepData);
      setStats(computeSleepStats(sleepData));
    }

    const ctx = prefsData?.context ?? {};
    if (ctx.sleep_config) {
      setConfig({ ...DEFAULT_CONFIG, ...(ctx.sleep_config as Partial<SleepConfig>) });
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("unsupported");
      return;
    }
    if (hasPushPermission()) {
      setPushState("granted");
    } else if (Notification.permission === "denied") {
      setPushState("denied");
    } else {
      setPushState("unknown");
    }
  }, []);

  const handleEnablePush = async () => {
    setPushState("loading");
    const { result, errorMsg } = await subscribeToPush();
    if (result === "granted") {
      setPushState("granted");
    } else if (result === "denied") {
      setPushState("denied");
    } else {
      setPushState("unknown");
      setPushError(errorMsg ?? "Erro desconhecido");
      setTimeout(() => setPushError(null), 8000);
    }
  };

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      const prefs = await fetch("/api/preferences").then((r) => r.json()).catch(() => ({}));
      const ctx = { ...(prefs?.context ?? {}), sleep_config: config };
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: ctx }),
      });
    } catch { /* ignore */ }
    setConfigSaving(false);
  };

  const weeklyLogs = stats?.weeklyLogs ?? [];

  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        background: `radial-gradient(ellipse 80% 50% at 50% 0%, oklch(.95 .04 80 / .4) 0%, transparent 60%),
                     linear-gradient(180deg, oklch(.98 .005 160) 0%, oklch(.93 .03 160) 100%)`,
      }}>
        <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Carregando…</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100dvh", paddingBottom: 100,
      background: `radial-gradient(ellipse 80% 50% at 50% 0%, oklch(.95 .04 80 / .4) 0%, transparent 60%),
                   linear-gradient(180deg, oklch(.98 .005 160) 0%, oklch(.93 .03 160) 100%)`,
      fontFamily: "var(--font-sans)",
    }}>
      {/* Header */}
      <div style={{ padding: "28px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Moon className="size-5" style={{ color: P }} />
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>Sono</h1>
          </div>
          <button type="button" onClick={() => setShowModal(true)} style={{
            height: 36, padding: "0 16px", borderRadius: 9999,
            background: P, color: "#fff",
            border: 0, cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, fontWeight: 600,
            boxShadow: "0 2px 10px -2px oklch(.5 .12 160 / .35)",
          }}>
            + Registrar
          </button>
        </div>
        <p style={{ margin: "4px 0 0 35px", fontSize: 13, color: "var(--muted-foreground)" }}>
          Esta semana
        </p>
      </div>

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Weekly overview ── */}
        {weeklyLogs.length === 0 ? (
          <Card className="rounded-2xl" style={{ border: "1px dashed oklch(.7 .06 160 / .4)" }}>
            <CardContent className="p-6 text-center space-y-3">
              <div style={{ fontSize: 52 }}>🌙</div>
              <p className="text-sm font-semibold">Nenhum registro esta semana</p>
              <p className="text-xs text-muted-foreground">
                Responda o check-in diário ou toque em "Registrar" para começar.
                Quanto mais dados, melhor a análise.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="size-3.5" style={{ color: P }} />
                    <p className="text-xs text-muted-foreground">Média / noite</p>
                  </div>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                    {stats!.avgDurationMin > 0 ? formatDuration(stats!.avgDurationMin) : "–"}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="size-3.5 text-amber-400" />
                    <p className="text-xs text-muted-foreground">Qualidade média</p>
                  </div>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: qualityColor(stats!.avgQuality) }}>
                    {stats!.avgQuality > 0 ? `${stats!.avgQuality} ${QUALITY_EMOJI[Math.round(stats!.avgQuality)]}` : "–"}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="size-3.5 text-emerald-500" />
                    <p className="text-xs text-muted-foreground">Consistência</p>
                  </div>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: scoreColor(stats!.consistencyScore) }}>
                    {stats!.consistencyScore}
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--muted-foreground)" }}> /100</span>
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Moon className="size-3.5" style={{ color: P }} />
                    <p className="text-xs text-muted-foreground">Noites esta semana</p>
                  </div>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                    {stats!.totalNights}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Best / Worst */}
            {stats!.bestNight && stats!.worstNight && stats!.bestNight.date !== stats!.worstNight.date && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Card className="rounded-2xl" style={{ background: "oklch(.95 .03 160 / .45)", border: "1px solid oklch(.7 .08 160 / .3)" }}>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">🌟 Melhor noite</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                      {new Date(stats!.bestNight.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" })}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 700, color: "oklch(.4 .15 160)" }}>
                      {stats!.bestNight.quality ? QUALITY_EMOJI[stats!.bestNight.quality] : sleepScore(stats!.bestNight)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl" style={{ background: "oklch(.95 .03 30 / .3)", border: "1px solid oklch(.7 .08 30 / .3)" }}>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">💡 A melhorar</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                      {new Date(stats!.worstNight.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" })}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 700, color: "oklch(.5 .15 30)" }}>
                      {stats!.worstNight.quality ? QUALITY_EMOJI[stats!.worstNight.quality] : sleepScore(stats!.worstNight)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        {/* ── Cycle calculator ── */}
        <CycleCalculator defaultBedtime={config.bedtime} />

        {/* ── Push notification ── */}
        {pushState === "unknown" && (
          <Card className="rounded-2xl" style={{
            background: "linear-gradient(135deg, oklch(.95 .04 160 / .25) 0%, oklch(.97 .02 80 / .2) 100%)",
            border: "1px solid oklch(.6 .08 160 / .2)",
          }}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <BellRing className="size-4" style={{ color: P }} />
                <p className="text-sm font-semibold">Lembretes de sono</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Ative notificações para receber um lembrete na hora de dormir e uma pergunta rápida ao acordar. Só uma permissão, nada mais.
              </p>
              <button type="button" onClick={handleEnablePush} style={{
                height: 40, padding: "0 18px", borderRadius: 9999,
                background: P, color: "#fff",
                border: 0, cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: 600,
              }}>
                Ativar notificações
              </button>
            </CardContent>
          </Card>
        )}

        {pushState === "loading" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: PL, border: PB }}>
            <BellRing className="size-4 animate-pulse" style={{ color: P }} />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>Aguardando permissão…</p>
          </div>
        )}

        {pushError && pushState === "unknown" && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", borderRadius: 12, background: "oklch(.95 .02 60 / .5)", border: "1px solid oklch(.7 .06 60 / .3)" }}>
            <BellOff className="size-4 mt-0.5 shrink-0" style={{ color: "oklch(.55 .1 60)" }} />
            <div>
              <p style={{ margin: 0, fontSize: 12, color: "oklch(.4 .08 60)", fontWeight: 600 }}>
                Não foi possível ativar
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "oklch(.5 .06 60)", fontFamily: "monospace", wordBreak: "break-all" }}>
                {pushError}
              </p>
            </div>
          </div>
        )}

        {pushState === "granted" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: PL, border: PB }}>
            <BellRing className="size-4 shrink-0" style={{ color: P }} />
            <p style={{ margin: 0, flex: 1, fontSize: 13, color: "oklch(.35 .1 160)", fontWeight: 500 }}>
              Lembretes de sono ativos
            </p>
            <button
              type="button"
              onClick={async () => {
                const res = await fetch("/api/push/test", { method: "POST" });
                if (!res.ok) {
                  const { error } = await res.json();
                  alert(error ?? "Erro ao enviar teste");
                }
              }}
              style={{
                padding: "4px 10px", borderRadius: 9999, border: 0, cursor: "pointer",
                background: P, color: "#fff", fontFamily: "inherit",
                fontSize: 11, fontWeight: 600, flexShrink: 0,
              }}
            >
              Testar
            </button>
          </div>
        )}

        {pushState === "denied" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "oklch(.95 .02 30 / .4)", border: "1px solid oklch(.7 .06 30 / .3)" }}>
            <BellOff className="size-4" style={{ color: "oklch(.5 .1 30)" }} />
            <p style={{ margin: 0, fontSize: 12, color: "oklch(.4 .08 30)", fontWeight: 500, lineHeight: 1.4 }}>
              Notificações bloqueadas. Habilite nas configurações do navegador para ativar lembretes.
            </p>
          </div>
        )}

        {pushState === "unsupported" && null}

        {/* ── Sleep config ── */}
        <SleepConfigCard
          config={config}
          onChange={setConfig}
          onSave={handleSaveConfig}
          saving={configSaving}
        />

        {/* ── History ── */}
        {logs.length > 0 && (
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <p className="text-sm font-semibold mb-1">Histórico</p>
              <p className="text-xs text-muted-foreground mb-3">
                Pontuação = duração + qualidade + sem interrupções
              </p>
              {logs.slice(0, 14).map((log) => (
                <SleepHistoryRow key={log.id} log={log} onEdit={setEditingLog} />
              ))}
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center" style={{ padding: "0 8px" }}>
          O app monitora passivamente padrões de uso (bateria e tela) para estimar seu sono automaticamente, sem nenhuma permissão extra.
        </p>
      </div>

      {showModal && (
        <ManualLogModal onClose={() => setShowModal(false)} onSaved={loadLogs} />
      )}
      {editingLog && (
        <EditSleepModal log={editingLog} onClose={() => setEditingLog(null)} onSaved={loadLogs} />
      )}
    </div>
  );
}
