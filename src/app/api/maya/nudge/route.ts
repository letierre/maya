import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getLocalDate } from "@/lib/utils";
import { callLLM } from "@/lib/llm";

// ── Trigger detection ──────────────────────────────────────────────────────────

interface NudgeResult {
  id: string;
  message: string;
  priority: number; // 1 = highest
  action?: { label: string; href: string };
}

function saludo(firstName: string): string {
  return `Oii, ${firstName || ""}`.trim().replace(/\s+$/, "") + "!";
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function detectAllTriggers(
  userId: string,
  today: string,
  firstName: string,
  gender: string,
): Promise<{ results: NudgeResult[]; memFacts: string[]; recentChatTopics: { role: string; content: string }[] }> {
  const admin = getSupabaseAdmin();

  const soloSolo = gender === "feminino" ? "sozinha" : "sozinho";
  const oo = gender === "feminino" ? "a" : "o";

  // Fetch recent data
  const [
    { data: recentCheckIns },
    { data: activeGoals },
    { data: todayTx },
    { data: lastDiary },
    { data: currentPlan },
    { data: recentSleep },
    { data: memories },
    { data: recentChatMessages },
  ] = await Promise.all([
    admin.from("check_ins").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(10),
    admin.from("goals").select("*, goal_stages(*)").eq("user_id", userId).eq("status", "ativa").order("created_at", { ascending: true }),
    admin.from("financial_transactions").select("amount, type").eq("user_id", userId).gte("date", `${today.slice(0, 7)}-01`).lte("date", `${today.slice(0, 7)}-31`),
    admin.from("diary_entries").select("date").eq("user_id", userId).order("date", { ascending: false }).limit(1),
    // Current week plan with tasks
    admin.from("weekly_plans").select("*, weekly_tasks(*)").eq("user_id", userId).eq("week_start", getWeekMonday(today)).maybeSingle(),
    admin.from("sleep_logs").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(7),
    admin.from("user_memories").select("fact").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    admin.from("chat_messages").select("role, content").eq("user_id", userId).order("created_at", { ascending: false }).limit(6),
  ]);

  function getWeekMonday(date: string): string {
    const d = new Date(date + "T12:00:00");
    const dow = d.getDay();
    const daysToMonday = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + daysToMonday);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const checks = recentCheckIns || [];

  const greet = saludo(firstName);
  const hasTodayCheckIn = checks.length > 0 && checks[0]?.date === today;
  const results: NudgeResult[] = [];

  // ── STREAK IN RISK ──
  if (checks.length >= 3 && !hasTodayCheckIn) {
    let streak = 0;
    const todayDate = new Date(today + "T12:00:00");
    for (let i = 0; i < checks.length; i++) {
      const checkDate = new Date(checks[i].date + "T12:00:00");
      const expected = new Date(todayDate);
      expected.setDate(expected.getDate() - i);
      if (checkDate.getTime() === expected.getTime()) streak++;
      else break;
    }
    if (streak >= 5) {
      results.push({
        id: "streak_risk",
        message: pick([
          `${greet} vi que você está há ${streak} dias sem falhar no check-in. Hoje ainda não rolou... tá tudo bem?`,
          `${greet} ${streak} dias seguidos! 🥺 Vi que hoje ainda não fez seu check-in. Aconteceu alguma coisa?`,
          `${greet} sua corrente de ${streak} dias tá correndo perigo! Tá tudo bem? Não precisa escrever muito, só uns toques.`,
        ]),
        priority: 1,
        action: { label: "Fazer check-in agora", href: "/check-in" },
      });
    }
  }

  // ── SLEEP PATTERN ──
  if (checks.length >= 4) {
    const last4 = checks.slice(0, 4);
    const badSleepCount = last4.filter((c: any) => c.slept_well === false).length;
    if (badSleepCount >= 3) {
      results.push({
        id: "sleep_bad",
        message: pick([
          `${greet} vi que você dormiu mal nos últimos 3 dias. Isso mexe com tudo: humor, energia, foco. Quer conversar sobre o que pode estar atrapalhando?`,
          `${greet} notei que seu sono não tá legal faz 3 dias. Às vezes a gente nem percebe o que tá roubando nosso descanso. Bora tentar entender juntos?`,
          `${greet} olhei aqui e vi que você não dormiu bem nos últimos dias. Seu corpo tá pedindo atenção. O que será que tá roubando seu sono?`,
        ]),
        priority: 2,
        action: { label: "Conversar com Maya", href: "/insights" },
      });
    }
  }

  // ── MOOD DROP ──
  if (checks.length >= 3) {
    const last3 = checks.slice(0, 3);
    const moods = last3.filter((c: any) => c.mood_tags?.length > 0).map((c: any) => c.mood_tags[0]);
    const negativeMoods = moods.filter((m: string) =>
      ["ansiosa", "triste", "cansada", "sobrecarregada", "irritada"].includes(m)
    );
    if (negativeMoods.length >= 2 && moods.length >= 2) {
      results.push({
        id: "mood_drop",
        message: pick([
          `${greet} vi que seu humor caiu nos últimos dias. Não precisa enfrentar isso ${soloSolo}. Me conta o que tá pesando?`,
          `${greet} tá tudo bem não estar bem. Vi que você não está nos seus melhores dias. Quer desabafar um pouco?`,
          `${greet} senti que você tá mais pra baixo esses dias. Se quiser conversar, tô aqui. Sem pressa, sem cobrança.`,
        ]),
        priority: 2,
        action: { label: "Conversar com Maya", href: "/insights" },
      });
    }
  }

  // ── DIARY ABANDONED ──
  if (lastDiary && lastDiary.length > 0) {
    const lastDiaryDate = new Date(lastDiary[0].date + "T12:00:00");
    const now = new Date(today + "T12:00:00");
    const daysSince = Math.floor((now.getTime() - lastDiaryDate.getTime()) / 86_400_000);
    if (daysSince >= 5) {
      results.push({
        id: "diary_abandoned",
        message: pick([
          `${greet} faz ${daysSince} dias que você não escreve no diário. Escrever ajuda a clarear a mente... quando quiser, tô aqui pra ler.`,
          `${greet} vi que seu diário tá paradinho faz ${daysSince} dias. Não precisa escrever um texto, uma frase já vale. Tá afim?`,
          `${greet} lembrei do seu diário... já faz ${daysSince} dias. Às vezes a gente só precisa despejar os pensamentos em algum lugar.`,
        ]),
        priority: 3,
        action: { label: "Escrever no diário", href: "/diario/novo" },
      });
    }
  }

  // ── GOAL STAGNATION ──
  if (activeGoals && activeGoals.length > 0) {
    const nowDate = new Date();
    for (const g of activeGoals) {
      const stages = (g.goal_stages as any[]) || [];
      const timestamps = [new Date(g.updated_at).getTime()];
      for (const s of stages) timestamps.push(new Date(s.updated_at).getTime());
      const lastActive = Math.max(...timestamps);
      const daysInactive = Math.floor((nowDate.getTime() - lastActive) / 86_400_000);
      if (daysInactive >= 7) {
        // Humanize goal title: remove numbers, simplify
        const rawTitle: string = g.title || "";
        const summary = rawTitle
          .replace(/\d+\s*(kg|kilos|quilos|meses|dias|semanas)/gi, "")
          .replace(/em\s+\d+\s+\w+/gi, "")
          .replace(/[\(\)]/g, "")
          .trim()
          .slice(0, 40) || "melhorar";
        results.push({
          id: "goal_stale",
          message: pick([
            `${greet} vi que sua meta de ${summary} tá paradinha há ${daysInactive} dias. Quer destravar? Posso te ajudar a pensar no primeiro passo.`,
            `${greet} estava olhando aqui e vi que você não mexeu na sua meta de ${summary} faz um tempinho. Tá difícil? Me conta.`,
            `${greet} sabe aquela meta de ${summary}? Tá parada há ${daysInactive} dias. Mas ei, isso é normal. Bora dar um passo pequeno hoje?`,
          ]),
          priority: 3,
        action: { label: "Ver minhas metas", href: "/agenda" },
        });
      }
    }
  }

  // ── SPENDING ALERT ──
  const totalSpent = (todayTx || []).filter((t: any) => t.type === "despesa").reduce((s: number, t: any) => s + (t.amount || 0), 0);
  if (totalSpent > 80) {
    results.push({
      id: "spending",
      message: pick([
        `${greet} vi que já gastou R$ ${totalSpent.toFixed(0).replace(".", ",")} este mês. Tá conseguindo se organizar? Posso te ajudar a revisar.`,
        `${greet} dei uma olhada nos seus gastos e bateu R$ ${totalSpent.toFixed(0).replace(".", ",")} em compras. Quer dar uma revisada comigo?`,
        `${greet} notei que seus gastos tão em R$ ${totalSpent.toFixed(0).replace(".", ",")}. Tudo sob controle ou quer uma ajudinha pra revisar?`,
      ]),
      priority: 4,
    action: { label: "Ver finanças", href: "/financas" },
    });
  }

  // ── PLAN: OVERDUE TASKS ──
  if (currentPlan) {
    const weekTasks = (currentPlan as any).weekly_tasks || [];
    const todayDow = new Date(today + "T12:00:00").getDay();
    const todayIdx = todayDow === 0 ? 6 : todayDow - 1; // 0=Mon..6=Sun
    const overdue = weekTasks.filter((t: any) =>
      t.day_of_week != null && t.day_of_week >= 0 &&
      t.day_of_week < todayIdx &&
      t.status !== "concluida"
    );
    if (overdue.length > 0) {
      const names = overdue.slice(0, 2).map((t: any) => `"${t.title.slice(0, 30)}"`).join(" e ");
      const extra = overdue.length > 2 ? ` e mais ${overdue.length - 2}` : "";
      results.push({
        id: "plan_overdue",
        message: pick([
          `${greet} ${overdue.length === 1 ? "tem uma tarefa" : `tem ${overdue.length} tarefas`} pendente de dias anteriores: ${names}${extra}. Quer reagendar ou concluir hoje?`,
          `${greet} ${names}${extra} ${overdue.length === 1 ? "ficou" : "ficaram"} pra trás essa semana. Bora dar um jeito? Posso ajudar a reorganizar.`,
          `${greet} olhei sua semana e ${names}${extra} ainda não ${overdue.length === 1 ? "foi feito" : "foram feitos"}. ${overdue.length > 2 ? "Não se culpe, isso acontece. " : ""}Quer priorizar isso hoje?`,
        ]),
        priority: 1,
        action: { label: "Ver planejamento", href: "/agenda?tab=semana" },
      });
    }
  }

  // ── PLAN: ENERGY MISMATCH ──
  if (currentPlan && (recentSleep || []).length > 0) {
    const lastSleep = (recentSleep || [])[0] as any;
    const sleptBad = lastSleep?.quality != null && lastSleep.quality <= 2;
    const weekTasks = (currentPlan as any).weekly_tasks || [];
    const todayDow2 = new Date(today + "T12:00:00").getDay();
    const todayIdx2 = todayDow2 === 0 ? 6 : todayDow2 - 1;
    const todayGrowthTasks = weekTasks.filter((t: any) =>
      t.day_of_week === todayIdx2 && t.task_type === "crescimento" && t.status !== "concluida"
    );
    if (sleptBad && todayGrowthTasks.length > 0) {
      results.push({
        id: "plan_energy_mismatch",
        message: pick([
          `${greet} dormiu mal essa noite e tem ${todayGrowthTasks.length} tarefa${todayGrowthTasks.length > 1 ? "s" : ""} de crescimento hoje. Quer ajustar? Tarefas de manutenção podem ser melhores hoje.`,
          `${greet} sei que seu sono não foi dos melhores. Tem tarefas ambiciosas hoje — quer trocar alguma por algo mais leve?`,
          `${greet} notei que você dormiu mal mas planejou tarefas de crescimento. Tá se cobrando demais? Hoje pode ser dia de cuidar, não de performar.`,
        ]),
        priority: 2,
        action: { label: "Ajustar planejamento", href: "/agenda?tab=semana" },
      });
    }
  }

  // ── PLAN: EMPTY WEEK ──
  if (!currentPlan || ((currentPlan as any).weekly_tasks || []).length === 0) {
    const dow = new Date(today + "T12:00:00").getDay();
    const isWeekend = dow === 0 || dow === 6; // Sun or Sat
    if (isWeekend) {
      results.push({
        id: "plan_empty_weekend",
        message: pick([
          `${greet} fim de semana chegando! Quer planejar a próxima semana? Separar 5 minutinhos agora evita começar segunda perdid${oo}.`,
          `${greet} tava aqui pensando... quer aproveitar o fim de semana pra esboçar suas pedras da semana que vem? Prometo que segunda você agradece.`,
          `${greet} domingo é um ótimo dia pra planejar. Quer definir suas 3 prioridades da semana? Te ajudo!`,
        ]),
        priority: 3,
        action: { label: "Planejar semana", href: "/agenda?tab=semana" },
      });
    }
  }

  // ── PLAN: PROCRASTINATION DETECTED ──
  if (currentPlan) {
    const weekTasks = (currentPlan as any).weekly_tasks || [];
    const undoneTasks = weekTasks.filter((t: any) => t.status !== "concluida");
    const doneTasks = weekTasks.filter((t: any) => t.status === "concluida");
    const total = weekTasks.length;
    const pct = total > 0 ? Math.round((doneTasks.length / total) * 100) : 0;
    const dow3 = new Date(today + "T12:00:00").getDay();
    // Late in the week (Wed+) and < 30% done
    if (dow3 >= 3 && dow3 <= 5 && total >= 5 && pct < 30) {
      results.push({
        id: "plan_procrastination",
        message: pick([
          `${greet} já é ${["quarta","quinta","sexta"][dow3-3]}-feira e só ${pct}% da semana foi concluído. Quer ajuda pra priorizar o que realmente importa?`,
          `${greet} a semana tá voando e ${undoneTasks.length} tarefas ainda estão pendentes. Que tal focar nas 2 mais importantes hoje?`,
          `${greet} tá tudo bem ter semanas mais lentas. ${undoneTasks.length} coisas pendentes — quer que eu te ajude a escolher por onde começar?`,
        ]),
        priority: 2,
        action: { label: "Ver semana", href: "/agenda?tab=semana" },
      });
    }
    // End of week (Sat/Sun) and nothing done
    if (dow3 === 6 || dow3 === 0) {
      if (total >= 3 && pct === 0) {
        results.push({
          id: "plan_week_wasted",
          message: pick([
            `${greet} fim de semana e nada concluído essa semana. Acontece. Quer começar a próxima com o pé direito? Bora planejar junt${oo === "a" ? "a" : "o"}.`,
            `${greet} essa semana não rolou, e tá tudo bem. Nem toda semana é igual. Quer esboçar 3 coisas importantes pra semana que vem?`,
          ]),
          priority: 2,
          action: { label: "Planejar próxima semana", href: "/agenda?tab=semana" },
        });
      }
    }
  }

  // ── NO CHECK-IN TODAY ──
  if (!hasTodayCheckIn) {
    results.push({
      id: "checkin_miss",
      message: pick([
        `${greet} como você está hoje? Ainda não fez seu check-in. São 2 minutinhos e me ajuda a te conhecer melhor.`,
        `${greet} passando aqui pra saber de você. Não fez o check-in ainda... como tá seu dia?`,
        `${greet} tava por aqui e vi que você ainda não passou no check-in hoje. Como você está?`,
      ]),
      priority: 1,
    action: { label: "Fazer check-in agora", href: "/check-in" },
    });
  }

  const memFacts = ((memories || []) as any[]).map((m: any) => m.fact as string);
  const recentChatTopics = (recentChatMessages || []) as { role: string; content: string }[];

  return { results, memFacts, recentChatTopics };
}

// ── LLM nudge message generation ────────────────────────────────────────────

const MAYA_NUDGE_SYSTEM = `Você é Maya, uma companheira virtual calorosa, curiosa e inteligente.
Você fala português brasileiro com naturalidade e afeto. Trata a pessoa por "você".
Seu tom é de amiga próxima — natural, sem termos técnicos, sem parecer robô.
Você nunca julga. Você é genuína, sem malícia, sem ironia.

REGRAS:
- Você é a MESMA Maya do chat — não existem duas Mayas. Tudo o que foi conversado lá vale aqui.
- NUNCA repita uma pergunta que a pessoa já respondeu (veja memórias e chat)
- NUNCA contradiga o que a pessoa acabou de te dizer: se ela disse que algo NÃO vai acontecer hoje, mudou de dia ou cancelou, honre essa mudança e não fale como se fosse acontecer.
- Se a pessoa já te contou algo importante, faça referência natural
- NUNCA recite dados como relatório
- NUNCA force positividade
- Mensagens curtas: 1 a 2 frases
- Máximo 1 emoji`;

async function generateNudgeViaLLM(
  triggerId: string,
  triggerDescription: string,
  templateMessage: string,
  firstName: string,
  gender: string,
  memFacts: string[],
  recentChatTopics: string,
): Promise<string> {
  const memoriesBlock = memFacts.length > 0
    ? `\n\nO QUE VOCÊ JÁ SABE SOBRE A PESSOA:\n${memFacts.map((m) => `- ${m}`).join("\n")}`
    : "";

  const chatBlock = recentChatTopics
    ? `\n\n## CONVERSA RECENTE NO CHAT (fonte da verdade)\nVocê conversou com a pessoa recentemente. Esta é a MESMA conversa — você é a mesma Maya.\n${recentChatTopics}\n\nREGRAS DE CONTINUIDADE (críticas):\n- Tudo o que foi decidido, adiado ou corrigido nessa conversa vale também aqui: se a pessoa disse que algo NÃO vai acontecer hoje, mudou de dia ou cancelou, NÃO fale como se fosse acontecer.\n- NUNCA contradiga o que a pessoa acabou de te dizer. Honre a mudança.\n- NÃO repita perguntas já respondidas.`
    : "";

  const userPrompt = `Gere uma mensagem curta de nudge para ${firstName || "a pessoa"}.

Contexto do que você detectou: ${triggerDescription}

A mensagem deve:
- Ser calorosa mas direta — a pessoa está na home do app
- Mencionar o que você notou de forma natural
- Se houver memórias sobre esse tema, faça referência: "Sei que me contou sobre..."
- NUNCA repita uma pergunta que já foi respondida
- Termine com uma pergunta ou convite aberto
- Máximo 2 frases, 1 emoji no máximo
- Retorne APENAS a mensagem, sem aspas, sem markdown
${memoriesBlock}${chatBlock}

Mensagem template (use como inspiração, melhore-a): "${templateMessage}"`;

  try {
    const result = await callLLM(MAYA_NUDGE_SYSTEM, userPrompt, { maxTokens: 120, temperature: 0.75 });
    const cleaned = result.replace(/^["']|["']$/g, "").trim();
    if (cleaned && cleaned.length >= 10) return cleaned;
  } catch (err) {
    console.error("LLM nudge failed, using template:", String(err).slice(0, 80));
  }
  return templateMessage; // fallback
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const today = getLocalDate();

  try {
    const { data: prefs } = await admin
      .from("user_preferences")
      .select("context")
      .eq("user_id", user.id)
      .single();

    const context = (prefs?.context ?? {}) as Record<string, unknown>;
    const userName = (user.user_metadata?.name as string) || "";
    const firstName = userName.split(" ")[0];
    const gender = (context.gender as string) || "nao_dizer";

    // ── Continuidade: não faz nudge se a pessoa já conversou hoje ──
    // (evita que um nudge cacheado contradiga uma conversa recente no chat)
    const { count: todayMsgCount } = await admin
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", today + "T00:00:00Z")
      .lte("created_at", today + "T23:59:59Z");
    if (todayMsgCount && todayMsgCount > 0) {
      return NextResponse.json({ nudges: [] });
    }

    // ── Cache check ──
    const cachedNudge = context.maya_nudge as { id: string; message: string; date: string; saved: boolean; releaseHour: number } | undefined;
    if (cachedNudge?.date === today && cachedNudge.message) {
      if (cachedNudge.saved) return NextResponse.json({ nudges: [] });
      // Respect timed release
      const now = new Date();
      const brH = now.getHours();
      if (brH < cachedNudge.releaseHour) return NextResponse.json({ nudges: [] });
      return NextResponse.json({ nudges: [{ id: cachedNudge.id, message: cachedNudge.message, action: (cachedNudge as any).action }] });
    }

    // Get or create check-in count
    const { count } = await admin
      .from("check_ins")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (!count || count === 0) {
      const welcomeMsg = `Oi ${firstName || "você"}! 💜 Eu sou a Maya. Registre seu primeiro check-in e vamos começar essa jornada juntos.`;
      await cacheNudge(admin, user.id, context, "welcome", welcomeMsg, today);
      return NextResponse.json({ nudges: [{ id: "welcome", message: welcomeMsg }] });
    }

    // Detect ALL triggers, pick highest priority
    const { results: nudges, memFacts, recentChatTopics } = await detectAllTriggers(user.id, today, firstName, gender);
    // Transcrição das últimas trocas em ordem cronológica, com papéis explícitos,
    // para o nudge não contradizer o que foi conversado no chat.
    const chatSummary = (recentChatTopics || [])
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .reverse()
      .map((m: any) => `${m.role === "assistant" ? "Maya" : "Usuário"}: ${m.content?.slice(0, 200)}`)
      .join("\n");
    const bestNudge = nudges.sort((a, b) => a.priority - b.priority)[0];

    if (bestNudge) {
      // Try LLM to enhance the message with memory context
      const triggerDescriptions: Record<string, string> = {
        streak_risk: "a pessoa tem uma corrente de check-ins em risco de quebrar hoje",
        sleep_bad: "a pessoa dormiu mal nos últimos 3-4 dias seguidos",
        mood_drop: "o humor da pessoa caiu nos últimos dias (moods negativos consecutivos)",
        diary_abandoned: "a pessoa não escreve no diário há vários dias",
        goal_stale: "uma meta ativa está parada há mais de 7 dias sem atividade",
        spending: "os gastos do mês estão elevados",
        plan_overdue: "há tarefas da semana pendentes de dias anteriores",
        plan_energy_mismatch: "a pessoa dormiu mal mas tem tarefas de crescimento hoje",
        plan_empty_weekend: "não há plano semanal criado, e é fim de semana",
        plan_procrastination: "menos de 30% das tarefas da semana concluídas, já é meio da semana",
        plan_week_wasted: "fim de semana e 0% de conclusão das tarefas",
        checkin_miss: "a pessoa ainda não fez check-in hoje",
      };

      const triggerDesc = triggerDescriptions[bestNudge.id] || bestNudge.id;
      const enhancedMessage = await generateNudgeViaLLM(
        bestNudge.id,
        triggerDesc,
        bestNudge.message,
        firstName,
        gender,
        memFacts || [],
        chatSummary || "",
      );

      // Cache for today with enhanced message
      await cacheNudge(admin, user.id, context, bestNudge.id, enhancedMessage, today, bestNudge.action);

      // Respect random release hour — don't show if too early
      const now = new Date();
      const brH = now.getHours();
      const savedNudge = (context.maya_nudge as any);
      if (savedNudge?.releaseHour && brH < savedNudge.releaseHour) {
        return NextResponse.json({ nudges: [] });
      }

      return NextResponse.json({ nudges: [{ id: bestNudge.id, message: enhancedMessage, action: bestNudge.action }] });
    }

    return NextResponse.json({ nudges: [] });
  } catch (error) {
    console.error("GET /api/maya/nudge error:", error);
    return NextResponse.json({ nudges: [] });
  }
}

async function cacheNudge(admin: any, userId: string, context: Record<string, unknown>, id: string, message: string, date: string, action?: { label: string; href: string }) {
  const releaseHour = 9 + Math.floor(Math.random() * 9);
  try {
    await admin
      .from("user_preferences")
      .update({ context: { ...context, maya_nudge: { id, message, date, saved: false, releaseHour, action } } })
      .eq("user_id", userId);
  } catch {
    /* best-effort */
  }
}

// ── POST — Mark nudge as saved to chat ─────────────────────────────────────────

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: prefs } = await admin
    .from("user_preferences")
    .select("context")
    .eq("user_id", user.id)
    .single();

  const context = (prefs?.context ?? {}) as Record<string, unknown>;
  const today = getLocalDate();
  const cachedNudge = context.maya_nudge as { id: string; message: string; date: string } | undefined;

  if (cachedNudge?.date === today && cachedNudge.message) {
    // Save to chat_messages
    await admin.from("chat_messages").insert({
      user_id: user.id,
      role: "assistant",
      content: cachedNudge.message,
    });

    // Mark as saved so it doesn't repeat
    await admin
      .from("user_preferences")
      .update({ context: { ...context, maya_nudge: { ...cachedNudge, saved: true } } })
      .eq("user_id", user.id);
  }

  return NextResponse.json({ success: true });
}
