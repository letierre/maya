import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { base64, folder } = await request.json();

    if (!base64 || !folder) {
      return NextResponse.json({ error: "base64 e folder obrigatórios" }, { status: 400 });
    }

    if (!["meals", "diary", "avatars"].includes(folder)) {
      return NextResponse.json({ error: "folder inválido" }, { status: 400 });
    }

    // Decode base64 (with or without data URI prefix)
    const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/);
    let buffer: Buffer;
    let ext: string;
    if (matches) {
      ext = matches[1] === "png" ? "png" : "jpg";
      buffer = Buffer.from(matches[2], "base64");
    } else {
      ext = "jpg";
      buffer = Buffer.from(base64, "base64");
    }

    // Sanitize extension
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      ext = "jpg";
    }

    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `${folder}/${user.id}/${fileName}`;

    const admin = getSupabaseAdmin();
    const { error: uploadError } = await admin.storage
      .from("user-content")
      .upload(path, buffer, {
        contentType: `image/${ext}`,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Erro ao fazer upload" }, { status: 500 });
    }

    return NextResponse.json({ path });
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json(
      { error: "Erro ao fazer upload", detail: String(error) },
      { status: 500 }
    );
  }
}
