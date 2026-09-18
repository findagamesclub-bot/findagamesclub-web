import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * A client with no session attached.
 *
 * For reads that are the same for every visitor and are meant to be cached.
 * The ordinary server client reads cookies to attach the session, and Next
 * refuses `cookies()` inside `unstable_cache`: anything dynamic inside a cache
 * scope would mean one person's data cached for everybody. So a read that
 * genuinely has no reader uses this instead.
 *
 * Not the admin client. This one is the public key and RLS still applies, so a
 * row has to be readable by `anon` to come back at all. Reaching for the
 * service role to make a caching problem go away is how a public page ends up
 * able to read everything.
 */
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
