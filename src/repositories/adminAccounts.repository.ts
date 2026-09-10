import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Accounts, for the admin console.
 *
 * Reads go through definer functions rather than through policies, because an
 * account's email lives in auth.users and no policy can reach it. Each one
 * checks is_admin() itself, so a member calling them directly gets nothing.
 */

export type AccountRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  clubs_owned: number;
  memberships: number;
  /** What they run, already worded: "Owner of Didcot Wargames". Empty for most. */
  team_roles: string | null;
  total_count: number;
};

export type AccountDetailRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

export type AccountActionRow = {
  id: number;
  action: string;
  reason: string;
  actor_name: string;
  created_at: string;
};

type Rpc = {
  rpc(n: string, a?: Record<string, unknown>): Promise<{
    data: unknown; error: { message: string } | null;
  }>;
};

async function callRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as Rpc).rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const findAccounts = (query: string, status: string, limit: number, offset: number) =>
  callRpc<AccountRow[]>("admin_find_accounts",
    { p_query: query, p_status: status, p_limit: limit, p_offset: offset });

export const findAccount = (profileId: string) =>
  callRpc<AccountDetailRow[]>("admin_account_detail", { p_profile: profileId })
    .then((rows) => rows[0] ?? null);

export const setAccountActive = (profileId: string, active: boolean, reason: string) =>
  callRpc<string>("admin_set_account_active",
    { p_profile: profileId, p_active: active, p_reason: reason });

export const setAccountRole = (profileId: string, role: string) =>
  callRpc<string>("admin_set_account_role", { p_profile: profileId, p_role: role });

export async function findAccountActions(profileId: string): Promise<AccountActionRow[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    from(n: string): {
      select(c: string): {
        eq(col: string, v: string): {
          order(col: string, o: { ascending: boolean }): Promise<{
            data: AccountActionRow[] | null; error: { message: string } | null;
          }>;
        };
      };
    };
  })
    .from("account_actions")
    .select("id, action, reason, actor_name, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load the account's history: ${error.message}`);
  return data ?? [];
}

/**
 * The second half of a suspension.
 *
 * The database gate stops the writes, but a session that is still inside its
 * access token's lifetime carries a valid JWT until it expires. Banning the
 * auth user refuses the next sign-in and the next refresh; signing them out
 * globally revokes what they are holding now.
 *
 * Called only after the guarded RPC above has already returned, so this can
 * never run for somebody the database refused.
 */
export async function banAuthUser(userId: string, banned: boolean) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: banned ? "876000h" : "none",
  });
  if (error) throw new Error(error.message);

  if (banned) await admin.auth.admin.signOut(userId, "global");
}

/**
 * The figures on the admin overview.
 *
 * Head-only counts, so none of them pulls a row across. Clubs and profiles are
 * readable by policy; the suspended count comes from the same admin function
 * the list uses, which is the only thing here that needs the gate.
 */
export async function countSite() {
  const supabase = await createClient();
  const [clubs, live, members] = await Promise.all([
    supabase.from("clubs").select("id", { count: "exact", head: true }),
    supabase.from("clubs").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  return {
    clubs: clubs.count ?? 0,
    liveClubs: live.count ?? 0,
    members: members.count ?? 0,
  };
}
