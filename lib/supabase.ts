import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { Profile } from "./types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** In a server component or route handler. Carries the signed-in user, so RLS applies. */
export function serverClient() {
  const store = cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server components get read-only cookies; the middleware refreshes the session.
        }
      },
    },
  });
}

/**
 * The service role. Bypasses every policy in the database, so it is used for
 * exactly three things: inviting a user, writing AI feedback, and the nightly
 * purge. The "server-only" import at the top of this file makes the build fail
 * if it is ever pulled into a client component.
 */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** The signed-in user's profile, or null. The one place roles are read. */
export async function currentProfile(): Promise<Profile | null> {
  const supabase = serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, active")
    .eq("id", user.id)
    .single();

  if (!data || !data.active) return null;
  return data as Profile;
}

export { homeFor } from "./types";
export type { Profile, Role } from "./types";
