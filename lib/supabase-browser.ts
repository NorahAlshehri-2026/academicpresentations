import { createBrowserClient } from "@supabase/ssr";

/** In the browser. Carries the signed-in user, so every query is bound by RLS. */
export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
