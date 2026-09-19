import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnvSafe } from "@/lib/env";

const FALLBACK_SUPABASE_URL = "https://placeholder.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "build-time-placeholder-anon-key";

export function createSupabaseBrowserClient() {
  const env = getPublicEnvSafe();

  if (!env) {
    console.warn(
      "[Supabase] Browser client is using a safe build-time fallback because NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not configured."
    );
  }

  return createBrowserClient(
    env?.NEXT_PUBLIC_SUPABASE_URL ?? FALLBACK_SUPABASE_URL,
    env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_SUPABASE_ANON_KEY
  );
}

