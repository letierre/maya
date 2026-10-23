import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code       = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type       = searchParams.get("type") ?? "signup";

  const supabase = await createServerSupabaseClient();

  // PKCE flow (OAuth / newer Supabase versions)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  // OTP / magic-link flow (email confirmation in many Supabase configs)
  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as Parameters<typeof supabase.auth.verifyOtp>[0]["type"],
    });
    if (!error) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  // Already has a session (e.g. navigated here directly)
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  // Nothing worked — send back to login
  return NextResponse.redirect(`${origin}/login`);
}
