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
                 path.startsWith("avatars/") ? "avatars" :
                 path.startsWith("porques/") ? "porques" :
                 path.startsWith("chat/") ? "chat" :
                 path.startsWith("voice/") ? "voice" :
                 path.startsWith("running/") ? "running" : null;
  if (!bucket) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    const admin = getSupabaseAdmin();
    const storageBucket = "user-content";
    const { data, error } = await admin.storage
      .from(storageBucket)
      .download(path);

    if (error || !data) {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    }

    const ext = path.split(".").pop()?.toLowerCase() || "";
    const contentType =
      ext === "png" ? "image/png" :
      ext === "webp" ? "image/webp" :
      ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
      ext === "webm" ? "audio/webm" :
      ext === "mp3" ? "audio/mpeg" :
      ext === "wav" ? "audio/wav" :
      ext === "m4a" ? "audio/mp4" :
      ext === "ogg" ? "audio/ogg" :
      ext === "mp4" ? "video/mp4" :
      ext === "pdf" ? "application/pdf" :
      "image/jpeg";

    const size = data.size;
    const baseHeaders = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    };

    // Suporte real a Range requests — necessário p/ <audio>/<video> lerem a
    // duração e permitirem seek. Sem isso o navegador reporta duration como
    // Infinity/MAX_VALUE e o player quebra (barras não avançam, seek com lixo).
    const range = request.headers.get("range");
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = 0;
      let end = size - 1;
      if (m) {
        if (m[1] !== "" && m[2] !== "") {
          start = parseInt(m[1], 10);
          end = parseInt(m[2], 10);
        } else if (m[1] !== "") {
          start = parseInt(m[1], 10);
        } else if (m[2] !== "") {
          const suffix = parseInt(m[2], 10);
          start = Math.max(0, size - suffix);
        }
      }
      end = Math.min(end, size - 1);
      if (start > end || start >= size) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      const chunk = data.slice(start, end + 1);
      return new NextResponse(chunk, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(chunk.size),
        },
      });
    }

    return new NextResponse(data, {
      headers: {
        ...baseHeaders,
        "Content-Length": String(size),
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
