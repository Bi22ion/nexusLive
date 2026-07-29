import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    
    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data?.user) {
      const role = data.user.user_metadata?.user_role;

      // If they are a host/creator, force them to studio
      if (role === "host" || role === "creator") {
        return NextResponse.redirect(`${origin}/studio`);
      }
      
      // Otherwise, standard marketplace
      return NextResponse.redirect(`${origin}/`);
    }
  }

  // If it fails, go to login
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}