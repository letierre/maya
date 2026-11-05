import { NextResponse } from "next/server";

// Versão do deploy em execução no servidor (git SHA no Vercel; "local" em dev).
// O cliente (VersionGuard) compara com NEXT_PUBLIC_BUILD_VERSION para detectar
// deploy novo e recarregar o bundle antigo em cache.
export async function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA || "local";
  return NextResponse.json(
    { version },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}
