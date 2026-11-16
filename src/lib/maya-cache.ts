import { getSupabaseAdmin } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof getSupabaseAdmin>;

/**
 * Apaga chaves do `user_preferences.context` que funcionam como cache da Maya
 * (ex.: `maya_home_message`, `maya_nudge`), forçando a próxima montagem a
 * regenerar a fala com o contexto fresco. Best-effort: nunca lança — o fluxo
 * de quem chama não pode quebrar por causa de cache.
 */
export async function invalidateMayaContextKeys(
  admin: AdminClient,
  userId: string,
  keys: string[],
): Promise<void> {
  try {
    const { data } = await admin
      .from("user_preferences")
      .select("context")
      .eq("user_id", userId)
      .single();
    if (!data) return;

    const context = { ...(data.context as Record<string, unknown>) };
    let changed = false;
    for (const key of keys) {
      if (key in context) {
        delete context[key];
        changed = true;
      }
    }
    if (!changed) return;

    await admin.from("user_preferences").update({ context }).eq("user_id", userId);
  } catch {
    /* best-effort */
  }
}

/**
 * Invalida só a fala da home da Maya (`maya_home_message`).
 */
export async function invalidateMayaHomeMessage(
  admin: AdminClient,
  userId: string,
): Promise<void> {
  await invalidateMayaContextKeys(admin, userId, ["maya_home_message"]);
}
