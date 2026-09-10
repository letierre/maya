import { NextRequest, NextResponse } from "next/server";

// GET /api/geo — país do IP (Vercel injeta o header x-vercel-ip-country em toda request).
// Usado pelo Paywall para decidir R$ (Brasil) vs US$ (fora) com precisão por IP.
export async function GET(req: NextRequest) {
  const country = req.headers.get("x-vercel-ip-country") ?? "";
  return NextResponse.json({ country });
}
