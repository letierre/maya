import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSubscriptionActive } from "@/lib/subscription-status";

// Rotas de API que NÃO exigem assinatura ativa: onboarding, infra e rotas com auth própria.
// Tudo o que não está aqui fica protegido (403 se o usuário não tiver trial/assinatura ativa).
const API_ALLOW = [
  "/api/subscription",
  "/api/stripe",
  "/api/preferences",
  "/api/check-ins",
  "/api/push",
  "/api/profile",
  "/api/upload",
  "/api/media",
  "/api/admin",
  "/api/cron",
];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update request cookies so getUser() can read them
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Create fresh response with updated request
          supabaseResponse = NextResponse.next({ request });
          // Set cookies on response for the browser
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // Landing e callback de autenticação sempre liberados (sem custo de rede)
  if (pathname === "/" || pathname.startsWith("/auth/")) {
    return supabaseResponse;
  }

  // getUser valida o token e renova automaticamente quando só o access token expirou
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── API: gate de assinatura (defesa em profundidade) ──
  if (isApi) {
    // Rotas sem exigência de assinatura (onboarding, webhook/cron, etc.)
    if (API_ALLOW.some((p) => pathname.startsWith(p))) {
      return supabaseResponse;
    }
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, trial_ends_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!isSubscriptionActive(sub?.status ?? null, sub?.trial_ends_at ?? null)) {
      return NextResponse.json({ error: "Assinatura necessária" }, { status: 403 });
    }
    return supabaseResponse;
  }

  // ── Páginas ──

  const isAuthPage = pathname === "/login" || pathname === "/cadastro";

  // Logado tentando acessar login/cadastro → manda pro dashboard
  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Não logado acessando rota protegida → login, com redirect de volta
  if (!isAuthPage && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Roda em tudo exceto estáticos. Inclui /api (gate de assinatura).
  matcher: [
    "/((?!_next|favicon.ico|.*\\..*).*)",
  ],
};
