import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

type Client = ReturnType<typeof createBrowserClient<Database>>;

let shared: Client | null = null;

/**
 * Browser client. Publishable key only — the service role key must never
 * appear in client code.
 *
 * One instance per tab, deliberately: every realtime channel opened through it
 * shares a single websocket. Two callers each building their own client is two
 * sockets, two auth handshakes and two reconnect timers for the same session.
 */
export function createClient(): Client {
  shared ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  return shared;
}
