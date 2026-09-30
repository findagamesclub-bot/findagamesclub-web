import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * What the scheduled jobs read, as the service role.
 *
 * There is no session in a cron route, and none of these are readable by a
 * member: `last_sent_at` belongs to the job rather than to the person who saved
 * the search, and the delivery ledger is nobody's business but the job's.
 */

export type DueAlert = {
  id: number;
  profile_id: string;
  label: string;
  filters: Record<string, string> | null;
  since: string;
};

export type DueMembership = {
  membership_id: number;
  profile_id: string;
  club_slug: string;
  club_name: string;
  tier_key: string | null;
  ends_at: string;
};

function asService() {
  return createAdminClient() as unknown as {
    rpc(n: string, a: Record<string, unknown>): Promise<{
      data: unknown; error: { message: string } | null }>;
  };
}

async function call<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await asService().rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data as T;
}

export const findDueAlerts = (limit = 200) =>
  call<DueAlert[]>("event_alerts_due", { p_limit: limit });

export const markAlertsSent = (ids: number[]) =>
  ids.length ? call<number>("mark_event_alerts_sent", { p_ids: ids }) : Promise.resolve(0);

/** True the first time only, so a job that runs twice writes once. */
export const claimDelivery = (profileId: string, kind: string, key: string) =>
  call<boolean>("record_delivery", { p_profile: profileId, p_kind: kind, p_key: key });

export const findExpiringMemberships = (within = "7 days") =>
  call<DueMembership[]>("memberships_expiring", { p_within: within });

export const findLapsedMemberships = (since = "25 hours") =>
  call<DueMembership[]>("memberships_lapsed", { p_since: since });
