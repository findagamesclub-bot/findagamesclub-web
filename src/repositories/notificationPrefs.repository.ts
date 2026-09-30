import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc, table } from "@/lib/supabase/table";
import type { Family } from "@/utils/notification-families";

/**
 * Notification preferences, and the tokens that stop one email without a login.
 *
 * `src/types/database.ts` has not been regenerated since stage 3, so these go
 * through `table()` and `callRpc()` with hand-written row shapes. Swap them
 * over when the types catch up.
 */

/** What somebody has actually changed. A missing family means the default. */
export type PreferenceRow = { family: Family; bell: boolean; email: boolean };

export async function findMyPreferences(): Promise<PreferenceRow[]> {
  const prefs = await table<PreferenceRow>("notification_preferences");
  const { data, error } = await prefs.select("family, bell, email");
  if (error) throw new Error(`Failed to load your settings: ${error.message}`);
  return data ?? [];
}

export const savePreference = (family: Family, bell: boolean, email: boolean) =>
  callRpc<void>("save_notification_preference", {
    p_family: family, p_bell: bell, p_email: email,
  });

export const resolveToken = async (token: string) => {
  const rows = await callRpc<{ family: Family; already_off: boolean }[]>(
    "resolve_unsubscribe_token", { p_token: token });
  const row = rows?.[0];
  return row ? { family: row.family, alreadyOff: row.already_off } : null;
};

export const applyUnsubscribe = (token: string) =>
  callRpc<Family | null>("apply_unsubscribe", { p_token: token });

/**
 * The two reads a sender makes, as the server rather than as the reader.
 *
 * There is no session while addressing an email: the sender is a trigger's
 * consequence or a cron route, and the person being written to is never the
 * caller.
 */
function asService() {
  return createAdminClient() as unknown as {
    from(n: string): {
      select(c: string): {
        eq(col: string, v: string | boolean): PromiseLike<{
          data: { family: Family; email: boolean }[] | null;
          error: { message: string } | null;
        }>;
      };
    };
    rpc(n: string, a: Record<string, unknown>): Promise<{
      data: unknown; error: { message: string } | null }>;
  };
}

/**
 * Every preference row this person has, or null when it cannot be read.
 *
 * Null rather than an empty array, because the two mean opposite things: no
 * rows means "they have changed nothing, use the defaults", and a failed read
 * means "we do not know". Returning `[]` for both is how a broken read would
 * quietly become a decision.
 */
export async function savedPreferencesFor(
  profileId: string,
): Promise<{ family: Family; email: boolean }[] | null> {
  try {
    const { data, error } = await asService()
      .from("notification_preferences")
      .select("family, email")
      .eq("profile_id", profileId);

    if (error) {
      console.error("could not read notification preferences", { profileId, error });
      return null;
    }
    return data ?? [];
  } catch (error) {
    console.error("could not read notification preferences", { profileId, error });
    return null;
  }
}

/** The token for one family, made on first use and reused after. */
export async function unsubscribeToken(
  profileId: string, family: Family,
): Promise<string | null> {
  try {
    const { data, error } = await asService().rpc("issue_unsubscribe_token", {
      p_profile: profileId, p_family: family,
    });
    return error ? null : ((data as string | null) ?? null);
  } catch {
    return null;
  }
}
