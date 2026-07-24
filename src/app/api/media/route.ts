import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "path obrigatório" }, { status: 400 });
  }

  // Security: only allow paths for this user's content
  const bucket = path.startsWith("meals/") ? "meals" :
                 path.startsWith("diary/") ? "diary" :
                 path.startsWith("avatars/") ? "avatars" : null;
  if (!bucket) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    const admin = getSupabaseAdmin();
    const storageBucket = path.startsWith("meals/") ? "user-content" :
                           path.startsWith("diary/") ? "user-content" :
                           "avatars";
    const { data, error } = await admin.storage
      .from(storageBucket)
      .download(path);

    if (error || !data) {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    }

    const ext = path.split(".").pop();
    const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("GET /api/media error:", error);
    return NextResponse.json(
      { error: "Erro ao servir arquivo" },
      { status: 500 }
    );
  }
}
