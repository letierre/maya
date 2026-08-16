import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Atualiza um campo específico do check-in de hoje para um usuário.
 * Usado por endpoints (sono, refeições, agenda) para manter
 * o check-in sempre sincronizado em tempo real.
 * Se não existe check-in hoje, cria um novo com esse campo.
 */
export async function syncCheckInField(
  userId: string,
  date: string,
  field: string,
  value: boolean | number
) {
  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("check_ins")
    .select("id, answered_questions")
    .eq("user_id", userId)
    .eq("date", date)
    .limit(1)
    .single();

  if (existing) {
    // Marca o campo como "respondido" (auto-detectado por outro módulo).
    const answered = new Set<string>(
      Array.isArray(existing.answered_questions) ? existing.answered_questions : []
    );
    answered.add(field);
    await admin
      .from("check_ins")
      .update({ [field]: value, answered_questions: [...answered], updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await admin
      .from("check_ins")
      .insert({
        user_id: userId,
        date,
        [field]: value,
        answered_questions: [field],
      });
  }
}
