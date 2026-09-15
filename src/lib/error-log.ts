import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface ErrorLog {
  path?: string;
  message: string;
  status?: number;
  userId?: string;
  meta?: Record<string, unknown>;
}

/** Registro fire-and-forget de erros de API — nunca derruba o fluxo principal. */
export function logError(err: ErrorLog): void {
  void (async () => {
    try {
      await getSupabaseAdmin().from("error_logs").insert({
        path: err.path ?? null,
        message: String(err.message ?? "").slice(0, 500),
        status: err.status ?? null,
        meta: {
          ...(err.meta ?? {}),
          ...(err.userId ? { user_id: err.userId } : {}),
        },
      });
    } catch {
      /* best-effort: se o log falhar, não interfere no fluxo */
    }
  })();
}
