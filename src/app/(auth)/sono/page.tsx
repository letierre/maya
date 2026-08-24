"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Moon, Clock, Plus, BellRing, BellOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  computeSleepStats,
  sleepScore,
  formatDuration,
  sleepCycleTimes,
} from "@/lib/sleep-utils";
import type { SleepLog, SleepStats } from "@/types";
import { getLocalDate } from "@/lib/utils";
import { hasPushPermission } from "@/lib/push-utils";
import { useTranslation } from "@/lib/useTranslation";
import { t as tFn, type Lang } from "@/lib/i18n";
import { emitCareDataChanged } from "@/lib/care-events";

interface SleepConfig {
  bedtime: string;
  wake_time: string;
  reminder_time: string;
}

/** Calcula a janela de sono em horas entre bedtime e wake_time (trata virada de meia-noite) */
function calcWindowHours(bedtime: string, wake_time: string): number {
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wake_time.split(":").map(Number);
  let bedMins = bh * 60 + bm;
  let wakeMins = wh * 60 + wm;
  if (wakeMins <= bedMins) wakeMins += 24 * 60;
  return (wakeMins - bedMins) / 60;
}

const DEFAULT_CONFIG: SleepConfig = {
  bedtime: "23:00",
  wake_time: "07:00",
  reminder_time: "22:30",
};

// ── Color helpers (app identity: hue 160 = verde primário) ────────────────────

const P = "oklch(.58 .18 270)";   // primary purple
const PL = "oklch(.58 .18 270 / .15)";
const PB = "1px solid oklch(.58 .18 270 / .25)";

const QUALITY_EMOJI = ["", "😩", "😕", "😐", "🙂", "😊"];

function getQualityLabels(lang: Lang): string[] {
  return ["", tFn(lang, "sono_qualidade_1"), tFn(lang, "sono_qualidade_2"), tFn(lang, "sono_qualidade_3"), tFn(lang, "sono_qualidade_4"), tFn(lang, "sono_qualidade_5")];
}

function dateLocale(lang: Lang): string {
  if (lang === "es") return "es-ES";
  if (lang === "en") return "en-US";
  return "pt-BR";
}

function qualityColor(q: number | null): string {
  if (!q) return "var(--muted-foreground)";
  if (q <= 2) return "oklch(.5 .15 15)";
  if (q === 3) return "oklch(.60 .12 70)";
  return "oklch(.58 .18 270)";
}

function scoreColor(s: number): string {
  if (s >= 70) return "oklch(.58 .18 270)";
  if (s >= 45) return "oklch(.60 .12 70)";
  return "oklch(.5 .15 15)";
}

function fmt12(ts: string | null, lang: Lang = "pt"): string {
  if (!ts) return "--";
  return new Date(ts).toLocaleTimeString(dateLocale(lang), { hour: "2-digit", minute: "2-digit" });
}

// ── Input style shared ────────────────────────────────────────────────────────

const timeInputWrap: React.CSSProperties = {
  overflow: "hidden",
  minWidth: 0,
  borderRadius: 10,
  border: "1px solid rgba(167,139,250,0.25)",
  background: "#0F0F14",
  height: 42,
  display: "flex",
  alignItems: "center",
};

const timeInputStyle: React.CSSProperties = {
  flex: "1 1 0",
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  minWidth: 0,
  padding: "0 10px",
  border: "none",
  borderRadius: 0,
  color: "#e0d6ff",
  background: "transparent",
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 600,
  outline: "none",
};

/** Altura do teclado virtual (px) — sobe o bottom sheet acima do teclado. */
function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setOffset(Math.max(0, window.innerHeight - vv.height));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return offset;
}

// ── Manual log modal ──────────────────────────────────────────────────────────

function ManualLogModal({ onClose, onSaved, lang }: { onClose: () => void; onSaved: () => void; lang: Lang }) {
  const [quality, setQuality] = useState<number | null>(null);
  const [interruptions, setInterruptions] = useState<number>(0);
  const [startTime, setStartTime] = useState("22:00");
  const [endTime, setEndTime] = useState("07:00");
  const [notes, setNotes] = useState("");
  const [showQualityGuide, setShowQualityGuide] = useState(false);
  const [saving, setSaving] = useState(false);
  const kbOffset = useKeyboardOffset();

  const save = async () => {
    if (!quality) return;
    setSaving(true);
    const today = getLocalDate();
    const sleepStart = startTime ? new Date(`${today}T${startTime}:00`).toISOString() : null;
    let sleepEnd: string | null = null;
    let computedDuration: number | null = null;

    if (startTime && endTime) {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      const crossMidnight = endMin <= startMin;
      const endDate = crossMidnight
        ? new Date(new Date(today + "T12:00:00").getTime() + 86400000).toISOString().split("T")[0]
        : today;
      sleepEnd = new Date(`${endDate}T${endTime}:00`).toISOString();
      computedDuration = crossMidnight ? (24 * 60 - startMin) + endMin : endMin - startMin;
    }

    await fetch("/api/sleep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: today,
        quality,
        duration_min: computedDuration,
        interruptions,
        sleep_start: sleepStart,
        sleep_end: sleepEnd,
        notes: interruptions > 0 && notes.trim() ? notes.trim() : null,
        source: "checkin",
      }),
    });
    emitCareDataChanged();
    // Fire-and-forget: trigger specialist re-analysis in background
    fetch("/api/specialists/analyze", { method: "POST" }).catch(() => {});
    setSaving(false);
    onSaved();
    onClose();
  };

  const UN = "oklch(0.18 0.012 270)";   // unselected neutral bg
  const UM = "oklch(0.58 0.04 270)";    // unselected muted text

  const label11 = (text: string) => (
    <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#9e96b5" }}>
      {text}
    </p>
  );

  const qualityGuide = [
    { emoji: QUALITY_EMOJI[1], label: getQualityLabels(lang)[1], desc: tFn(lang, "sono_qualidade_guia_1") },
    { emoji: QUALITY_EMOJI[2], label: getQualityLabels(lang)[2], desc: tFn(lang, "sono_qualidade_guia_2") },
    { emoji: QUALITY_EMOJI[3], label: getQualityLabels(lang)[3], desc: tFn(lang, "sono_qualidade_guia_3") },
    { emoji: QUALITY_EMOJI[4], label: getQualityLabels(lang)[4], desc: tFn(lang, "sono_qualidade_guia_4") },
    { emoji: QUALITY_EMOJI[5], label: getQualityLabels(lang)[5], desc: tFn(lang, "sono_qualidade_guia_5") },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end",
        paddingBottom: kbOffset,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", boxSizing: "border-box",
        borderRadius: "24px 24px 0 0",
        background: "#151520",
        padding: "24px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.3)",
        overflow: "hidden",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 9999, background: "rgba(167,139,250,0.2)", margin: "0 auto 20px" }} />
        <h2 style={{ margin: "0 0 20px", fontSize: 19, fontWeight: 700 }}>{tFn(lang, "sono_registrar_btn")}</h2>

        {/* Times */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            {label11(tFn(lang, "sono_fui_dormir"))}
            <div style={timeInputWrap}>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={timeInputStyle} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {label11(tFn(lang, "sono_acordei"))}
            <div style={timeInputWrap}>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={timeInputStyle} />
            </div>
          </div>
        </div>

        {/* Quality label + info */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {label11(tFn(lang, "sono_como_foi"))}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowQualityGuide(!showQualityGuide); }}
            style={{
              background: "none", border: 0, cursor: "pointer",
              fontSize: 15, padding: "0 0 10px", lineHeight: 1,
              color: showQualityGuide ? P : "oklch(0.50 0.03 270)",
              transition: "color .2s ease",
            }}
            aria-label="Guia de qualidade"
          >
            ℹ️
          </button>
        </div>

        {/* Quality guide expandable */}
        {showQualityGuide && (
          <div style={{
            marginBottom: 14, padding: "12px 14px",
            borderRadius: 14,
            background: "oklch(0.17 0.015 270 / 0.6)",
            border: "1px solid oklch(0.28 0.02 270 / 0.3)",
          }}>
            <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#A78BFA" }}>
              {tFn(lang, "sono_qualidade_guia")}
            </p>
            {qualityGuide.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: i < 4 ? 6 : 0 }}>
                <span style={{ fontSize: 16, flexShrink: 0, width: 24, textAlign: "center" }}>{item.emoji}</span>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#e0d6ff" }}>{item.label}</span>
                  <span style={{ fontSize: 11, color: "#9e96b5", marginLeft: 6 }}>{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quality buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map((q) => (
            <button key={q} type="button" onClick={() => setQuality(q)} style={{
              flex: 1, padding: "10px 2px", borderRadius: 12, border: 0, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              background: quality === q ? PL : UN,
              outline: quality === q ? `2px solid ${P}` : "none",
              transition: "all .15s ease",
            }}>
              <span style={{ fontSize: 26 }}>{QUALITY_EMOJI[q]}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: quality === q ? "oklch(0.45 0.18 270)" : UM }}>
                {getQualityLabels(lang)[q]}
              </span>
            </button>
          ))}
        </div>

        {/* Interruptions */}
        {label11(tFn(lang, "sono_acordou_noite"))}
        <div style={{ display: "flex", gap: 8, marginBottom: interruptions > 0 ? 14 : 20 }}>
          {[0, 1, 2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => setInterruptions(n)} style={{
              flex: 1, padding: "10px 4px", borderRadius: 12, border: 0, cursor: "pointer",
              background: interruptions === n ? P : UN,
              fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              color: interruptions === n ? "#fff" : UM,
              transition: "all .15s ease",
            }}>
              {n === 4 ? "4+" : n === 0 ? tFn(lang, "nao") : `${n}×`}
            </button>
          ))}
        </div>

        {/* Notes when interrupted */}
        {interruptions > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#A78BFA" }}>
              {tFn(lang, "sono_interruption_note_label")}
            </p>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tFn(lang, "sono_interruption_note_placeholder")}
              maxLength={120}
              style={{
                width: "100%", boxSizing: "border-box",
                height: 42, borderRadius: 10,
                border: "1px solid oklch(0.28 0.02 270 / 0.4)",
                background: "oklch(0.14 0.012 270)",
                padding: "0 12px",
                color: "#e0d6ff",
                fontFamily: "inherit", fontSize: 13, fontWeight: 500,
                outline: "none",
              }}
            />
          </div>
        )}

        <button type="button" onClick={save} disabled={!quality || saving} style={{
          width: "100%", height: 50, borderRadius: 14, border: 0,
          cursor: !quality ? "not-allowed" : "pointer",
          background: quality ? P : "oklch(0.18 0.012 270)",
          color: quality ? "#fff" : "oklch(0.45 0.03 270)",
          fontFamily: "inherit", fontSize: 15, fontWeight: 700,
          opacity: saving ? 0.7 : 1, transition: "all .2s ease",
        }}>{saving ? tFn(lang, "salvando") : tFn(lang, "sono_salvar_alt")}</button>
      </div>
    </div>
  );
}

// ── Sleep edit modal ──────────────────────────────────────────────────────────

function toSPTime(ts: string | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function EditSleepModal({ log, onClose, onSaved, lang }: {
  log: SleepLog;
  onClose: () => void;
  onSaved: () => void;
  lang: Lang;
}) {
  const [startTime, setStartTime] = useState(toSPTime(log.sleep_start));
  const [endTime, setEndTime] = useState(toSPTime(log.sleep_end));
  const [quality, setQuality] = useState<number | null>(log.quality ?? null);
  const [interruptions, setInterruptions] = useState<number>(log.interruptions ?? 0);
  const [notes, setNotes] = useState(log.notes ?? "");
  const [showQualityGuide, setShowQualityGuide] = useState(false);
  const [saving, setSaving] = useState(false);
  const kbOffset = useKeyboardOffset();

  const save = async () => {
    setSaving(true);
    const sleepStart = startTime ? new Date(`${log.date}T${startTime}:00`).toISOString() : null;
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
      sleepEnd = new Date(`${endDate}T${endTime}:00`).toISOString();
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
        notes: interruptions > 0 && notes.trim() ? notes.trim() : null,
      }),
    });
    emitCareDataChanged();
    // Fire-and-forget: trigger specialist re-analysis in background
    fetch("/api/specialists/analyze", { method: "POST" }).catch(() => {});
    setSaving(false);
    onSaved();
    onClose();
  };

  const UN = "oklch(0.18 0.012 270)";
  const UM = "oklch(0.58 0.04 270)";

  const dayLabel = new Date(log.date + "T12:00:00").toLocaleDateString(dateLocale(lang), {
    weekday: "long", day: "numeric", month: "long",
  });

  const label11 = (text: string) => (
    <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#9e96b5" }}>
      {text}
    </p>
  );

  const qualityGuide = [
    { emoji: QUALITY_EMOJI[1], label: getQualityLabels(lang)[1], desc: tFn(lang, "sono_qualidade_guia_1") },
    { emoji: QUALITY_EMOJI[2], label: getQualityLabels(lang)[2], desc: tFn(lang, "sono_qualidade_guia_2") },
    { emoji: QUALITY_EMOJI[3], label: getQualityLabels(lang)[3], desc: tFn(lang, "sono_qualidade_guia_3") },
    { emoji: QUALITY_EMOJI[4], label: getQualityLabels(lang)[4], desc: tFn(lang, "sono_qualidade_guia_4") },
    { emoji: QUALITY_EMOJI[5], label: getQualityLabels(lang)[5], desc: tFn(lang, "sono_qualidade_guia_5") },
  ];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "flex-end",
      paddingBottom: kbOffset,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", boxSizing: "border-box",
        borderRadius: "24px 24px 0 0",
        background: "#151520",
        padding: "24px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.3)",
        overflow: "hidden",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 9999, background: "rgba(167,139,250,0.2)", margin: "0 auto 16px" }} />
        <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>{tFn(lang, "sono_editar_title")}</h2>
        <p style={{ margin: "0 0 20px", fontSize: 12, color: "#9e96b5", textTransform: "capitalize" }}>{dayLabel}</p>

        {/* Times */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
          <div>
            {label11(tFn(lang, "sono_dormiu_as"))}
            <div style={timeInputWrap}>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={timeInputStyle} />
            </div>
          </div>
          <div>
            {label11(tFn(lang, "sono_acordou_as"))}
            <div style={timeInputWrap}>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={timeInputStyle} />
            </div>
          </div>
        </div>

        {/* Interruptions */}
        {label11(tFn(lang, "sono_acordou_noite"))}
        <div style={{ display: "flex", gap: 8, marginBottom: interruptions > 0 ? 14 : 20 }}>
          {[0, 1, 2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => setInterruptions(n)} style={{
              flex: 1, padding: "10px 4px", borderRadius: 12, border: 0, cursor: "pointer",
              background: interruptions === n ? P : UN,
              fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              color: interruptions === n ? "#fff" : UM,
              transition: "all .15s ease",
            }}>
              {n === 4 ? "4+" : n === 0 ? tFn(lang, "nao") : `${n}×`}
            </button>
          ))}
        </div>

        {/* Notes when interrupted */}
        {interruptions > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#A78BFA" }}>
              {tFn(lang, "sono_interruption_note_label")}
            </p>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tFn(lang, "sono_interruption_note_placeholder")}
              maxLength={120}
              style={{
                width: "100%", boxSizing: "border-box",
                height: 42, borderRadius: 10,
                border: "1px solid oklch(0.28 0.02 270 / 0.4)",
                background: "oklch(0.14 0.012 270)",
                padding: "0 12px",
                color: "#e0d6ff",
                fontFamily: "inherit", fontSize: 13, fontWeight: 500,
                outline: "none",
              }}
            />
          </div>
        )}

        {/* Quality label + info */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {label11(tFn(lang, "sono_qualidade_label"))}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowQualityGuide(!showQualityGuide); }}
            style={{
              background: "none", border: 0, cursor: "pointer",
              fontSize: 15, padding: "0 0 6px", lineHeight: 1,
              color: showQualityGuide ? P : "oklch(0.50 0.03 270)",
              transition: "color .2s ease",
            }}
            aria-label={tFn(lang, "sono_qualidade_guia")}
          >
            ℹ️
          </button>
        </div>

        {/* Quality guide expandable */}
        {showQualityGuide && (
          <div style={{
            marginBottom: 14, padding: "12px 14px",
            borderRadius: 14,
            background: "oklch(0.17 0.015 270 / 0.6)",
            border: "1px solid oklch(0.28 0.02 270 / 0.3)",
          }}>
            <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#A78BFA" }}>
              {tFn(lang, "sono_qualidade_guia")}
            </p>
            {qualityGuide.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: i < 4 ? 6 : 0 }}>
                <span style={{ fontSize: 16, flexShrink: 0, width: 24, textAlign: "center" }}>{item.emoji}</span>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#e0d6ff" }}>{item.label}</span>
                  <span style={{ fontSize: 11, color: "#9e96b5", marginLeft: 6 }}>{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quality buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[1, 2, 3, 4, 5].map((q) => (
            <button key={q} type="button" onClick={() => setQuality(q)} style={{
              flex: 1, padding: "10px 2px", borderRadius: 12, border: 0, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              background: quality === q ? PL : UN,
              outline: quality === q ? `2px solid ${P}` : "none",
              transition: "all .15s ease",
            }}>
              <span style={{ fontSize: 22 }}>{QUALITY_EMOJI[q]}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: quality === q ? "oklch(0.45 0.18 270)" : UM }}>
                {getQualityLabels(lang)[q]}
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
        }}>{saving ? tFn(lang, "salvando") : tFn(lang, "sono_salvar_alt")}</button>
      </div>
    </div>
  );
}

// ── History row ───────────────────────────────────────────────────────────────

function SleepHistoryRow({ log, onEdit, lang }: { log: SleepLog; onEdit: (log: SleepLog) => void; lang: Lang }) {
  const score = sleepScore(log);
  const dayLabel = new Date(log.date + "T12:00:00").toLocaleDateString(dateLocale(lang), {
    weekday: "short", day: "numeric", month: "short",
  });

  return (
    <div
      onClick={() => onEdit(log)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 16px", borderBottom: "1px solid oklch(.28 .02 270 / .2)",
        cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 22, flexShrink: 0 }}>
        {log.quality ? QUALITY_EMOJI[log.quality] : "😴"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{dayLabel}</p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9e96b5" }}>
          {log.duration_min ? formatDuration(log.duration_min) : "--"}
          {log.sleep_start && log.sleep_end ? ` · ${fmt12(log.sleep_start, lang)}–${fmt12(log.sleep_end, lang)}` : ""}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ minWidth: 38, textAlign: "right", fontSize: 15, fontWeight: 700, color: scoreColor(score) }}>
          {score}
        </div>
        <span style={{ fontSize: 11, color: "oklch(.55 .03 270)" }}>✏️</span>
      </div>
    </div>
  );
}

// ── Secondary action toolbar ──────────────────────────────────────────────────

function SleepToolbar({ config, onChange, onSave, saving, lang }: {
  config: SleepConfig;
  onChange: (c: SleepConfig) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  lang: Lang;
}) {
  const [openPanel, setOpenPanel] = useState<"config" | "calculator" | null>(null);

  const toggle = (panel: "config" | "calculator") => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  };

  const pillBase: React.CSSProperties = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: "11px 15px",
    borderRadius: 9999,
    border: "1px solid oklch(0.28 0.02 270 / 0.35)",
    background: "oklch(0.14 0.012 270 / 0.5)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    fontFamily: "inherit",
    fontSize: 12.5,
    fontWeight: 600,
    color: "#c4b5e0",
    cursor: "pointer",
    transition: "all 0.25s ease",
  };

  const pillActive: React.CSSProperties = {
    background: "oklch(0.20 0.025 270 / 0.8)",
    borderColor: "oklch(0.58 0.18 270 / 0.5)",
    boxShadow: "0 0 20px oklch(0.58 0.18 270 / 0.14)",
    color: "#e0d6ff",
  };

  const panelOuter = (isOpen: boolean): React.CSSProperties => ({
    display: "grid",
    gridTemplateRows: isOpen ? "1fr" : "0fr",
    transition: "grid-template-rows 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
    marginTop: isOpen ? 10 : 0,
  });

  const panelInner: React.CSSProperties = {
    overflow: "hidden",
    background: "oklch(0.14 0.012 270 / 0.35)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    borderRadius: 18,
    border: "1px solid oklch(0.28 0.02 270 / 0.22)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  };

  return (
    <div>
      {/* Pill row */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => toggle("config")}
          style={{
            ...pillBase,
            ...(openPanel === "config" ? pillActive : {}),
          }}
        >
          <span>{tFn(lang, "sono_config_title")}</span>
          <span
            style={{
              fontSize: 10,
              display: "inline-block",
              transform: openPanel === "config" ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.25s ease",
            }}
          >
            ▾
          </span>
        </button>

        <button
          type="button"
          onClick={() => toggle("calculator")}
          style={{
            ...pillBase,
            ...(openPanel === "calculator" ? pillActive : {}),
          }}
        >
          <Clock size={15} style={{ flexShrink: 0 }} />
          <span>{tFn(lang, "sono_calc_title")}</span>
          <span
            style={{
              fontSize: 10,
              display: "inline-block",
              transform: openPanel === "calculator" ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.25s ease",
            }}
          >
            ▾
          </span>
        </button>
      </div>

      {/* Config panel */}
      <div style={panelOuter(openPanel === "config")}>
        <div style={panelInner}>
          <SleepConfigContent config={config} onChange={onChange} onSave={onSave} saving={saving} lang={lang} />
        </div>
      </div>

      {/* Calculator panel */}
      <div style={panelOuter(openPanel === "calculator")}>
        <div style={panelInner}>
          <SleepCalculatorContent bedtime={config.bedtime} lang={lang} />
        </div>
      </div>
    </div>
  );
}

// ── Sleep config content (inside toolbar panel) ────────────────────────────────

function SleepConfigContent({ config, onChange, onSave, saving, lang }: {
  config: SleepConfig;
  onChange: (c: SleepConfig) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  lang: Lang;
}) {
  const router = useRouter();
  const [pushState, setPushState] = useState<"granted" | "denied" | "default">("default");
  const [original, setOriginal] = useState<SleepConfig | null>(null);

  // Snapshot original config on mount to detect changes
  useEffect(() => {
    if (!original) setOriginal({ ...config });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = original
    ? config.bedtime !== original.bedtime ||
      config.wake_time !== original.wake_time ||
      config.reminder_time !== original.reminder_time
    : false;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasPushPermission()) {
      setPushState("granted");
    } else if ("Notification" in window && Notification.permission === "denied") {
      setPushState("denied");
    } else {
      setPushState("default");
    }
  }, []);

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Bedtime + Wake — side by side on larger screens */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#9e96b5" }}>
            {tFn(lang, "sono_horario_dormir")}
          </p>
          <div style={timeInputWrap}>
            <input
              type="time"
              value={config.bedtime}
              onChange={(e) => onChange({ ...config, bedtime: e.target.value })}
              style={timeInputStyle}
            />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#9e96b5" }}>
            {tFn(lang, "sono_horario_acordar")}
          </p>
          <div style={timeInputWrap}>
            <input
              type="time"
              value={config.wake_time}
              onChange={(e) => onChange({ ...config, wake_time: e.target.value })}
              style={timeInputStyle}
            />
          </div>
        </div>
      </div>

      {/* Auto-calculated sleep goal from bedtime → wake_time window */}
      <div>
        <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#9e96b5" }}>
          {tFn(lang, "sono_meta")}
        </p>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", borderRadius: 10,
          background: "oklch(0.16 0.012 270)", border: "1px solid oklch(.28 .02 270 / .25)",
        }}>
          <span style={{ fontSize: 20 }}>🎯</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#e0d6ff" }}>
            {calcWindowHours(config.bedtime, config.wake_time)}h
          </span>
          <span style={{ fontSize: 11, color: "#9e96b5" }}>
            {tFn(lang, "sono_meta_auto")}
          </span>
        </div>
      </div>

      {/* Reminder time + push status */}
      <div>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#9e96b5" }}>
          {tFn(lang, "sono_lembrete_noturno")}
        </p>

        {/* Push notification status badge */}
        {pushState === "granted" ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 10px", borderRadius: 8, marginBottom: 8,
            background: "oklch(0.45 0.15 160 / 0.10)", border: "1px solid oklch(0.45 0.15 160 / 0.20)",
          }}>
            <BellRing size={13} style={{ color: "oklch(0.45 0.15 160)", flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "oklch(0.45 0.15 160)" }}>
              {tFn(lang, "sono_push_active")}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/perfil")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 10px", borderRadius: 8, marginBottom: 8, cursor: "pointer",
              width: "100%", fontFamily: "inherit", textAlign: "left",
              background: pushState === "denied"
                ? "oklch(0.45 0.15 15 / 0.10)"
                : "oklch(0.50 0.10 70 / 0.08)",
              border: pushState === "denied"
                ? "1px solid oklch(0.45 0.15 15 / 0.20)"
                : "1px solid oklch(0.50 0.10 70 / 0.18)",
            }}>
            {pushState === "denied" ? (
              <BellOff size={13} style={{ color: "oklch(0.50 0.15 15)", flexShrink: 0 }} />
            ) : (
              <BellRing size={13} style={{ color: "oklch(0.60 0.12 70)", flexShrink: 0 }} />
            )}
            <span style={{
              fontSize: 11.5, fontWeight: 600, flex: 1, lineHeight: 1.3,
              color: pushState === "denied"
                ? "oklch(0.50 0.15 15)"
                : "oklch(0.60 0.12 70)",
            }}>
              {pushState === "denied" ? tFn(lang, "sono_push_denied") : tFn(lang, "sono_push_inactive")}
            </span>
            <span style={{ fontSize: 11, color: "#9e96b5", flexShrink: 0 }}>→</span>
          </button>
        )}

        <div style={timeInputWrap}>
          <input
            type="time"
            value={config.reminder_time}
            onChange={(e) => onChange({ ...config, reminder_time: e.target.value })}
            style={timeInputStyle}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={async () => { await onSave(); setOriginal({ ...config }); }}
        disabled={!dirty || saving}
        style={{
          width: "100%", height: 44, borderRadius: 12, border: 0,
          cursor: !dirty || saving ? "not-allowed" : "pointer",
          background: P, color: "#fff",
          fontFamily: "inherit", fontSize: 14, fontWeight: 700,
          opacity: !dirty || saving ? 0.4 : 1, transition: "opacity .15s ease",
        }}
      >
        {saving ? tFn(lang, "salvando") : tFn(lang, "sono_salvar_config")}
      </button>
    </div>
  );
}

// ── Cycle calculator content (inside toolbar panel) ───────────────────────────

function SleepCalculatorContent({ bedtime = "23:00", lang = "pt" }: { bedtime?: string; lang?: Lang }) {
  const idealWakes = (() => {
    const [h, m] = bedtime.split(":").map(Number);
    const start = new Date();
    start.setHours(h, m, 0, 0);
    return sleepCycleTimes(start, [5, 6]);
  })();

  // Formata bedtime para exibição (ex: "23:00")
  const displayTime = (() => {
    const [h, m] = bedtime.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString(dateLocale(lang), { hour: "2-digit", minute: "2-digit" });
  })();

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 12, color: "#9e96b5" }}>
        {tFn(lang, "sono_calc_desc")}
      </p>

      {/* Uses the bedtime from config — no duplicate input */}
      <p style={{
        margin: 0, fontSize: 13, color: "#e0d6ff", fontWeight: 600,
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 14px", borderRadius: 10,
        background: "oklch(0.16 0.012 270)", border: "1px solid oklch(.28 .02 270 / .25)",
      }}>
        <span style={{ fontSize: 16 }}>🕐</span>
        {tFn(lang, "sono_dormir_as")} {displayTime}
      </p>

      <div>
        <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#9e96b5" }}>
          {tFn(lang, "sono_horarios_ideais")}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          {idealWakes.map((w, i) => (
            <div key={i} style={{
              flex: 1, padding: "12px", borderRadius: 14, textAlign: "center",
              background: i === 1 ? PL : "oklch(.16 .012 270)",
              border: i === 1 ? PB : "1px solid oklch(.28 .02 270 / .5)",
            }}>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: i === 1 ? "#e0d6ff" : "var(--foreground)" }}>
                {w.toLocaleTimeString(dateLocale(lang), { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 11, color: "#9e96b5" }}>
                {i === 0 ? tFn(lang, "sono_ciclo_5") : tFn(lang, "sono_ciclo_6")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 30-day trend sparkline ────────────────────────────────────────────────────

function SleepTrendChart({ logs, lang }: { logs: SleepLog[]; lang: Lang }) {
  const sorted = useMemo(() => {
    return [...logs]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [logs]);

  if (sorted.length < 2) return null;

  const scores = sorted.map((l) => sleepScore(l));
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const range = maxScore - minScore || 1;
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const W = 600;
  const H = 160;
  const pad = { top: 18, right: 10, bottom: 26, left: 38 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  const points = scores.map((s, i) => {
    const x = pad.left + (i / Math.max(scores.length - 1, 1)) * pw;
    const y = pad.top + ph - ((s - minScore) / range) * ph;
    return [x, y] as const;
  });

  const lineD = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const areaD = [
    `M${points[0][0]},${pad.top + ph}`,
    ...points.map(([x, y]) => `L${x},${y}`),
    `L${points[points.length - 1][0]},${pad.top + ph}`,
    "Z",
  ].join(" ");

  const avgY = pad.top + ph - ((avgScore - minScore) / range) * ph;

  // Reference threshold Y positions (clamped to visible range)
  const toY = (score: number) => {
    const raw = pad.top + ph - ((score - minScore) / range) * ph;
    return Math.max(pad.top, Math.min(pad.top + ph, raw));
  };
  const refGoodY = toY(70);   // ≥70 = bom
  const refWarnY = toY(45);   // <45 = ruim

  const fmtShort = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short" });
  };

  return (
    <div
      style={{
        background: "oklch(0.16 0.012 270)",
        borderRadius: 18,
        border: "1px solid oklch(0.28 0.02 270 / 0.5)",
        padding: "16px 18px 12px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "#A78BFA",
          }}
        >
          📈 {tFn(lang, "sono_tendencia_30d")}
        </span>
        <span style={{ fontSize: 11, color: "#9e96b5" }}>
          {tFn(lang, "sono_media")}: {avgScore}
        </span>
      </div>

      {/* Sparkline */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="sleeptrend-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.58 0.18 270 / 0.30)" />
            <stop offset="100%" stopColor="oklch(0.58 0.18 270 / 0.02)" />
          </linearGradient>
        </defs>

        {/* Average reference line */}
        <line
          x1={pad.left}
          y1={avgY}
          x2={pad.left + pw}
          y2={avgY}
          stroke="oklch(0.58 0.18 270 / 0.30)"
          strokeWidth="1.5"
          strokeDasharray="5,4"
        />

        {/* Score threshold: 70 (good) */}
        <line
          x1={pad.left}
          y1={refGoodY}
          x2={pad.left + pw}
          y2={refGoodY}
          stroke="oklch(0.58 0.18 270 / 0.55)"
          strokeWidth="1.5"
          strokeDasharray="3,6"
        />
        <rect x={4} y={refGoodY - 14} width="24" height="16" rx="4" fill="oklch(0.58 0.18 270 / 0.20)" />
        <text x={16} y={refGoodY - 1} textAnchor="middle" fontSize="12" fontWeight="700" fill="oklch(0.58 0.18 270 / 0.90)" fontFamily="inherit">70</text>

        {/* Score threshold: 45 (warning) */}
        <line
          x1={pad.left}
          y1={refWarnY}
          x2={pad.left + pw}
          y2={refWarnY}
          stroke="oklch(0.60 0.12 70 / 0.55)"
          strokeWidth="1.5"
          strokeDasharray="3,6"
        />
        <rect x={4} y={refWarnY - 14} width="24" height="16" rx="4" fill="oklch(0.60 0.12 70 / 0.20)" />
        <text x={16} y={refWarnY - 1} textAnchor="middle" fontSize="12" fontWeight="700" fill="oklch(0.60 0.12 70 / 0.90)" fontFamily="inherit">45</text>

        {/* Area fill */}
        <path d={areaD} fill="url(#sleeptrend-grad)" />

        {/* Line */}
        <path
          d={lineD}
          fill="none"
          stroke="oklch(0.58 0.18 270)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Key dots: first, last, max, min */}
        {points.map(([x, y], i) => {
          const isKey =
            i === 0 ||
            i === points.length - 1 ||
            scores[i] === maxScore ||
            scores[i] === minScore;
          if (!isKey) return null;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={5}
              fill="oklch(0.58 0.18 270)"
              stroke="#15151F"
              strokeWidth="2"
            />
          );
        })}
      </svg>

      {/* Date labels */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          fontSize: 11,
          fontWeight: 600,
          color: "oklch(0.55 0.03 270)",
        }}
      >
        <span>{fmtShort(sorted[0].date)}</span>
        <span>{fmtShort(sorted[sorted.length - 1].date)}</span>
      </div>
    </div>
  );
}

// ── Sleep specialist card ──────────────────────────────────────────────────────

function SleepSpecialistCard({ insight, lang }: {
  insight: { patterns: string[]; concerns: string[]; strengths: string[]; summary: string } | null;
  lang: Lang;
}) {
  if (!insight?.summary) return null;

  return (
    <div
      style={{
        background: "oklch(0.16 0.012 270)",
        borderRadius: 18,
        border: "1px solid oklch(0.28 0.02 270 / 0.5)",
        padding: "16px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>🧠</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "#A78BFA",
          }}
        >
          {tFn(lang, "sono_especialista_title")}
        </span>
      </div>

      {/* Summary */}
      <p
        style={{
          margin: "0 0 12px",
          fontSize: 13,
          lineHeight: 1.55,
          color: "#e0d6ff",
        }}
      >
        {insight.summary}
      </p>

      {/* Badges */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {insight.strengths?.map((s, i) => (
          <span
            key={`s-${i}`}
            style={{
              padding: "4px 10px",
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 600,
              background: "oklch(0.20 0.04 160 / 0.20)",
              color: "#5EEAD4",
            }}
          >
            {s}
          </span>
        ))}
        {insight.concerns?.map((c, i) => (
          <span
            key={`c-${i}`}
            style={{
              padding: "4px 10px",
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 600,
              background: "oklch(0.20 0.04 70 / 0.20)",
              color: "#FBBF24",
            }}
          >
            {c}
          </span>
        ))}
        {insight.patterns?.map((p, i) => (
          <span
            key={`p-${i}`}
            style={{
              padding: "4px 10px",
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 500,
              background: "oklch(0.20 0.025 270 / 0.25)",
              color: "#c4b5e0",
            }}
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SonoPage() {
  const { lang } = useTranslation();
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [stats, setStats] = useState<SleepStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLog, setEditingLog] = useState<SleepLog | null>(null);
  const [config, setConfig] = useState<SleepConfig>(DEFAULT_CONFIG);
  const [configSaving, setConfigSaving] = useState(false);
  const [openSleepMonths, setOpenSleepMonths] = useState<Set<string>>(new Set());
  const [sleepInsight, setSleepInsight] = useState<{ patterns: string[]; concerns: string[]; strengths: string[]; summary: string } | null>(null);

  // Open current month by default once logs load
  useEffect(() => {
    if (logs.length > 0) {
      const now = new Date();
      setOpenSleepMonths(new Set([`${now.getFullYear()}-${now.getMonth()}`]));
    }
  }, [logs.length === 0]); // eslint-disable-line

  const sleepMonthGroups = useMemo(() => {
    const groups = new Map<string, { label: string; logs: SleepLog[]; key: string }>();
    logs.forEach((log) => {
      const d = new Date(log.date + "T12:00:00");
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!groups.has(key)) {
        const raw = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        groups.set(key, { label: raw.charAt(0).toUpperCase() + raw.slice(1), logs: [], key });
      }
      groups.get(key)!.logs.push(log);
    });
    return Array.from(groups.values());
  }, [logs]);

  const toggleSleepMonth = (key: string) => {
    setOpenSleepMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const loadLogs = useCallback(async () => {
    const [sleepData, prefsData, insightData] = await Promise.all([
      fetch("/api/sleep?limit=30").then((r) => r.json()).catch(() => []),
      fetch("/api/preferences").then((r) => r.json()).catch(() => ({})),
      fetch("/api/sleep/insights").then((r) => r.json()).catch(() => null),
    ]);

    if (Array.isArray(sleepData)) {
      setLogs(sleepData);
      setStats(computeSleepStats(sleepData));
    }

    const ctx = prefsData?.context ?? {};
    if (ctx.sleep_config) {
      setConfig({ ...DEFAULT_CONFIG, ...(ctx.sleep_config as Partial<SleepConfig>) });
    }

    if (insightData?.summary) {
      setSleepInsight(insightData);
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      const prefs = await fetch("/api/preferences").then((r) => r.json()).catch(() => ({}));
      // Inclui target_hours calculado para compatibilidade com cron de lembrete
      const configToSave = { ...config, target_hours: calcWindowHours(config.bedtime, config.wake_time) };
      const ctx = { ...(prefs?.context ?? {}), sleep_config: configToSave };
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
        background: `radial-gradient(ellipse 80% 50% at 50% 0%, oklch(.58 .18 270 / .15) 0%, transparent 60%),
                     linear-gradient(180deg, oklch(.12 .012 270) 0%, oklch(.15 .015 270) 100%)`,
      }}>
        <p style={{ color: "#9e96b5", fontSize: 13 }}>{tFn(lang, "carregando")}</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100dvh", paddingBottom: 100,
      background: `radial-gradient(ellipse 80% 50% at 50% 0%, oklch(.58 .18 270 / .15) 0%, transparent 60%),
                   linear-gradient(180deg, oklch(.12 .012 270) 0%, oklch(.15 .015 270) 100%)`,
      fontFamily: "var(--font-sans)",
    }}>
      {/* Header */}
      <div style={{ padding: "28px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Moon className="size-5" style={{ color: P }} />
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>Sono</h1>
          </div>
        </div>
        <p style={{ margin: "4px 0 0 35px", fontSize: 13, color: "#9e96b5" }}>
          {tFn(lang, "sono_esta_semana")}
        </p>
      </div>

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Weekly overview ── */}
        {weeklyLogs.length === 0 ? (
          <Card className="rounded-2xl" style={{ border: "1px dashed oklch(.28 .02 270 / .5)" }}>
            <CardContent className="p-6 text-center space-y-3">
              <div style={{ fontSize: 52 }}>🌙</div>
              <p className="text-sm font-semibold">{tFn(lang, "sono_nenhum_reg")}</p>
              <p className="text-xs text-muted-foreground">
                {tFn(lang, "sono_cta")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { icon: "🌙", label: tFn(lang, "sono_avg_noite"), value: stats!.avgDurationMin > 0 ? formatDuration(stats!.avgDurationMin) : "–", sub: "média da semana", color: "#e0d6ff" },
                { icon: "⭐", label: tFn(lang, "sono_avg_qualidade"), value: stats!.avgQuality > 0 ? `${stats!.avgQuality}/5` : "–", sub: stats!.avgQuality > 0 ? QUALITY_EMOJI[Math.round(stats!.avgQuality)] : "", color: qualityColor(stats!.avgQuality) },
                { icon: "📊", label: tFn(lang, "sono_consistencia"), value: `${stats!.consistencyScore}`, sub: "de 100", color: scoreColor(stats!.consistencyScore) },
                { icon: "🎯", label: "Meta de sono", value: config ? `${calcWindowHours(config.bedtime, config.wake_time)}h` : "–", sub: stats!.avgDurationMin > 0 ? `${formatDuration(stats!.avgDurationMin)} médio` : "sem dados", color: "#5EEAD4" },
              ].map((card) => (
                <div key={card.label} style={{
                  background: "oklch(0.16 0.012 270)",
                  borderRadius: 18,
                  border: "1px solid oklch(0.28 0.02 270 / 0.5)",
                  padding: "16px 14px",
                  display: "flex", flexDirection: "column", gap: 4,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 16 }}>{card.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#9e96b5", textTransform: "uppercase", letterSpacing: ".06em" }}>{card.label}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: card.color, letterSpacing: "-0.02em" }}>
                    {card.value}
                  </p>
                  {card.sub && (
                    <p style={{ margin: 0, fontSize: 10, color: "#9e96b5" }}>{card.sub}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Melhor noite + comparativo semanal */}
            {stats!.bestNight && (
              <div style={{
                background: "oklch(0.16 0.012 270)",
                borderRadius: 18,
                border: "1px solid oklch(0.28 0.02 270 / 0.5)",
                padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ fontSize: 28 }}>🌟</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#A78BFA" }}>
                    Melhor noite da semana
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "#e0d6ff" }}>
                    {new Date(stats!.bestNight.date + "T12:00:00").toLocaleDateString(dateLocale(lang), { weekday: "long", day: "numeric" })}
                    {" · "}{stats!.bestNight.duration_min ? formatDuration(stats!.bestNight.duration_min) : ""}
                    {stats!.bestNight.quality ? ` · qualidade ${stats!.bestNight.quality}/5` : ""}
                  </p>
                </div>
                <span style={{ fontSize: 24 }}>
                  {stats!.bestNight.quality ? QUALITY_EMOJI[stats!.bestNight.quality] : "😊"}
                </span>
              </div>
            )}
          </>
        )}

        {/* ── 30-day trend ── */}
        <SleepTrendChart logs={logs} lang={lang} />

        {/* ── Specialist analysis ── */}
        <SleepSpecialistCard insight={sleepInsight} lang={lang} />

        {/* ── Secondary actions toolbar ── */}
        <SleepToolbar
          config={config}
          onChange={setConfig}
          onSave={handleSaveConfig}
          saving={configSaving}
          lang={lang}
        />

        {/* ── History ── */}
        {sleepMonthGroups.map((group) => (
          <div key={group.key} style={{
            background: "oklch(0.16 0.012 270)",
            borderRadius: 18,
            border: "1px solid oklch(0.28 0.02 270 / 0.5)",
            overflow: "hidden",
          }}>
            {/* Month header */}
            <button
              type="button"
              onClick={() => toggleSleepMonth(group.key)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "12px 16px", background: "transparent", border: 0,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <span style={{
                fontSize: 10, color: "#A78BFA", transition: "transform .2s",
                display: "inline-block",
                transform: openSleepMonths.has(group.key) ? "rotate(90deg)" : "rotate(0deg)",
              }}>▶</span>
              <span style={{
                flex: 1, textAlign: "left",
                fontSize: 12, fontWeight: 700, color: "#e0d6ff",
                textTransform: "capitalize",
              }}>{group.label}</span>
              <span style={{ fontSize: 10, color: "#9e96b5" }}>{group.logs.length}</span>
            </button>

            {/* Entries */}
            {openSleepMonths.has(group.key) && group.logs.map((log) => (
              <SleepHistoryRow key={log.id} log={log} onEdit={setEditingLog} lang={lang} />
            ))}
          </div>
        ))}

        <p className="text-xs text-muted-foreground text-center" style={{ padding: "0 8px" }}>
          {tFn(lang, "sono_monitoramento")}
        </p>
      </div>

      {showModal && (
        <ManualLogModal onClose={() => setShowModal(false)} onSaved={loadLogs} lang={lang} />
      )}
      {editingLog && (
        <EditSleepModal log={editingLog} onClose={() => setEditingLog(null)} onSaved={loadLogs} lang={lang} />
      )}

      {/* FAB */}
      <button type="button" onClick={() => setShowModal(true)}
        style={{
          position: "fixed", bottom: 84, right: 20, zIndex: 40,
          width: 56, height: 56, borderRadius: "50%",
          background: "#7C5CFF", border: 0, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(124,92,255,0.4)",
        }}>
        <Plus size={24} color="#fff" />
      </button>
    </div>
  );
}
