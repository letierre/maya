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
    .select("id")
    .eq("user_id", userId)
    .eq("date", date)
    .limit(1)
    .single();

  if (existing) {
    await admin
      .from("check_ins")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await admin
      .from("check_ins")
      .insert({
        user_id: userId,
        date,
        [field]: value,
      });
  }
}
