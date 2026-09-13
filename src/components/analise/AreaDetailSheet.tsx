"use client";
import { getLocale } from "@/lib/language";
import { useTranslation } from "@/lib/useTranslation";

// Detalhe por área da Roda da Vida: lista as tarefas (plano semanal) e os
// itens da agenda (compromissos/atividades) do período selecionado, agrupados
// pelas 8 áreas. Presentacional — recebe dados + callbacks de toggle.

const AREA_META: Record<string, { labelKey: string; emoji: string; color: string }> = {
  espiritualidade: { labelKey: "area_espiritualidade", emoji: "✨", color: "#F97316" },
  carreira: { labelKey: "area_carreira", emoji: "💼", color: "#5EEAD4" },
  desenvolvimento: { labelKey: "area_desenvolvimento", emoji: "🧠", color: "#A78BFA" },
  familia: { labelKey: "area_familia", emoji: "🏡", color: "#22D18B" },
  relacionamentos: { labelKey: "area_relacionamentos", emoji: "❤️", color: "#EC4899" },
  financas: { labelKey: "area_financas", emoji: "💰", color: "#F59E0B" },
  lazer: { labelKey: "area_lazer", emoji: "🌊", color: "#38BDF8" },
  saude: { labelKey: "area_saude", emoji: "💚", color: "#7C5CFF" },
};

const AREA_ORDER = [
  "espiritualidade", "carreira", "desenvolvimento", "familia",
  "relacionamentos", "financas", "lazer", "saude",
];

interface DetailTask {
  id: string;
  title: string;
  area: string;
  status: string;
  day_of_week: number;
  scheduled_time: string | null;
}
interface DetailPlan { week_start: string; weekly_tasks?: DetailTask[]; }
interface DetailAgenda {
  id: string;
  title: string;
  area: string | null;
  status: string;
  item_type: string;
  date: string;
  start_time: string | null;
}

interface AreaDetailSheetProps {
  plans: DetailPlan[];
  agendaItems: DetailAgenda[];
  from: string;
  to: string;
  onClose: () => void;
  onToggleTask: (taskId: string, next: string) => void;
  onToggleAgenda: (id: string, next: string) => void;
}

interface Entry {
  key: string;
  id: string;
  kind: "task" | "agenda";
  title: string;
  status: string;
  area: string;
  date: string; // YYYY-MM-DD (para ordenação)
  time: string | null; // HH:MM
  typeLabel: string;
}

/** week_start + day_of_week dias → YYYY-MM-DD (âncora ao meio-dia evita off-by-one). */
function addDaysYMD(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

/** YYYY-MM-DD → "DD/MM". */
function fmtYMD(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(getLocale(), { day: "2-digit", month: "2-digit" });
}

function fmtTime(t: string | null): string | null {
  if (!t) return null;
  return t.slice(0, 5);
}

export function AreaDetailSheet({
  plans,
  agendaItems,
  from,
  to,
  onClose,
  onToggleTask,
  onToggleAgenda,
}: AreaDetailSheetProps) {
  const { t } = useTranslation();
  const entries: Entry[] = [];

  for (const p of plans) {
    for (const task of p.weekly_tasks ?? []) {
      if (!AREA_ORDER.includes(task.area)) continue;
      entries.push({
        key: `task-${task.id}`,
        id: task.id,
        kind: "task",
        title: task.title,
        status: task.status,
        area: task.area,
        date: addDaysYMD(p.week_start, task.day_of_week),
        time: fmtTime(task.scheduled_time),
        typeLabel: t("an_tarefa"),
      });
    }
  }

  for (const it of agendaItems) {
    if (!it.area || !AREA_ORDER.includes(it.area)) continue;
    entries.push({
      key: `agenda-${it.id}`,
      id: it.id,
      kind: "agenda",
      title: it.title,
      status: it.status,
      area: it.area,
      date: it.date,
      time: fmtTime(it.start_time),
      typeLabel: t(it.item_type === "compromisso" ? "an_compromisso" : "an_atividade"),
    });
  }

  const grouped = AREA_ORDER
    .map((area) => ({
      area,
      items: entries
        .filter((e) => e.area === area)
        .sort((a, b) =>
          a.date === b.date ? (a.time ?? "").localeCompare(b.time ?? "") : a.date.localeCompare(b.date)
        ),
    }))
    .filter((g) => g.items.length > 0);

  const periodLabel = from === to ? fmtYMD(from) : `${fmtYMD(from)} a ${fmtYMD(to)}`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          maxHeight: "85dvh",
          overflowY: "auto",
          background: "#151520",
          borderRadius: 24,
          padding: "20px 20px 22px",
          border: "1px solid rgba(167,139,250,0.15)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#e0d6ff" }}>
              {t("an_detalhes_area")}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9e96b5" }}>
              📅 {periodLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("ck_fechar")}
            style={{ background: "none", border: 0, color: "#9e96b5", fontSize: 18, cursor: "pointer", padding: 4 }}
          >
            ✕
          </button>
        </div>

        {grouped.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "#9e96b5" }}>{t("an_nenhum_item_periodo")}</p>
        ) : (
          grouped.map(({ area, items }) => {
            const meta = AREA_META[area];
            const doneCount = items.filter((i) => i.status === "concluida").length;
            return (
              <div key={area} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{meta.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: meta.color, flex: 1 }}>
                    {t(meta.labelKey)}
                  </span>
                  <span style={{ fontSize: 11, color: "#9e96b5", fontWeight: 600 }}>
                    {doneCount}/{items.length}
                  </span>
                </div>

                {items.map((it) => {
                  const done = it.status === "concluida";
                  const meta = [it.typeLabel, fmtYMD(it.date), it.time ? `${it.time}` : null]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div
                      key={it.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <button
                        type="button"
                        aria-label={done ? t("an_marcar_pendente") : t("an_marcar_concluida")}
                        onClick={() => {
                          const next = done ? "pendente" : "concluida";
                          if (it.kind === "task") onToggleTask(it.id, next);
                          else onToggleAgenda(it.id, next);
                        }}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          flexShrink: 0,
                          border: done ? "none" : "2px solid rgba(167,139,250,0.3)",
                          background: done ? "#7C5CFF" : "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: 13,
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        {done ? "✓" : ""}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            fontWeight: 500,
                            color: done ? "#5a5470" : "#e0d6ff",
                            textDecoration: done ? "line-through" : "none",
                            lineHeight: 1.3,
                          }}
                        >
                          {it.title}
                        </p>
                        <p style={{ margin: "1px 0 0", fontSize: 10.5, color: "#6a657a" }}>
                          {meta}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
