import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Saved event searches. The filters ride as jsonb; see migration 0023. */
export type AlertFilters = Record<string, string>;

export type AlertRow = {
  id: number;
  label: string;
  filters: AlertFilters | null;
  created_at: string;
};

async function alerts() {
  const supabase = await createClient();
  return supabase.from("club_event_alerts");
}

export async function findMyAlerts(profileId: string) {
  const { data, error } = await (await alerts())
    .select("id, label, filters, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load your alerts: ${error.message}`);
  return data ?? [];
}

export async function insertAlert(profileId: string, label: string, filters: AlertFilters) {
  const { data, error } = await (await alerts())
    .insert({ profile_id: profileId, label, filters })
    .select("id, label")
    .maybeSingle();

  if (error) throw new Error(error.message);
  // RLS filtering an insert returns no row and no error — see CLAUDE.md.
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

export async function deleteAlert(id: number, profileId: string) {
  const { data, error } = await (await alerts())
    .delete()
    .eq("id", id)
    .eq("profile_id", profileId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}
