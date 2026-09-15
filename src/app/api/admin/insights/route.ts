import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type Gender = "masculino" | "feminino" | "nao_dizer" | "other";

interface ModuleUsage {
  total: number;
  last24h: number;
  last7d: number;
  activeUsers: number;
  byGender: Record<Gender, number>;
}

// Módulos mapeados para a tabela de atividade que os representa. `timeCol` é a
// coluna de timestamp usada para "últimas 24h/7d" (a maioria é created_at).
const MODULES: { key: string; label: string; table: string; timeCol: string }[] = [
  { key: "checkin", label: "Check-in", table: "check_ins", timeCol: "created_at" },
  { key: "diario", label: "Diário", table: "diary_entries", timeCol: "created_at" },
  { key: "nutricao", label: "Nutrição", table: "meals", timeCol: "criado_em" },
  { key: "sono", label: "Sono", table: "sleep_logs", timeCol: "created_at" },
  { key: "financas", label: "Finanças", table: "financial_transactions", timeCol: "created_at" },
  { key: "leitura", label: "Leitura", table: "reading_sessions", timeCol: "created_at" },
  { key: "corrida", label: "Corrida", table: "running_sessions", timeCol: "created_at" },
  { key: "metas", label: "Metas", table: "goals", timeCol: "created_at" },
  { key: "agenda", label: "Agenda/Plano", table: "agenda_items", timeCol: "created_at" },
  { key: "maya_chat", label: "Maya (chat)", table: "chat_messages", timeCol: "created_at" },
  { key: "comunidade", label: "Comunidade", table: "community_posts", timeCol: "created_at" },
];

async function moduleStat(admin: SupabaseClient, table: string, timeCol: string, genderByUser: Map<string, Gender>): Promise<ModuleUsage> {
  const now = Date.now();
  const iso24 = new Date(now - 86400000).toISOString();
  const iso7 = new Date(now - 7 * 86400000).toISOString();

  const stat: ModuleUsage = { total: 0, last24h: 0, last7d: 0, activeUsers: 0, byGender: { masculino: 0, feminino: 0, nao_dizer: 0, other: 0 } };

  try {
    const { count } = await admin.from(table).select("*", { count: "exact", head: true });
    stat.total = count ?? 0;
  } catch { /* tabela inexistente */ }

  try {
    const { count } = await admin.from(table).select("*", { count: "exact", head: true }).gte(timeCol, iso24);
    stat.last24h = count ?? 0;
  } catch { /* coluna de tempo pode não existir */ }

  try {
    const { count } = await admin.from(table).select("*", { count: "exact", head: true }).gte(timeCol, iso7);
    stat.last7d = count ?? 0;
  } catch { /* coluna de tempo pode não existir */ }

  try {
    const { data: rows } = await admin.from(table).select("user_id");
    const sets: Record<Gender, Set<string>> = { masculino: new Set(), feminino: new Set(), nao_dizer: new Set(), other: new Set() };
    for (const r of rows ?? []) {
      if (!r.user_id) continue;
      const g = genderByUser.get(r.user_id) || "other";
      sets[g].add(r.user_id);
    }
    stat.activeUsers = sets.masculino.size + sets.feminino.size + sets.nao_dizer.size + sets.other.size;
    stat.byGender = { masculino: sets.masculino.size, feminino: sets.feminino.size, nao_dizer: sets.nao_dizer.size, other: sets.other.size };
  } catch { /* sem user_id */ }

  return stat;
}

// GET /api/admin/insights — demografia de usuários + uso por módulo (admin only)
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: role } = await admin.from("user_roles").select("is_admin").eq("user_id", session.user.id).maybeSingle();
  if (!role?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  // Demografia: idioma e gênero a partir de user_preferences.context
  const languages = { pt: 0, es: 0, en: 0, other: 0 };
  const genders: Record<Gender, number> = { masculino: 0, feminino: 0, nao_dizer: 0, other: 0 };
  const genderByUser = new Map<string, Gender>();
  try {
    const { data: prefs } = await admin.from("user_preferences").select("user_id, context");
    for (const p of prefs ?? []) {
      const ctx = (p.context || {}) as Record<string, string>;
      const lang = ctx.language;
      if (lang === "pt" || lang === "es" || lang === "en") languages[lang]++;
      else languages.other++;

      const g = ctx.gender;
      if (g === "masculino" || g === "feminino" || g === "nao_dizer") {
        genders[g]++;
        genderByUser.set(p.user_id, g);
      } else {
        genders.other++;
        if (g) genderByUser.set(p.user_id, "other");
      }
    }
  } catch { /* user_preferences pode não existir */ }

  const modules = [];
  for (const m of MODULES) {
    const stat = await moduleStat(admin, m.table, m.timeCol, genderByUser);
    modules.push({ key: m.key, label: m.label, ...stat });
  }

  return NextResponse.json({ languages, genders, modules });
}
