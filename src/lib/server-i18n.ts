import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { t as tFn, type Lang } from "@/lib/i18n";

/**
 * Traduz uma chave no idioma do usuário (fallback pt). Uso server-side
 * (cron, rotas de API) onde não há `useTranslation` do cliente.
 */
export function tUser(lang: Lang | string | null | undefined, key: string, vars?: Record<string, string>): string {
  return tFn((lang as Lang) || "pt", key, vars);
}

/** Busca o idioma (pt/es/en) de vários usuários a partir de user_preferences.context.language. */
export async function getLanguagesByUser(userIds: string[]): Promise<Map<string, Lang>> {
  const map = new Map<string, Lang>();
  if (userIds.length === 0) return map;

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("user_preferences")
    .select("user_id, context")
    .in("user_id", userIds);

  for (const p of data ?? []) {
    const lang = (p.context as { language?: string } | undefined)?.language;
    if (lang === "es" || lang === "en" || lang === "pt") map.set(p.user_id, lang as Lang);
  }
  return map;
}
