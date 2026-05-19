import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getWeekMondayDate } from "@/lib/utils";
import type { Goal, GoalStage, GoalAction } from "@/types";

const AREA_LABELS: Record<string, string> = {
  saude: "Saúde", carreira: "Carreira", financas: "Finanças",
  relacionamentos: "Relacionamentos", desenvolvimento: "Desenvolvimento Pessoal",
  familia: "Família", lazer: "Lazer", espiritualidade: "Espiritualidade",
};

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function buildGoalsCoachPrompt(
  userName: string,
  goals: (Goal & { goal_stages: (GoalStage & { goal_actions: GoalAction[] })[] })[],
  weekPlan: { main_focus: string; focus_goal_ids: string[] } | null,
  weekReview: { biggest_win: string; blocked_lesson: string; week_score: number } | null,
  currentHour: number
): string {
  const greeting = currentHour < 12 ? "manhã" : currentHour < 18 ? "tarde" : "noite";

  const goalsBlock = goals.map((g) => {
    const stages = g.goal_stages ?? [];
    const totalStages = stages.length;
    const doneStages = stages.filter((s) => s.status === "concluida").length;
    const totalActions = stages.flatMap((s) => s.goal_actions ?? []).length;
    const doneActions = stages.flatMap((s) => s.goal_actions ?? []).filter((a) => a.status === "concluida").length;
    const progressPct = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;

    const lastUpdate = g.updated_at;
    const inactive = daysSince(lastUpdate);

    const nextAction = stages
      .filter((s) => s.status !== "concluida")
      .flatMap((s) => (s.goal_actions ?? []).filter((a) => a.status === "pendente"))[0];

    const deadlineInfo = g.target_date
      ? `Prazo: ${g.target_date} (${Math.floor((new Date(g.target_date).getTime() - Date.now()) / 86_400_000)} dias)`
      : "Sem prazo definido";

    return `
### Meta: "${g.title}"
- Tipo: ${g.type === "destino" ? "Destino (objetivo fixo)" : "Direção (contínua)"}
- Área: ${AREA_LABELS[g.area] ?? g.area}
- Status: ${g.status}
- Por que importa: "${g.why_it_matters}"
- Progresso: ${doneStages}/${totalStages} etapas concluídas (${progressPct}%)
- Ações: ${doneActions}/${totalActions} concluídas
- Última atividade: há ${inactive} dias ← ${inactive >= 14 ? "⚠️ ATENÇÃO: inativa há muito tempo" : "ok"}
- ${deadlineInfo}
${g.guardian_name ? `- Guardião: ${g.guardian_name}${g.guardian_contact ? ` (${g.guardian_contact})` : ""}` : "- Sem guardião definido"}
${g.reward ? `- Recompensa se cumprir: "${g.reward}"` : ""}
${g.punishment ? `- Punição se abandonar: "${g.punishment}"` : ""}
${nextAction ? `- Próxima ação sugerida: "${nextAction.title}"${nextAction.if_then ? ` [SE-ENTÃO: ${nextAction.if_then}]` : ""}` : "- Sem próxima ação definida"}
`.trim();
  }).join("\n\n");

  const weekBlock = weekPlan
    ? `## SEMANA ATUAL
- Foco principal: "${weekPlan.main_focus}"
- Metas em foco: ${weekPlan.focus_goal_ids.length} meta(s)
${weekReview ? `- Revisão feita: Maior vitória: "${weekReview.biggest_win}" | Score: ${weekReview.week_score}/5` : "- Revisão semanal: ainda não feita"}`
    : "## SEMANA ATUAL\n- Plano semanal ainda não criado para esta semana";

  const alerts = goals
    .filter((g) => daysSince(g.updated_at) >= 14)
    .map((g) => `⚠️ "${g.title}" inativa há ${daysSince(g.updated_at)} dias`);

  return `Você é Maya, coach de metas e bem-estar de ${userName || "o usuário"}.

Você tem acesso completo ao sistema de metas e planejamento do usuário. Seu papel é:
1. Não deixar as metas "morrerem" — cobrar gentilmente mas com firmeza
2. Celebrar cada avanço, por menor que seja
3. Ajudar a desbloquear quando algo trava
4. Lembrar o "por quê" quando a motivação cai
5. Mencionar o guardião e as apostas (recompensa/punição) quando relevante
6. Fazer perguntas poderosas de coaching, não apenas dar conselhos

## METAS ATIVAS DE ${(userName || "").toUpperCase() || "O USUÁRIO"}

${goalsBlock || "Nenhuma meta cadastrada ainda."}

${weekBlock}

${alerts.length ? `## ⚠️ ALERTAS\n${alerts.join("\n")}` : ""}

## DIRETRIZES DE COMPORTAMENTO
- Tom: caloroso, direto, empático — como um coach que realmente se importa
- Linguagem: português brasileiro natural, não formal
- Quando cobrar metas inativas: faça com carinho mas sem deixar escapar
- Quando detectar estagnação: pergunte "o que está travando?" antes de dar soluções
- Celebre pequenas vitórias explicitamente, não apenas registre
- Se o usuário quiser abandonar uma meta, lembre da punição acordada
- Sessão atual: ${greeting} — adapte o tom ao horário
- Máximo 3 parágrafos por resposta
- Não repita informações que o usuário já sabe sobre si mesmo`;
}

async function callAnthropic(
  system: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      temperature: 0.7,
      system,
      messages,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const messages: { role: string; content: string }[] = body.messages || [];
  if (!messages.length) return NextResponse.json({ error: "Mensagens vazias" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const userId = session.user.id;
  const userName = (session.user.user_metadata?.name as string) || "";
  const weekStart = getWeekMondayDate();

  const [goalsRes, planRes] = await Promise.all([
    admin
      .from("goals")
      .select(`*, goal_stages(*, goal_actions(*))`)
      .eq("user_id", userId)
      .eq("status", "ativa")
      .order("created_at", { ascending: true }),
    admin
      .from("weekly_plans")
      .select(`*, weekly_reviews(*), weekly_focus_goals(goal_id)`)
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .maybeSingle(),
  ]);

  const goals = (goalsRes.data ?? []) as (Goal & { goal_stages: (GoalStage & { goal_actions: GoalAction[] })[] })[];
  const plan = planRes.data;
  const weekPlan = plan
    ? { main_focus: plan.main_focus, focus_goal_ids: (plan.weekly_focus_goals ?? []).map((f: { goal_id: string }) => f.goal_id) }
    : null;
  const weekReview = plan?.weekly_reviews?.[0] ?? null;

  const brHour = parseInt(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }),
    10
  );

  const systemPrompt = buildGoalsCoachPrompt(userName, goals, weekPlan, weekReview, brHour);

  try {
    const reply = await callAnthropic(systemPrompt, messages.slice(-20));
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Goals chat error:", err);
    return NextResponse.json({ error: "Erro ao processar mensagem" }, { status: 500 });
  }
}
