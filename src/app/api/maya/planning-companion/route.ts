import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildMayaSystemPrompt, GoalSummary, WeekPlanSummary } from "@/lib/maya";
import { getLatestInsights } from "@/lib/specialists";
import { calculateStreak, getWeekMondayDate } from "@/lib/utils";
import { computeCareSignals } from "@/lib/care-signals";
import { callLLM } from "@/lib/llm";
import { habitAnswered } from "@/lib/checkin-answered";
import { NextResponse } from "next/server";
import type { SuggestedTask } from "@/types";

// ── Types ──────────────────────────────────────────────────────────

interface PlanState {
  stones: (string | null)[];
  areasWithTasks: string[];
  emptyAreas: string[];
  totalTasks: number;
  doneTasks: number;
  linkedGoalIds: string[];
  areaTasks?: { area: string; total: number; done: number; titles: string[] }[];
}

interface PrevWeekSummary {
  weekStart: string;
  mainFocus: string | null;
  totalTasks: number;
  doneTasks: number;
  perArea: { area: string; total: number; done: number }[];
  reviewScore: number | null;
}

interface ActiveKR {
  title: string;
  current: number;
  target: number;
  unit: string;
  pct: number;
  area: string | null;
  status: string;
  linkedGoalTitle: string | null;
}

interface ActiveQuarterlyCycle {
  label: string;
  theme: string | null;
  keyResults: ActiveKR[];
  totalKRs: number;
  doneKRs: number;
  avgPct: number;
}

interface PlanningCompanionResponse {
  greeting: string;
  strategicFeedback: string;
  suggestedStones?: { rank: 1 | 2 | 3; text: string; rationale: string }[];
  areaSuggestions?: {
    area: string;
    areaLabel: string;
    message: string;
    suggestedTasks: { title: string; taskType: "manutencao" | "crescimento" }[];
  }[];
}

// ── Area labels ────────────────────────────────────────────────────

const AREA_LABELS: Record<string, string> = {
  saude: "Saúde", carreira: "Carreira", financas: "Finanças",
  relacionamentos: "Relacionamentos", desenvolvimento: "Mente",
  familia: "Família", lazer: "Lazer", espiritualidade: "Espiritualidade",
};

const AREA_EMOJIS: Record<string, string> = {
  saude: "💚", carreira: "💼", financas: "💰",
  relacionamentos: "❤️", desenvolvimento: "🧠",
  familia: "🏡", lazer: "🌊", espiritualidade: "✨",
};

// ── Planning-specific system prompt ────────────────────────────────

function buildPlanningPrompt(
  planState: PlanState,
  quarterlyData?: ActiveQuarterlyCycle | null,
  areaVisions?: { area: string; statement: string }[],
  previousWeek?: PrevWeekSummary | null,
  recentChatTopics?: string,
  careSignals?: { title: string; description: string; emoji: string }[],
): string {
  const stonesList = planState.stones.filter(Boolean).map((s, i) => `  Pedra ${i + 1}: "${s}"`).join("\n") || "  (nenhuma pedra definida ainda)";
  const areasWithList = planState.areasWithTasks.length > 0
    ? planState.areasWithTasks.map(a => `  ${AREA_EMOJIS[a] || "•"} ${AREA_LABELS[a] || a}`).join("\n")
    : "  (nenhuma área com tarefas ainda)";
  const emptyList = planState.emptyAreas.length > 0
    ? planState.emptyAreas.map(a => `  ${AREA_EMOJIS[a] || "•"} ${AREA_LABELS[a] || a}`).join("\n")
    : "  (todas as áreas têm tarefas — muito bom!)";

  // Per-area detail of the current week (titles + done/total)
  let areaDetailSection = "";
  if (planState.areaTasks && planState.areaTasks.length > 0) {
    const detailLines = planState.areaTasks.map(at =>
      `  ${AREA_EMOJIS[at.area] || "•"} ${AREA_LABELS[at.area] || at.area} (${at.done}/${at.total}): ${at.titles.join(" · ") || "—"}`
    ).join("\n");
    areaDetailSection = `
### DETALHE DAS TAREFAS DESTA SEMANA
${detailLines}
`;
  }

  // Previous week comparison
  let previousWeekSection = "";
  if (previousWeek) {
    const prevPerArea = previousWeek.perArea.length > 0
      ? previousWeek.perArea.map(pa => `  ${AREA_EMOJIS[pa.area] || "•"} ${AREA_LABELS[pa.area] || pa.area}: ${pa.done}/${pa.total}`).join("\n")
      : "  (sem registro de áreas)";
    previousWeekSection = `
### SEMANA PASSADA (${previousWeek.weekStart})
${previousWeek.mainFocus ? `Foco principal: "${previousWeek.mainFocus}"` : "Sem foco definido"}
Tarefas: ${previousWeek.totalTasks} planejadas, ${previousWeek.doneTasks} concluídas.
${previousWeek.reviewScore != null ? `Autoavaliação: ${previousWeek.reviewScore}/5` : "Sem autoavaliação registrada."}
Por área:
${prevPerArea}
`;
  }

  // Recent chat continuity (same Maya as the Home/chat)
  let chatSection = "";
  if (recentChatTopics) {
    chatSection = `
### CONVERSA RECENTE NO CHAT (você é a MESMA Maya do chat)
${recentChatTopics}

REGRAS DE CONTINUIDADE:
- Tudo que foi decidido, adiado ou corrigido nessa conversa vale também aqui. Se a pessoa mudou de ideia sobre algo, honre a mudança.
- NUNCA contradiga o que a pessoa acabou de te dizer.
- NÃO repita perguntas já respondidas. Referencie o que já foi conversado com naturalidade.
`;
  }

  // Care signals (what the data says to watch for)
  let careSection = "";
  if (careSignals && careSignals.length > 0) {
    careSection = `
### O QUE CUIDAR NOS PRÓXIMOS DIAS (detectado pelos dados)
${careSignals.slice(0, 3).map(s => `  ${s.emoji} ${s.title}: ${s.description}`).join("\n")}

REGRAS:
- Se um cuidado detectado combina com uma área do plano, sugira uma tarefa concreta para ele (ex: sono caindo → priorizar descanso/rotina noturna).
- Fale com naturalidade, sem relatório e sem números de diagnóstico.
- NÃO force: se o plano já trata disso, reconheça em vez de empilhar.
`;
  }

  // Build quarterly OKR section if available
  let quarterlySection = "";
  if (quarterlyData) {
    const krLines = quarterlyData.keyResults.map(kr => {
      const areaLabel = kr.area ? `${AREA_EMOJIS[kr.area] || "•"} ${AREA_LABELS[kr.area] || kr.area}` : "sem área";
      const linkedGoal = kr.linkedGoalTitle ? ` (meta: "${kr.linkedGoalTitle}")` : "";
      const done = kr.status === "completed" ? "✅" : "🔄";
      return `  ${done} [${kr.pct}%] ${kr.title} — ${kr.current}/${kr.target}${kr.unit}${linkedGoal} · ${areaLabel}`;
    }).join("\n") || "  (nenhum KR definido)";

    quarterlySection = `
### OKRs DO TRIMESTRE ATUAL (${quarterlyData.label})
${quarterlyData.theme ? `Tema: "${quarterlyData.theme}"` : "Sem tema definido"}
Progresso: ${quarterlyData.doneKRs}/${quarterlyData.totalKRs} KRs concluídos · ${quarterlyData.avgPct}% de progresso médio

**Key Results ativos:**
${krLines}
`;
  }

  // Build vision section if available
  let visionSection = "";
  if (areaVisions && areaVisions.length > 0) {
    const defined = areaVisions.filter(v => v.statement.trim());
    if (defined.length > 0) {
      visionSection = `
### VISÃO DE 5 ANOS
${defined.map(v => `  ${AREA_EMOJIS[v.area] || "•"} ${AREA_LABELS[v.area] || v.area}: "${v.statement.slice(0, 200)}${v.statement.length > 200 ? "..." : ""}"`).join("\n")}

`;
    }
  }

  return `

## MODO PLANEJAMENTO — VOCÊ É UMA CONSELHEIRA ESTRATÉGICA

Você está ajudando o usuário a planejar a semana. Este é um momento de reflexão estratégica, como generais ao redor de um mapa. Seu papel é ser uma companheira que ajuda a pensar melhor — não uma ferramenta que cospe listas.

### Estado atual do plano:
**Pedras (focos principais):**
${stonesList}

**Áreas com tarefas:**
${areasWithList}

**Áreas VAZIAS (sem nenhuma tarefa):**
${emptyList}

**Total:** ${planState.totalTasks} tarefas planejadas, ${planState.doneTasks} concluídas.
${areaDetailSection}${previousWeekSection}${quarterlySection}${visionSection}${chatSection}${careSection}
### SUA MISSÃO NESTE MODO

Você é uma estrategista. Os dados acima são o MAPA. Seu conhecimento do usuário (diário, check-ins, metas, memórias, especialistas) é a INTELIGÊNCIA. Combine os dois para ajudar a pessoa a tomar melhores decisões. NÃO seja passiva: o usuário espera que você OPINE, SUGIRA e aponte o que ela não está vendo.

**Como pensar:**
1. Olhe para as áreas vazias. Por que estão vazias? Isso é intencional ou descuido?
2. COMPARE com a semana passada: o que mudou? Uma área que estava forte agora sumiu? Você está repetindo sempre o mesmo padrão? Diga explicitamente o que fazer de diferente.
3. Cruze com o que você sabe: se o diário menciona algo, se o check-in mostra um padrão, se uma meta ativa está parada, se um especialista já deu uma recomendação que você ainda não seguiu.
4. Conecte as pedras com as áreas: as pedras cobrem as áreas certas? Há desequilíbrio (muita tarefa em uma área, zero em outra)?
5. Traga ESTRATÉGIAS VALIDADAS: se os especialistas (sono, psicologia, nutrição, atividade física, finanças, espiritualidade) já apontaram algo, transforme isso em sugestão concreta desta semana.
6. Pergunte-se: "Se eu fosse essa pessoa, o que eu gostaria que alguém me lembrasse agora — e o que eu não percebo sozinha?"

**Como responder (formato JSON obrigatório):**

Você DEVE responder EXATAMENTE neste formato JSON (sem texto antes ou depois):

{
  "greeting": "Uma saudação curta e pessoal (1 frase). Use o nome da pessoa se souber. Ex: 'Boa tarde, Leticia! Pronta para planejar a semana?'",
  "strategicFeedback": "2-4 frases de observação estratégica e OPINIÃO. Aponte o que a pessoa não está vendo: compare com a semana passada, note desequilíbrios, conecte com metas/OKRs/diário/especialistas. Ex: 'Semana passada você concluiu 5 tarefas em carreira, mas lazer ficou zerado de novo — e a especialista de sono já avisou que você precisa desacelerar à noite. Que tal uma pedra de descanso esta semana?'",
  "suggestedStones": [
    {
      "rank": 1,
      "text": "Sugestão de pedra (frase curta e acionável)",
      "rationale": "Por que isso faria sentido esta semana (1 frase)"
    }
  ],
  "areaSuggestions": [
    {
      "area": "lazer",
      "areaLabel": "Lazer",
      "message": "Sua observação sobre esta área (1-2 frases, use contexto real)",
      "suggestedTasks": [
        { "title": "Título da tarefa sugerida", "taskType": "manutencao" }
      ]
    }
  ]
}

**REGRAS IMPORTANTES:**
- Use SEMPRE o nome da pessoa se disponível
- Se houver OKRs trimestrais, RELACIONE suas sugestões com os KRs ativos:
  * Se há KRs com pouco progresso, sugira pedras e tarefas que avancem especificamente esses KRs
  * Se um KR está próximo da meta (≥80%), celebre e incentive o sprint final
  * Se um KR está travado (0%), pergunte se ainda faz sentido ou se precisa de ajuste
  * Se uma pedra atual se alinha com um KR, mencione essa conexão
- Se houver visões de 5 anos, use-as como o NORTE estratégico:
  * Se uma área tem visão mas está vazia no plano, pergunte com curiosidade: "Sua visão para [área] é linda — quer pensar em algo para essa semana que te aproxime dela?"
  * Conecte pedras sugeridas com a visão: "Essa pedra te aproxima da sua visão de [área]"
  * Se um KR está alinhado com uma visão, mencione essa cascata: visão → KR → pedra
- Se houver áreas vazias, dê sugestões para CADA uma delas
- Se o diário mencionou algo relevante, conecte ("Você escreveu 'me sinto sobrecarregada' e carreira tem 7 tarefas...")
- Se metas ativas estão paradas, lembre com leveza
- Se houver dados da SEMANA PASSADA, USE-OS: compare por área e diga o que fazer de diferente — o que repetir, o que parar, o que começar
- Se especialistas já deram recomendações, traga como ESTRATÉGIA VALIDADA (ex: "a especialista de sono sugeriu X — quer colocar como tarefa esta semana?")
- Sugira tarefas CONCRETAS e PESSOAIS, baseadas no que você sabe da pessoa
- NUNCA sugira tarefas genéricas ("Fazer exercício") — sempre contextualize ("Caminhar no parque que você gosta" se isso estiver nas memórias)
- Se não há informação suficiente para personalizar, seja honesta e encorajadora
- suggestedStones: sugira 0-3 pedras. Se as pedras atuais já são boas, retorne array vazio
- areaSuggestions: foque nas áreas VAZIAS primeiro, depois nas que têm poucas tarefas. Considere também áreas dos KRs ativos
- taskType: "manutencao" para hábitos/rotina, "crescimento" para coisas novas/expansão
- NUNCA invente dados. Se não sabe algo sobre a pessoa, não finja que sabe.
- TEXTO PLANO, sem markdown.`;
}

// ── Focused area suggestion prompt (per-area "sugerir" button) ─────

function buildAreaFocusPrompt(focusArea: string): string {
  const label = AREA_LABELS[focusArea] || focusArea;
  const emoji = AREA_EMOJIS[focusArea] || "•";
  return `
## MODO PLANEJAMENTO — SUGESTÃO FOCADA EM UMA ÁREA

O usuário quer ideias de tarefas para a área ${emoji} ${label} (que está sem tarefas ou com poucas esta semana).

Você conhece o usuário: diário, check-ins, metas, memórias, especialistas e visão de 5 anos. Use isso para gerar sugestões CONCRETAS e PESSOAIS para ESTA área específica.

Responda APENAS o JSON (sem texto antes ou depois):
{
  "message": "1-2 frases de observação sobre esta área, conectando com o que você sabe da pessoa",
  "suggestedTasks": [
    { "title": "Tarefa concreta e pessoal", "taskType": "manutencao" }
  ]
}

REGRAS:
- Sugira de 3 a 5 tarefas
- NUNCA genéricas ("Fazer exercício") — sempre contextualize com o que você sabe da pessoa
- Se esta área tem uma visão de 5 anos, conecte as tarefas com ela
- Se um especialista já deu recomendação relacionada, transforme em tarefa concreta
- taskType: "manutencao" para hábitos/rotina, "crescimento" para coisas novas/expansão
- TEXTO PLANO, sem markdown.`;
}

// ── POST ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const weekStart: string = body.weekStart || getWeekMondayDate();
    const planState: PlanState = body.planState || {
      stones: [], areasWithTasks: [], emptyAreas: [], totalTasks: 0, doneTasks: 0, linkedGoalIds: [],
    };
    // When set, Maya focuses suggestions on a single area (per-area "sugerir" button)
    const focusArea: string | null = typeof body.focusArea === "string" ? body.focusArea : null;

    // Monday of the previous week (relative to the week being planned, not "today")
    const prevWeekStart = (() => {
      const d = new Date(weekStart + "T12:00:00");
      d.setDate(d.getDate() - 7);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();

    const admin = getSupabaseAdmin();

    // ── Fetch user context (same pattern as POST /api/maya) ──
    const [prefsRes, checkInsRes, diaryRes, memoriesRes, goalsRes, weekPlanRes, prevWeekRes, specialistRes, quarterlyRes, visionsRes, chatRes, careSignals] = await Promise.all([
      admin.from("user_preferences").select("context").eq("user_id", user.id).single(),
      admin.from("check_ins").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(7),
      admin.from("diary_entries").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(10),
      admin.from("user_memories").select("fact").eq("user_id", user.id).order("created_at", { ascending: false }),
      admin.from("goals").select(`*, goal_stages(*, goal_actions(*))`)
        .eq("user_id", user.id).eq("status", "ativa")
        .order("created_at", { ascending: true })
        .order("position", { foreignTable: "goal_stages", ascending: true }),
      admin.from("weekly_plans").select(`*, weekly_reviews(*), weekly_focus_goals(goal_id)`)
        .eq("user_id", user.id).eq("week_start", weekStart).maybeSingle(),
      admin.from("weekly_plans").select(`*, weekly_tasks(*), weekly_reviews(*)`)
        .eq("user_id", user.id).eq("week_start", prevWeekStart).maybeSingle(),
      getLatestInsights(user.id).catch(() => null),
      admin.from("quarterly_cycles")
        .select(`*, key_results(*), quarterly_reviews(*)`)
        .eq("user_id", user.id).eq("status", "active")
        .order("position", { foreignTable: "key_results", ascending: true })
        .maybeSingle(),
      admin.from("area_visions").select("*").eq("user_id", user.id).order("area", { ascending: true }),
      admin.from("chat_messages").select("role, content").eq("user_id", user.id)
        .or("chat_type.is.null,chat_type.eq.maya")
        .order("created_at", { ascending: false }).limit(8),
      computeCareSignals(user.id),
    ]);

    const context = (prefsRes.data?.context || {}) as Record<string, unknown>;
    const checkIns = checkInsRes.data || [];
    const diaryEntries = diaryRes.data || [];
    const memories = (memoriesRes.data || []).map((m: { fact: string }) => m.fact);
    const rawGoals = goalsRes.data || [];
    const weekPlanRaw = weekPlanRes.data;
    const latestInsights = specialistRes ?? null;

    // ── Build GoalSummary[] ──
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeGoals: GoalSummary[] = rawGoals.map((g: Record<string, unknown>) => {
      const stages = (g.goal_stages as Record<string, unknown>[]) || [];
      const totalStages = stages.length;
      const doneStages = stages.filter((s) => s.status === "concluida").length;
      const pct = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;

      const timestamps: number[] = [new Date(g.updated_at as string).getTime()];
      for (const s of stages) {
        timestamps.push(new Date(s.updated_at as string).getTime());
        for (const a of (s.goal_actions as Record<string, unknown>[]) || []) {
          timestamps.push(new Date(a.updated_at as string).getTime());
        }
      }
      const lastActive = new Date(Math.max(...timestamps));
      lastActive.setHours(0, 0, 0, 0);
      const daysInactive = Math.floor((today.getTime() - lastActive.getTime()) / 86_400_000);

      let nextAction: string | null = null;
      for (const s of stages) {
        if (s.status !== "concluida") {
          const pendingAction = ((s.goal_actions as Record<string, unknown>[]) || []).find((a) => a.status === "pendente");
          if (pendingAction) { nextAction = pendingAction.title as string; break; }
          break;
        }
      }

      const daysUntilDeadline = g.target_date
        ? Math.floor((new Date(g.target_date as string).getTime() - today.getTime()) / 86_400_000)
        : null;

      return {
        title: g.title as string,
        area: g.area as string,
        pct,
        daysInactive,
        nextAction,
        daysUntilDeadline,
        guardianName: (g.guardian_name as string) || null,
        reward: (g.reward as string) || null,
        punishment: (g.punishment as string) || null,
      };
    });

    // ── Build WeekPlanSummary ──
    let weekPlan: WeekPlanSummary | null = null;
    if (weekPlanRaw) {
      const reviews = (weekPlanRaw.weekly_reviews as Record<string, unknown>[]) || [];
      const review = reviews[0] ?? null;
      weekPlan = {
        mainFocus: weekPlanRaw.main_focus as string,
        focusGoalCount: ((weekPlanRaw.weekly_focus_goals as unknown[]) || []).length,
        hasReview: !!review,
        reviewScore: review ? (review.week_score as number) : null,
      };
    }

    // ── Build previous week summary (for week-over-week comparison) ──
    let previousWeek: PrevWeekSummary | null = null;
    const prevWeekRaw = prevWeekRes.data as Record<string, unknown> | null;
    if (prevWeekRaw) {
      const prevTasks = (prevWeekRaw.weekly_tasks as Record<string, unknown>[]) || [];
      const prevReviews = (prevWeekRaw.weekly_reviews as Record<string, unknown>[]) || [];
      const prevReview = prevReviews[0] ?? null;
      const perAreaMap: Record<string, { total: number; done: number }> = {};
      for (const t of prevTasks) {
        const area = (t.area as string) || "outros";
        if (!perAreaMap[area]) perAreaMap[area] = { total: 0, done: 0 };
        perAreaMap[area].total += 1;
        if (t.status === "concluida") perAreaMap[area].done += 1;
      }
      previousWeek = {
        weekStart: prevWeekStart,
        mainFocus: (prevWeekRaw.main_focus as string) || null,
        totalTasks: prevTasks.length,
        doneTasks: prevTasks.filter(t => t.status === "concluida").length,
        perArea: Object.entries(perAreaMap).map(([area, v]) => ({ area, total: v.total, done: v.done })),
        reviewScore: prevReview ? (prevReview.week_score as number) : null,
      };
    }

    // ── Build active quarterly cycle data ──
    let quarterlyData: ActiveQuarterlyCycle | null = null;
    const quarterlyCycle = quarterlyRes.data as Record<string, unknown> | null;
    if (quarterlyCycle) {
      const krs = (quarterlyCycle.key_results as Record<string, unknown>[]) || [];
      const activeKRs: ActiveKR[] = [];

      for (const kr of krs) {
        const current = kr.current as number;
        const target = kr.target as number;
        const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

        // Look up linked goal title
        let linkedGoalTitle: string | null = null;
        if (kr.linked_goal_id) {
          const linkedGoal = activeGoals.find(g => {
            const rawGoal = rawGoals.find((rg: Record<string, unknown>) => rg.id === kr.linked_goal_id);
            return rawGoal && rawGoal.title === g.title;
          });
          // simpler: find from rawGoals directly
          const rg = rawGoals.find((rg: Record<string, unknown>) => rg.id === kr.linked_goal_id);
          if (rg) linkedGoalTitle = rg.title as string;
        }

        activeKRs.push({
          title: kr.title as string,
          current,
          target,
          unit: kr.unit as string,
          pct,
          area: (kr.area as string) || null,
          status: kr.status as string,
          linkedGoalTitle,
        });
      }

      const doneKRs = activeKRs.filter(k => k.status === "completed").length;
      const avgPct = activeKRs.length > 0
        ? Math.round(activeKRs.reduce((sum, k) => sum + k.pct, 0) / activeKRs.length)
        : 0;

      quarterlyData = {
        label: quarterlyCycle.label as string,
        theme: (quarterlyCycle.theme as string) || null,
        keyResults: activeKRs,
        totalKRs: activeKRs.length,
        doneKRs,
        avgPct,
      };
    }

    // ── Build area visions ──
    const areaVisions = ((visionsRes.data || []) as Record<string, unknown>[]).map((v) => ({
      area: v.area as string,
      statement: (v.statement as string) || "",
    }));

    const streak = calculateStreak(checkIns.map((c: Record<string, unknown>) => c.date as string));

    // ── Recent chat topics (continuity: same Maya as the Home/chat) ──
    const recentChatTopics = ((chatRes.data || []) as Record<string, unknown>[])
      .filter((m) => m.role === "assistant" || m.role === "user")
      .reverse()
      .map((m) => `${m.role === "assistant" ? "Maya" : "Usuário"}: ${(m.content as string)?.slice(0, 200)}`)
      .join("\n");

    // ── Build specialist summaries ──
    let specialistSummaries = undefined;
    if (latestInsights && typeof latestInsights === "object") {
      const insights = latestInsights as Record<string, unknown>;
      specialistSummaries = {
        psychology: (insights.psychology as string) || undefined,
        sleep: (insights.sleep as string) || undefined,
        nutrition: (insights.nutrition as string) || undefined,
        physical: (insights.physical as string) || undefined,
        goals: (insights.goals as string) || undefined,
        finance: (insights.finance as string) || undefined,
        spirituality: (insights.spirituality as string) || undefined,
        philosophy: (insights.philosophy as string) || undefined,
      };
    }

    // ── Build system prompt ──
    const currentHour = new Date().getHours();
    const currentDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

    const systemPrompt = buildMayaSystemPrompt({
      currentHour,
      currentDate,
      language: (context.language as string) || "pt",
      profile: {
        name: (user.user_metadata?.name as string) || "",
        gender: (context.gender as string) || "nao_dizer",
        has_medication: context.has_medication === true,
        has_faith: context.has_faith === true,
        has_creative_hobby: context.has_creative_hobby === true,
      },
      recentCheckIns: checkIns.map((c: Record<string, unknown>) => ({
        date: c.date as string,
        feeling: (c.feeling as string) || "",
        positives: [
          c.exercise_walk && "exercício",
          c.ate_well && "comeu bem",
          c.drank_water && "água",
          c.slept_well && "dormiu bem",
          c.meditation_prayer_breathing && "meditou/orou",
          c.creative_activity && "criatividade",
          c.did_something_enjoyable && "algo que gostou",
          c.worked_on_goals && "metas",
        ].filter(Boolean) as string[],
        negatives: [
          !c.exercise_walk && habitAnswered(c, "exercise_walk") && "sem exercício",
          !c.ate_well && habitAnswered(c, "ate_well") && "comeu mal",
          !c.drank_water && habitAnswered(c, "drank_water") && "pouca água",
          !c.slept_well && habitAnswered(c, "slept_well") && "dormiu mal",
        ].filter(Boolean) as string[],
      })),
      recentDiary: diaryEntries.map((d: Record<string, unknown>) => ({
        date: d.date as string,
        content: (d.content as string) || "",
        mood: (d.mood as number) ?? null,
      })),
      memories,
      porques: ((context.porques as any[]) || []).map((p: any) => ({
        id: p.id || "",
        text: p.text || "",
        photoPath: p.photo_path || p.photoPath || null,
      })),
      streak,
      activeGoals,
      weekPlan,
      specialistSummaries,
      areaVisions: areaVisions.filter(v => v.statement.trim()),
    });

    // ── Append planning-specific prompt ──
    const fullPrompt = focusArea
      ? systemPrompt + buildAreaFocusPrompt(focusArea)
      : systemPrompt + buildPlanningPrompt(planState, quarterlyData, areaVisions, previousWeek, recentChatTopics, careSignals);

    // ── Call LLM ──
    const userMessage = focusArea
      ? `Sugira tarefas concretas para a área ${AREA_LABELS[focusArea] || focusArea}. Responda APENAS o JSON no formato especificado, sem texto antes ou depois.`
      : `Analise o plano da semana e me ajude como conselheira estratégica. Responda APENAS o JSON no formato especificado, sem texto antes ou depois.`;

    const llmResponse = await callLLM(fullPrompt, userMessage, { maxTokens: focusArea ? 500 : 800 });

    // ── Parse JSON response ──
    let parsed: PlanningCompanionResponse;
    try {
      // Extract JSON from response (may have markdown fences or extra text)
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      const raw = JSON.parse(jsonMatch[0]);

      if (focusArea) {
        // Focused shape: { message, suggestedTasks } → wrap as a single area suggestion
        const focusTasks: SuggestedTask[] = Array.isArray(raw.suggestedTasks)
          ? (raw.suggestedTasks as Record<string, unknown>[])
              .map((t) => ({
                title: String(t.title || ""),
                taskType: (t.taskType === "crescimento" ? "crescimento" : "manutencao") as "manutencao" | "crescimento",
              }))
              .filter((t) => t.title)
          : [];
        parsed = {
          greeting: "",
          strategicFeedback: "",
          suggestedStones: [],
          areaSuggestions: [{
            area: focusArea,
            areaLabel: AREA_LABELS[focusArea] || focusArea,
            message: typeof raw.message === "string" ? raw.message : "",
            suggestedTasks: focusTasks,
          }],
        };
      } else {
        parsed = raw as PlanningCompanionResponse;
      }
    } catch {
      // Fallback: return a friendly but empty response
      const firstName = (user.user_metadata?.name as string || "").split(" ")[0];
      if (focusArea) {
        parsed = {
          greeting: "",
          strategicFeedback: "",
          suggestedStones: [],
          areaSuggestions: [{
            area: focusArea,
            areaLabel: AREA_LABELS[focusArea] || focusArea,
            message: "",
            suggestedTasks: [],
          }],
        };
      } else {
        parsed = {
          greeting: firstName ? `Olá, ${firstName}! Vamos planejar sua semana?` : "Vamos planejar sua semana?",
          strategicFeedback: planState.emptyAreas.length > 0
            ? `Notei que ${planState.emptyAreas.map(a => AREA_LABELS[a] || a).join(", ")} ${planState.emptyAreas.length === 1 ? "está" : "estão"} sem tarefas. Que tal pensarmos juntos no que colocar lá?`
            : "Seu plano está tomando forma! Quer que eu revise algo específico?",
          suggestedStones: [],
          areaSuggestions: planState.emptyAreas.map(area => ({
            area,
            areaLabel: AREA_LABELS[area] || area,
            message: `Esta área está vazia. Que tal adicionar pelo menos uma tarefa?`,
            suggestedTasks: [],
          })),
        };
      }
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("POST /api/maya/planning-companion error:", error);
    return NextResponse.json({
      greeting: "Vamos planejar sua semana!",
      strategicFeedback: "",
      suggestedStones: [],
      areaSuggestions: [],
    } as PlanningCompanionResponse);
  }
}
