import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnvSafe } from "@/lib/env";

const FALLBACK_SUPABASE_URL = "https://placeholder.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "build-time-placeholder-anon-key";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = getPublicEnvSafe();
  const isConfigured = Boolean(env);

  if (!isConfigured) {
    console.warn(
      "[Supabase] Server client is using a safe build-time fallback because NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not configured."
    );
  }

  return createServerClient(
    env?.NEXT_PUBLIC_SUPABASE_URL ?? FALLBACK_SUPABASE_URL,
    env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_SUPABASE_ANON_KEY,
    {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Safe to ignore in Server Components
        }
      },
    },
  });
}
