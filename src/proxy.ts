import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  // Landing e callback de autenticação sempre liberados (sem custo de rede)
  if (pathname === "/" || pathname.startsWith("/auth/")) {
    return supabaseResponse;
  }

  // getUser valida o token e renova automaticamente quando só o access token expirou
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  // Não roda em /api (autenticação própria) nem em arquivos estáticos (caminhos com extensão)
  matcher: [
    "/((?!api|_next|favicon.ico|.*\\..*).*)",
  ],
};
