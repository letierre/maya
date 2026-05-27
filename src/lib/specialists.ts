import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLocalDate } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SpecialistName =
  | "psychology"
  | "sleep"
  | "nutrition"
  | "physical"
  | "goals"
  | "finance"
  | "spirituality"
  | "philosophy";

export interface SpecialistResult {
  patterns: string[];
  concerns: string[];
  strengths: string[];
  summary: string;
}

export type SpecialistInsights = Partial<Record<SpecialistName, SpecialistResult>>;

// ── Claude helper ─────────────────────────────────────────────────────────────

async function callClaude(userMessage: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 350,
      temperature: 0.3,
      system: `Você é um especialista analisando dados de bem-estar de um usuário.
Analise apenas os dados fornecidos. Seja objetivo e conciso.
Responda APENAS em JSON válido com este formato exato — sem texto fora do JSON:
{"patterns":["padrão 1"],"concerns":["preocupação 1"],"strengths":["ponto forte 1"],"summary":"resumo em 1-2 frases"}
Máximo 3 itens por campo. Escreva em português brasileiro.`,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const body = await res.json();
  return body.content[0].text as string;
}

function parseResult(text: string): SpecialistResult {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    const p = JSON.parse(match[0]);
    return {
      patterns: Array.isArray(p.patterns) ? p.patterns.slice(0, 3) : [],
      concerns: Array.isArray(p.concerns) ? p.concerns.slice(0, 3) : [],
      strengths: Array.isArray(p.strengths) ? p.strengths.slice(0, 3) : [],
      summary: typeof p.summary === "string" ? p.summary : "",
    };
  } catch {
    return { patterns: [], concerns: [], strengths: [], summary: "" };
  }
}

// ── Specialist prompt builders ────────────────────────────────────────────────

function promptPsychology(checkIns: Record<string, unknown>[]): string {
  const rows = checkIns.map((c) => {
    const tags = (c.mood_tags as string[] | null)?.join(", ") || "—";
    const feeling = c.feeling ? `"${String(c.feeling).slice(0, 80)}"` : "—";
    return `${c.date}: humor=[${tags}] | sentimento=${feeling} | sentiu-se julgado=${c.felt_judged ? "sim" : "não"} | conversou pessoalmente=${c.talked_to_someone ? "sim" : "não"}${c.suicidal_thoughts ? " | ⚠️ pensamentos autodestrutivos" : ""}`;
  });
  return `Especialista em psicologia e saúde mental.

Dados dos últimos ${checkIns.length} dias:
${rows.join("\n") || "Sem dados."}

Analise: padrões de humor, sinais de ansiedade/sobrecarga, qualidade da conexão social, bem-estar emocional geral.`;
}

function promptSleep(
  sleepLogs: Record<string, unknown>[],
  checkIns: Record<string, unknown>[]
): string {
  const logRows = sleepLogs.map((s) => {
    const dur = s.duration_min
      ? `${Math.round((s.duration_min as number) / 60 * 10) / 10}h`
      : "—";
    return `${s.date}: qualidade=${s.quality ?? "—"}/5 | duração=${dur} | interrupções=${s.interruptions ?? 0}`;
  });
  const ciRows = checkIns.map((c) => `${c.date}: dormiu_bem=${c.slept_well ? "sim" : "não"}`);
  return `Especialista em sono.

Registros de sono:
${logRows.join("\n") || "Sem logs detalhados."}

Check-ins (dormiu bem?):
${ciRows.join("\n") || "Sem dados."}

Analise: média de horas, qualidade, consistência de horários, impacto no bem-estar.`;
}

function promptNutrition(meals: Record<string, unknown>[]): string {
  const rows = meals.map((m) => {
    const macros = m.macros
      ? (() => {
          const mac = m.macros as Record<string, number>;
          return `${Math.round(mac.calorias_kcal)}kcal | C:${mac.carboidratos_g}g P:${mac.proteinas_g}g G:${mac.gorduras_g}g`;
        })()
      : "sem análise";
    return `${String(m.data_hora).slice(0, 10)} [${m.tipo_refeicao}]: ${m.classificacao || "—"} | ${macros}`;
  });
  return `Especialista em nutrição.

Refeições dos últimos 7 dias:
${rows.join("\n") || "Sem registros."}

Analise: frequência de refeições, qualidade nutricional, padrões de classificação, distribuição de macros.`;
}

function promptPhysical(checkIns: Record<string, unknown>[]): string {
  const rows = checkIns.map((c) => {
    const cups = (c.water_cups as number) ?? 0;
    return `${c.date}: exercício=${c.exercise_walk ? "sim" : "não"} | água=${cups} copos (${cups * 250}ml) | intestino=${c.bowel_movement ? "ok" : "não"} | medicação=${c.took_medication ? "sim" : "não"} | comeu_bem=${c.ate_well ? "sim" : "não"}`;
  });
  return `Especialista em saúde física.

Dados dos últimos ${checkIns.length} dias:
${rows.join("\n") || "Sem dados."}

Analise: frequência de exercício, média de hidratação, regularidade intestinal, aderência à medicação.`;
}

function promptGoals(
  goals: Record<string, unknown>[],
  checkIns: Record<string, unknown>[],
  weekPlan: Record<string, unknown> | null
): string {
  const goalsStr = goals
    .map((g) => {
      const stages = (g.stages as Record<string, unknown>[] | null) ?? [];
      const done = stages.filter((s) => s.status === "concluida").length;
      const pct = stages.length > 0 ? Math.round((done / stages.length) * 100) : 0;
      return `"${g.title}" (${g.area}) — ${pct}% concluída`;
    })
    .join("\n");
  const workedRows = checkIns
    .map((c) => `${c.date}: trabalhou_nas_metas=${c.worked_on_goals ? "sim" : "não"}`)
    .join("\n");
  const weekStr = weekPlan
    ? `Foco da semana: "${weekPlan.main_focus}"`
    : "Sem plano semanal esta semana.";
  return `Especialista em metas e produtividade.

Metas ativas:
${goalsStr || "Sem metas ativas."}

Trabalhou nas metas (últimos check-ins):
${workedRows || "Sem dados."}

${weekStr}

Analise: progresso real, consistência de trabalho nas metas, momentum, próximos passos.`;
}

function promptFinance(
  transactions: Record<string, unknown>[],
  budgets: Record<string, unknown>[]
): string {
  let totalIn = 0, totalOut = 0;
  const byCategory: Record<string, { in: number; out: number }> = {};
  for (const t of transactions) {
    const cat = String(t.category);
    if (!byCategory[cat]) byCategory[cat] = { in: 0, out: 0 };
    if (t.type === "receita") { byCategory[cat].in += t.amount as number; totalIn += t.amount as number; }
    else { byCategory[cat].out += t.amount as number; totalOut += t.amount as number; }
  }
  const catRows = Object.entries(byCategory).map(
    ([cat, v]) => `${cat}: entrada R$${v.in.toFixed(0)} | saída R$${v.out.toFixed(0)}`
  );
  const budgetRows = budgets.map((b) => {
    const spent = byCategory[String(b.category)]?.out ?? 0;
    const pct = (b.monthly_limit as number) > 0
      ? Math.round((spent / (b.monthly_limit as number)) * 100)
      : 0;
    return `${b.category}: limite R$${(b.monthly_limit as number).toFixed(0)} | gasto R$${spent.toFixed(0)} (${pct}%)`;
  });
  return `Especialista em finanças pessoais.

Últimos 30 dias:
Total receitas: R$${totalIn.toFixed(0)} | Total despesas: R$${totalOut.toFixed(0)} | Saldo: R$${(totalIn - totalOut).toFixed(0)}

Por categoria:
${catRows.join("\n") || "Sem dados por categoria."}

Orçamentos:
${budgetRows.join("\n") || "Sem orçamentos definidos."}

Analise: equilíbrio receita/despesa, categorias acima do orçamento, padrões de gastos.`;
}

function promptSpirituality(checkIns: Record<string, unknown>[]): string {
  const rows = checkIns.map((c) => {
    const grat = c.gratitude ? `"${String(c.gratitude).slice(0, 60)}"` : "—";
    return `${c.date}: meditou/orou=${c.meditation_prayer_breathing ? "sim" : "não"} | criatividade=${c.creative_activity ? "sim" : "não"} | algo_que_gostou=${c.did_something_enjoyable ? "sim" : "não"} | conversou_pessoalmente=${c.talked_to_someone ? "sim" : "não"} | gratidão=${grat}`;
  });
  return `Especialista em espiritualidade e conexão.

Dados dos últimos ${checkIns.length} dias:
${rows.join("\n") || "Sem dados."}

Analise: frequência de práticas contemplativas, expressão criativa, gratidão, qualidade das conexões pessoais.`;
}

function promptPhilosophy(
  goals: Record<string, unknown>[],
  diaryEntries: Record<string, unknown>[],
  memories: string[]
): string {
  const goalsWhy = goals
    .map((g) => `"${g.title}" (${g.type}): porquê="${g.why_it_matters || "não informado"}"`)
    .join("\n");
  const diaryStr = diaryEntries
    .slice(0, 5)
    .map((d) => `${d.date}: ${String(d.content || "").slice(0, 150)}...`)
    .join("\n");
  const memStr = memories.slice(0, 8).map((m) => `- ${m}`).join("\n");
  return `Especialista em filosofia de vida e propósito.

Metas e seus porquês:
${goalsWhy || "Sem metas com porquês registrados."}

Diário recente:
${diaryStr || "Sem entradas."}

Memórias do usuário:
${memStr || "Sem memórias registradas."}

Analise: clareza de propósito, alinhamento entre valores e ações, crescimento pessoal, sentido de direção.`;
}

// ── Main analysis function ────────────────────────────────────────────────────

export async function analyzeAllSpecialists(userId: string): Promise<SpecialistInsights> {
  const admin = getSupabaseAdmin();
  const today = getLocalDate();

  const d14 = new Date();
  d14.setDate(d14.getDate() - 14);
  const since14 = d14.toISOString().split("T")[0];

  const d30 = new Date();
  d30.setDate(d30.getDate() - 30);
  const since30 = d30.toISOString().split("T")[0];

  // Fetch all data in parallel
  const [
    { data: checkIns },
    { data: sleepLogs },
    { data: meals },
    { data: goals },
    { data: goalStages },
    { data: weeklyPlans },
    { data: transactions },
    { data: budgets },
    { data: diaryEntries },
    { data: memories },
  ] = await Promise.all([
    admin.from("check_ins").select("*").eq("user_id", userId).gte("date", since14).order("date", { ascending: false }),
    admin.from("sleep_logs").select("*").eq("user_id", userId).gte("date", since14).order("date", { ascending: false }),
    admin.from("meals").select("*").eq("user_id", userId).gte("data_hora", since30 + "T00:00:00").order("data_hora", { ascending: false }).limit(60),
    admin.from("goals").select("id,title,area,type,why_it_matters,status").eq("user_id", userId).eq("status", "ativa"),
    admin.from("goal_stages").select("goal_id,title,status").eq("user_id", userId),
    admin.from("weekly_plans").select("main_focus,week_start").eq("user_id", userId).order("week_start", { ascending: false }).limit(1),
    admin.from("financial_transactions").select("*").eq("user_id", userId).gte("date", since30).order("date", { ascending: false }),
    admin.from("financial_budgets").select("*").eq("user_id", userId),
    admin.from("diary_entries").select("date,content,mood").eq("user_id", userId).order("date", { ascending: false }).limit(10),
    admin.from("user_memories").select("content").eq("user_id", userId).order("created_at", { ascending: false }).limit(15),
  ]);

  // Attach stages to goals
  const goalsWithStages = (goals ?? []).map((g) => ({
    ...g,
    stages: (goalStages ?? []).filter((s) => s.goal_id === g.id),
  })) as Record<string, unknown>[];

  const ci = (checkIns ?? []) as Record<string, unknown>[];
  const sl = (sleepLogs ?? []) as Record<string, unknown>[];
  const ml = (meals ?? []) as Record<string, unknown>[];
  const tx = (transactions ?? []) as Record<string, unknown>[];
  const bu = (budgets ?? []) as Record<string, unknown>[];
  const di = (diaryEntries ?? []) as Record<string, unknown>[];
  const mem = (memories ?? []).map((m: Record<string, unknown>) => String(m.content));
  const wp = (weeklyPlans ?? [])[0] as Record<string, unknown> | null ?? null;

  // Run all 8 specialists in parallel
  const names: SpecialistName[] = ["psychology", "sleep", "nutrition", "physical", "goals", "finance", "spirituality", "philosophy"];
  const calls = [
    callClaude(promptPsychology(ci)),
    callClaude(promptSleep(sl, ci)),
    callClaude(promptNutrition(ml)),
    callClaude(promptPhysical(ci)),
    callClaude(promptGoals(goalsWithStages, ci, wp)),
    callClaude(promptFinance(tx, bu)),
    callClaude(promptSpirituality(ci)),
    callClaude(promptPhilosophy(goalsWithStages, di, mem)),
  ];

  const settled = await Promise.allSettled(calls);

  const insights: SpecialistInsights = {};
  for (let i = 0; i < names.length; i++) {
    const r = settled[i];
    insights[names[i]] = r.status === "fulfilled"
      ? parseResult(r.value)
      : { patterns: [], concerns: [], strengths: [], summary: "" };
  }

  // Persist to DB (upsert by user_id + date + specialist)
  const rows = names.map((name) => ({
    user_id: userId,
    date: today,
    specialist: name,
    patterns: insights[name]!.patterns,
    concerns: insights[name]!.concerns,
    strengths: insights[name]!.strengths,
    summary: insights[name]!.summary,
  }));

  await admin
    .from("specialist_insights")
    .upsert(rows, { onConflict: "user_id,date,specialist" })
    .throwOnError();

  return insights;
}

// ── Fetch cached insights ─────────────────────────────────────────────────────

export async function getLatestInsights(userId: string): Promise<SpecialistInsights | null> {
  const admin = getSupabaseAdmin();
  const today = getLocalDate();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yd = yesterday.toISOString().split("T")[0];

  const { data } = await admin
    .from("specialist_insights")
    .select("specialist,patterns,concerns,strengths,summary,date")
    .eq("user_id", userId)
    .in("date", [today, yd])
    .order("date", { ascending: false });

  if (!data || data.length === 0) return null;

  // Take most recent entry per specialist (today preferred over yesterday)
  const seen = new Set<string>();
  const insights: SpecialistInsights = {};
  for (const row of data) {
    if (!seen.has(row.specialist)) {
      seen.add(row.specialist);
      insights[row.specialist as SpecialistName] = {
        patterns: row.patterns ?? [],
        concerns: row.concerns ?? [],
        strengths: row.strengths ?? [],
        summary: row.summary ?? "",
      };
    }
  }
  return Object.keys(insights).length > 0 ? insights : null;
}

// ── Build Maya nudge from insights ────────────────────────────────────────────

const SPECIALIST_LABELS: Record<SpecialistName, string> = {
  psychology:   "Psicólogo",
  sleep:        "Especialista em sono",
  nutrition:    "Nutricionista",
  physical:     "Saúde física",
  goals:        "Coach de metas",
  finance:      "Finanças",
  spirituality: "Espiritualidade e conexão",
  philosophy:   "Filósofo de vida",
};

export async function generateMayaNudge(
  insights: SpecialistInsights,
  userName: string,
  gender: string
): Promise<string> {
  const names = Object.keys(insights) as SpecialistName[];
  const summaryLines = names
    .filter((n) => insights[n]?.summary)
    .map((n) => `${SPECIALIST_LABELS[n]}: ${insights[n]!.summary}`)
    .join("\n");

  const genderNote = gender === "feminino"
    ? "Trate-a no feminino."
    : gender === "masculino"
      ? "Trate-o no masculino."
      : "";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      temperature: 0.75,
      system: `Você é Maya, companheira de transformação pessoal. Escreva UMA mensagem curta e calorosa para ${userName || "a pessoa"}. ${genderNote}
Regras:
- Máximo 2-3 frases curtas
- Escolha o tema mais relevante ou urgente das análises abaixo
- Seja humana e pessoal — como uma amiga querida, não um relatório
- Pode terminar com uma pergunta suave ou convite à reflexão
- Texto plano, sem markdown, sem listas
- Português brasileiro natural`,
      messages: [
        {
          role: "user",
          content: `Análise do dia de ${userName || "hoje"} pelos especialistas:\n${summaryLines}\n\nEscreva a mensagem da Maya agora.`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic nudge ${res.status}`);
  const body = await res.json();
  return String(body.content[0].text).trim();
}
