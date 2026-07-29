import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnvSafe } from "@/lib/env";

export function createSupabaseBrowserClient() {
  const env = getPublicEnvSafe();
  if (!env) return null;
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

