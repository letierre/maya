import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hasActiveSubscription, subscriptionRequired } from "@/lib/subscription-guard";
import { callLLM } from "@/lib/llm";
import { getLocalDate } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const userId = session.user.id;

  if (!(await hasActiveSubscription(userId))) return subscriptionRequired();

  // Get user context
  const { data: recentCI } = await admin.from("check_ins").select("mood_tags, feeling, slept_well").eq("user_id", userId).order("date", { ascending: false }).limit(2);
  const recentMoods = (recentCI || []).flatMap(c => c.mood_tags || []);
  const lastFeeling = recentCI?.[0]?.feeling || "";

  const { data: prefs } = await admin.from("user_preferences").select("context").eq("user_id", userId).maybeSingle();
  const userName = ((prefs?.context as any)?.name as string) || session.user.user_metadata?.name || "";

  // Determine mood sentiment
  const negativeSet = new Set(["triste", "ansiosa", "cansada", "sobrecarregada", "irritada", "desanimada", "estressada", "raiva", "culpada"]);
  const hasNegative = recentMoods.some(m => negativeSet.has(m));

  // Fetch candidate posts
  const categories = hasNegative ? ["vitoria", "gratidao", "dica"] : ["reflexao", "dica", "vitoria"];
  const { data: posts } = await admin.from("community_posts").select(`*, community_likes(count)`).in("category", categories).order("created_at", { ascending: false }).limit(25);

  const candidates = (posts || []).filter((p: any) => p.user_id !== userId);

  // ── Semantic scoring via Maya ──
  let scored: { id: string; display_name: string; display_emoji: string | null; category: string; content: string; like_count: number; score: number }[] = [];
  if (candidates.length > 0 && process.env.ANTHROPIC_API_KEY) {
    try {
      const moodStr = recentMoods.length > 0 ? recentMoods.join(", ") : "sem registro";
      const postList = candidates.map((p: any, i: number) => `[${i}] ${p.content.slice(0, 150)}`).join("\n");
      const llmResult = await callLLM(
        "Você é a Maya, uma curadora empática. Retorne APENAS um JSON array com os índices dos 3 posts mais relevantes para o momento do usuário. Ex: [2,5,0]. Priorize posts que mais se conectam emocionalmente com o estado atual.",
        `Momento do usuário: humor=[${moodStr}] feeling="${lastFeeling}" humorNegativo=${hasNegative}\n\nPosts:\n${postList}`,
        { maxTokens: 50, temperature: 0.5 }
      );
      const indices = JSON.parse(llmResult.match(/\[[\d,\s]+\]/)?.[0] || "[]") as number[];
      scored = candidates.map((p: any, i: number) => ({ ...p, content: p.content?.slice(0, 200) || "", like_count: p.community_likes?.[0]?.count ?? 0, score: indices.includes(i) ? 2 : 1 })).sort((a, b) => b.score - a.score).slice(0, 3);
    } catch { /* fallback to random */ }
  }

  if (scored.length === 0) {
    scored = candidates.sort(() => Math.random() - 0.5).slice(0, 3).map((p: any) => ({ ...p, content: p.content?.slice(0, 200) || "", like_count: p.community_likes?.[0]?.count ?? 0, score: 1 }));
  }

  const greeting = userName ? `${userName}` : "";
  const moodContext = hasNegative
    ? "Vi que seu humor não está dos melhores. Separei algumas coisas que a comunidade compartilhou e que talvez te façam bem."
    : "Separei algumas inspirações da comunidade que combinam com seu momento.";
  const fallbackMessage = scored.length === 0
    ? `${userName || "Ei"}, ainda não encontrei nada que combine com seu momento. Mas a comunidade está crescendo — que tal ser o primeiro a compartilhar algo hoje?`
    : undefined;

  return NextResponse.json({
    message: fallbackMessage || (greeting ? `${greeting}, ${moodContext.charAt(0).toLowerCase() + moodContext.slice(1)}` : moodContext),
    posts: scored.map(p => ({ id: p.id, display_name: p.display_name, display_emoji: p.display_emoji, category: p.category, content: p.content, like_count: p.like_count })),
  });
}

// POST /api/community/inspire — feedback: this post helped or not
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { post_id, helpful } = await req.json();
  if (!post_id || helpful === undefined) return NextResponse.json({ error: "post_id e helpful obrigatórios" }, { status: 400 });

  const admin = getSupabaseAdmin();
  await admin.from("community_post_helpful").upsert({ post_id, user_id: session.user.id, helpful }, { onConflict: "post_id,user_id" });
  return NextResponse.json({ ok: true });
}

